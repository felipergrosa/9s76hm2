import { WASocket } from "@whiskeysockets/baileys";
import Contact from "../../models/Contact";
import LidMapping from "../../models/LidMapping";
import logger from "../../utils/logger";
import { safeNormalizePhoneNumber } from "../../utils/phone";
import { ExtractedIdentifiers } from "./extractMessageIdentifiers";
import { Op } from "sequelize";
import CreateOrUpdateContactService from "../ContactServices/CreateOrUpdateContactService";

/**
 * CAMADA 3: CRIAÇÃO (só quando resolução retorna null)
 *
 * Regras:
 *   A. Se temos pnJid (sabemos o número real):
 *      → Criar com number = normalize(pnJid), lidJid = ids.lidJid
 *
 *   B. Se SÓ temos lidJid (não sabemos o número):
 *      → Consultar LidMapping uma vez mais
 *      → Se encontrou PN: criar com number = PN
 *      → Se NÃO encontrou: criar contato PENDENTE (number = "PENDING_<lidJid>")
 *
 *   C. Se é grupo:
 *      → Criar com number = groupJid (sem mudança)
 */

type Session = WASocket & { id?: number; store?: any };

export async function createContact(
  ids: ExtractedIdentifiers,
  companyId: number,
  wbot: Session,
  /** PN descoberto via LidMapping na camada de resolução */
  pnFromMapping: string | null
): Promise<Contact> {
  // ─────────────────────────────────────────────────
  // CASO C: Grupo
  // ─────────────────────────────────────────────────
  if (ids.isGroup && ids.groupJid) {
    const groupNumber = ids.groupJid.includes("@g.us")
      ? ids.groupJid
      : `${ids.groupJid}@g.us`;

    logger.info({
      groupJid: ids.groupJid,
      companyId
    }, "[createContact] Criando contato de grupo");

    const contact = await CreateOrUpdateContactService({
      name: ids.pushName || groupNumber,
      number: groupNumber,
      isGroup: true,
      companyId,
      remoteJid: ids.groupJid,
      whatsappId: wbot.id,
      wbot
    });

    return contact;
  }

  // ─────────────────────────────────────────────────
  // CASO A: Temos PN (número real conhecido)
  // ─────────────────────────────────────────────────
  let phoneNumber: string | null = ids.pnCanonical || ids.pnDigits;

  // Se não veio dos identificadores, usar pnFromMapping (camada 2)
  if (!phoneNumber && pnFromMapping) {
    phoneNumber = pnFromMapping;
  }

  // Última tentativa: consultar LidMapping
  if (!phoneNumber && ids.lidJid) {
    try {
      const mapping = await LidMapping.findOne({
        where: { lid: ids.lidJid, companyId }
      });
      if (mapping?.phoneNumber) {
        phoneNumber = mapping.phoneNumber;
        logger.info({
          lidJid: ids.lidJid,
          phoneNumber
        }, "[createContact] PN obtido via LidMapping");
      }
    } catch (err: any) {
      logger.warn({ err: err?.message }, "[createContact] Erro ao consultar LidMapping");
    }
  }

  if (phoneNumber) {
    // Normalizar
    const { canonical } = safeNormalizePhoneNumber(phoneNumber);
    const number = canonical || phoneNumber;

    // Validar comprimento (BR: 12-13 dígitos com DDI)
    const digits = number.replace(/\D/g, "");
    if (digits.length < 10 || digits.length > 20) {
      logger.error({
        number,
        digits,
        length: digits.length,
        companyId
      }, "[createContact] BLOQUEADO: Número com comprimento inválido");
      // Tratar como caso B (sem PN válido)
      return createPendingContact(ids, companyId, wbot);
    }

    logger.info({
      number,
      lidJid: ids.lidJid,
      pushName: ids.pushName,
      companyId
    }, "[createContact] Criando contato com número real");

    const remoteJid = `${digits}@s.whatsapp.net`;

    const contact = await CreateOrUpdateContactService({
      name: ids.pushName || digits,
      number: digits,
      isGroup: false,
      companyId,
      remoteJid,
      whatsappId: wbot.id,
      wbot
    });

    // Preencher lidJid se conhecido
    if (contact && ids.lidJid && !contact.lidJid) {
      try {
        await contact.update({ lidJid: ids.lidJid });
      } catch (err: any) {
        // Constraint unique pode falhar se outro contato já tem esse LID
        logger.warn({ err: err?.message, lidJid: ids.lidJid }, "[createContact] Falha ao preencher lidJid");
      }
    }

    // Salvar mapeamento LID → PN no LidMappings
    if (ids.lidJid && digits) {
      try {
        await LidMapping.upsert({
          lid: ids.lidJid,
          phoneNumber: digits,
          companyId,
          whatsappId: wbot.id,
          verified: true
        });
      } catch (err: any) {
        logger.warn({ err: err?.message }, "[createContact] Falha ao salvar LidMapping");
      }
    }

    return contact;
  }

  // ─────────────────────────────────────────────────
  // CASO B: Só temos LID (sem número real)
  // ─────────────────────────────────────────────────
  return createPendingContact(ids, companyId, wbot);
}

