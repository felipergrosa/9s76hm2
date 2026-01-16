
import AppError from "../../errors/AppError";

import Whatsapp from "../../models/Whatsapp";

import { getIO } from "../../libs/socket";
import Ticket from "../../models/Ticket";
import { Op } from "sequelize";
import { add } from "date-fns";
import UpdateTicketService from "../TicketServices/UpdateTicketService";
import { dataMessages, getWbot } from "../../libs/wbot";
import { handleMessage } from "../WbotServices/wbotMessageListener";
import fs from 'fs';
import moment from "moment";
import { addLogs } from "../../helpers/addLogs";
import logger from "../../utils/logger";


export const closeTicketsImported = async (whatsappId) => {

  const tickets = await Ticket.findAll({
    where: {
      status: 'pending',
      whatsappId,
      imported: { [Op.lt]: +add(new Date(), { hours: +5 }) }
    }
  })


  for (const ticket of tickets) {
    await new Promise(r => setTimeout(r, 330));
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



function sortByMessageTimestamp(a, b) {
  return b.messageTimestamp - a.messageTimestamp
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

  return resultado.sort(sortByMessageTimestamp)
}






const ImportWhatsAppMessageService = async (whatsappId: number | string) => {
  let whatsApp = await Whatsapp.findByPk(whatsappId);


  const wbot = getWbot(whatsApp.id);

  try {

    const io = getIO();
    const messages = cleaner(dataMessages[whatsappId])
    let dateOldLimit = new Date(whatsApp.importOldMessages).getTime();
    let dateRecentLimit = new Date(whatsApp.importRecentMessages).getTime();

    addLogs({
      fileName: `processImportMessagesWppId${whatsappId}.txt`, forceNewFile: true,
      text: `Aguardando conexão para iniciar a importação de mensagens:
    Whatsapp nome: ${whatsApp.name}
    Whatsapp Id: ${whatsApp.id}
    Criação do arquivo de logs: ${moment().format("DD/MM/YYYY HH:mm:ss")}
    Selecionado Data de inicio de importação: ${moment(dateOldLimit).format("DD/MM/YYYY HH:mm:ss")} 
    Selecionado Data final da importação: ${moment(dateRecentLimit).format("DD/MM/YYYY HH:mm:ss")} 
    `
    })


    const qtd = messages.length;
    let i = 0;

    // Emite estado inicial "PREPARING" para o frontend mostrar loading
    io.of(`/workspace-${whatsApp.companyId}`)
      .emit(`importMessages-${whatsApp.companyId}`, {
        action: "update",
        status: { this: 0, all: qtd, state: "PREPARING", date: moment().format("DD/MM/YY HH:mm:ss") }
      });

    logger.info(`[Import] Iniciando importação de ${qtd} mensagens para whatsappId=${whatsappId}`);

    while (i < qtd) {

      try {
        const msg = messages[i]
        addLogs({
          fileName: `processImportMessagesWppId${whatsappId}.txt`, text: `
Mensagem ${i + 1} de ${qtd}
              `})
        await handleMessage(msg, wbot, whatsApp.companyId, true);

        if (i % 2 === 0) {
          const timestampMsg = Math.floor(msg.messageTimestamp["low"] * 1000)
          io.of(`/workspace-${whatsApp.companyId}`)
            .emit(`importMessages-${whatsApp.companyId}`, {
              action: "update",
              status: { this: i + 1, all: qtd, state: "IMPORTING", date: moment(timestampMsg).format("DD/MM/YY HH:mm:ss") }
            });
        }

        // Delay anti-ban: 500ms entre mensagens para evitar detecção de bot
        await new Promise(r => setTimeout(r, 500));


        if (i + 1 === qtd) {
          dataMessages[whatsappId] = [];

          if (whatsApp.closedTicketsPostImported) {
            await closeTicketsImported(whatsappId)
          }
          await whatsApp.update({
            statusImportMessages: whatsApp.closedTicketsPostImported ? null : "renderButtonCloseTickets",
            importOldMessages: null,
            importRecentMessages: null
          });

          // Emitir conclusão 100% antes do refresh
          io.of(`/workspace-${whatsApp.companyId}`)
            .emit(`importMessages-${whatsApp.companyId}`, {
              action: "update",
              status: { this: qtd, all: qtd, state: "COMPLETED", date: moment().format("DD/MM/YY HH:mm:ss") }
            });

          // Pequena pausa para UI processar
          await new Promise(r => setTimeout(r, 1000));

          io.of(`/workspace-${whatsApp.companyId}`)
            .emit(`importMessages-${whatsApp.companyId}`, {
              action: "refresh",
            });
        }
      } catch (error: any) {
        logger.error(`[Import] Erro ao importar mensagem ${i + 1}/${qtd}: ${error?.message || error}`);
        addLogs({
          fileName: `processImportMessagesWppId${whatsappId}.txt`,
          text: `ERRO na mensagem ${i + 1}: ${error?.message || error}`
        });
      }

      i++
    }


  } catch (error) {
    throw new AppError("ERR_NOT_MESSAGE_TO_IMPORT", 403);
  }

  return "whatsapps";
};

export default ImportWhatsAppMessageService;