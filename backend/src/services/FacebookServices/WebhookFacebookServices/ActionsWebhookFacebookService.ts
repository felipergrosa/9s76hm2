import Chatbot from "../../../models/Chatbot";
import Contact from "../../../models/Contact";
import Queue from "../../../models/Queue";
import Ticket from "../../../models/Ticket";
import Whatsapp from "../../../models/Whatsapp";
import ShowTicketService from "../../TicketServices/ShowTicketService";
import { IConnections, INodes } from "../../WebhookService/DispatchWebHookService"
import { getAccessToken, sendAttachmentFromUrl, sendText, showTypingIndicator } from "../graphAPI";
import formatBody from "../../../helpers/Mustache";
import axios from "axios";
import fs from "fs";
import { sendFacebookMessageMedia } from "../sendFacebookMessageMedia";
import mime from "mime";
import path from "path";
import { getIO } from "../../../libs/socket";
import { randomizarCaminho } from "../../../utils/randomizador";
import CreateLogTicketService from "../../TicketServices/CreateLogTicketService";
import UpdateTicketService from "../../TicketServices/UpdateTicketService";
import FindOrCreateATicketTrakingService from "../../TicketServices/FindOrCreateATicketTrakingService";
import ShowQueueService from "../../QueueService/ShowQueueService";
import logger from "../../../utils/logger";
import Tag from "../../../models/Tag";
import ContactTag from "../../../models/ContactTag";
import { FlowBuilderModel } from "../../../models/FlowBuilder";
import User from "../../../models/User";
import ContactCustomField from "../../../models/ContactCustomField";
import CreateMessageService, {
    MessageData
} from "../../MessageServices/CreateMessageService";
import { randomString } from "../../../utils/randomCode";
import ffmpeg from "fluent-ffmpeg";
import { fi } from "date-fns/locale";
import queue from "../../../libs/queue";
const os = require("os");

let ffmpegPath;
if (os.platform() === "win32") {
    // Windows
    ffmpegPath = "C:\\ffmpeg\\ffmpeg.exe"; // Substitua pelo caminho correto no Windows
} else if (os.platform() === "darwin") {
    // macOS
    ffmpegPath = "/opt/homebrew/bin/ffmpeg"; // Substitua pelo caminho correto no macOS
} else {
    // Outros sistemas operacionais (Linux, etc.)
    ffmpegPath = "/usr/bin/ffmpeg"; // Substitua pelo caminho correto em sistemas Unix-like
}
ffmpeg.setFfmpegPath(ffmpegPath);


interface IAddContact {
    companyId: number;
    name: string;
    phoneNumber: string;
    email?: string;
    dataMore?: any;
}

interface NumberPhrase {
    number: string,
    name: string,
    email: string
}


