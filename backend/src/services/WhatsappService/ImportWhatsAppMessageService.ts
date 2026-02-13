import { getIO } from "../../libs/socket";
import AppError from "../../errors/AppError";
import Whatsapp from "../../models/Whatsapp";
import Ticket from "../../models/Ticket";
import Message from "../../models/Message";
import { Op } from "sequelize";
import { add } from "date-fns";
import UpdateTicketService from "../TicketServices/UpdateTicketService";
import { dataMessages, getWbot } from "../../libs/wbot";
import moment from "moment";
import { addLogs } from "../../helpers/addLogs";
import logger from "../../utils/logger";
import CreateOrUpdateContactService from "../ContactServices/CreateOrUpdateContactService";
import { safeNormalizePhoneNumber } from "../../utils/phone";
import FindOrCreateTicketService from "../TicketServices/FindOrCreateTicketService";
import { getBodyMessage, getQuotedMessage } from "../WbotServices/wbotMessageListener";
import { jidNormalizedUser } from "@whiskeysockets/baileys";

// Funções Auxiliares (Cleaner e Sorter)
function sortByMessageTimestamp(a, b) {
  return (b.messageTimestamp || 0) - (a.messageTimestamp || 0);
}

function cleaner(array) {
  const mapa = new Map();
  const resultado = [];

  for (const objeto of array) {
    const valorChave = objeto['key']['id'];
    if (!mapa.has(valorChave)) {
      mapa.set(valorChave, true);
      resultado.push(objeto);
    }
  }

  return resultado.sort((a, b) => (a.messageTimestamp || 0) - (b.messageTimestamp || 0)); // Sort ASC for import
}

export const closeTicketsImported = async (whatsappId) => {
  const tickets = await Ticket.findAll({
    where: {
      status: 'pending',
      whatsappId,
      imported: { [Op.lt]: +add(new Date(), { hours: +5 }) }
    }
  })

  for (const ticket of tickets) {
    await new Promise(r => setTimeout(r, 200)); // Delay menor
    await UpdateTicketService({ ticketData: { status: "closed" }, ticketId: ticket.id, companyId: ticket.companyId })
  }
  let whatsApp = await Whatsapp.findByPk(whatsappId);
  whatsApp.update({ statusImportMessages: null })
  const io = getIO();
  io.of(`/workspace-${whatsApp.companyId}`)
    .emit(`importMessages-${whatsApp.companyId}`, {
      action: "refresh",
    });
}

