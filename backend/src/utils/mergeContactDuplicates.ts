/**
 * Script para mesclar contatos duplicados causados por JIDs @lid
 * e aplicar tags automáticas da conexão aos contatos existentes
 * 
 * Este script:
 * 1. Identifica contatos duplicados (mesmo nome, números diferentes)
 * 2. Mescla os tickets/mensagens para o contato principal (com número real)
 * 3. Aplica tags automáticas configuradas nas conexões aos contatos
 * 
 * Uso: npx ts-node src/utils/mergeContactDuplicates.ts [companyId] [--dry-run] [--apply-tags-only]
 * 
 * --dry-run: Apenas mostra o que seria feito, sem executar
 * --apply-tags-only: Apenas aplica tags automáticas, sem mesclar duplicatas
 */

import "../bootstrap";
import sequelize from "../database";
import Contact from "../models/Contact";
import Ticket from "../models/Ticket";
import Message from "../models/Message";
import ContactTag from "../models/ContactTag";
import Whatsapp from "../models/Whatsapp";
import Tag from "../models/Tag";
import { Op, Sequelize } from "sequelize";

interface DuplicateGroup {
  name: string;
  contacts: Contact[];
  primaryContact: Contact;
  duplicateContacts: Contact[];
}

const isLidNumber = (number: string): boolean => {
  if (!number) return false;
  // LIDs geralmente são números muito longos (>15 dígitos) ou não seguem padrão de telefone
  const digits = number.replace(/\D/g, "");
  // Números reais brasileiros: 12-13 dígitos (55 + DDD + número)
  // LIDs: geralmente 14+ dígitos ou padrões estranhos
  return digits.length > 15 || (digits.length > 13 && !digits.startsWith("55"));
};

const digitsFromJid = (jid: string): string => {
  if (!jid) return "";
  const left = jid.includes("@") ? jid.split("@")[0] : jid;
  return left.replace(/\D/g, "");
};

const isRealPhoneNumber = (number: string): boolean => {
  if (!number) return false;
  const digits = number.replace(/\D/g, "");
  // Se o padrão é de LID, nunca considerar como número real
  if (isLidNumber(digits)) return false;
  // Número real brasileiro: 12-13 dígitos começando com 55
  if (digits.startsWith("55") && digits.length >= 12 && digits.length <= 13) {
    return true;
  }
  // Número internacional: 10-15 dígitos
  if (digits.length >= 10 && digits.length <= 15) {
    return true;
  }
  return false;
};

const findPrimaryContactFromMessages = async (
  companyId: number,
  possibleLidContact: Contact
): Promise<Contact | null> => {
  // Heurística: se em alguma mensagem desse contato o remoteJid for @s.whatsapp.net,
  // dá pra extrair o número real e encontrar o contato correto.
  const msgs = await Message.findAll({
    where: {
      companyId,
      contactId: possibleLidContact.id,
      remoteJid: { [Op.iLike]: "%@s.whatsapp.net" }
    },
    attributes: ["remoteJid"],
    order: [["createdAt", "DESC"]],
    limit: 30
  });

  for (const m of msgs) {
    const digits = digitsFromJid((m as any).remoteJid);
    if (!digits) continue;
    if (!isRealPhoneNumber(digits)) continue;

    const candidate = await Contact.findOne({
      where: {
        companyId,
        isGroup: false,
        id: { [Op.ne]: possibleLidContact.id },
        [Op.or]: [{ number: digits }, { canonicalNumber: digits }]
      }
    });
    if (candidate) return candidate;
  }

  return null;
};

