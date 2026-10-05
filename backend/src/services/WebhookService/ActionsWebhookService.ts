import AppError from "../../errors/AppError";
import { WebhookModel } from "../../models/Webhook";
import { sendMessageFlow } from "../../controllers/MessageController";
import { IConnections, INodes } from "./DispatchWebHookService";
import { Request, Response } from "express";
import { ParamsDictionary } from "express-serve-static-core";
import { ParsedQs } from "qs";
import CreateContactService from "../ContactServices/CreateContactService";
import Contact from "../../models/Contact";
import CreateTicketService from "../TicketServices/CreateTicketService";
import CreateTicketServiceWebhook from "../TicketServices/CreateTicketServiceWebhook";
import { SendMessage } from "../../helpers/SendMessage";
import GetDefaultWhatsApp from "../../helpers/GetDefaultWhatsApp";
import Ticket from "../../models/Ticket";
import fs from "fs";
import GetWhatsappWbot from "../../helpers/GetWhatsappWbot";
import path from "path";
import SendWhatsAppMedia from "../WbotServices/SendWhatsAppMedia";
import SendWhatsAppMediaFlow, {
  typeSimulation
} from "../WbotServices/SendWhatsAppMediaFlow";
import { randomizarCaminho } from "../../utils/randomizador";
import { SendMessageFlow } from "../../helpers/SendMessageFlow";
import formatBody from "../../helpers/Mustache";
import SetTicketMessagesAsRead from "../../helpers/SetTicketMessagesAsRead";
import SendWhatsAppMessage from "../WbotServices/SendWhatsAppMessage";
import ShowTicketService from "../TicketServices/ShowTicketService";
import CreateMessageService, {
  MessageData
} from "../MessageServices/CreateMessageService";
import { randomString } from "../../utils/randomCode";
import ShowQueueService from "../QueueService/ShowQueueService";
import { getIO } from "../../libs/socket";
import UpdateTicketService from "../TicketServices/UpdateTicketService";
import FindOrCreateATicketTrakingService from "../TicketServices/FindOrCreateATicketTrakingService";
import ShowTicketUUIDService from "../TicketServices/ShowTicketFromUUIDService";
import logger from "../../utils/logger";
import CreateLogTicketService from "../TicketServices/CreateLogTicketService";
import CompaniesSettings from "../../models/CompaniesSettings";
import ShowWhatsAppService from "../WhatsappService/ShowWhatsAppService";
import { delay } from "bluebird";
import typebotListener from "../TypebotServices/typebotListener";
import { getWbotOrRecover } from "../../libs/wbot";
import { proto } from "@whiskeysockets/baileys";
import { handleOpenAi } from "../IntegrationsServices/OpenAiService";
import { IOpenAi } from "../../@types/openai";
import { emitTicketStatusChange, emitTicketUpdateSimple } from "../../helpers/emitTicketUpdate";
import FlowExecutionLog from "../../models/FlowExecutionLog";
import axios from "axios";
import Tag from "../../models/Tag";
import ContactTag from "../../models/ContactTag";
import { FlowBuilderModel } from "../../models/FlowBuilder";
import User from "../../models/User";
import ContactCustomField from "../../models/ContactCustomField";

interface IAddContact {
  companyId: number;
  name: string;
  phoneNumber: string;
  email?: string;
  dataMore?: any;
}

// Item 6 do plano: log de execução do FlowBuilder. Side-effect puro — nunca
// lança erro, para não alterar o fluxo de controle já existente do loop.
const safeLogFlowExecution = async (params: {
  flowBuilderId: number;
  companyId: number;
  ticketId?: number | null;
  nodeId?: string | null;
  nodeType?: string | null;
  status: "executed" | "error";
  errorMessage?: string | null;
  contextSnapshot?: any;
}): Promise<void> => {
  try {
    await FlowExecutionLog.create({
      flowBuilderId: params.flowBuilderId,
      companyId: params.companyId,
      ticketId: params.ticketId ?? null,
      nodeId: params.nodeId ?? null,
      nodeType: params.nodeType ?? null,
      status: params.status,
      errorMessage: params.errorMessage ?? null,
      contextSnapshot: params.contextSnapshot ?? null
    } as any);
  } catch (logError) {
    logger.error(`[FlowExecutionLog] Falha ao gravar log de execução: ${logError}`);
  }
};

