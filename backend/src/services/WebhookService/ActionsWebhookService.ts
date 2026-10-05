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
import { Op } from "sequelize";
import { randomUUID } from "crypto";
import mime from "mime-types";
import Whatsapp from "../../models/Whatsapp";
import SendWhatsAppMediaUnified from "../WbotServices/SendWhatsAppMediaUnified";
import SendTemplateToContact from "../MetaServices/SendTemplateToContact";
import DripSequence from "../../models/DripSequence";
import DripSequenceEnrollment from "../../models/DripSequenceEnrollment";
import AIAgent from "../../models/AIAgent";
import FunnelStage from "../../models/FunnelStage";
import TicketFunnelState from "../../models/TicketFunnelState";
import { emitToCompanyRoom } from "../../libs/socketEmit";
import { scheduleFlowResume } from "../../queues/FlowResumeQueue";

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

// Converte amount+unit ("minutes"|"hours"|"days") em ms. Retorna null se
// inválido ou acima do teto (30 dias) — usado por smartDelay/waitReply.
const flowDelayMs = (amount: any, unit: string): number | null => {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return null;
  const factor =
    unit === "days" ? 86400000 : unit === "hours" ? 3600000 : unit === "minutes" ? 60000 : 0;
  if (!factor) return null;
  const ms = n * factor;
  if (ms > 30 * 86400000) return null;
  return ms;
};

// Resolve caminho local para mídia do nó "file": aceita URL externa (baixa
// para public/company{id}), URL do próprio /public ou nome de arquivo local.
const resolveFlowMediaPath = async (
  urlRaw: string,
  companyId: number,
  fileName?: string
): Promise<string> => {
  const url = String(urlRaw || "").trim();
  const publicDir = path.resolve(__dirname, "..", "..", "..", "public");
  const companyDir = path.join(publicDir, `company${companyId}`);

  const backendUrl = (process.env.BACKEND_URL || "").replace(/\/+$/, "");
  const publicPrefix = `${backendUrl}/public/`;
  if (backendUrl && url.startsWith(publicPrefix)) {
    return path.join(publicDir, url.substring(publicPrefix.length));
  }

  if (/^https?:\/\//i.test(url)) {
    const safeName = (
      fileName || path.basename(url.split("?")[0]) || "arquivo"
    ).replace(/[^a-zA-Z0-9._-]/g, "_");
    const localName = `flow-${Date.now()}-${safeName}`;
    if (!fs.existsSync(companyDir)) fs.mkdirSync(companyDir, { recursive: true });
    const localPath = path.join(companyDir, localName);
    const resp = await axios.get(url, {
      responseType: "arraybuffer",
      timeout: 30000
    });
    fs.writeFileSync(localPath, Buffer.from(resp.data));
    return localPath;
  }

  return path.join(companyDir, url);
};