const ImportWhatsAppMessageService = async (whatsappId: number | string) => {
  let whatsApp = await Whatsapp.findByPk(whatsappId);
  const companyId = whatsApp.companyId;

  // Proteção contra reentrada e estado inválido
  // if (whatsApp.statusImportMessages === "importing") {
  //     logger.warn(`[Import] Tentativa de reimportação ignorada para Whatsapp ${whatsappId}`);
  //     // return; // Comentado para permitir retry manual se travar, mas idealmente deveria bloquear
  // }

  const wbot = getWbot(whatsApp.id);

  try {
    const io = getIO();
    let messages = cleaner(dataMessages[whatsappId] || []);

    addLogs({
      fileName: `processImportMessagesWppId${whatsappId}.txt`, forceNewFile: true,
      text: `Iniciando Importação OTIMIZADA:
    Whatsapp: ${whatsApp.name} (ID: ${whatsApp.id})
    Total em memória: ${messages.length}
    Data: ${moment().format("DD/MM/YYYY HH:mm:ss")}
    `
    });

    if (messages.length === 0) {
      // Nada a importar
      await whatsApp.update({
        statusImportMessages: whatsApp.closedTicketsPostImported ? null : "renderButtonCloseTickets",
        importOldMessages: null,
        importRecentMessages: null
      });
      io.of(`/workspace-${companyId}`).emit(`importMessages-${companyId}`, {
        action: "update",
        status: { this: 0, all: 0, state: "COMPLETED", date: moment().format("DD/MM/YY HH:mm:ss") }
      });
      return "whatsapps";
    }

    // Filtrar Duplicatas (otimizado)
    logger.info(`[Import] Verificando duplicatas para ${messages.length} mensagens...`);
    const allWids = messages.map(m => m.key.id);
    const existingWids = new Set<string>();
    const chunkSize = 1000;

    for (let i = 0; i < allWids.length; i += chunkSize) {
      const chunk = allWids.slice(i, i + chunkSize);
      const existing = await Message.findAll({
        where: {
          wid: { [Op.in]: chunk },
          companyId
        },
        attributes: ['wid']
      });
      existing.forEach(m => existingWids.add(m.wid));
    }

    const messagesToImport = messages.filter(m => !existingWids.has(m.key.id));
    const totalImport = messagesToImport.length;

    addLogs({
      fileName: `processImportMessagesWppId${whatsappId}.txt`,
      text: `Filtragem concluída. Total Novas: ${totalImport}. Existentes ignoradas: ${existingWids.size}.`
    });

    io.of(`/workspace-${companyId}`).emit(`importMessages-${companyId}`, {
      action: "update",
      status: { this: 0, all: totalImport, state: "PREPARING", date: moment().format("DD/MM/YY HH:mm:ss") }
    });

    // Cache de tickets durante a importação para evitar criar múltiplos tickets para o mesmo contato
    const ticketCache = new Map<string, Ticket>();
    let processedCount = 0;

    for (const msg of messagesToImport) {
      processedCount++;

      try {
        // 1. Extrair JIDs Corretamente para evitar Chats Misturados
        const isGroup = msg.key.remoteJid.endsWith("@g.us");
        const msgContactId = msg.key.participant || msg.participant || msg.key.remoteJid;
        const remoteJid = msg.key.remoteJid;
        const fromMe = msg.key.fromMe;

        // Normalização
        const { canonical: contactNumberCanonical } = safeNormalizePhoneNumber(jidNormalizedUser(msgContactId));
        const { canonical: remoteNumberCanonical } = safeNormalizePhoneNumber(jidNormalizedUser(remoteJid));

        const contactNumber = contactNumberCanonical || jidNormalizedUser(msgContactId).replace(/\D/g, "");
        const remoteNumber = remoteNumberCanonical || jidNormalizedUser(remoteJid).replace(/\D/g, "");

        // Chave única para cache: grupo usa remoteJid, privado usa contactNumber
        const cacheKey = isGroup ? remoteNumber : contactNumber;

        // 2. Buscar/Criar Contato (Sem baixar foto para não travar)
        // Se for grupo, precisamos do contato do remetente E do contato do grupo
        let contact = null;
        let groupContact = null;

        if (isGroup) {
          // Contato Grupo
          groupContact = await CreateOrUpdateContactService({
            number: remoteNumber,
            name: remoteNumber, // Será atualizado se houver info
            isGroup: true,
            companyId,
            channel: "whatsapp",
            whatsappId: whatsApp.id,
            remoteJid: remoteJid,
            checkProfilePic: false // CRÍTICO: Pular download de foto
          });

          // Contato Remetente
          contact = await CreateOrUpdateContactService({
            number: contactNumber,
            name: contactNumber,
            isGroup: false,
            companyId,
            channel: "whatsapp",
            whatsappId: whatsApp.id,
            remoteJid: jidNormalizedUser(msgContactId),
            checkProfilePic: false // CRÍTICO: Pular download de foto
          });
        } else {
          // Chat Privado
          contact = await CreateOrUpdateContactService({
            number: remoteNumber,
            name: remoteNumber,
            isGroup: false,
            companyId,
            channel: "whatsapp",
            whatsappId: whatsApp.id,
            remoteJid: remoteJid,
            checkProfilePic: false // CRÍTICO: Pular download de foto
          });
        }

        // 3. Buscar/Criar Ticket (usando cache para evitar duplicados na importação)
        let ticket: Ticket | undefined = ticketCache.get(cacheKey);

        if (!ticket) {
          // Proteção contra contatos nulos (rejeitados por serem IDs Meta ou inválidos)
          if (!contact && !groupContact) {
            logger.warn(`[Import] Pulando mensagem ${msg.key.id}: Contato não pôde ser criado (provável ID Meta ou inválido)`);
            continue;
          }

          // Só chama FindOrCreateTicketService se não estiver no cache
          ticket = await FindOrCreateTicketService(
            contact,
            whatsApp,
            0, // unreadMessages
            companyId,
            0, // queue
            0, // userId
            groupContact,
            "whatsapp",
            true // isImported = true (cria pending ou usa existente)
          );

          if (!ticket) {
            logger.warn(`[Import] Falha ao obter ticket para ${cacheKey}, ignorando mensagem.`);
            continue;
          }

          // Guarda no cache para reutilizar nas próximas mensagens do mesmo contato
          ticketCache.set(cacheKey, ticket);
        }

        // 4. Salvar Mensagem (Direto no Banco)
        const body = getBodyMessage(msg);
        const quotedMsg = getQuotedMessage(msg); // Opcional: extrair quoted se necessário

        if (body || msg.message) {
          // Timestamp original da mensagem (em segundos → milissegundos)
          const originalTimestamp = (msg.messageTimestamp as number) * 1000;
          const originalDate = new Date(originalTimestamp);

          const messageData = {
            wid: msg.key.id,
            ticketId: ticket.id,
            contactId: fromMe ? undefined : contact?.id,
            body: body || "",
            fromMe,
            read: true, // Importadas sempre lidas
            mediaType: getBodyMessage(msg) ? "chat" : "image",
            mediaUrl: null,
            timestamp: originalTimestamp,
            createdAt: originalDate, // Data original da mensagem
            updatedAt: originalDate,
            dataJson: JSON.stringify(msg),
            companyId
          };

          await Message.upsert(messageData);
        }

        // 5. Emitir Progresso (Batch)
        if (processedCount % 20 === 0 || processedCount === totalImport) {
          const timestampMsg = (msg.messageTimestamp as number) * 1000;
          io.of(`/workspace-${companyId}`).emit(`importMessages-${companyId}`, {
            action: "update",
            status: {
              this: processedCount,
              all: totalImport,
              state: "IMPORTING",
              date: moment(timestampMsg).format("DD/MM/YY HH:mm:ss")
            }
          });
        }

      } catch (err) {
        logger.error(`[Import] Erro MSG ${processedCount}: ${err}`);
      }
    }

    // Finalização
    dataMessages[whatsappId] = [];

    if (whatsApp.closedTicketsPostImported) {
      await closeTicketsImported(whatsappId);
    }

    await whatsApp.update({
      statusImportMessages: whatsApp.closedTicketsPostImported ? null : "renderButtonCloseTickets",
      importOldMessages: null,
      importRecentMessages: null
    });

    io.of(`/workspace-${companyId}`).emit(`importMessages-${companyId}`, {
      action: "update",
      status: { this: totalImport, all: totalImport, state: "COMPLETED", date: moment().format("DD/MM/YY HH:mm:ss") }
    });

    // Refresh UI
    setTimeout(() => {
      io.of(`/workspace-${companyId}`).emit(`importMessages-${companyId}`, { action: "refresh" });
    }, 1000);

  } catch (error) {
    logger.error(`[Import] Fatal: ${error}`);
    throw new AppError("ERR_IMPORT_FAILED", 500);
  }

  return "whatsapps";
};

export default ImportWhatsAppMessageService;