export const ActionsWebhookService = async (
  whatsappId: number,
  idFlowDb: number,
  companyId: number,
  nodes: INodes[],
  connects: IConnections[],
  nextStage: string,
  dataWebhook: any,
  details: any,
  hashWebhookId: string,
  pressKey?: string,
  idTicket?: number,
  numberPhrase: "" | { number: string; name: string; email: string } = "",
  msg?: proto.IWebMessageInfo,
  flowDepth: number = 0
): Promise<string> => {
  try {
    const io = getIO();
    let next = nextStage;
    console.log(
      "ActionWebhookService | 53",
      idFlowDb,
      companyId,
      nodes,
      connects,
      nextStage,
      dataWebhook,
      details,
      hashWebhookId,
      pressKey,
      idTicket,
      numberPhrase
    );
    let createFieldJsonName = "";

    const connectStatic = connects;
    if (numberPhrase === "") {
      const nameInput = details.inputs.find(item => item.keyValue === "nome");
      nameInput.data.split(",").map(dataN => {
        const lineToData = details.keysFull.find(item => item === dataN);
        let sumRes = "";
        if (!lineToData) {
          sumRes = dataN;
        } else {
          sumRes = constructJsonLine(lineToData, dataWebhook);
        }
        createFieldJsonName = createFieldJsonName + sumRes;
      });
    } else {
      createFieldJsonName = numberPhrase.name;
    }

    let numberClient = "";

    if (numberPhrase === "") {
      const numberInput = details.inputs.find(
        item => item.keyValue === "celular"
      );

      numberInput.data.split(",").map(dataN => {
        const lineToDataNumber = details.keysFull.find(item => item === dataN);
        let createFieldJsonNumber = "";
        if (!lineToDataNumber) {
          createFieldJsonNumber = dataN;
        } else {
          createFieldJsonNumber = constructJsonLine(
            lineToDataNumber,
            dataWebhook
          );
        }

        numberClient = numberClient + createFieldJsonNumber;
      });
    } else {
      numberClient = numberPhrase.number;
    }

    numberClient = removerNaoLetrasNumeros(numberClient);

    if (numberClient.substring(0, 2) === "55") {
      if (parseInt(numberClient.substring(2, 4)) >= 31) {
        if (numberClient.length === 13) {
          numberClient =
            numberClient.substring(0, 4) + numberClient.substring(5, 13);
        }
      }
    }

    let createFieldJsonEmail = "";

    if (numberPhrase === "") {
      const emailInput = details.inputs.find(item => item.keyValue === "email");
      emailInput.data.split(",").map(dataN => {
        const lineToDataEmail = details.keysFull.find(item =>
          item.endsWith("email")
        );

        let sumRes = "";
        if (!lineToDataEmail) {
          sumRes = dataN;
        } else {
          sumRes = constructJsonLine(lineToDataEmail, dataWebhook);
        }

        createFieldJsonEmail = createFieldJsonEmail + sumRes;
      });
    } else {
      createFieldJsonEmail = numberPhrase.email;
    }

    const whatsapp = await GetDefaultWhatsApp(whatsappId, companyId);

    if (whatsapp.status !== "CONNECTED") {
      return;
    }

    let execCount = 0;

    let execFn = "";

    let ticket = null;

    let noAlterNext = false;

    // Contador de saltos gotoFlow — evita loop infinito entre fluxos (máx. 5)
    let gotoDepth = flowDepth;

    // Carrega o ticket sob demanda: parte dos nós executa antes de qualquer
    // bloco que inicialize `ticket` (singleBlock/menu faziam isso depois).
    const ensureTicket = async (): Promise<Ticket | null> => {
      if (!ticket && idTicket) {
        ticket = await Ticket.findOne({
          where: { id: idTicket, companyId }
        });
      }
      return ticket;
    };

    // Loop usa nodes.length direto: gotoFlow anexa novos nós ao array
    // durante a execução e eles precisam ser alcançáveis pelo `next`.
    for (var i = 0; i < nodes.length; i++) {
      let nodeSelected: any;
      let ticketInit: Ticket;

      if (pressKey) {
        console.log("UPDATE2...");
        if (pressKey === "parar") {
          console.log("UPDATE3...");
          if (idTicket) {
            console.log("UPDATE4...");
            ticketInit = await Ticket.findOne({
              where: { id: idTicket, whatsappId }
            });
            await ticket.update({
              status: "closed"
            });
            // Emitir evento de deleção (remover da aba antiga)
            await emitTicketStatusChange(ticket, companyId, ticket.status);
          }
          break;
        }

        if (execFn === "") {
          console.log("UPDATE5...");
          nodeSelected = {
            type: "menu"
          };
        } else {
          console.log("UPDATE6...");
          nodeSelected = nodes.filter(node => node.id === execFn)[0];
        }
      } else {
        console.log("UPDATE7...");
        const otherNode = nodes.filter(node => node.id === next)[0];
        if (otherNode) {
          nodeSelected = otherNode;
        }
      }

      if (nodeSelected) {
        await safeLogFlowExecution({
          flowBuilderId: idFlowDb,
          companyId,
          ticketId: idTicket ?? (ticket ? ticket.id : null),
          nodeId: nodeSelected.id,
          nodeType: nodeSelected.type,
          status: "executed"
        });
      }

      if (nodeSelected.type === "message") {
        
        let msg;
        
        const webhook = ticket.dataWebhook

        if (webhook && webhook.hasOwnProperty("variables")) {
          msg = {
            body: replaceMessages(webhook, nodeSelected.data.label)
          };
        } else {
          msg = {
            body: nodeSelected.data.label
          };
        }

        await SendMessage(whatsapp, {
          number: numberClient,
          body: msg.body
        });
        

        //TESTE BOTÃO
        //await SendMessageFlow(whatsapp, {
        //  number: numberClient,
        //  body: msg.body
        //} )
        await intervalWhats("1");
      }
      console.log("273");
      if (nodeSelected.type === "typebot") {
        console.log("275");
        // CORREÇÃO: Usar getWbotOrRecover para aguardar sessão durante reconexão
        const wbot = await getWbotOrRecover(whatsapp.id, 30000);
        if (!wbot) {
          throw new AppError("ERR_WAPP_NOT_INITIALIZED");
        }
        await typebotListener({
          wbot: wbot,
          msg,
          ticket,
          typebot: nodeSelected.data.typebotIntegration
        });
      }

      if (nodeSelected.type === "openai") {
        let {
          name,
          prompt,
          voice,
          voiceKey,
          voiceRegion,
          maxTokens,
          temperature,
          apiKey,
          queueId,
          maxMessages
        } = nodeSelected.data.typebotIntegration as IOpenAi;

        let openAiSettings = {
          name,
          prompt,
          voice,
          voiceKey,
          voiceRegion,
          maxTokens,
          temperature,
          apiKey,
          queueId,
          maxMessages
        };

        const contact = await Contact.findOne({
          where: { number: numberClient, companyId }
        });

        const wbot = await getWbotOrRecover(whatsapp.id, 30000);
        if (!wbot) {
          throw new AppError("ERR_WAPP_NOT_INITIALIZED");
        }

        const ticketTraking = await FindOrCreateATicketTrakingService({
          ticketId: ticket.id,
          companyId,
          userId: null,
          whatsappId: whatsapp?.id
        });

                await handleOpenAi(
  {
    name,
    prompt,
    voice,
    voiceKey,
    voiceRegion,
    model: "gpt-3.5-turbo",
    maxTokens,
    temperature,
    apiKey,
    queueId,
    maxMessages
  },
  msg,
  wbot,
  ticket,
  contact,
  null,
  ticketTraking
);
        await handleOpenAi(undefined,
          msg,
          wbot,
          ticket,
          contact,
          null,
          ticketTraking
        );
      }

      if (nodeSelected.type === "question") {
        const webhook = ticket?.dataWebhook;
        const variables = ticket?.dataWebhook?.variables;

        if (!variables || variables === undefined || variables === null) {
          const { message } = nodeSelected.data.typebotIntegration;
          const ticketDetails = await ShowTicketService(ticket.id, companyId);

          const bodyFila = formatBody(`${message}`, ticket.contact);

          await delay(3000);
          await typeSimulation(ticket, "composing");

          await SendWhatsAppMessage({
            body: bodyFila,
            ticket: ticketDetails,
            quotedMsg: null
          });

          SetTicketMessagesAsRead(ticketDetails);

          await ticketDetails.update({
            lastMessage: bodyFila
          });

          await ticket.update({
            userId: null,
            companyId: companyId,
            lastFlowId: nodeSelected.id,
            hashFlowId: hashWebhookId,
            flowStopped: idFlowDb.toString()
          });
          // Emitir update do ticket
          await emitTicketUpdateSimple(ticket, companyId);
        }
        break;
      }

      if (nodeSelected.type === "ticket") {
        const queueId = nodeSelected.data?.data?.id || nodeSelected.data?.id;
        const queue = await ShowQueueService(queueId, companyId);

        await ticket.update({
          status: "pending",
          queueId: queue.id,
          userId: ticket.userId,
          companyId: companyId,
          flowWebhook: true,
          lastFlowId: nodeSelected.id,
          hashFlowId: hashWebhookId,
          flowStopped: idFlowDb.toString()
        });
        // Nota: UpdateTicketService abaixo já emite eventos

        await FindOrCreateATicketTrakingService({
          ticketId: ticket.id,
          companyId,
          whatsappId: ticket.whatsappId,
          userId: ticket.userId
        });

        await UpdateTicketService({
          ticketData: {
            status: "pending",
            queueId: queue.id
          },
          ticketId: ticket.id,
          companyId
        });

        await CreateLogTicketService({
          ticketId: ticket.id,
          type: "queue",
          queueId: queue.id
        });

        let settings = await CompaniesSettings.findOne({
          where: {
            companyId: companyId
          }
        });

        const enableQueuePosition = settings.sendQueuePosition === "enabled";

        if (enableQueuePosition) {
          const count = await Ticket.findAndCountAll({
            where: {
              userId: null,
              status: "pending",
              companyId,
              queueId: queue.id,
              whatsappId: whatsapp.id,
              isGroup: false
            }
          });

          // Lógica para enviar posição da fila de atendimento
          const qtd = count.count === 0 ? 1 : count.count;

          const msgFila = `${settings.sendQueuePositionMessage} *${qtd}*`;

          const ticketDetails = await ShowTicketService(ticket.id, companyId);

          const bodyFila = formatBody(`${msgFila}`, ticket.contact);

          await delay(3000);
          await typeSimulation(ticket, "composing");

          await SendWhatsAppMessage({
            body: bodyFila,
            ticket: ticketDetails,
            quotedMsg: null
          });

          SetTicketMessagesAsRead(ticketDetails);

          await ticketDetails.update({
            lastMessage: bodyFila
          });
        }
      }

      if (nodeSelected.type === "singleBlock") {
        for (var iLoc = 0; iLoc < nodeSelected.data.seq.length; iLoc++) {
          const elementNowSelected = nodeSelected.data.seq[iLoc];

          ticket = await Ticket.findOne({
            where: { id: idTicket, companyId }
          });

          if (elementNowSelected.includes("message")) {
            const bodyFor = nodeSelected.data.elements.filter(
              item => item.number === elementNowSelected
            )[0].value;

            const ticketDetails = await ShowTicketService(idTicket, companyId);

            let msg;

            const webhook = ticket.dataWebhook;

            if (webhook && webhook.hasOwnProperty("variables")) {
              msg = replaceMessages(webhook.variables, bodyFor);
            } else {
              msg = bodyFor;
            }

            await delay(3000);
            await typeSimulation(ticket, "composing");

            await SendWhatsAppMessage({
              body: msg,
              ticket: ticketDetails,
              quotedMsg: null
            });

            SetTicketMessagesAsRead(ticketDetails);

            await ticketDetails.update({
              lastMessage: formatBody(bodyFor, ticket.contact)
            });

            await intervalWhats("1");
          }
          if (elementNowSelected.includes("interval")) {
            await intervalWhats(
              nodeSelected.data.elements.filter(
                item => item.number === elementNowSelected
              )[0].value
            );
          }

          if (elementNowSelected.includes("img")) {
            await typeSimulation(ticket, "composing");

            await SendMessage(whatsapp, {
              number: numberClient,
              body: "",
              mediaPath:
                process.env.BACKEND_URL === "https://localhost:8090"
                  ? `${__dirname.split("src")[0].split("\\").join("/")}public/company${companyId}/${
                    nodeSelected.data.elements.filter(
                      item => item.number === elementNowSelected
                    )[0].value
                    }`
                  : `${__dirname
                      .split("dist")[0]
                      .split("\\")
                      .join("/")}public/company${companyId}/${
                      nodeSelected.data.elements.filter(
                        item => item.number === elementNowSelected
                      )[0].value
                    }`
            });
            await intervalWhats("1");
          }

          if (elementNowSelected.includes("audio")) {
            const mediaDirectory =
              process.env.BACKEND_URL === "https://localhost:8090"
                ? `${__dirname.split("src")[0].split("\\").join("/")}public/company${companyId}/${
                    nodeSelected.data.elements.filter(
                      item => item.number === elementNowSelected
                    )[0].value
                  }`
                : `${__dirname.split("dist")[0].split("\\").join("/")}public/company${companyId}/${
                    nodeSelected.data.elements.filter(
                      item => item.number === elementNowSelected
                    )[0].value
                  }`;
            const ticketInt = await Ticket.findOne({
              where: { id: ticket.id }
            });

            await typeSimulation(ticket, "recording");

            await SendWhatsAppMediaFlow({
              media: mediaDirectory,
              ticket: ticketInt,
              isRecord: nodeSelected.data.elements.filter(
                item => item.number === elementNowSelected
              )[0].record
            });
            //fs.unlinkSync(mediaDirectory.split('.')[0] + 'A.mp3');
            await intervalWhats("1");
          }
          if (elementNowSelected.includes("video")) {
            const mediaDirectory =
              process.env.BACKEND_URL === "https://localhost:8090"
                ? `${__dirname.split("src")[0].split("\\").join("/")}public/${
                    nodeSelected.data.elements.filter(
                      item => item.number === elementNowSelected
                    )[0].value
                  }`
                : `${__dirname.split("dist")[0].split("\\").join("/")}public/${
                    nodeSelected.data.elements.filter(
                      item => item.number === elementNowSelected
                    )[0].value
                  }`;
            const ticketInt = await Ticket.findOne({
              where: { id: ticket.id }
            });

            await typeSimulation(ticket, "recording");

            await SendWhatsAppMediaFlow({
              media: mediaDirectory,
              ticket: ticketInt
            });
            //fs.unlinkSync(mediaDirectory.split('.')[0] + 'A.mp3');
            await intervalWhats("1");
          }
        }
      }

      let isRandomizer: boolean;
      if (nodeSelected.type === "randomizer") {
        const selectedRandom = randomizarCaminho(
          nodeSelected.data.percent / 100
        );

        const resultConnect = connects.filter(
          connect => connect.source === nodeSelected.id
        );
        if (selectedRandom === "A") {
          next = resultConnect.filter(item => item.sourceHandle === "a")[0]
            .target;
          noAlterNext = true;
        } else {
          next = resultConnect.filter(item => item.sourceHandle === "b")[0]
            .target;
          noAlterNext = true;
        }
        isRandomizer = true;
      }

      let isCondition = false;
      let isGotoFlow = false;
      let isBusinessHours = false;

      // Nó "condition": desvia pelo sourceHandle "a" (verdadeiro) ou "b"
      // (falso) conforme a comparação da chave com o valor configurado.
      if (nodeSelected.type === "condition") {
        await ensureTicket();

        const keyCond = nodeSelected.data?.key;
        const opCond = Number(nodeSelected.data?.condition);
        const valCond = nodeSelected.data?.value ?? "";

        // Resolve a chave em: variáveis capturadas -> dataWebhook -> contato -> ""
        const dwCond: any = ticket?.dataWebhook || {};
        const varsCond: any = dwCond?.variables || {};
        let leftCond: any = "";

        if (keyCond && Object.prototype.hasOwnProperty.call(varsCond, keyCond)) {
          leftCond = varsCond[keyCond];
        } else if (
          keyCond &&
          Object.prototype.hasOwnProperty.call(dwCond, keyCond)
        ) {
          leftCond = dwCond[keyCond];
        } else {
          let contactCond: Contact = ticket?.contact;
          if (!contactCond && ticket?.contactId) {
            contactCond = await Contact.findOne({
              where: { id: ticket.contactId, companyId }
            });
          }
          if (!contactCond && numberClient) {
            contactCond = await Contact.findOne({
              where: { number: numberClient, companyId }
            });
          }
          if (contactCond) {
            if (keyCond === "name") leftCond = contactCond.name;
            else if (keyCond === "email") leftCond = contactCond.email;
            else if (keyCond === "number") leftCond = contactCond.number;
          }
        }

        let resultCond = false;
        if (opCond === 1) {
          // Igualdade textual: case-insensitive e sem espaços nas pontas
          resultCond =
            String(leftCond ?? "").trim().toLowerCase() ===
            String(valCond).trim().toLowerCase();
        } else {
          const numLeft = parseFloat(leftCond);
          const numRight = parseFloat(valCond);
          if (!isNaN(numLeft) && !isNaN(numRight)) {
            if (opCond === 2) resultCond = numLeft >= numRight;
            else if (opCond === 3) resultCond = numLeft <= numRight;
            else if (opCond === 4) resultCond = numLeft < numRight;
            else if (opCond === 5) resultCond = numLeft > numRight;
          }
        }

        const edgeCond = connects.filter(
          c =>
            c.source === nodeSelected.id &&
            c.sourceHandle === (resultCond ? "a" : "b")
        )[0];

        if (!edgeCond) {
          // Sem edge correspondente: encerra a execução do fluxo
          next = "";
          noAlterNext = true;
          break;
        }

        next = edgeCond.target;
        noAlterNext = true;
        isCondition = true;
      }

      // Nó "tag": adiciona/remove tag no contato do ticket. Falhas são
      // logadas e não interrompem o fluxo.
      if (nodeSelected.type === "tag") {
        try {
          await ensureTicket();

          const tagIdNode = Number(nodeSelected.data?.tagId);
          const actionTag = nodeSelected.data?.action;

          let contactTag: Contact = ticket?.contact;
          if (!contactTag && ticket?.contactId) {
            contactTag = await Contact.findOne({
              where: { id: ticket.contactId, companyId }
            });
          }
          if (!contactTag && numberClient) {
            contactTag = await Contact.findOne({
              where: { number: numberClient, companyId }
            });
          }

          if (!tagIdNode || !contactTag) {
            logger.warn(
              `[FlowBuilder][tag] node=${nodeSelected.id} sem tagId ou contato`
            );
          } else {
            // Valida que a Tag pertence à empresa antes de gravar
            const tagNode = await Tag.findOne({
              where: { id: tagIdNode, companyId }
            });
            if (!tagNode) {
              logger.warn(
                `[FlowBuilder][tag] Tag ${tagIdNode} não pertence à empresa ${companyId}`
              );
            } else if (actionTag === "add") {
              await ContactTag.findOrCreate({
                where: {
                  contactId: contactTag.id,
                  tagId: tagIdNode,
                  companyId
                }
              });
            } else if (actionTag === "remove") {
              await ContactTag.destroy({
                where: {
                  contactId: contactTag.id,
                  tagId: tagIdNode,
                  companyId
                }
              });
            }
          }
        } catch (errTag) {
          logger.warn(
            `[FlowBuilder][tag] Falha no node ${nodeSelected.id}: ${errTag?.message || errTag}`
          );
        }
      }

      // Nó "webhook": chamada HTTP externa com interpolação {{var}} no body
      // e headers. Resposta/status vão para dataWebhook.variables. Falha
      // HTTP salva o status e segue o fluxo (não lança exceção).
      if (nodeSelected.type === "webhook") {
        await ensureTicket();

        const dataWh = nodeSelected.data || {};
        const varsWh: any = ticket?.dataWebhook?.variables || {};
        const headersWh: Record<string, string> = {};
        (dataWh.headers || []).forEach((h: any) => {
          if (h?.key) {
            headersWh[h.key] = replaceMessages(varsWh, String(h.value ?? ""));
          }
        });

        let statusWh: number | null = null;
        let responseWh: any = null;
        try {
          const respWh = await axios.request({
            method: String(dataWh.method || "GET").toUpperCase(),
            url: replaceMessages(varsWh, String(dataWh.url || "")),
            data: dataWh.body
              ? replaceMessages(varsWh, String(dataWh.body))
              : undefined,
            headers: headersWh,
            timeout: 10000
          });
          statusWh = respWh.status;
          responseWh = respWh.data;
        } catch (errWh) {
          // Sem URL/segredos no log — apenas status e node
          statusWh = errWh?.response?.status ?? null;
          responseWh = errWh?.response?.data ?? null;
          logger.warn(
            `[FlowBuilder][webhook] node=${nodeSelected.id} falhou status=${statusWh}`
          );
        }

        if (dataWh.responseVariable && ticket) {
          const dwWh: any = { ...(ticket.dataWebhook || {}) };
          const varsUpd: any = { ...(dwWh.variables || {}) };
          varsUpd[dataWh.responseVariable] =
            responseWh !== null && typeof responseWh === "object"
              ? JSON.stringify(responseWh)
              : responseWh;
          varsUpd[`${dataWh.responseVariable}_status`] = statusWh;
          dwWh.variables = varsUpd;
          await ticket.update({ dataWebhook: dwWh });
        }
      }

      // Nó "end": encerra o fluxo; opcionalmente fecha o ticket.
      if (nodeSelected.type === "end") {
        await ensureTicket();

        if (ticket) {
          await ticket.update({
            flowWebhook: false,
            flowStopped: idFlowDb.toString(),
            hashFlowId: null,
            lastFlowId: nodeSelected.id
          });

          if (nodeSelected.data?.closeTicket) {
            // UpdateTicketService emite os eventos de fechamento
            await UpdateTicketService({
              ticketData: { status: "closed" },
              ticketId: ticket.id,
              companyId
            });
          }
        } else {
          logger.warn(
            `[FlowBuilder][end] node=${nodeSelected.id} sem ticket vinculado`
          );
        }

        break;
      }

      // Nó "gotoFlow": anexa nós/conexões do fluxo destino na execução
      // corrente e desvia para o nó "start" dele. Limitado a 5 saltos.
      if (nodeSelected.type === "gotoFlow") {
        const flowIdGoto = Number(nodeSelected.data?.flowId);

        if (gotoDepth >= 5) {
          logger.warn(
            `[FlowBuilder][gotoFlow] Limite de 5 saltos atingido — flow=${idFlowDb} node=${nodeSelected.id}`
          );
          break;
        }

        const flowGoto = flowIdGoto
          ? await FlowBuilderModel.findOne({
              where: { id: flowIdGoto, company_id: companyId }
            })
          : null;

        const startGoto = ((flowGoto?.flow as any)?.nodes || []).find(
          (n: any) => n.type === "start"
        );

        if (!flowGoto || !startGoto) {
          logger.warn(
            `[FlowBuilder][gotoFlow] Fluxo ${flowIdGoto} inexistente ou sem nó start — flow=${idFlowDb}`
          );
          break;
        }

        gotoDepth++;

        // `connectStatic` referencia o mesmo array de `connects`
        nodes.push(...(((flowGoto.flow as any)?.nodes) || []));
        connects.push(...(((flowGoto.flow as any)?.connections) || []));

        // Edge sintética: garante saída do nó gotoFlow no cálculo de `next`
        connects.push({
          id: `goto-${nodeSelected.id}-${startGoto.id}`,
          source: nodeSelected.id,
          sourceHandle: null,
          target: startGoto.id,
          targetHandle: null
        });

        next = startGoto.id;
        noAlterNext = true;
        isGotoFlow = true;
      }

      // Nó "businessHours": desvia por "a" (dentro do horário) ou "b"
      // (fora) conforme dia da semana + janela start/end configuradas.
      if (nodeSelected.type === "businessHours") {
        const dataBh = nodeSelected.data || {};
        const daysBh: string[] = Array.isArray(dataBh.days)
          ? dataBh.days
          : [];

        // Hora local do servidor; se o nó informar timezone, converte
        let nowBh = new Date();
        if (dataBh.timezone) {
          try {
            nowBh = new Date(
              new Date().toLocaleString("en-US", {
                timeZone: dataBh.timezone
              })
            );
          } catch {
            logger.warn(
              `[FlowBuilder][businessHours] node=${nodeSelected.id} timezone inválido: ${dataBh.timezone}`
            );
          }
        }

        const diasSemanaBh = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"];
        const diaAtualBh = diasSemanaBh[nowBh.getDay()];
        // Lista vazia = todos os dias
        const diaOkBh =
          daysBh.length === 0 ||
          daysBh.map(d => String(d).toLowerCase()).includes(diaAtualBh);

        const minAgoraBh = nowBh.getHours() * 60 + nowBh.getMinutes();
        const [hIniBh, mIniBh] = String(dataBh.start || "00:00")
          .split(":")
          .map(Number);
        const [hFimBh, mFimBh] = String(dataBh.end || "23:59")
          .split(":")
          .map(Number);
        const minIniBh = (hIniBh || 0) * 60 + (mIniBh || 0);
        const minFimBh = (hFimBh || 0) * 60 + (mFimBh || 0);
        const horaOkBh = minAgoraBh >= minIniBh && minAgoraBh <= minFimBh;

        const edgeBh = connects.filter(
          c =>
            c.source === nodeSelected.id &&
            c.sourceHandle === (diaOkBh && horaOkBh ? "a" : "b")
        )[0];

        if (!edgeBh) {
          // Sem edge correspondente: encerra a execução do fluxo
          next = "";
          noAlterNext = true;
          break;
        }

        next = edgeBh.target;
        noAlterNext = true;
        isBusinessHours = true;
      }

      // Nó "assignUser": atribui o ticket a um usuário da empresa e marca
      // como "open". Falhas são logadas e não interrompem o fluxo.
      if (nodeSelected.type === "assignUser") {
        try {
          await ensureTicket();

          const userIdAssign = Number(nodeSelected.data?.userId);

          if (!userIdAssign || !ticket) {
            logger.warn(
              `[FlowBuilder][assignUser] node=${nodeSelected.id} sem userId ou ticket`
            );
          } else {
            // Valida que o usuário pertence à empresa antes de atribuir
            const userAssign = await User.findOne({
              where: { id: userIdAssign, companyId }
            });
            if (!userAssign) {
              logger.warn(
                `[FlowBuilder][assignUser] Usuário ${userIdAssign} não pertence à empresa ${companyId}`
              );
            } else {
              await ticket.update({
                userId: userIdAssign,
                status: "open"
              });

              // UpdateTicketService emite os eventos de atualização
              await UpdateTicketService({
                ticketData: {
                  userId: userIdAssign,
                  status: "open"
                },
                ticketId: ticket.id,
                companyId
              });

              await CreateLogTicketService({
                ticketId: ticket.id,
                type: "userDefine",
                userId: userIdAssign
              });
            }
          }
        } catch (errAssign) {
          logger.warn(
            `[FlowBuilder][assignUser] Falha no node ${nodeSelected.id}: ${errAssign?.message || errAssign}`
          );
        }
      }

      // Nó "internalNote": grava mensagem privada (nota interna) no ticket
      // com interpolação {{var}} — não é enviada ao contato. Falhas são
      // logadas e não interrompem o fluxo.
      if (nodeSelected.type === "internalNote") {
        try {
          await ensureTicket();

          if (!ticket) {
            logger.warn(
              `[FlowBuilder][internalNote] node=${nodeSelected.id} sem ticket vinculado`
            );
          } else {
            const varsNote: any = ticket?.dataWebhook?.variables || {};
            const messageDataNote: MessageData = {
              wid: randomString(50),
              ticketId: ticket.id,
              body: replaceMessages(
                varsNote,
                String(nodeSelected.data?.text ?? "")
              ),
              fromMe: true,
              read: true,
              isPrivate: true
            };
            await CreateMessageService({
              messageData: messageDataNote,
              companyId
            });
          }
        } catch (errNote) {
          logger.warn(
            `[FlowBuilder][internalNote] Falha no node ${nodeSelected.id}: ${errNote?.message || errNote}`
          );
        }
      }

      // Nó "updateContact": atualiza name/email do contato ou faz upsert de
      // campo customizado. Valor aceita interpolação {{var}}. Falhas são
      // logadas e não interrompem o fluxo.
      if (nodeSelected.type === "updateContact") {
        try {
          await ensureTicket();

          const dataUc = nodeSelected.data || {};
          const fieldUc = dataUc.field;
          const varsUc: any = ticket?.dataWebhook?.variables || {};
          const valueUc = replaceMessages(varsUc, String(dataUc.value ?? ""));

          let contactUc: Contact = ticket?.contact;
          if (!contactUc && ticket?.contactId) {
            contactUc = await Contact.findOne({
              where: { id: ticket.contactId, companyId }
            });
          }
          if (!contactUc && numberClient) {
            contactUc = await Contact.findOne({
              where: { number: numberClient, companyId }
            });
          }

          if (!contactUc || !fieldUc) {
            logger.warn(
              `[FlowBuilder][updateContact] node=${nodeSelected.id} sem field ou contato`
            );
          } else if (fieldUc === "name" || fieldUc === "email") {
            await contactUc.update({ [fieldUc]: valueUc });
          } else if (fieldUc === "custom") {
            const keyUc = String(dataUc.customKey || "").trim();
            if (!keyUc) {
              logger.warn(
                `[FlowBuilder][updateContact] node=${nodeSelected.id} sem customKey`
              );
            } else {
              // ContactCustomField não tem companyId — o isolamento é pelo
              // contactId, já resolvido com companyId acima
              const [fieldRowUc, createdUc] = await ContactCustomField.findOrCreate({
                where: { contactId: contactUc.id, name: keyUc },
                defaults: {
                  contactId: contactUc.id,
                  name: keyUc,
                  value: valueUc
                }
              });
              if (!createdUc) {
                await fieldRowUc.update({ value: valueUc });
              }
            }
          }
        } catch (errUc) {
          logger.warn(
            `[FlowBuilder][updateContact] Falha no node ${nodeSelected.id}: ${errUc?.message || errUc}`
          );
        }
      }

      let isMenu: boolean;

      if (nodeSelected.type === "menu") {
        console.log(650, "menu");
        if (pressKey) {
          const filterOne = connectStatic.filter(
            confil => confil.source === next
          );
          const filterTwo = filterOne.filter(
            filt2 => filt2.sourceHandle === "a" + pressKey
          );
          if (filterTwo.length > 0) {
            execFn = filterTwo[0].target;
          } else {
            execFn = undefined;
          }
          // execFn =
          //   connectStatic
          //     .filter(confil => confil.source === next)
          //     .filter(filt2 => filt2.sourceHandle === "a" + pressKey)[0]?.target ??
          //   undefined;
          if (execFn === undefined) {
            break;
          }
          pressKey = "999";

          const isNodeExist = nodes.filter(item => item.id === execFn);
          console.log(674, "menu");
          if (isNodeExist.length > 0) {
            isMenu = isNodeExist[0].type === "menu" ? true : false;
          } else {
            isMenu = false;
          }
        } else {
          console.log(681, "menu");
          let optionsMenu = "";
          nodeSelected.data.arrayOption.map(item => {
            optionsMenu += `[${item.number}] ${item.value}
`;
          });

          const menuCreate = `${nodeSelected.data.message}

${optionsMenu}`;

          const webhook = ticket.dataWebhook;

          let msg;
          if (webhook && webhook.hasOwnProperty("variables")) {
            msg = {
              body: replaceMessages(webhook, menuCreate),
              number: numberClient,
              companyId: companyId
            };
          } else {
            msg = {
              body: menuCreate,
              number: numberClient,
              companyId: companyId
            };
          }

          const ticketDetails = await ShowTicketService(ticket.id, companyId);

          const messageData: MessageData = {
            wid: randomString(50),
            ticketId: ticket.id,
            body: msg.body,
            fromMe: true,
            read: true
          };

          //await CreateMessageService({ messageData: messageData, companyId });

          //await SendWhatsAppMessage({ body: bodyFor, ticket: ticketDetails, quotedMsg: null })

          // await SendMessage(whatsapp, {
          //   number: numberClient,
          //   body: msg.body
          // });

          await typeSimulation(ticket, "composing");

          await SendWhatsAppMessage({
            body: msg.body,
            ticket: ticketDetails,
            quotedMsg: null
          });

          SetTicketMessagesAsRead(ticketDetails);

          await ticketDetails.update({
            lastMessage: formatBody(msg.body, ticket.contact)
          });
          await intervalWhats("1");

          if (ticket) {
            ticket = await Ticket.findOne({
              where: {
                id: ticket.id,
                whatsappId: whatsappId,
                companyId: companyId
              }
            });
          } else {
            ticket = await Ticket.findOne({
              where: {
                id: idTicket,
                whatsappId: whatsappId,
                companyId: companyId
              }
            });
          }

          if (ticket) {
            await ticket.update({
              queueId: ticket.queueId ? ticket.queueId : null,
              userId: null,
              companyId: companyId,
              flowWebhook: true,
              lastFlowId: nodeSelected.id,
              dataWebhook: dataWebhook,
              hashFlowId: hashWebhookId,
              flowStopped: idFlowDb.toString()
            });
            // Emitir update do ticket
            await emitTicketUpdateSimple(ticket, companyId);
          }

          break;
        }
      }

      let isContinue = false;

      if (pressKey === "999" && execCount > 0) {
        console.log(587, "ActionsWebhookService | 587");

        pressKey = undefined;
        let result = connects.filter(connect => connect.source === execFn)[0];
        if (typeof result === "undefined") {
          next = "";
        } else {
          if (!noAlterNext) {
            next = result.target;
          }
        }
      } else {
        let result;

        if (isMenu) {
          result = { target: execFn };
          isContinue = true;
          pressKey = undefined;
        } else if (isRandomizer) {
          isRandomizer = false;
          result = next;
        } else if (isCondition || isGotoFlow || isBusinessHours) {
          // condition/gotoFlow/businessHours já definiram `next`
          // manualmente — não recalcular nem zerar quando o alvo não tem
          // edge de saída
          isCondition = false;
          isGotoFlow = false;
          isBusinessHours = false;
          result = next;
        } else {
          result = connects.filter(connect => connect.source === next)[0];
        }

        if (typeof result === "undefined") {
          next = "";
        } else {
          if (!noAlterNext) {
            next = result.target;
          }
        }
        console.log(619, "ActionsWebhookService");
      }

      if (!pressKey && !isContinue) {
        const nextNode = connects.filter(
          connect => connect.source === nodeSelected.id
        ).length;

        console.log(626, "ActionsWebhookService");

        if (nextNode === 0) {
          console.log(654, "ActionsWebhookService");

          await Ticket.findOne({
            where: { id: idTicket, whatsappId, companyId: companyId }
          });
          await ticket.update({
            lastFlowId: nodeSelected.id,
            hashFlowId: null,
            flowWebhook: false,
            flowStopped: idFlowDb.toString()
          });
          break;
        }
      }

      isContinue = false;

      if (next === "") {
        break;
      }

      console.log(678, "ActionsWebhookService");
      // userId preservado: o nó "assignUser" pode ter acabado de atribuir
      // um atendente nesta mesma iteração — zerar aqui anularia a ação.
      await ticket.update({
        userId: ticket.userId,
        companyId: companyId,
        flowWebhook: true,
        lastFlowId: nodeSelected.id,
        hashFlowId: hashWebhookId,
        flowStopped: idFlowDb.toString()
      });
      // Emitir update do ticket
      await emitTicketUpdateSimple(ticket, companyId);

      noAlterNext = false;
      execCount++;
    }

    return "ds";
  } catch (error) {
    logger.error(error);
    await safeLogFlowExecution({
      flowBuilderId: idFlowDb,
      companyId,
      ticketId: idTicket ?? null,
      status: "error",
      errorMessage: error?.message || String(error)
    });
  }
};