const findDuplicateGroups = async (companyId: number): Promise<DuplicateGroup[]> => {
  console.log(`\n🔍 Buscando contatos duplicados para empresa ${companyId}...`);

  // Buscar todos os contatos não-grupo da empresa
  const contacts = await Contact.findAll({
    where: {
      companyId,
      isGroup: false
    },
    order: [["name", "ASC"], ["createdAt", "ASC"]]
  });

  console.log(`   Total de contatos: ${contacts.length}`);

  // Agrupar por nome (case-insensitive, trim)
  const byName = new Map<string, Contact[]>();
  for (const contact of contacts) {
    const normalizedName = (contact.name || "").trim().toLowerCase();
    if (!normalizedName) continue;
    
    if (!byName.has(normalizedName)) {
      byName.set(normalizedName, []);
    }
    byName.get(normalizedName)!.push(contact);
  }

  // Filtrar apenas grupos com mais de 1 contato
  const duplicateGroups: DuplicateGroup[] = [];
  
  for (const [name, groupContacts] of byName.entries()) {
    if (groupContacts.length <= 1) continue;

    // Identificar o contato principal (com número real) e os duplicados (com LID)
    const withRealNumber = groupContacts.filter(c => isRealPhoneNumber(c.number));
    const withLidNumber = groupContacts.filter(c => isLidNumber(c.number));

    if (withRealNumber.length === 0 || withLidNumber.length === 0) {
      // Não é um caso de duplicata LID vs número real
      continue;
    }

    // O contato principal é o mais antigo com número real
    const primaryContact = withRealNumber.sort((a, b) => 
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )[0];

    // Todos os outros são duplicados
    const duplicateContacts = groupContacts.filter(c => c.id !== primaryContact.id);

    duplicateGroups.push({
      name: groupContacts[0].name,
      contacts: groupContacts,
      primaryContact,
      duplicateContacts
    });
  }

  console.log(`   Grupos de duplicatas encontrados: ${duplicateGroups.length}`);
  return duplicateGroups;
};

const mergeContacts = async (
  primaryContact: Contact,
  duplicateContact: Contact,
  dryRun: boolean
): Promise<{ tickets: number; messages: number; tags: number; wallets: number }> => {
  const stats = { tickets: 0, messages: 0, tags: 0, wallets: 0 };

  // 1. Mover tickets do duplicado para o principal
  const tickets = await Ticket.findAll({
    where: { contactId: duplicateContact.id }
  });
  stats.tickets = tickets.length;

  if (!dryRun && tickets.length > 0) {
    await Ticket.update(
      { contactId: primaryContact.id },
      { where: { contactId: duplicateContact.id } }
    );
  }

  // 2. Mover mensagens do duplicado para o principal
  const messages = await Message.findAll({
    where: { contactId: duplicateContact.id }
  });
  stats.messages = messages.length;

  if (!dryRun && messages.length > 0) {
    await Message.update(
      { contactId: primaryContact.id },
      { where: { contactId: duplicateContact.id } }
    );
  }

  // 3. Mover tags do duplicado para o principal (evitando duplicatas)
  const duplicateTags = await ContactTag.findAll({
    where: { contactId: duplicateContact.id }
  });
  
  for (const tag of duplicateTags) {
    const existsInPrimary = await ContactTag.findOne({
      where: { contactId: primaryContact.id, tagId: tag.tagId }
    });
    
    if (!existsInPrimary) {
      stats.tags++;
      if (!dryRun) {
        await ContactTag.update(
          { contactId: primaryContact.id },
          { where: { id: tag.id } }
        );
      }
    } else if (!dryRun) {
      // Se já existe no principal, apenas deletar a duplicata
      await tag.destroy();
    }
  }

  // 4. Carteiras agora são representadas por tags pessoais (#) - não há mais tabela ContactWallet
  // As tags já são movidas no passo 3 acima

  // 5. Deletar o contato duplicado
  if (!dryRun) {
    await duplicateContact.destroy();
  }

  return stats;
};

/**
 * Aplica tags automáticas das conexões aos contatos que têm tickets abertos
 * ou que foram importados por aquela conexão
 */
