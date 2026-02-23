/**
 * LidResolverService - Serviço proativo para resolução de LIDs não resolvidos
 * 
 * Este serviço é responsável por:
 * 1. Detectar contatos com LID pendente (PENDING_)
 * 2. Tentar resolver o número real usando múltiplas estratégias
 * 3. Atualizar o contato quando o número for descoberto
 * 
 * Estratégias de resolução (ordem de prioridade):
 * 1. LidMapping no banco (mapeamentos salvos)
 * 2. signalRepository.lidMapping.getPNForLID() (Baileys v7)
 * 3. authState.keys.get('lid-mapping') (KeyStore persistido)
 * 4. wbot.onWhatsApp() (consulta direta ao WhatsApp)
 * 5. USync Query (protocolo de sincronização)
 * 6. store.contacts (cache local)
 * 7. Match por pushName (quando nome bate com contato conhecido)
 */

import { jidNormalizedUser } from "@whiskeysockets/baileys";
import { Op } from "sequelize";
import Contact from "../../models/Contact";
import LidMapping from "../../models/LidMapping";
import Ticket from "../../models/Ticket";
import logger from "../../utils/logger";
import { safeNormalizePhoneNumber, isRealPhoneNumber } from "../../utils/phone";

type Session = any; // WASocket

export interface LidResolutionResult {
  success: boolean;
  phoneNumber?: string;
  pnJid?: string;
  strategy?: string;
  error?: string;
}

/**
 * Tenta resolver um LID para número de telefone usando todas as estratégias disponíveis
 */