const constructJsonLine = (line: string, json: any) => {
  let valor = json;
  const chaves = line.split(".");

  if (chaves.length === 1) {
    return valor[chaves[0]];
  }

  for (const chave of chaves) {
    valor = valor[chave];
  }
  return valor;
};

function removerNaoLetrasNumeros(texto: string) {
  return texto.replace(/[^a-zA-Z0-9]/g, "");
}

const sendMessageWhats = async (
  whatsId: number,
  msg: any,
  req: Request<ParamsDictionary, any, any, ParsedQs, Record<string, any>>
) => {
  sendMessageFlow(whatsId, msg, req);
  return Promise.resolve();
};

const intervalWhats = (time: string) => {
  const seconds = parseInt(time) * 1000;
  return new Promise(resolve => setTimeout(resolve, seconds));
};

const replaceMessages = (variables, message) => {
  return message.replace(
    /{{\s*([^{}\s]+)\s*}}/g,
    (match, key) => variables[key] || ""
  );
};

const replaceMessagesOld = (
  message: string,
  details: any,
  dataWebhook: any,
  dataNoWebhook?: any
) => {
  const matches = message.match(/\{([^}]+)\}/g);

  if (dataWebhook) {
    let newTxt = message.replace(/{+nome}+/, dataNoWebhook.nome);
    newTxt = newTxt.replace(/{+numero}+/, dataNoWebhook.numero);
    newTxt = newTxt.replace(/{+email}+/, dataNoWebhook.email);
    return newTxt;
  }

  if (matches && matches.includes("inputs")) {
    const placeholders = matches.map(match => match.replace(/\{|\}/g, ""));
    let newText = message;
    placeholders.map(item => {
      const value = details["inputs"].find(
        itemLocal => itemLocal.keyValue === item
      );
      const lineToData = details["keysFull"].find(itemLocal =>
        itemLocal.endsWith(`.${value.data}`)
      );
      const createFieldJson = constructJsonLine(lineToData, dataWebhook);
      newText = newText.replace(`{${item}}`, createFieldJson);
    });
    return newText;
  } else {
    return message;
  }
};