const applyAutoTagsFromConnections = async (
  companyId: number,
  dryRun: boolean
): Promise<{ contactsUpdated: number; tagsApplied: number }> => {
  console.log(`\n🏷️  Buscando conexões com tags automáticas configuradas...`);

  // Buscar todas as conexões da empresa que têm contactTagId configurado
  const whatsapps = await Whatsapp.findAll({
    where: {
      companyId,
      contactTagId: { [Op.ne]: null }
    },
    attributes: ["id", "name", "contactTagId"]
  });

  if (whatsapps.length === 0) {
    console.log("   Nenhuma conexão com tag automática configurada.");
    return { contactsUpdated: 0, tagsApplied: 0 };
  }

  console.log(`   Encontradas ${whatsapps.length} conexão(ões) com tags automáticas.`);

  let totalContactsUpdated = 0;
  let totalTagsApplied = 0;

  for (const whatsapp of whatsapps) {
    const tagId = Number((whatsapp as any).contactTagId);
    if (!tagId || Number.isNaN(tagId)) continue;

    // Verificar se a tag existe
    const tag = await Tag.findOne({
      where: { id: tagId, companyId },
      attributes: ["id", "name"]
    });

    if (!tag) {
      console.log(`   ⚠️  Tag ID=${tagId} não encontrada para conexão "${whatsapp.name}"`);
      continue;
    }

    console.log(`\n   📱 Conexão: "${whatsapp.name}" → Tag: "${tag.name}"`);

    // Buscar contatos que têm tickets nesta conexão (abertos ou não)
    const ticketsWithContacts = await Ticket.findAll({
      where: {
        whatsappId: whatsapp.id,
        companyId
      },
      attributes: ["contactId"],
      group: ["contactId"],
      raw: true
    });

    const contactIds = ticketsWithContacts.map((t: any) => t.contactId).filter(Boolean);
    
    if (contactIds.length === 0) {
      console.log(`      Nenhum contato encontrado com tickets nesta conexão.`);
      continue;
    }

    console.log(`      Encontrados ${contactIds.length} contato(s) com tickets nesta conexão.`);

    // Buscar contatos que ainda não têm esta tag
    const contactsWithoutTag = await Contact.findAll({
      where: {
        id: { [Op.in]: contactIds },
        companyId,
        isGroup: false
      },
      attributes: ["id", "name", "number"]
    });

    let tagsAppliedForConnection = 0;

    for (const contact of contactsWithoutTag) {
      // Verificar se já tem a tag
      const existingTag = await ContactTag.findOne({
        where: { contactId: contact.id, tagId: tag.id }
      });

      if (!existingTag) {
        if (!dryRun) {
          await ContactTag.create({
            contactId: contact.id,
            tagId: tag.id
          });
        }
        tagsAppliedForConnection++;
        console.log(`      ✅ ${dryRun ? "[DRY-RUN] " : ""}Tag aplicada ao contato: ${contact.name} (${contact.number})`);
      }
    }

    if (tagsAppliedForConnection > 0) {
      totalContactsUpdated += tagsAppliedForConnection;
      totalTagsApplied += tagsAppliedForConnection;
      console.log(`      → ${tagsAppliedForConnection} tag(s) ${dryRun ? "a serem aplicadas" : "aplicadas"}`);
    } else {
      console.log(`      → Todos os contatos já possuem a tag.`);
    }
  }

  return { contactsUpdated: totalContactsUpdated, tagsApplied: totalTagsApplied };
};