/**
 * Cria contato LID temporário (sem número real conhecido).
 * 
 * Regras (simplificação lidJid):
 *   - `remoteJid` = LID completo (identificador primário de busca)
 *   - `lidJid` = NÃO setado (só será preenchido quando reconciliado com número real)
 *   - `number` = dígitos do LID (temporário, será corrigido na reconciliação)
 *   - NUNCA usar prefixo PENDING_
 */
async function createPendingContact(
  ids: ExtractedIdentifiers,
  companyId: number,
  wbot: Session
): Promise<Contact> {
  const lidJid = ids.lidJid || "unknown";
  const lidDigits = lidJid.replace(/\D/g, "");

  logger.warn({
    lidJid,
    pushName: ids.pushName,
    companyId
  }, "[createContact] Criando contato LID temporário (sem número real)");

  // Verificar se já existe contato com esse remoteJid (busca primária por LID)
  const existing = await Contact.findOne({
    where: {
      companyId,
      remoteJid: ids.lidJid
    }
  });

  if (existing) {
    logger.info({
      contactId: existing.id,
      number: existing.number
    }, "[createContact] Contato LID já existe, reutilizando");
    return existing;
  }

  // Criar novo contato LID temporário
  try {
    const contactName = ids.isFromMe
      ? `Contato ${lidJid.replace("@lid", "").slice(-6)}`
      : (ids.pushName || `Contato ${lidJid.replace("@lid", "").slice(-6)}`);

    // VALIDAÇÃO CRÍTICA: Verificar se lidDigits parece ser telefone inválido
    if (lidDigits.length >= 10 && lidDigits.length <= 20) {
      const { canonical } = safeNormalizePhoneNumber(lidDigits);
      if (!canonical) {
        logger.error("[createContact] LID com formato de telefone inválido", {
          lidJid,
          lidDigits,
          companyId
        });
        throw new Error(`LID com formato de telefone inválido: ${lidDigits}`);
      }

      // Se o LID tem formato de telefone válido, verificar se já existe contato similar
      // antes de criar como "temporário"
      const existingSimilar = await Contact.findOne({
        where: {
          companyId,
          isGroup: false,
          [Op.or]: [
            { number: { [Op.like]: `%${lidDigits.slice(-10)}` } },
            { canonicalNumber: { [Op.like]: `%${lidDigits.slice(-10)}` } }
          ]
        }
      });

      if (existingSimilar) {
        logger.info({
          lidJid,
          lidDigits,
          existingContactId: existingSimilar.id,
          existingNumber: existingSimilar.number
        }, "[createContact] Contato similar encontrado, reutilizando em vez de criar LID temporário");

        // Atualizar lidJid no contato existente se não tiver
        if (!existingSimilar.lidJid) {
          try {
            await existingSimilar.update({ lidJid: ids.lidJid });
          } catch (err: any) {
            logger.warn({ err: err?.message }, "[createContact] Falha ao preencher lidJid em contato similar");
          }
        }

        return existingSimilar;
      }
    }

    const contact = await Contact.create({
      name: contactName,
      number: lidDigits,
      canonicalNumber: null,
      isGroup: false,
      companyId,
      remoteJid: null, // NÃO usar LID como remoteJid - será preenchido quando reconciliado
      // lidJid: NÃO setar — só será preenchido quando reconciliado com número real
      email: "",
      channel: "whatsapp",
      whatsappId: wbot.id
    });

    logger.info({
      contactId: contact.id,
      number: lidDigits,
      lidJid
    }, "[createContact] Contato LID temporário criado");

    return contact;
  } catch (err: any) {
    // Se falhar por constraint unique, tentar buscar existente
    logger.warn({ err: err?.message }, "[createContact] Erro ao criar contato LID, buscando existente");

    const fallback = await Contact.findOne({
      where: {
        companyId,
        remoteJid: ids.lidJid
      }
    });

    if (fallback) return fallback;

    // Se nada funcionar, propagar erro
    throw err;
  }
}
