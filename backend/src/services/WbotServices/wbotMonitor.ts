import {
  WASocket,
  BinaryNode,
  Contact as BContact,
  Chat,
  isJidBroadcast,
  isJidStatusBroadcast,
  isJidUser,
} from "@whiskeysockets/baileys";
import * as Sentry from "@sentry/node";
import fs from "fs";
import path from "path";
import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import Whatsapp from "../../models/Whatsapp";
import WhatsappLabel from "../../models/WhatsappLabel";
import logger from "../../utils/logger";
import { upsertLabel, addChatLabelAssociation, getChatLabelIds } from "../../libs/labelCache";
import createOrUpdateBaileysService from "../BaileysServices/CreateOrUpdateBaileysService";
import CreateMessageService from "../MessageServices/CreateMessageService";
import CompaniesSettings from "../../models/CompaniesSettings";
import { verifyMessage } from "./wbotMessageListener";

let i = 0;

setInterval(() => {
  i = 0;
}, 5000);

type Session = WASocket & {
  id?: number;
};

interface IContact {
  contacts: BContact[];
}

const wbotMonitor = async (
  wbot: Session,
  whatsapp: Whatsapp,
  companyId: number
): Promise<void> => {
  logger.info(`[wbotMonitor] Iniciando monitor para whatsappId=${whatsapp.id}, companyId=${companyId}`);
  try {
    wbot.ws.on("CB:call", async (node: BinaryNode) => {
      const content = node.content[0] as any;

      await new Promise((r) => setTimeout(r, i * 650));
      i++;

      if (content.tag === "terminate" && !node.attrs.from.includes("@call")) {
        const settings = await CompaniesSettings.findOne({
          where: { companyId },
        });

        if (settings?.acceptCallWhatsapp === "enabled") {
          const sentMessage = await wbot.sendMessage(node.attrs.from, {
            text: `\u200e ${settings.AcceptCallWhatsappMessage}`,
          });
          const number = node.attrs.from.split(":")[0].replace(/\D/g, "");

          const contact = await Contact.findOne({
            where: { companyId, number },
          });

          if (!contact) return;

          const [ticket] = await Ticket.findOrCreate({
            where: {
              contactId: contact.id,
              whatsappId: wbot.id,
              status: ["open", "pending", "nps", "lgpd"],
              companyId,
            },
            defaults: {
              companyId,
              contactId: contact.id,
              whatsappId: wbot.id,
              isGroup: contact.isGroup,
              status: "pending",
            },
          });

          if (!ticket) return;

          await verifyMessage(sentMessage, ticket, contact, undefined, undefined, false, false, wbot);

          const date = new Date();
          const hours = date.getHours();
          const minutes = date.getMinutes();

          const body = `Chamada de voz/vídeo perdida às ${hours}:${minutes}`;
          const messageData = {
            wid: content.attrs["call-id"],
            ticketId: ticket.id,
            contactId: contact.id,
            body,
            fromMe: false,
            mediaType: "call_log",
            read: true,
            quotedMsgId: null,
            ack: 1,
          };

          await ticket.update({
            lastMessage: body,
          });

          if (ticket.status === "closed") {
            await ticket.update({
              status: "pending",
            });
          }

          return CreateMessageService({ messageData, companyId });
        }
      }
    });

    function cleanStringForJSON(str: string | undefined): string {
      if (!str) return "";
      // Remove control characters, quotes, backslashes, and invalid Unicode
      return str
        .replace(/[\x00-\x1F"\\']/g, "")
        .replace(/[\uD800-\uDFFF]/g, "") // Remove unpaired surrogates
        .replace(/\uFFFD/g, ""); // Remove replacement characters
    }

    wbot.ev.on("contacts.upsert", async (contacts: BContact[]) => {
      const filteredContacts: BContact[] = [];

      try {
        // Await the Promise.all to ensure all contacts are processed
        await Promise.all(
          contacts.map(async (contact) => {
            if (
              !isJidBroadcast(contact.id) &&
              !isJidStatusBroadcast(contact.id) &&
              isJidUser(contact.id)
            ) {
              const contactArray: BContact = {
                id: contact.id,
                name: contact.name
                  ? cleanStringForJSON(contact.name)
                  : contact.id.split("@")[0].split(":")[0],
              };
              filteredContacts.push(contactArray);
            }
          })
        );

        // Validate that filteredContacts is serializable
        try {
          JSON.stringify(filteredContacts);
        } catch (err) {
          logger.error(`Failed to serialize filteredContacts: ${err.message}`);
          Sentry.captureException(err);
          return;
        }

        // Write to file
        const publicFolder = path.resolve(__dirname, "..", "..", "..", "public");
        const companyFolder = path.join(publicFolder, `company${companyId}`);
        const contactJson = path.join(companyFolder, "contactJson.txt");

        try {
          if (!fs.existsSync(companyFolder)) {
            fs.mkdirSync(companyFolder, { recursive: true });
            fs.chmodSync(companyFolder, 0o777);
          }
          if (fs.existsSync(contactJson)) {
            await fs.promises.unlink(contactJson);
          }
          await fs.promises.writeFile(contactJson, JSON.stringify(filteredContacts, null, 2));
        } catch (err) {
          logger.error(`Failed to write contactJson.txt: ${err.message}`);
          Sentry.captureException(err);
        }

        // Pass filteredContacts as an array to createOrUpdateBaileysService
        try {
          await createOrUpdateBaileysService({
            whatsappId: whatsapp.id,
            contacts: filteredContacts,
          });

        } catch (err) {
          logger.error(`Error in createOrUpdateBaileysService: ${err.message}`);
          Sentry.captureException(err);
          console.log("Filtered Contacts:", filteredContacts); // Debug output
        }
      } catch (err) {
        logger.error(`Error in contacts.upsert: ${err.message}`);
        Sentry.captureException(err);
      }
    });

    // Persistência de CHATS (com labels) no Baileys para extração de etiquetas
    wbot.ev.on("chats.upsert", async (chats: Chat[]) => {
      try {
        await createOrUpdateBaileysService({
          whatsappId: whatsapp.id,
          chats
        });
      } catch (err: any) {
        logger.error(`Error persisting chats.upsert: ${err?.message}`);
        Sentry.captureException(err);
      }
    });

    wbot.ev.on("chats.update", async (chats: Partial<Chat>[]) => {
      try {
        // Mesmo fluxo de merge no serviço; envia as atualizações parciais
        await createOrUpdateBaileysService({
          whatsappId: whatsapp.id,
          chats: chats as any
        });
      } catch (err: any) {
        logger.error(`Error persisting chats.update: ${err?.message}`);
        Sentry.captureException(err);
      }
    });

    // Captura eventos de edição de labels (criar/editar/remover) vindos do App State
    wbot.ev.on("labels.edit", async (payload: any) => {
      try {
        logger.info(`[wbotMonitor] Evento labels.edit recebido:`, JSON.stringify(payload));
        const items: any[] = Array.isArray(payload)
          ? payload
          : (Array.isArray(payload?.labels) ? payload.labels : [payload]);
        let count = 0;
        for (const it of items) {
          const rid = it?.id ?? it?.labelId ?? it?.lid ?? it?.value;
          if (!rid) continue;
          const id = String(rid);
          const name = String(it?.name ?? it?.label ?? it?.title ?? it?.displayName ?? id);
          const color = it?.color ?? it?.colorHex ?? it?.backgroundColor;
          const predefinedId = it?.predefinedId;
          const deleted = it?.deleted === true;

          // 1. Atualizar cache em memória (comportamento existente)
          upsertLabel(whatsapp.id, { id, name, color, predefinedId, deleted });

          // 2. NOVO: Persistir no banco de dados
          try {
            const colorNum = typeof color === 'number' ? color : (typeof color === 'string' ? parseInt(color, 10) || 0 : 0);
            if (deleted) {
              // Marcar como deletada no banco
              await WhatsappLabel.update(
                { deleted: true },
                { where: { whatsappLabelId: id, whatsappId: whatsapp.id } }
              );
            } else {
              // Upsert: criar ou atualizar
              const [dbLabel, created] = await WhatsappLabel.findOrCreate({
                where: { whatsappLabelId: id, whatsappId: whatsapp.id },
                defaults: {
                  whatsappLabelId: id,
                  name,
                  color: colorNum,
                  predefinedId: predefinedId || null,
                  deleted: false,
                  whatsappId: whatsapp.id
                }
              });
              if (!created) {
                await dbLabel.update({ name, color: colorNum, predefinedId: predefinedId || null, deleted: false });
              }
            }
            logger.info(`[wbotMonitor] Label ${id} persistida no banco para whatsappId=${whatsapp.id}`);
          } catch (dbErr: any) {
            logger.warn(`[wbotMonitor] Falha ao persistir label ${id} no banco: ${dbErr?.message}`);
          }

          count++;
        }
        if (count === 0) {
          logger.warn(`[wbotMonitor] labels.edit sem itens válidos para upsert.`);
        } else {
          logger.info(`[wbotMonitor] labels.edit processou ${count} label(s) para whatsappId=${whatsapp.id}`);
        }
      } catch (err: any) {
        logger.error(`[wbotMonitor] labels.edit handler error: ${err?.message}`, err);
      }
    });

    // Sincronização inicial/relacional de labels: inventário completo e relações
    // Payload esperado (defensivo): { labels: [{id,name,color}], relations?: [{ chatId,labelId } | { type:'label_jid', chatId, labelId }] }
    (wbot.ev as any).on("labels.relations", async (payload: any) => {
      try {
        logger.info(`[wbotMonitor] Evento labels.relations recebido`);
        const labels = Array.isArray(payload?.labels) ? payload.labels : [];
        for (const l of labels) {
          if (!l?.id) continue;
          upsertLabel(whatsapp.id, { id: String(l.id), name: String(l.name || l.id), color: l.color });
        }

        const relations = Array.isArray(payload?.relations) ? payload.relations : (Array.isArray(payload?.associations) ? payload.associations : []);
        for (const r of relations) {
          const chatId = String(r?.chatId || r?.jid || '');
          const labelId = String(r?.labelId || r?.lid || '');
          if (!chatId || !labelId) continue;
          addChatLabelAssociation(whatsapp.id, chatId, labelId, true);
        }

        // Persistir mapeamento atualizado das labels por chat em Baileys.chats para fallback e contagem
        try {
          if (Array.isArray(relations) && relations.length > 0) {
            const batch: any[] = [];
            const seen = new Map<string, Set<string>>();
            for (const r of relations) {
              const chatId = String(r?.chatId || r?.jid || '');
              const labelId = String(r?.labelId || r?.lid || '');
              if (!chatId || !labelId) continue;
              let set = seen.get(chatId);
              if (!set) { set = new Set(); seen.set(chatId, set); }
              set.add(labelId);
            }
            for (const [jid, set] of seen.entries()) {
              batch.push({ id: jid, labels: Array.from(set), labelsAbsolute: true });
            }
            if (batch.length) {
              await createOrUpdateBaileysService({ whatsappId: whatsapp.id, chats: batch as any });
            }
          }
        } catch (e: any) {
          logger.warn(`[wbotMonitor] Falha ao persistir labels.relations no Baileys.chats: ${e?.message}`);
        }
      } catch (err: any) {
        logger.error(`[wbotMonitor] labels.relations handler error: ${err?.message}`, err);
      }
    });

    // Captura eventos de associação de labels a chats/mensagens
    wbot.ev.on("labels.association", async (payload: any) => {
      try {
        logger.info(`[wbotMonitor] Evento labels.association recebido:`, JSON.stringify(payload));
        const { type, association } = payload || {};
        if (!association) {
          logger.warn(`[wbotMonitor] labels.association sem association:`, payload);
          return;
        }
        const labeled = type === "add";
        const assocType = association.type; // 'label_jid' (Chat) ou 'label_message'
        const labelId = association.labelId;
        if (assocType === "label_jid" || assocType === 0 || assocType === "Chat") {
          const chatId = association.chatId;
          if (chatId && labelId) {
            // 1. Atualizar cache em memória (comportamento existente)
            addChatLabelAssociation(whatsapp.id, chatId, labelId, labeled);
            logger.info(`[wbotMonitor] Associação ${labeled ? 'add' : 'remove'}: chat=${chatId} label=${labelId}`);

            // 2. NOVO: Persistir associação no banco de dados (ContactWhatsappLabel)
            try {
              const ContactWhatsappLabel = (await import("../../models/ContactWhatsappLabel")).default;
              const Contact = (await import("../../models/Contact")).default;

              // Extrair número do chatId (formato: 5511999999999@c.us)
              const number = chatId.split('@')[0];

              // Buscar contato pelo número
              const contact = await Contact.findOne({
                where: { number, companyId }
              });

              if (contact) {
                // Buscar label no banco
                const dbLabel = await WhatsappLabel.findOne({
                  where: { whatsappLabelId: labelId, whatsappId: whatsapp.id }
                });

                if (dbLabel) {
                  if (labeled) {
                    // Adicionar associação
                    await ContactWhatsappLabel.findOrCreate({
                      where: { contactId: contact.id, whatsappLabelId: dbLabel.id }
                    });
                    logger.info(`[wbotMonitor] Associação persistida no banco: contact=${contact.id} label=${dbLabel.id}`);
                  } else {
                    // Remover associação
                    await ContactWhatsappLabel.destroy({
                      where: { contactId: contact.id, whatsappLabelId: dbLabel.id }
                    });
                    logger.info(`[wbotMonitor] Associação removida do banco: contact=${contact.id} label=${dbLabel.id}`);
                  }
                } else {
                  logger.warn(`[wbotMonitor] Label ${labelId} não encontrada no banco para whatsappId=${whatsapp.id}`);
                }
              } else {
                logger.debug(`[wbotMonitor] Contato ${number} não encontrado no banco para companyId=${companyId}`);
              }
            } catch (dbErr: any) {
              logger.warn(`[wbotMonitor] Falha ao persistir associação no banco: ${dbErr?.message}`);
            }

            // 3. Persistir labels deste chat também em Baileys.chats (para fallback e contagem)
            try {
              const ids = getChatLabelIds(whatsapp.id, chatId) || [];
              await createOrUpdateBaileysService({
                whatsappId: whatsapp.id,
                chats: [{ id: chatId, labels: ids, labelsAbsolute: true }] as any
              });
            } catch (e: any) {
              logger.warn(`[wbotMonitor] Falha ao persistir labels no Baileys.chats para chat=${chatId}: ${e?.message}`);
            }
          }
        }
      } catch (err: any) {
        logger.error(`[wbotMonitor] labels.association handler error: ${err?.message}`, err);
      }
    });

    // =================================================================
    // EVENTO LID-MAPPING.UPDATE - Mapeamento LID ↔ PN do Baileys v7
    // Fluxo simplificado: salva mapeamento + reconcilia contatos PENDING_
    // =================================================================
    wbot.ev.on("lid-mapping.update" as any, async (update: any) => {
      try {
        if (!update?.mapping) return;

        const LidMapping = require("../../models/LidMapping").default;
        const Contact = require("../../models/Contact").default;
        const Ticket = require("../../models/Ticket").default;
        const Message = require("../../models/Message").default;
        const { Op } = require("sequelize");
        let savedCount = 0;
        let reconciledCount = 0;

        for (const [lid, pn] of Object.entries(update.mapping)) {
          if (!lid || !pn) continue;

          const lidJid = lid.includes("@lid") ? lid : `${lid}@lid`;
          const phoneNumber = (pn as string).replace(/\D/g, "");

          // 1. Salvar mapeamento verificado
          try {
            await LidMapping.upsert({
              lid: lidJid,
              phoneNumber,
              companyId,
              whatsappId: whatsapp.id,
              source: "baileys_lid_mapping_event",
              confidence: 1.0,
              verified: true
            });
            savedCount++;
          } catch (e: any) {
            logger.warn("[wbotMonitor] Erro ao salvar LID mapping", { e: e?.message });
          }

          // 2. Reconciliar contatos PENDING_ ou com lidJid
          try {
            // Buscar contato pendente por lidJid
            const pendingContact = await Contact.findOne({
              where: {
                companyId,
                isGroup: false,
                [Op.or]: [
                  { remoteJid: lidJid },
                  { lidJid: lidJid }
                ]
              }
            });

            if (!pendingContact) continue;

            // Verificar se já existe contato real com esse número
            const realContact = await Contact.findOne({
              where: {
                companyId,
                isGroup: false,
                [Op.or]: [
                  { canonicalNumber: phoneNumber },
                  { number: phoneNumber }
                ],
                id: { [Op.ne]: pendingContact.id }
              }
            });

            if (realContact) {
              // MERGE: usar ContactMergeService (com transação atômica)
              const ContactMergeService = require("../../services/ContactServices/ContactMergeService").default;
              const mergeResult = await ContactMergeService.mergeContacts(
                pendingContact.id,
                realContact.id,
                companyId
              );
              if (mergeResult.success) {
                // Atualizar lidJid do contato real
                if (!realContact.lidJid) {
                  await realContact.update({ lidJid: lidJid });
                }
                reconciledCount++;
                logger.info("[wbotMonitor] Contato PENDING_ mesclado com contato real", {
                  pendingId: pendingContact.id,
                  realId: realContact.id,
                  lidJid,
                  phoneNumber,
                  ticketsMoved: mergeResult.ticketsMoved,
                  messagesMoved: mergeResult.messagesMoved
                });
              } else {
                logger.warn("[wbotMonitor] Falha ao mesclar contato PENDING_", {
                  pendingId: pendingContact.id,
                  realId: realContact.id,
                  error: mergeResult.error
                });
              }
            } else {
              // PROMOVER: transformar contato pendente em real
              await pendingContact.update({
                number: phoneNumber,
                canonicalNumber: phoneNumber,
                remoteJid: `${phoneNumber}@s.whatsapp.net`,
                lidJid: lidJid
              });
              reconciledCount++;
              logger.info("[wbotMonitor] Contato PENDING_ promovido a real", {
                contactId: pendingContact.id,
                lidJid,
                phoneNumber
              });
            }
          } catch (mergeErr: any) {
            logger.warn("[wbotMonitor] Erro ao reconciliar contato LID", {
              lidJid,
              phoneNumber,
              err: mergeErr?.message
            });
          }
        }

        logger.info("[wbotMonitor] lid-mapping.update processado", {
          total: Object.keys(update.mapping).length,
          saved: savedCount,
          reconciled: reconciledCount
        });
      } catch (err: any) {
        logger.error("[wbotMonitor] Erro no lid-mapping.update handler", { err: err?.message });
        Sentry.captureException(err);
      }
    });

  } catch (err) {
    logger.error(`Error in wbotMonitor: ${err.message}`);
    Sentry.captureException(err);
  }
};

export default wbotMonitor;