// Envia arquivo pelo canal WhatsApp do ticket — roteia Baileys (path local)
// ou API Oficial (SendWhatsAppMediaUnified monta a URL pública assinada).
const sendFlowFile = async (
  ticket: Ticket,
  whatsapp: Whatsapp,
  localPath: string,
  caption?: string,
  fileName?: string
): Promise<void> => {
  if (whatsapp.channelType === "official") {
    const mimetype = mime.lookup(localPath) || "application/octet-stream";
    const stat = fs.statSync(localPath);
    await SendWhatsAppMediaUnified({
      media: {
        originalname: fileName || path.basename(localPath),
        filename: path.basename(localPath),
        mimetype: String(mimetype),
        size: stat.size,
        path: localPath
      } as any,
      ticket,
      body: caption
    });
  } else {
    await SendWhatsAppMediaFlow({
      media: localPath,
      ticket,
      body: caption,
      isFlow: true
    });
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

    // Resolve o contato do ticket — mesma ordem dos nós tag/condition:
    // associação carregada -> contactId -> número do remetente.
    const resolveFlowContact = async (): Promise<Contact | null> => {
      let contactFlow: Contact = ticket?.contact;
      if (!contactFlow && ticket?.contactId) {
        contactFlow = await Contact.findOne({
          where: { id: ticket.contactId, companyId }
        });
      }
      if (!contactFlow && numberClient) {
        contactFlow = await Contact.findOne({
          where: { number: numberClient, companyId }
        });
      }
      return contactFlow;
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
          // Elemento "file" do singleBlock: value = url ou nome de arquivo
          // em public/company{id}; caption/fileName opcionais.
          if (elementNowSelected.includes("file")) {
            try {
              const elFile = nodeSelected.data.elements.filter(
                item => item.number === elementNowSelected
              )[0];
              const urlEl = String(elFile?.value || "").trim();
              if (urlEl) {
                const ticketFile = await Ticket.findOne({
                  where: { id: ticket.id }
                });
                const localPathEl = await resolveFlowMediaPath(
                  urlEl,
                  companyId,
                  elFile?.fileName
                );
                await sendFlowFile(
                  ticketFile || ticket,
                  whatsapp,
                  localPathEl,
                  elFile?.caption,
                  elFile?.fileName
                );
              }
            } catch (errFileEl) {
              logger.warn(
                `[FlowBuilder][singleBlock][file] Falha: ${errFileEl?.message || errFileEl}`
              );
            }
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

      // Nó "file": envia documento/arquivo ao contato. data: {url, caption?,
      // fileName?} — url pode ser externa (baixada), URL do /public ou nome
      // de arquivo em public/company{id}. Falhas são logadas e seguem o fluxo.
      if (nodeSelected.type === "file") {
        try {
          await ensureTicket();

          const dataFile = nodeSelected.data || {};
          const urlFile = String(dataFile.url || "").trim();

          if (!ticket || !urlFile) {
            logger.warn(
              `[FlowBuilder][file] node=${nodeSelected.id} sem url ou ticket`
            );
          } else {
            const localPathFile = await resolveFlowMediaPath(
              urlFile,
              companyId,
              dataFile.fileName
            );
            await sendFlowFile(
              ticket,
              whatsapp,
              localPathFile,
              dataFile.caption,
              dataFile.fileName
            );
            await intervalWhats("1");
          }
        } catch (errFile) {
          logger.warn(
            `[FlowBuilder][file] Falha no node ${nodeSelected.id}: ${errFile?.message || errFile}`
          );
        }
      }

      // Nó "subscribeDrip": inscribe/remove o contato de uma sequência de
      // drip. Reativa inscrição completed/cancelled/failed. Sequência
      // inválida/inativa só gera warn — não derruba o fluxo.
      if (nodeSelected.type === "subscribeDrip") {
        try {
          await ensureTicket();

          const dripIdNode = Number(nodeSelected.data?.dripSequenceId);
          const actionDrip =
            nodeSelected.data?.action === "unsubscribe"
              ? "unsubscribe"
              : "subscribe";

          const drip = dripIdNode
            ? await DripSequence.findOne({
                where: { id: dripIdNode, companyId, active: true }
              })
            : null;

          const contactDrip = await resolveFlowContact();

          if (!drip || !contactDrip) {
            logger.warn(
              `[FlowBuilder][subscribeDrip] node=${nodeSelected.id} sequência ${dripIdNode} inexistente/inativa ou sem contato`
            );
          } else if (actionDrip === "subscribe") {
            const nowDrip = new Date();
            const [enrollment, created] =
              await DripSequenceEnrollment.findOrCreate({
                where: {
                  dripSequenceId: drip.id,
                  contactId: contactDrip.id
                },
                defaults: {
                  dripSequenceId: drip.id,
                  contactId: contactDrip.id,
                  companyId,
                  currentStepIndex: 0,
                  status: "active",
                  nextSendAt: nowDrip,
                  enrolledAt: nowDrip
                } as any
              });
            if (
              !created &&
              ["completed", "cancelled", "failed"].includes(enrollment.status)
            ) {
              await enrollment.update({
                status: "active",
                currentStepIndex: 0,
                nextSendAt: nowDrip,
                attempts: 0,
                lastError: null
              });
            }
          } else {
            await DripSequenceEnrollment.update(
              { status: "cancelled" },
              {
                where: {
                  dripSequenceId: drip.id,
                  contactId: contactDrip.id,
                  companyId,
                  status: "active"
                }
              }
            );
          }
        } catch (errDrip) {
          logger.warn(
            `[FlowBuilder][subscribeDrip] Falha no node ${nodeSelected.id}: ${errDrip?.message || errDrip}`
          );
        }
      }

      // Nó "optOut": desliga o bot para o contato (disableBot) e aplica a
      // tag DNC/OPT-OUT quando existir na empresa. Segue o fluxo.
      if (nodeSelected.type === "optOut") {
        try {
          await ensureTicket();

          const contactOo = await resolveFlowContact();
          if (!contactOo) {
            logger.warn(
              `[FlowBuilder][optOut] node=${nodeSelected.id} sem contato`
            );
          } else {
            await contactOo.update({ disableBot: true });

            const tagDnc = await Tag.findOne({
              where: {
                companyId,
                [Op.or]: [
                  { name: { [Op.iLike]: "dnc" } },
                  { name: { [Op.iLike]: "opt-out" } },
                  { name: { [Op.iLike]: "optout" } }
                ]
              }
            });
            if (tagDnc) {
              await ContactTag.findOrCreate({
                where: {
                  contactId: contactOo.id,
                  tagId: tagDnc.id,
                  companyId
                }
              });
            }
          }
        } catch (errOo) {
          logger.warn(
            `[FlowBuilder][optOut] Falha no node ${nodeSelected.id}: ${errOo?.message || errOo}`
          );
        }
      }

      // Nó "notifyTeam": notificação em tempo real para a equipe via socket
      // (sala "notification" do namespace da empresa). Aceita {{var}}.
      if (nodeSelected.type === "notifyTeam") {
        try {
          await ensureTicket();

          const varsNt: any = ticket?.dataWebhook?.variables || {};
          const msgNt = replaceMessages(
            varsNt,
            String(nodeSelected.data?.message ?? "")
          );

          await emitToCompanyRoom(
            companyId,
            "notification",
            `company-${companyId}-notification`,
            {
              action: "flowNotify",
              ticketId: ticket?.id ?? idTicket ?? null,
              message: msgNt
            }
          );
        } catch (errNt) {
          logger.warn(
            `[FlowBuilder][notifyTeam] Falha no node ${nodeSelected.id}: ${errNt?.message || errNt}`
          );
        }
      }

      // Nó "sendTemplate": envia template Meta — somente conexão oficial.
      // Em Baileys apenas loga e segue o fluxo.
      if (nodeSelected.type === "sendTemplate") {
        try {
          await ensureTicket();

          const dataTpl = nodeSelected.data || {};
          const templateName = String(dataTpl.templateName || "").trim();

          if (whatsapp.channelType !== "official") {
            logger.warn(
              `[FlowBuilder][sendTemplate] node=${nodeSelected.id} conexão ${whatsapp.id} não é API Oficial — nó ignorado`
            );
          } else if (!templateName || !ticket) {
            logger.warn(
              `[FlowBuilder][sendTemplate] node=${nodeSelected.id} sem templateName ou ticket`
            );
          } else {
            const contactTpl = await resolveFlowContact();
            if (!contactTpl) {
              logger.warn(
                `[FlowBuilder][sendTemplate] node=${nodeSelected.id} sem contato`
              );
            } else {
              const varsTpl: any = ticket?.dataWebhook?.variables || {};
              let variablesConfig: Record<string, any> | undefined;
              if (Array.isArray(dataTpl.variables) && dataTpl.variables.length) {
                variablesConfig = {};
                for (const v of dataTpl.variables) {
                  if (v?.name) {
                    variablesConfig[String(v.name)] = {
                      type: "fixed",
                      source: replaceMessages(varsTpl, String(v.value ?? ""))
                    };
                  }
                }
              }
              await SendTemplateToContact({
                whatsappId: whatsapp.id,
                contactId: contactTpl.id,
                companyId,
                userId: ticket.userId || null,
                templateName,
                languageCode: dataTpl.languageCode || "pt_BR",
                variablesConfig
              });
            }
          }
        } catch (errTpl) {
          logger.warn(
            `[FlowBuilder][sendTemplate] Falha no node ${nodeSelected.id}: ${errTpl?.message || errTpl}`
          );
        }
      }

      // Nó "csat": envia a pergunta de avaliação (data.message ||
      // whatsapp.ratingMessage || padrão) e suspende o fluxo com o ticket em
      // status "nps" — a nota numérica é capturada pelos listeners.
      if (nodeSelected.type === "csat") {
        try {
          await ensureTicket();

          if (!ticket) {
            logger.warn(
              `[FlowBuilder][csat] node=${nodeSelected.id} sem ticket vinculado`
            );
          } else {
            const varsCsat: any = ticket?.dataWebhook?.variables || {};
            const rawCsat =
              nodeSelected.data?.message ||
              whatsapp.ratingMessage ||
              "De 0 a 10, como você avalia nosso atendimento?";

            const ticketDetails = await ShowTicketService(ticket.id, companyId);

            const bodyCsat = formatBody(
              replaceMessages(varsCsat, String(rawCsat)),
              ticketDetails
            );

            await delay(3000);
            try {
              await typeSimulation(ticket, "composing");
            } catch {
              // canal oficial não tem wbot — presença é best-effort
            }

            await SendWhatsAppMessage({
              body: bodyCsat,
              ticket: ticketDetails,
              quotedMsg: null
            });

            SetTicketMessagesAsRead(ticketDetails);

            await ticketDetails.update({
              lastMessage: bodyCsat
            });

            await ticket.update({
              status: "nps",
              userId: null,
              companyId: companyId,
              lastFlowId: nodeSelected.id,
              hashFlowId: hashWebhookId,
              flowStopped: idFlowDb.toString()
            });
            // Emitir update do ticket
            await emitTicketUpdateSimple(ticket, companyId);
          }
        } catch (errCsat) {
          logger.warn(
            `[FlowBuilder][csat] Falha no node ${nodeSelected.id}: ${errCsat?.message || errCsat}`
          );
        }
        break;
      }

      // Nó "setStatus": altera o status do ticket. "closed" encerra o fluxo
      // igual ao nó "end"; open/pending/bot seguem para o próximo nó.
      let endedBySetStatus = false;
      if (nodeSelected.type === "setStatus") {
        try {
          await ensureTicket();

          const statusSet = String(nodeSelected.data?.status || "");
          if (
            !ticket ||
            !["open", "pending", "bot", "closed", "nps"].includes(statusSet)
          ) {
            logger.warn(
              `[FlowBuilder][setStatus] node=${nodeSelected.id} status inválido ou sem ticket`
            );
          } else if (statusSet === "closed") {
            await ticket.update({
              status: "closed",
              flowWebhook: false,
              flowStopped: idFlowDb.toString(),
              hashFlowId: null,
              lastFlowId: nodeSelected.id
            });
            // UpdateTicketService emite os eventos de fechamento
            await UpdateTicketService({
              ticketData: { status: "closed" },
              ticketId: ticket.id,
              companyId
            });
            endedBySetStatus = true;
          } else {
            await UpdateTicketService({
              ticketData: {
                status: statusSet,
                isBot: statusSet === "bot" ? true : ticket.isBot
              },
              ticketId: ticket.id,
              companyId
            });
            await ticket.reload();
          }
        } catch (errSet) {
          logger.warn(
            `[FlowBuilder][setStatus] Falha no node ${nodeSelected.id}: ${errSet?.message || errSet}`
          );
        }
      }
      if (endedBySetStatus) {
        break;
      }

      // Nó "aiAgent": transfere o ticket para um AIAgent. O vínculo usado
      // pelo ResolveAIAgentForTicketService é ticket.queueId ∈ agent.queueIds
      // — por isso o ticket vai para a primeira fila do agente com
      // status="bot" e isBot=true, e a etapa inicial do funil é registrada.
      // O fluxo é suspenso (a IA passa a responder pelo listener).
      let suspendedByAgent = false;
      if (nodeSelected.type === "aiAgent") {
        try {
          await ensureTicket();

          const agentIdNode = Number(nodeSelected.data?.aiAgentId);
          // Mesma resolução do ResolveAIAgentForTicketService: primeiro o
          // aiAgentId explícito do nó; depois o agente ativo cujo queueIds
          // contenha o ticket.queueId atual.
          let agent = agentIdNode
            ? await AIAgent.findOne({
                where: { id: agentIdNode, companyId, status: "active" }
              })
            : null;
          if (!agent && ticket?.queueId) {
            agent = await AIAgent.findOne({
              where: {
                companyId,
                status: "active",
                queueIds: { [Op.contains]: [ticket.queueId] }
              }
            });
          }

          if (!agent || !ticket) {
            logger.warn(
              `[FlowBuilder][aiAgent] node=${nodeSelected.id} agente ${agentIdNode || "por-fila"} inexistente/inativo ou sem ticket — seguindo fluxo`
            );
          } else {
            const queueIdAgent =
              Array.isArray(agent.queueIds) && agent.queueIds.length
                ? Number(agent.queueIds[0])
                : ticket.queueId;

            await UpdateTicketService({
              ticketData: {
                queueId: queueIdAgent,
                status: "bot",
                isBot: true,
                userId: null
              },
              ticketId: ticket.id,
              companyId
            });

            // Etapa inicial do funil (menor order) — histórico é append-only,
            // a linha mais recente representa a etapa atual do ticket.
            const firstStage = await FunnelStage.findOne({
              where: { agentId: agent.id },
              order: [["order", "ASC"]]
            });
            if (firstStage) {
              await TicketFunnelState.create({
                ticketId: ticket.id,
                funnelStageId: firstStage.id,
                agentId: agent.id,
                companyId,
                enteredAt: new Date()
              } as any);
            }

            await ticket.update({
              flowWebhook: false,
              flowStopped: idFlowDb.toString(),
              hashFlowId: null,
              lastFlowId: nodeSelected.id
            });
            suspendedByAgent = true;
          }
        } catch (errAgent) {
          logger.warn(
            `[FlowBuilder][aiAgent] Falha no node ${nodeSelected.id}: ${errAgent?.message || errAgent}`
          );
        }
      }
      if (suspendedByAgent) {
        break;
      }

      // Nó "smartDelay": suspende o fluxo e agenda a retomada no próximo nó
      // (FlowResume com resumeToken). Amount inválido/sem saída → segue direto.
      let suspendedByDelay = false;
      if (nodeSelected.type === "smartDelay") {
        try {
          await ensureTicket();

          const dataSd = nodeSelected.data || {};
          const delayMsSd = flowDelayMs(dataSd.amount, dataSd.unit);
          const edgeSd = connects.filter(
            c => c.source === nodeSelected.id
          )[0];

          if (!ticket || !delayMsSd || !edgeSd) {
            logger.warn(
              `[FlowBuilder][smartDelay] node=${nodeSelected.id} amount/unit inválido ou sem saída — seguindo fluxo`
            );
          } else {
            const resumeTokenSd = randomUUID();
            const dwSd: any = {
              ...(ticket.dataWebhook || {}),
              resumeToken: resumeTokenSd,
              resumeNodeId: edgeSd.target
            };
            await ticket.update({
              // flowWebhook false: mensagem do usuário durante o delay não
              // deve disparar a retomada genérica — só o job FlowResume.
              flowWebhook: false,
              lastFlowId: edgeSd.target,
              hashFlowId: hashWebhookId,
              flowStopped: idFlowDb.toString(),
              dataWebhook: dwSd
            });
            await scheduleFlowResume(
              { ticketId: ticket.id, companyId, resumeToken: resumeTokenSd },
              delayMsSd
            );
            await emitTicketUpdateSimple(ticket, companyId);
            suspendedByDelay = true;
          }
        } catch (errSd) {
          logger.warn(
            `[FlowBuilder][smartDelay] Falha no node ${nodeSelected.id}: ${errSd?.message || errSd}`
          );
        }
      }
      if (suspendedByDelay) {
        break;
      }

      // Nó "waitReply": suspende o fluxo aguardando resposta do usuário
      // (mesmo mecanismo do "question": lastFlowId aponta para este nó).
      // Saída "a" = usuário respondeu (listener retoma); saída "b" = timeout
      // (FlowResume agendado com resumeToken — invalidado se a resposta chegar).
      if (nodeSelected.type === "waitReply") {
        try {
          await ensureTicket();

          const dataWr = nodeSelected.data || {};
          const edgeWrB = connects.filter(
            c => c.source === nodeSelected.id && c.sourceHandle === "b"
          )[0];
          const delayMsWr = flowDelayMs(dataWr.timeout, dataWr.unit);

          if (!ticket) {
            logger.warn(
              `[FlowBuilder][waitReply] node=${nodeSelected.id} sem ticket vinculado`
            );
          } else {
            const dwWr: any = { ...(ticket.dataWebhook || {}) };
            const varsWr: any = dwWr.variables || {};
            const canSchedule = Boolean(edgeWrB && delayMsWr);
            const resumeTokenWr = canSchedule ? randomUUID() : null;

            if (canSchedule) {
              dwWr.resumeToken = resumeTokenWr;
              dwWr.resumeNodeId = edgeWrB.target;
              if (dataWr.timeoutMessage) {
                dwWr.resumeTimeoutMessage = replaceMessages(
                  varsWr,
                  String(dataWr.timeoutMessage)
                );
              }
            }

            await ticket.update({
              userId: null,
              companyId: companyId,
              flowWebhook: true,
              lastFlowId: nodeSelected.id,
              hashFlowId: hashWebhookId,
              flowStopped: idFlowDb.toString(),
              dataWebhook: dwWr
            });
            await emitTicketUpdateSimple(ticket, companyId);

            if (canSchedule) {
              await scheduleFlowResume(
                { ticketId: ticket.id, companyId, resumeToken: resumeTokenWr },
                delayMsWr
              );
            }
          }
        } catch (errWr) {
          logger.warn(
            `[FlowBuilder][waitReply] Falha no node ${nodeSelected.id}: ${errWr?.message || errWr}`
          );
        }
        break;
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