export async function resolveLidToPhoneNumber(
  lidJid: string,
  wbot: Session,
  companyId: number,
  pushName?: string
): Promise<LidResolutionResult> {
  const lidId = lidJid.replace("@lid", "");
  
  logger.info({ lidJid, pushName }, "[LidResolver] Iniciando resolução de LID...");

  // ═══════════════════════════════════════════════════════════════════
  // ESTRATÉGIA 1: LidMapping no banco (cache persistido)
  // ═══════════════════════════════════════════════════════════════════
  try {
    const mapping = await LidMapping.findOne({
      where: { 
        lid: lidJid, 
        companyId 
      }
    });
    
    if (mapping?.phoneNumber) {
      const digits = mapping.phoneNumber.replace(/\D/g, "");
      if (isRealPhoneNumber(digits)) {
        logger.info({ lidJid, phoneNumber: digits, strategy: "LidMapping" }, "[LidResolver] LID resolvido via LidMapping");
        return {
          success: true,
          phoneNumber: digits,
          pnJid: `${digits}@s.whatsapp.net`,
          strategy: "LidMapping"
        };
      }
    }
  } catch (err: any) {
    logger.warn({ err: err?.message, lidJid }, "[LidResolver] Erro ao consultar LidMapping");
  }

  // ═══════════════════════════════════════════════════════════════════
  // ESTRATÉGIA 2: signalRepository.lidMapping.getPNForLID() (Baileys v7)
  // ═══════════════════════════════════════════════════════════════════
  try {
    const lidStore = wbot.signalRepository?.lidMapping;
    if (lidStore?.getPNForLID) {
      const resolvedPN = await lidStore.getPNForLID(lidId);
      if (resolvedPN) {
        const digits = resolvedPN.replace(/\D/g, "");
        if (isRealPhoneNumber(digits)) {
          const pnJid = resolvedPN.includes("@") ? jidNormalizedUser(resolvedPN) : `${digits}@s.whatsapp.net`;
          
          // Persistir para futuras consultas
          await persistMapping(lidJid, digits, companyId, wbot.id, "signalRepository");
          
          logger.info({ lidJid, phoneNumber: digits, strategy: "signalRepository" }, "[LidResolver] LID resolvido via signalRepository");
          return {
            success: true,
            phoneNumber: digits,
            pnJid,
            strategy: "signalRepository"
          };
        }
      }
    }
  } catch (err: any) {
    logger.warn({ err: err?.message, lidJid }, "[LidResolver] Erro ao usar signalRepository");
  }

  // ═══════════════════════════════════════════════════════════════════
  // ESTRATÉGIA 3: authState.keys.get('lid-mapping') (KeyStore persistido)
  // ═══════════════════════════════════════════════════════════════════
  try {
    const authKeys = wbot.authState?.keys;
    if (authKeys?.get) {
      const data = await authKeys.get("lid-mapping", [lidId]);
      const raw = data?.[lidId];
      
      const resolved = extractPnFromMapping(raw);
      if (resolved) {
        const digits = resolved.replace(/\D/g, "");
        if (isRealPhoneNumber(digits)) {
          const pnJid = resolved.includes("@") ? jidNormalizedUser(resolved) : `${digits}@s.whatsapp.net`;
          
          await persistMapping(lidJid, digits, companyId, wbot.id, "authState.keys");
          
          logger.info({ lidJid, phoneNumber: digits, strategy: "authState.keys" }, "[LidResolver] LID resolvido via authState.keys");
          return {
            success: true,
            phoneNumber: digits,
            pnJid,
            strategy: "authState.keys"
          };
        }
      }
    }
  } catch (err: any) {
    logger.warn({ err: err?.message, lidJid }, "[LidResolver] Erro ao consultar authState.keys");
  }

  // ═══════════════════════════════════════════════════════════════════
  // ESTRATÉGIA 4: wbot.onWhatsApp() (consulta direta ao WhatsApp)
  // ═══════════════════════════════════════════════════════════════════
  try {
    const results = await wbot.onWhatsApp(lidJid);
    
    if (results && results.length > 0) {
      const result = results[0];
      if (result.jid && result.jid.includes("@s.whatsapp.net")) {
        const pnJid = jidNormalizedUser(result.jid);
        const digits = pnJid.replace(/\D/g, "");
        
        if (isRealPhoneNumber(digits)) {
          await persistMapping(lidJid, digits, companyId, wbot.id, "onWhatsApp");
          
          logger.info({ lidJid, phoneNumber: digits, strategy: "onWhatsApp" }, "[LidResolver] LID resolvido via onWhatsApp");
          return {
            success: true,
            phoneNumber: digits,
            pnJid,
            strategy: "onWhatsApp"
          };
        }
      }
    }
  } catch (err: any) {
    logger.warn({ err: err?.message, lidJid }, "[LidResolver] Erro ao chamar onWhatsApp");
  }

  // ═══════════════════════════════════════════════════════════════════
  // ESTRATÉGIA 5: USync Query (protocolo de sincronização forçada)
  // ═══════════════════════════════════════════════════════════════════
  try {
    if (wbot.executeUSyncQuery && typeof wbot.executeUSyncQuery === 'function') {
      const { USyncQuery, USyncUser } = require("@whiskeysockets/baileys");
      
      const usyncQuery = new USyncQuery()
        .withMode("query")
        .withUser(new USyncUser().withId(lidJid))
        .withContactProtocol();
      
      const result = await wbot.executeUSyncQuery(usyncQuery);
      
      if (result?.list?.length > 0) {
        const firstResult = result.list[0];
        
        if (firstResult.id && firstResult.id.includes("@s.whatsapp.net")) {
          const pnJid = jidNormalizedUser(firstResult.id);
          const digits = pnJid.replace(/\D/g, "");
          
          if (isRealPhoneNumber(digits)) {
            await persistMapping(lidJid, digits, companyId, wbot.id, "USync");
            
            logger.info({ lidJid, phoneNumber: digits, strategy: "USync" }, "[LidResolver] LID resolvido via USync");
            return {
              success: true,
              phoneNumber: digits,
              pnJid,
              strategy: "USync"
            };
          }
        }
      }
    }
  } catch (err: any) {
    logger.warn({ err: err?.message, lidJid }, "[LidResolver] Erro no USync Query");
  }

  // ═══════════════════════════════════════════════════════════════════
  // ESTRATÉGIA 6: store.contacts (cache local de contatos sincronizados)
  // ═══════════════════════════════════════════════════════════════════
  try {
    const store = wbot.store;
    if (store?.contacts) {
      // 6a: Busca direta pelo LID
      const contactInfo = store.contacts[lidJid];
      if (contactInfo?.id?.includes("@s.whatsapp.net")) {
        const digits = contactInfo.id.replace(/\D/g, "");
        if (isRealPhoneNumber(digits)) {
          await persistMapping(lidJid, digits, companyId, wbot.id, "store.direct");
          
          logger.info({ lidJid, phoneNumber: digits, strategy: "store.direct" }, "[LidResolver] LID resolvido via store.contacts direto");
          return {
            success: true,
            phoneNumber: digits,
            pnJid: contactInfo.id,
            strategy: "store.direct"
          };
        }
      }
      
      // 6b: Busca por lid associado em contatos PN
      for (const [jid, contact] of Object.entries(store.contacts)) {
        const c = contact as any;
        const contactLid = String(c?.lid || c?.lidId || c?.lidJid || "");
        if (contactLid === lidId || contactLid === lidJid) {
          if (jid.includes("@s.whatsapp.net")) {
            const digits = jid.replace(/\D/g, "");
            if (isRealPhoneNumber(digits)) {
              await persistMapping(lidJid, digits, companyId, wbot.id, "store.scan");
              
              logger.info({ lidJid, phoneNumber: digits, strategy: "store.scan" }, "[LidResolver] LID resolvido via store.contacts scan");
              return {
                success: true,
                phoneNumber: digits,
                pnJid: jid,
                strategy: "store.scan"
              };
            }
          }
        }
      }
    }
  } catch (err: any) {
    logger.warn({ err: err?.message, lidJid }, "[LidResolver] Erro ao consultar store.contacts");
  }

  // ═══════════════════════════════════════════════════════════════════
  // ESTRATÉGIA 7: Match por pushName (quando nome bate com contato conhecido)
  // ═══════════════════════════════════════════════════════════════════
  if (pushName && pushName.trim().length > 2) {
    try {
      const cleanName = pushName.trim().toLowerCase();
      
      // 7a: Buscar no store por nome
      const store = wbot.store;
      if (store?.contacts) {
        const allContacts = Object.values(store.contacts) as any[];
        const match = allContacts.find(c => {
          const names = [c.name, c.notify, c.verifiedName].filter(n => n).map(n => n.toLowerCase());
          return names.some(n => n === cleanName) && c.id?.includes("@s.whatsapp.net");
        });
        
        if (match) {
          const digits = match.id.replace(/\D/g, "");
          if (isRealPhoneNumber(digits)) {
            await persistMapping(lidJid, digits, companyId, wbot.id, "pushName.store");
            
            logger.info({ lidJid, phoneNumber: digits, pushName, strategy: "pushName.store" }, "[LidResolver] LID resolvido via match de nome no store");
            return {
              success: true,
              phoneNumber: digits,
              pnJid: match.id,
              strategy: "pushName.store"
            };
          }
        }
      }
      
      // 7b: Buscar no banco por nome
      const contactByName = await Contact.findOne({
        where: {
          companyId,
          isGroup: false,
          [Op.or]: [
            { name: { [Op.iLike]: pushName.trim() } },
            { pushName: { [Op.iLike]: pushName.trim() } }
          ],
          number: { [Op.notLike]: "PENDING_%" }
        }
      });
      
      if (contactByName?.number) {
        const digits = contactByName.number.replace(/\D/g, "");
        if (isRealPhoneNumber(digits)) {
          await persistMapping(lidJid, digits, companyId, wbot.id, "pushName.database");
          
          logger.info({ lidJid, phoneNumber: digits, pushName, strategy: "pushName.database" }, "[LidResolver] LID resolvido via match de nome no banco");
          return {
            success: true,
            phoneNumber: digits,
            pnJid: `${digits}@s.whatsapp.net`,
            strategy: "pushName.database"
          };
        }
      }
    } catch (err: any) {
      logger.warn({ err: err?.message, lidJid, pushName }, "[LidResolver] Erro no match por pushName");
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // TODAS AS ESTRATÉGIAS FALHARAM
  // ═══════════════════════════════════════════════════════════════════
  logger.warn({ lidJid, pushName }, "[LidResolver] Não foi possível resolver o LID");
  return {
    success: false,
    error: "Todas as estratégias de resolução falharam"
  };
}

/**
 * Processa todos os contatos pendentes e tenta resolver seus LIDs
 */
export async function resolveAllPendingLids(
  wbot: Session,
  companyId: number,
  limit: number = 50
): Promise<{ resolved: number; failed: number; total: number }> {
  logger.info({ companyId, limit }, "[LidResolver] Iniciando resolução de LIDs pendentes...");

  // Buscar contatos com LID pendente
  const pendingContacts = await Contact.findAll({
    where: {
      companyId,
      isGroup: false,
      [Op.or]: [
        { number: { [Op.like]: "PENDING_%" } },
        { 
          lidJid: { [Op.ne]: null },
          number: { [Op.like]: "%@lid" }
        }
      ]
    },
    limit,
    order: [["createdAt", "DESC"]]
  });

  let resolved = 0;
  let failed = 0;

  for (const contact of pendingContacts) {
    const lidJid = contact.lidJid || contact.remoteJid;
    
    if (!lidJid || !lidJid.includes("@lid")) {
      failed++;
      continue;
    }

    // Rate limiting: aguardar 500ms entre cada tentativa
    await new Promise(resolve => setTimeout(resolve, 500));

    const result = await resolveLidToPhoneNumber(lidJid, wbot, companyId, contact.name);

    if (result.success && result.phoneNumber) {
      try {
        // Verificar se já existe contato com esse número
        const existingContact = await Contact.findOne({
          where: {
            companyId,
            isGroup: false,
            number: result.phoneNumber,
            id: { [Op.ne]: contact.id }
          }
        });

        if (existingContact) {
          // Mesclar contatos
          const ContactMergeService = (await import("../ContactServices/ContactMergeService")).default;
          await ContactMergeService.mergeContacts(contact.id, existingContact.id, companyId);
          logger.info({ 
            pendingId: contact.id, 
            realId: existingContact.id, 
            phoneNumber: result.phoneNumber 
          }, "[LidResolver] Contatos mesclados");
        } else {
          // Atualizar contato pendente
          await contact.update({
            number: result.phoneNumber,
            canonicalNumber: result.phoneNumber,
            remoteJid: result.pnJid,
            lidJid: lidJid
          });
          
          logger.info({ 
            contactId: contact.id, 
            phoneNumber: result.phoneNumber,
            strategy: result.strategy
          }, "[LidResolver] Contato atualizado com número real");
        }
        
        resolved++;
      } catch (err: any) {
        logger.warn({ err: err?.message, contactId: contact.id }, "[LidResolver] Erro ao atualizar contato");
        failed++;
      }
    } else {
      failed++;
    }
  }

  logger.info({ companyId, resolved, failed, total: pendingContacts.length }, "[LidResolver] Resolução de LIDs concluída");
  
  return {
    resolved,
    failed,
    total: pendingContacts.length
  };
}

/**
 * Persiste mapeamento LID→PN no banco
 */
async function persistMapping(
  lid: string,
  phoneNumber: string,
  companyId: number,
  whatsappId: number,
  source: string
): Promise<void> {
  try {
    await LidMapping.upsert({
      lid,
      phoneNumber,
      companyId,
      whatsappId,
      source: `LidResolver_${source}`,
      confidence: 1.0,
      verified: true
    });
  } catch {
    // Ignorar erros de persistência
  }
}

/**
 * Extrai PN de estrutura de mapeamento do Baileys
 */
function extractPnFromMapping(v: any): string | null {
  if (!v) return null;
  if (typeof v === "string") return v;
  
  const jid = String(
    v?.jid || 
    v?.pnJid || 
    v?.pn || 
    v?.phoneNumber || 
    v?.number || 
    ""
  );
  
  return jid || null;
}

export default {
  resolveLidToPhoneNumber,
  resolveAllPendingLids
};