const main = async () => {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const applyTagsOnly = args.includes("--apply-tags-only");
  const companyIdArg = args.find(a => !a.startsWith("--"));
  
  if (!companyIdArg) {
    console.log("\n❌ Uso: npx ts-node src/utils/mergeContactDuplicates.ts [companyId] [--dry-run] [--apply-tags-only]");
    console.log("   --dry-run: Apenas mostra o que seria feito, sem executar");
    console.log("   --apply-tags-only: Apenas aplica tags automáticas, sem mesclar duplicatas");
    console.log("\n   Exemplos:");
    console.log("   npx ts-node src/utils/mergeContactDuplicates.ts 1 --dry-run");
    console.log("   npx ts-node src/utils/mergeContactDuplicates.ts 1 --apply-tags-only");
    console.log("   npx ts-node src/utils/mergeContactDuplicates.ts 1");
    process.exit(1);
  }

  const companyId = parseInt(companyIdArg, 10);
  if (isNaN(companyId)) {
    console.log("\n❌ companyId deve ser um número");
    process.exit(1);
  }

  // Garante que o Sequelize foi inicializado e que os models foram registrados
  // (evita ModelNotInitializedError ao rodar via ts-node)
  try {
    await sequelize.authenticate();
  } catch (err) {
    console.error("\n❌ Falha ao conectar no banco (Sequelize.authenticate)", err);
    process.exit(1);
  }

  console.log("\n" + "=".repeat(60));
  console.log("🔄 SCRIPT DE MESCLAGEM E APLICAÇÃO DE TAGS");
  console.log("=".repeat(60));
  
  if (dryRun) {
    console.log("⚠️  MODO DRY-RUN: Nenhuma alteração será feita");
  } else {
    console.log("⚠️  MODO EXECUÇÃO: Alterações serão aplicadas!");
  }

  if (applyTagsOnly) {
    console.log("📌 MODO: Apenas aplicação de tags automáticas");
  }

  try {
    let totalStats = { tickets: 0, messages: 0, tags: 0, wallets: 0, contacts: 0, tagsApplied: 0 };
    const mergedContactIds = new Set<number>();

    // PARTE 1: Mesclar duplicatas (se não for --apply-tags-only)
    if (!applyTagsOnly) {
      const duplicateGroups = await findDuplicateGroups(companyId);

      if (duplicateGroups.length === 0) {
        console.log("\n✅ Nenhuma duplicata encontrada!");
      } else {
        console.log("\n" + "-".repeat(60));
        console.log("📋 DUPLICATAS ENCONTRADAS:");
        console.log("-".repeat(60));

        for (const group of duplicateGroups) {
          console.log(`\n👤 Nome: "${group.name}"`);
          console.log(`   ✅ Principal: ID=${group.primaryContact.id}, Número=${group.primaryContact.number}`);
          
          for (const dup of group.duplicateContacts) {
            console.log(`   ❌ Duplicado: ID=${dup.id}, Número=${dup.number}`);
            
            const stats = await mergeContacts(group.primaryContact, dup, dryRun);

            mergedContactIds.add(dup.id);
            
            console.log(`      → Tickets: ${stats.tickets}, Mensagens: ${stats.messages}, Tags: ${stats.tags}, Wallets: ${stats.wallets}`);
            
            totalStats.tickets += stats.tickets;
            totalStats.messages += stats.messages;
            totalStats.tags += stats.tags;
            totalStats.wallets += stats.wallets;
            totalStats.contacts++;
          }
        }
      }

      // Segunda passada: LIDs/nomes numéricos que não casam por nome
      // (ex.: contato criado com nome=número por falta de pushName)
      const possibleLidContacts = await Contact.findAll({
        where: {
          companyId,
          isGroup: false
        },
        attributes: ["id", "name", "number", "remoteJid", "createdAt"]
      });

      for (const c of possibleLidContacts) {
        if (mergedContactIds.has(c.id)) continue;

        const numDigits = (c.number || "").replace(/\D/g, "");
        const nameDigits = (c.name || "").replace(/\D/g, "");
        const remote = (c as any).remoteJid || "";
        const looksLikeLid =
          isLidNumber(numDigits) ||
          remote.includes("@lid") ||
          (nameDigits && nameDigits === (c.name || "") && isLidNumber(nameDigits));

        if (!looksLikeLid) continue;

        const primary = await findPrimaryContactFromMessages(companyId, c);
        if (!primary) continue;

        console.log(`\n🔁 Mesclando por mensagens (LID → número real):`);
        console.log(`   ✅ Principal: ID=${primary.id}, Número=${primary.number}, Nome=${primary.name}`);
        console.log(`   ❌ Duplicado: ID=${c.id}, Número=${c.number}, Nome=${c.name}`);

        const stats = await mergeContacts(primary, c, dryRun);
        mergedContactIds.add(c.id);
        console.log(
          `      → Tickets: ${stats.tickets}, Mensagens: ${stats.messages}, Tags: ${stats.tags}, Wallets: ${stats.wallets}`
        );
        totalStats.tickets += stats.tickets;
        totalStats.messages += stats.messages;
        totalStats.tags += stats.tags;
        totalStats.wallets += stats.wallets;
        totalStats.contacts++;
      }
    }

    // PARTE 2: Aplicar tags automáticas das conexões
    console.log("\n" + "-".repeat(60));
    console.log("🏷️  APLICAÇÃO DE TAGS AUTOMÁTICAS:");
    console.log("-".repeat(60));

    const tagStats = await applyAutoTagsFromConnections(companyId, dryRun);
    totalStats.tagsApplied = tagStats.tagsApplied;

    // RESUMO FINAL
    console.log("\n" + "=".repeat(60));
    console.log("📊 RESUMO FINAL:");
    console.log("=".repeat(60));
    
    if (!applyTagsOnly) {
      console.log(`   Contatos duplicados ${dryRun ? "a serem removidos" : "removidos"}: ${totalStats.contacts}`);
      console.log(`   Tickets ${dryRun ? "a serem movidos" : "movidos"}: ${totalStats.tickets}`);
      console.log(`   Mensagens ${dryRun ? "a serem movidas" : "movidas"}: ${totalStats.messages}`);
      console.log(`   Tags de duplicatas ${dryRun ? "a serem movidas" : "movidas"}: ${totalStats.tags}`);
      console.log(`   Wallets ${dryRun ? "a serem movidas" : "movidas"}: ${totalStats.wallets}`);
    }
    
    console.log(`   Tags automáticas ${dryRun ? "a serem aplicadas" : "aplicadas"}: ${totalStats.tagsApplied}`);

    if (dryRun) {
      console.log("\n💡 Execute sem --dry-run para aplicar as alterações.");
    } else {
      console.log("\n✅ Execução concluída com sucesso!");
    }

  } catch (error) {
    console.error("\n❌ Erro durante a execução:", error);
    process.exit(1);
  }

  process.exit(0);
};

main();