export const ActionsWebhookFacebookService = async (
    token: Whatsapp,
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
    numberPhrase?: NumberPhrase,
    flowDepth: number = 0
): Promise<string> => {

    const io = getIO()
    let next = nextStage;
    let createFieldJsonName = "";
    const connectStatic = connects;


    const getSession = await Whatsapp.findOne({
        where: {
            facebookPageUserId: token.facebookPageUserId
        },
        include: [
            {
                model: Queue,
                as: "queues",
                attributes: ["id", "name", "color", "greetingMessage"],
                include: [
                    {
                        model: Chatbot,
                        as: "chatbots",
                        attributes: ["id", "name", "greetingMessage"]
                    }
                ]
            }
        ],
        order: [
            ["queues", "id", "ASC"],
            ["queues", "chatbots", "id", "ASC"]
        ]
    })

    let execCount = 0;

    let execFn = "";

    let ticket = null;

    let noAlterNext = false;

    let selectedQueueid = null;

    // Contador de saltos gotoFlow — evita loop infinito entre fluxos (máx. 5)
    let gotoDepth = flowDepth;

    // Carrega o ticket sob demanda: ele só é inicializado mais adiante no
    // loop (menu/fim da iteração), e os novos nós podem precisar dele antes.
    const ensureTicket = async (): Promise<Ticket | null> => {
        if (!ticket && idTicket) {
            ticket = await Ticket.findOne({
                where: { id: idTicket, companyId }
            });
        }
        return ticket;
    };

    // Interpolação {{var}} com as variáveis capturadas do fluxo
    // (o replaceMessages local usa outra assinatura/propósito)
    const replaceFlowVars = (variables: any, text: string) => {
        return String(text).replace(
            /{{\s*([^{}\s]+)\s*}}/g,
            (match, key) => variables[key] || ""
        );
    };

    // Loop usa nodes.length direto: gotoFlow anexa novos nós ao array
    // durante a execução e eles precisam ser alcançáveis pelo `next`.
    for (var i = 0; i < nodes.length; i++) {
        let nodeSelected: any;
        let ticketInit: Ticket;
        if (idTicket) {
            ticketInit = await Ticket.findOne({
                where: { id: idTicket }
            });
            if (ticketInit.status === "closed") {
               break
            } else {
                await ticketInit.update({
                    dataWebhook: {
                        status: "process",
                    },
                })
            }
        }
        if (pressKey) {
            if (pressKey === "parar") {
                if (idTicket) {
                    const ticket = await Ticket.findOne({
                        where: { id: idTicket }
                    });
                    await ticket.update({
                        status: "closed"
                    });
                }
                break;
            }

            if (execFn === "") {
                nodeSelected = {
                    type: "menu"
                };
            } else {
                nodeSelected = nodes.filter(node => node.id === execFn)[0];
            }
        } else {
            const otherNode = nodes.filter(node => node.id === next)[0];
            if (otherNode) {
                nodeSelected = otherNode;
            }
        }

        if (nodeSelected.type === "ticket") {
            const queue = await ShowQueueService(nodeSelected.data.data.id, companyId)

            console.clear()
            console.log("====================================")
            console.log("              TICKET                ")
            console.log("====================================")

            selectedQueueid = queue.id;
            console.log({ selectedQueueid })
            //await updateQueueId(ticket, companyId, queue.id)

        }

        if (nodeSelected.type === "singleBlock") {

            for (var iLoc = 0; iLoc < nodeSelected.data.seq.length; iLoc++) {
                const elementNowSelected = nodeSelected.data.seq[iLoc];
                console.log(elementNowSelected, "elementNowSelected")

                if (elementNowSelected.includes("message")) {
                    // await SendMessageFlow(whatsapp, {
                    //   number: numberClient,
                    //   body: nodeSelected.data.elements.filter(
                    //     item => item.number === elementNowSelected
                    //   )[0].value
                    // });
                    const bodyFor = nodeSelected.data.elements.filter(
                        item => item.number === elementNowSelected
                    )[0].value;

                    const ticketDetails = await ShowTicketService(ticket.id, companyId);


                    const contact = await Contact.findOne({
                        where: { number: numberPhrase.number, companyId }
                    });

                    const bodyBot: string = formatBody(
                        `${bodyFor}`,
                        ticket
                    );

                    await showTypingIndicator(
                        contact.number,
                        getSession.facebookUserToken,
                        "typing_on"
                    );

                    await intervalWhats("5");

                    const sentMessage = await sendText(
                        contact.number,
                        bodyBot,
                        getSession.facebookUserToken);

                    await ticketDetails.update({
                        lastMessage: formatBody(bodyFor, ticket.contact)
                    });

                    await updateQueueId(ticket, companyId, selectedQueueid)

                    await intervalWhats("1");

                    await showTypingIndicator(
                        contact.number,
                        getSession.facebookUserToken,
                        "typing_off"
                    );

                }


                if (elementNowSelected.includes("interval")) {
                    await intervalWhats(
                        nodeSelected.data.elements.filter(
                            item => item.number === elementNowSelected
                        )[0].value
                    );
                }


                if (elementNowSelected.includes("img")) {
                    const mediaPath = process.env.BACKEND_URL === "http://localhost:8090"
                        ? `${__dirname.split("src")[0].split("\\").join("/")}public/company${companyId}/${nodeSelected.data.elements.filter(
                            item => item.number === elementNowSelected
                        )[0].value
                        }`
                        : `${__dirname.split("dist")[0].split("\\").join("/")}public/company${companyId}/${nodeSelected.data.elements.filter(
                            item => item.number === elementNowSelected
                        )[0].value
                        }`

                    const contact = await Contact.findOne({
                        where: { number: numberPhrase.number, companyId }
                    });


                    // Obtendo o tipo do arquivo
                    const fileExtension = path.extname(mediaPath);

                    //Obtendo o nome do arquivo sem a extensão
                    const fileNameWithoutExtension = path.basename(mediaPath, fileExtension);

                    //Obtendo o tipo do arquivo
                    const mimeType = mime.lookup(mediaPath);

                    const domain = `${process.env.BACKEND_URL}/public/company${companyId}/${fileNameWithoutExtension}${fileExtension}`


                    await showTypingIndicator(
                        contact.number,
                        getSession.facebookUserToken,
                        "typing_on"
                    );

                    await intervalWhats("5");

                    const sendMessage = await sendAttachmentFromUrl(
                        contact.number,
                        domain,
                        "image",
                        getSession.facebookUserToken
                    );

                    const ticketDetails = await ShowTicketService(ticket.id, companyId);

                    await ticketDetails.update({
                        lastMessage: formatBody(`${fileNameWithoutExtension}${fileExtension}`, ticket.contact)
                    });

                    await showTypingIndicator(
                        contact.number,
                        getSession.facebookUserToken,
                        "typing_off"
                    );

                }


                if (elementNowSelected.includes("audio")) {
                    const mediaDirectory =
                        process.env.BACKEND_URL === "http://localhost:8090"
                            ? `${__dirname.split("src")[0].split("\\").join("/")}public/company${companyId}/${nodeSelected.data.elements.filter(
                                item => item.number === elementNowSelected
                            )[0].value
                            }`
                            : `${__dirname.split("dist")[0].split("\\").join("/")}public/company${companyId}/${nodeSelected.data.elements.filter(
                                item => item.number === elementNowSelected
                            )[0].value
                            }`;

                    const contact = await Contact.findOne({
                        where: { number: numberPhrase.number, companyId }
                    });

                    // Obtendo o tipo do arquivo
                    const fileExtension = path.extname(mediaDirectory);

                    //Obtendo o nome do arquivo sem a extensão
                    const fileNameWithoutExtension = path.basename(mediaDirectory, fileExtension);

                    //Obtendo o tipo do arquivo
                    const mimeType = mime.lookup(mediaDirectory);

                    const fileNotExists = path.resolve(__dirname, "..", "..", "..", "..", "public", `company${companyId}`, fileNameWithoutExtension + ".mp4");

                    if (fileNotExists) {
                        const folder = path.resolve(__dirname, "..", "..", "..", "..", "public", `company${companyId}`, fileNameWithoutExtension + fileExtension);
                        await convertAudio(folder)
                    }

                    const domain = `${process.env.BACKEND_URL}/public/company${companyId}/${fileNameWithoutExtension}.mp4`


                    await showTypingIndicator(
                        contact.number,
                        getSession.facebookUserToken,
                        "typing_on"
                    );

                    await intervalWhats("5");

                    const sendMessage = await sendAttachmentFromUrl(
                        contact.number,
                        domain,
                        "audio",
                        getSession.facebookUserToken
                    );


                    const ticketDetails = await ShowTicketService(ticket.id, companyId);

                    await ticketDetails.update({
                        lastMessage: formatBody(`${fileNameWithoutExtension}${fileExtension}`, ticket.contact)
                    });

                    await showTypingIndicator(
                        contact.number,
                        getSession.facebookUserToken,
                        "typing_off"
                    );

                }


                if (elementNowSelected.includes("video")) {
                    const mediaDirectory =
                        process.env.BACKEND_URL === "http://localhost:8090"
                            ? `${__dirname.split("src")[0].split("\\").join("/")}public/company${companyId}/${nodeSelected.data.elements.filter(
                                item => item.number === elementNowSelected
                            )[0].value
                            }`
                            : `${__dirname.split("dist")[0].split("\\").join("/")}public/company${companyId}/${nodeSelected.data.elements.filter(
                                item => item.number === elementNowSelected
                            )[0].value
                            }`;


                    const contact = await Contact.findOne({
                        where: { number: numberPhrase.number, companyId }
                    });

                    // Obtendo o tipo do arquivo
                    const fileExtension = path.extname(mediaDirectory);

                    //Obtendo o nome do arquivo sem a extensão
                    const fileNameWithoutExtension = path.basename(mediaDirectory, fileExtension);

                    //Obtendo o tipo do arquivo
                    const mimeType = mime.lookup(mediaDirectory);

                    const domain = `${process.env.BACKEND_URL}/public/company${companyId}/${fileNameWithoutExtension}${fileExtension}`


                    await showTypingIndicator(
                        contact.number,
                        getSession.facebookUserToken,
                        "typing_on"
                    );

                    const sendMessage = await sendAttachmentFromUrl(
                        contact.number,
                        domain,
                        "video",
                        getSession.facebookUserToken
                    );

                    const ticketDetails = await ShowTicketService(ticket.id, companyId);

                    await ticketDetails.update({
                        lastMessage: formatBody(`${fileNameWithoutExtension}${fileExtension}`, ticket.contact)
                    });

                    await showTypingIndicator(
                        contact.number,
                        getSession.facebookUserToken,
                        "typing_off"
                    );
                }

            }
        }

        if (nodeSelected.type === "img") {
            const mediaPath = process.env.BACKEND_URL === "http://localhost:8090"
                ? `${__dirname.split("src")[0].split("\\").join("/")}public/company${companyId}/${nodeSelected.data.url
                }`
                : `${__dirname.split("dist")[0].split("\\").join("/")}public/company${companyId}/${nodeSelected.data.url
                }`


            // Obtendo o tipo do arquivo
            const fileExtension = path.extname(mediaPath);

            //Obtendo o nome do arquivo sem a extensão
            const fileNameWithoutExtension = path.basename(mediaPath, fileExtension);

            //Obtendo o tipo do arquivo
            const mimeType = mime.lookup(mediaPath);

            const domain = `${process.env.BACKEND_URL}/public/company${companyId}/${fileNameWithoutExtension}${fileExtension}`

            const contact = await Contact.findOne({
                where: { number: numberPhrase.number, companyId }
            });

            await showTypingIndicator(
                contact.number,
                getSession.facebookUserToken,
                "typing_on"
            );

            await intervalWhats("5");

            const sendMessage = await sendAttachmentFromUrl(
                contact.number,
                domain,
                "image",
                getSession.facebookUserToken
            );

            const ticketDetails = await ShowTicketService(ticket.id, companyId);

            await ticketDetails.update({
                lastMessage: formatBody(`${fileNameWithoutExtension}${fileExtension}`, ticket.contact)
            });

            await showTypingIndicator(
                contact.number,
                getSession.facebookUserToken,
                "typing_off"
            );
        }

        if (nodeSelected.type === "audio") {
            const mediaDirectory =
                process.env.BACKEND_URL === "http://localhost:8090"
                    ? `${__dirname.split("src")[0].split("\\").join("/")}public/company${companyId}/${nodeSelected.data.url
                    }`
                    : `${__dirname.split("dist")[0].split("\\").join("/")}public/company${companyId}/${nodeSelected.data.url
                    }`;

            const contact = await Contact.findOne({
                where: { number: numberPhrase.number, companyId }
            });

            // Obtendo o tipo do arquivo
            const fileExtension = path.extname(mediaDirectory);

            //Obtendo o nome do arquivo sem a extensão
            const fileNameWithoutExtension = path.basename(mediaDirectory, fileExtension);

            //Obtendo o tipo do arquivo
            const mimeType = mime.lookup(mediaDirectory);

            const domain = `${process.env.BACKEND_URL}/public/company${companyId}/${fileNameWithoutExtension}${fileExtension}`


            const sendMessage = await sendAttachmentFromUrl(
                contact.number,
                domain,
                "audio",
                getSession.facebookUserToken
            );

            const ticketDetails = await ShowTicketService(ticket.id, companyId);

            await ticketDetails.update({
                lastMessage: formatBody(`${fileNameWithoutExtension}${fileExtension}`, ticket.contact)
            });

            await intervalWhats("1");
        }
        if (nodeSelected.type === "interval") {
            await intervalWhats(nodeSelected.data.sec);
        }
        if (nodeSelected.type === "video") {
            const mediaDirectory =
                process.env.BACKEND_URL === "http://localhost:8090"
                    ? `${__dirname.split("src")[0].split("\\").join("/")}public/company${companyId}/${nodeSelected.data.url
                    }`
                    : `${__dirname.split("dist")[0].split("\\").join("/")}public/company${companyId}/${nodeSelected.data.url
                    }`;


            const contact = await Contact.findOne({
                where: { number: numberPhrase.number, companyId }
            });

            // Obtendo o tipo do arquivo
            const fileExtension = path.extname(mediaDirectory);

            //Obtendo o nome do arquivo sem a extensão
            const fileNameWithoutExtension = path.basename(mediaDirectory, fileExtension);

            //Obtendo o tipo do arquivo
            const mimeType = mime.lookup(mediaDirectory);

            const domain = `${process.env.BACKEND_URL}/public/company${companyId}/${fileNameWithoutExtension}${fileExtension}`


            await showTypingIndicator(
                contact.number,
                getSession.facebookUserToken,
                "typing_on"
            );

            const sendMessage = await sendAttachmentFromUrl(
                contact.number,
                domain,
                "video",
                getSession.facebookUserToken
            );

            const ticketDetails = await ShowTicketService(ticket.id, companyId);

            await ticketDetails.update({
                lastMessage: formatBody(`${fileNameWithoutExtension}${fileExtension}`, ticket.contact),
            });

            await showTypingIndicator(
                contact.number,
                getSession.facebookUserToken,
                "typing_off"
            );
        }
        let isRandomizer: boolean;
        if (nodeSelected.type === "randomizer") {
            const selectedRandom = randomizarCaminho(nodeSelected.data.percent / 100);

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
                if (!contactCond && numberPhrase?.number) {
                    contactCond = await Contact.findOne({
                        where: { number: numberPhrase.number, companyId }
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
                if (!contactTag && numberPhrase?.number) {
                    contactTag = await Contact.findOne({
                        where: { number: numberPhrase.number, companyId }
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
                    headersWh[h.key] = replaceFlowVars(varsWh, String(h.value ?? ""));
                }
            });

            let statusWh: number | null = null;
            let responseWh: any = null;
            try {
                const respWh = await axios.request({
                    method: String(dataWh.method || "GET").toUpperCase(),
                    url: replaceFlowVars(varsWh, String(dataWh.url || "")),
                    data: dataWh.body
                        ? replaceFlowVars(varsWh, String(dataWh.body))
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
                // O update de fim de iteração grava `dataWebhook` (param) no
                // ticket — reatribuir para não perder as variáveis salvas
                dataWebhook = dwWh;
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
                        body: replaceFlowVars(
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
                const valueUc = replaceFlowVars(varsUc, String(dataUc.value ?? ""));

                let contactUc: Contact = ticket?.contact;
                if (!contactUc && ticket?.contactId) {
                    contactUc = await Contact.findOne({
                        where: { id: ticket.contactId, companyId }
                    });
                }
                if (!contactUc && numberPhrase?.number) {
                    contactUc = await Contact.findOne({
                        where: { number: numberPhrase.number, companyId }
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
            if (pressKey) {

                const filterOne = connectStatic.filter(confil => confil.source === next)
                const filterTwo = filterOne.filter(filt2 => filt2.sourceHandle === "a" + pressKey)
                if (filterTwo.length > 0) {
                    execFn = filterTwo[0].target
                } else {
                    execFn = undefined
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

                if (isNodeExist.length > 0) {
                    isMenu = isNodeExist[0].type === "menu" ? true : false;
                } else {
                    isMenu = false;
                }
            } else {
                let optionsMenu = "";
                nodeSelected.data.arrayOption.map(item => {
                    optionsMenu += `[${item.number}] ${item.value}\n`;
                });

                const menuCreate = `${nodeSelected.data.message}\n\n${optionsMenu}`;

                let msg;


                const ticketDetails = await ShowTicketService(ticket.id, companyId);


                //await CreateMessageService({ messageData: messageData, companyId });

                //await SendWhatsAppMessage({ body: bodyFor, ticket: ticketDetails, quotedMsg: null })

                // await SendMessage(whatsapp, {
                //   number: numberClient,
                //   body: msg.body
                // });


                await ticketDetails.update({
                    lastMessage: formatBody(menuCreate, ticket.contact)
                });

                const contact = await Contact.findOne({
                    where: { number: numberPhrase.number, companyId }
                });


                await showTypingIndicator(
                    contact.number,
                    getSession.facebookUserToken,
                    "typing_on"
                );

                await intervalWhats("5");

                await sendText(
                    numberPhrase.number,
                    menuCreate,
                    getSession.facebookUserToken
                );


                await showTypingIndicator(
                    contact.number,
                    getSession.facebookUserToken,
                    "typing_off"
                );

                ticket = await Ticket.findOne({
                    where: { id: idTicket, companyId: companyId }
                });


                await ticket.update({
                    status: "pending",
                    queueId: ticket.queueId ? ticket.queueId : null,
                    userId: null,
                    companyId: companyId,
                    flowWebhook: true,
                    lastFlowId: nodeSelected.id,
                    dataWebhook: dataWebhook,
                    hashFlowId: hashWebhookId,
                    flowStopped: idFlowDb.toString()
                });

                break;
            }
        }

        let isContinue = false;

        if (pressKey === "999" && execCount > 0) {
            pressKey = undefined;
            let result = connects.filter(connect => connect.source === execFn)[0];
            if (typeof result === "undefined") {
                next = "";
            } else {
                if (!noAlterNext) {
                    await ticket.reload();

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
                // manualmente — não recalcular nem zerar quando o alvo não
                // tem edge de saída
                isCondition = false;
                isGotoFlow = false;
                isBusinessHours = false;
                result = next;
            } else {
                result = connects.filter(connect => connect.source === next)[0];
                console.log(512, "ActionsWebhookFacebookService")
            }

            if (typeof result === "undefined") {
                console.log(517, "ActionsWebhookFacebookService")
                next = "";
            } else {
                if (!noAlterNext) {
                    console.log(520, "ActionsWebhookFacebookService")
                    next = result.target;
                }
            }
        }

        if (!pressKey && !isContinue) {
            const nextNode = connects.filter(
                connect => connect.source === nodeSelected.id
            ).length;
            console.log(530, "ActionsWebhookFacebookService")
            if (nextNode === 0) {
                console.log(532, "ActionsWebhookFacebookService")

                const ticket = await Ticket.findOne({
                    where: { id: idTicket, companyId: companyId }
                });

                await ticket.update({
                    lastFlowId: null,
                    dataWebhook: {
                        status: "process",
                    },
                    queueId: ticket.queueId ? ticket.queueId : null,
                    hashFlowId: null,
                    flowWebhook: false,
                    flowStopped: idFlowDb.toString()
                });

                await ticket.reload();

                break;
            }
        }

        isContinue = false;

        if (next === "") {
            break;
        }


        ticket = await Ticket.findOne({
            where: { id: idTicket, companyId: companyId }
        });

        // userId/queueId preservados: "assignUser"/"ticket" podem ter
        // acabado de definir os valores nesta iteração — zerar aqui
        // anularia a ação do nó.
        await ticket.update({
            queueId: ticket.queueId,
            userId: ticket.userId,
            companyId: companyId,
            flowWebhook: true,
            lastFlowId: nodeSelected.id,
            dataWebhook: dataWebhook,
            hashFlowId: hashWebhookId,
            flowStopped: idFlowDb.toString()
        });

        noAlterNext = false;
        execCount++;
    }

    return "ds";
};

const constructJsonLine = (line: string, json: any) => {
    let valor = json
    const chaves = line.split(".")

    if (chaves.length === 1) {
        return valor[chaves[0]]
    }

    for (const chave of chaves) {
        valor = valor[chave]
    }
    return valor
};


function removerNaoLetrasNumeros(texto: string) {
    // Substitui todos os caracteres que não são letras ou números por vazio
    return texto.replace(/[^a-zA-Z0-9]/g, "");
}



const intervalWhats = (time: string) => {
    const seconds = parseInt(time) * 1000;
    return new Promise(resolve => setTimeout(resolve, seconds));
};


const replaceMessages = (
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
}

async function updateQueueId(ticket: Ticket, companyId: number, queueId: number) {
    await ticket.update({
        status: 'pending',
        queueId: queueId,
        userId: ticket.userId,
        companyId: companyId,
    });

    await FindOrCreateATicketTrakingService({
        ticketId: ticket.id,
        companyId,
        whatsappId: ticket.whatsappId,
        userId: ticket.userId
    })



    await UpdateTicketService({
        ticketData: {
            status: "pending",
            queueId: queueId 
        },
        ticketId: ticket.id,
        companyId
    })


    await CreateLogTicketService({
        ticketId: ticket.id,
        type: "queue",
        queueId: queueId
    });

}

function convertAudio(inputFile: string): Promise<string> {
    let outputFile: string;


    if (inputFile.endsWith(".mp3")) {
        outputFile = inputFile.replace(".mp3", ".mp4");
    }

    console.log("output", outputFile);


    return new Promise((resolve, reject) => {
        ffmpeg(inputFile)
            .toFormat('mp4')
            .save(outputFile)
            .on('end', () => {
                resolve(outputFile);
            })
            .on('error', (err) => {
                console.error('Error during conversion:', err);
                reject(err);
            });
    });

}
