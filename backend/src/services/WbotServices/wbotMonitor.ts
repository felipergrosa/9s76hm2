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

          await verifyMessage(sentMessage, ticket, contact);

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
    wbot.ev.on("labels.edit", (payload: any) => {
      try {
        logger.info(`[wbotMonitor] Evento labels.edit recebido:`, JSON.stringify(payload));
        const { id, name, color, predefinedId, deleted } = payload || {};
        if (!id) {
          logger.warn(`[wbotMonitor] labels.edit sem ID:`, payload);
          return;
        }
        upsertLabel(whatsapp.id, { id: String(id), name: String(name || id), color, predefinedId, deleted });
        logger.info(`[wbotMonitor] Label ${name} (${id}) processada para whatsappId=${whatsapp.id}`);
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
            addChatLabelAssociation(whatsapp.id, chatId, labelId, labeled);
            logger.info(`[wbotMonitor] Associação ${labeled ? 'add' : 'remove'}: chat=${chatId} label=${labelId}`);

            // Persistir labels deste chat também em Baileys.chats (para fallback e contagem)
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

  } catch (err) {
    logger.error(`Error in wbotMonitor: ${err.message}`);
    Sentry.captureException(err);
  }
};

export default wbotMonitor;
