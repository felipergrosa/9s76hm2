import Chatbot from "../../../models/Chatbot";
import Contact from "../../../models/Contact";
import Queue from "../../../models/Queue";
import Ticket from "../../../models/Ticket";
import Whatsapp from "../../../models/Whatsapp";
import ShowTicketService from "../../TicketServices/ShowTicketService";
import { IConnections, INodes } from "../../WebhookService/DispatchWebHookService"
import { getAccessToken, sendAttachmentFromUrl, sendGenericTemplate, sendQuickReplies, sendText, showTypingIndicator } from "../graphAPI";
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
import { Op } from "sequelize";
import { randomUUID } from "crypto";
import DripSequence from "../../../models/DripSequence";
import DripSequenceEnrollment from "../../../models/DripSequenceEnrollment";
import AIAgent from "../../../models/AIAgent";
import FunnelStage from "../../../models/FunnelStage";
import TicketFunnelState from "../../../models/TicketFunnelState";
import { emitToCompanyRoom } from "../../../libs/socketEmit";
import { scheduleFlowResume } from "../../../queues/FlowResumeQueue";
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

// Resolve a URL de mídia para a Graph API: URL externa é usada direto;
// nome de arquivo local vira URL pública em /public/company{id} (mesmo
// padrão dos nós img/audio/video).
const resolveFbMediaUrl = (urlRaw: string, companyId: number): string => {
    const url = String(urlRaw || "").trim();
    if (/^https?:\/\//i.test(url)) return url;
    return `${process.env.BACKEND_URL}/public/company${companyId}/${url}`;
};


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

    // Resolve o contato do ticket — mesma ordem dos nós tag/condition:
    // associação carregada -> contactId -> número (PSID) do remetente.
    const resolveFlowContact = async (): Promise<Contact | null> => {
        let contactFlow: Contact = ticket?.contact;
        if (!contactFlow && ticket?.contactId) {
            contactFlow = await Contact.findOne({
                where: { id: ticket.contactId, companyId }
            });
        }
        if (!contactFlow && numberPhrase?.number) {
            contactFlow = await Contact.findOne({
                where: { number: numberPhrase.number, companyId }
            });
        }
        return contactFlow;
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

        // Resume de "quickReplies": o nó suspenso guarda as opções e a
        // resposta do botão chega como texto (título/payload) em pressKey.
        // Converte para o índice da opção para reutilizar o desvio por
        // sourceHandle "a{n}" do resume genérico (mesmo contrato do menu).
        if (pressKey && pressKey !== "999" && pressKey !== "parar") {
            const nodePress: any = nodes.filter(n => n.id === next)[0];
            if (nodePress?.type === "quickReplies") {
                const optsPress: any[] = Array.isArray(nodePress.data?.options)
                    ? nodePress.data.options
                    : [];
                const pressedNorm = String(pressKey).trim().toLowerCase();
                const idxPress = optsPress.findIndex((o: any) =>
                    [o?.payload, o?.label]
                        .filter(v => v !== undefined && v !== null)
                        .some(
                            v => String(v).trim().toLowerCase() === pressedNorm
                        )
                );
                if (idxPress >= 0) {
                    pressKey = String(idxPress + 1);
                }
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

                // Elemento "file" do singleBlock: value = url ou nome de
                // arquivo em public/company{id}; caption opcional vai como
                // texto separado (Graph não suporta legenda em "file").
                if (elementNowSelected.includes("file")) {
                    try {
                        const elFile = nodeSelected.data.elements.filter(
                            item => item.number === elementNowSelected
                        )[0];
                        const urlEl = String(elFile?.value || "").trim();

                        const contact = await Contact.findOne({
                            where: { number: numberPhrase.number, companyId }
                        });

                        if (urlEl && contact) {
                            const domainFile = resolveFbMediaUrl(urlEl, companyId);
                            const fileNameEl = elFile?.fileName || path.basename(urlEl.split("?")[0]);

                            if (elFile?.caption) {
                                await sendText(
                                    contact.number,
                                    formatBody(`${elFile.caption}`, ticket),
                                    getSession.facebookUserToken
                                );
                            }

                            await sendAttachmentFromUrl(
                                contact.number,
                                domainFile,
                                "file",
                                getSession.facebookUserToken
                            );

                            const ticketDetails = await ShowTicketService(ticket.id, companyId);
                            await ticketDetails.update({
                                lastMessage: formatBody(`${fileNameEl}`, ticket.contact)
                            });
                        }
                    } catch (errFileEl) {
                        logger.warn(
                            `[FlowBuilder][singleBlock][file] Falha: ${errFileEl?.message || errFileEl}`
                        );
                    }
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

        // Nó "file": envia documento/arquivo via sendAttachmentFromUrl.
        // data: {url, caption?, fileName?} — url externa é usada direto;
        // nome de arquivo local vira URL pública em /public/company{id}.
        // A Graph não suporta legenda em "file" — caption vai como texto.
        if (nodeSelected.type === "file") {
            try {
                await ensureTicket();

                const dataFile = nodeSelected.data || {};
                const urlFile = String(dataFile.url || "").trim();
                const contactFile = await resolveFlowContact();

                if (!urlFile || !contactFile || !ticket) {
                    logger.warn(
                        `[FlowBuilder][file] node=${nodeSelected.id} sem url, contato ou ticket`
                    );
                } else {
                    const domainFile = resolveFbMediaUrl(urlFile, companyId);
                    const fileNameFile =
                        dataFile.fileName || path.basename(urlFile.split("?")[0]);
                    const varsFile: any = ticket?.dataWebhook?.variables || {};

                    if (dataFile.caption) {
                        await sendText(
                            contactFile.number,
                            formatBody(
                                replaceFlowVars(varsFile, String(dataFile.caption)),
                                ticket
                            ),
                            getSession.facebookUserToken
                        );
                    }

                    await sendAttachmentFromUrl(
                        contactFile.number,
                        domainFile,
                        "file",
                        getSession.facebookUserToken
                    );

                    const ticketDetails = await ShowTicketService(ticket.id, companyId);
                    await ticketDetails.update({
                        lastMessage: formatBody(`${fileNameFile}`, ticket.contact)
                    });
                }
            } catch (errFile) {
                logger.warn(
                    `[FlowBuilder][file] Falha no node ${nodeSelected.id}: ${errFile?.message || errFile}`
                );
            }
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

        // Nó "subscribeDrip": inscreve/remove o contato de uma sequência de
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
                                // waiting_window: inscrição segurada pela janela de 24h também sai
                                status: { [Op.in]: ["active", "waiting_window"] }
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
                const msgNt = replaceFlowVars(
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

        // Nó "sendTemplate": canal Meta (Messenger/Instagram) não suporta
        // templates WhatsApp — apenas loga e segue o fluxo.
        if (nodeSelected.type === "sendTemplate") {
            logger.warn(
                `[FlowBuilder][sendTemplate] node=${nodeSelected.id} canal não suporta template — nó ignorado`
            );
        }

        // Nó "quickReplies": envia botões de resposta rápida (1–13,
        // título máx 20 chars) e suspende o fluxo aguardando a escolha.
        // A resposta volta como texto no listener → pressKey → desvio por
        // sourceHandle "a{index+1}" (mesmo contrato do menu).
        let suspendedByQuickReplies = false;
        if (nodeSelected.type === "quickReplies") {
            try {
                await ensureTicket();

                const dataQr = nodeSelected.data || {};
                const varsQr: any = ticket?.dataWebhook?.variables || {};
                const optionsQr: any[] = Array.isArray(dataQr.options)
                    ? dataQr.options
                    : [];
                const contactQr = await resolveFlowContact();

                if (!ticket || !contactQr || optionsQr.length === 0) {
                    logger.warn(
                        `[FlowBuilder][quickReplies] node=${nodeSelected.id} sem ticket, contato ou opções`
                    );
                } else {
                    const bodyQr = formatBody(
                        replaceFlowVars(varsQr, String(dataQr.message ?? "")),
                        ticket
                    );

                    await sendQuickReplies(
                        contactQr.number,
                        bodyQr,
                        optionsQr.slice(0, 13).map((o: any) => ({
                            title: String(o?.label || "").slice(0, 20),
                            payload: String(o?.payload || o?.label || "")
                        })),
                        getSession.facebookUserToken
                    );

                    const ticketDetailsQr = await ShowTicketService(
                        ticket.id,
                        companyId
                    );
                    await ticketDetailsQr.update({
                        lastMessage: bodyQr
                    });

                    // Suspende igual ao menu: o listener retoma com pressKey
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
                    suspendedByQuickReplies = true;
                }
            } catch (errQr) {
                logger.warn(
                    `[FlowBuilder][quickReplies] Falha no node ${nodeSelected.id}: ${errQr?.message || errQr}`
                );
            }
        }
        if (suspendedByQuickReplies) {
            break;
        }

        // Nó "carousel": envia generic template (cards com imagem e até 3
        // botões postback/web_url). Não suspende — clique em botão
        // postback volta como mensagem comum no listener.
        if (nodeSelected.type === "carousel") {
            try {
                await ensureTicket();

                const dataCar = nodeSelected.data || {};
                const varsCar: any = ticket?.dataWebhook?.variables || {};
                const cardsCar: any[] = Array.isArray(dataCar.cards)
                    ? dataCar.cards
                    : [];
                const contactCar = await resolveFlowContact();

                if (cardsCar.length === 0) {
                    logger.warn(
                        `[FlowBuilder][carousel] node=${nodeSelected.id} sem cards — seguindo fluxo`
                    );
                } else if (!contactCar) {
                    logger.warn(
                        `[FlowBuilder][carousel] node=${nodeSelected.id} sem contato — seguindo fluxo`
                    );
                } else {
                    const elementsCar = cardsCar.slice(0, 10).map((c: any) => {
                        const elCar: any = {
                            title: replaceFlowVars(
                                varsCar,
                                String(c?.title ?? "")
                            ).slice(0, 80)
                        };
                        if (c?.subtitle) {
                            elCar.subtitle = replaceFlowVars(
                                varsCar,
                                String(c.subtitle)
                            ).slice(0, 80);
                        }
                        if (c?.imageUrl) {
                            elCar.image_url = resolveFbMediaUrl(
                                replaceFlowVars(varsCar, String(c.imageUrl)),
                                companyId
                            );
                        }
                        const buttonsCar: any[] = Array.isArray(c?.buttons)
                            ? c.buttons
                            : [];
                        if (buttonsCar.length > 0) {
                            elCar.buttons = buttonsCar.slice(0, 3).map(
                                (b: any) => ({
                                    type:
                                        b?.type === "web_url"
                                            ? "web_url"
                                            : "postback",
                                    title: String(b?.title || "").slice(0, 20),
                                    url: b?.url
                                        ? replaceFlowVars(
                                              varsCar,
                                              String(b.url)
                                          )
                                        : undefined,
                                    payload: String(
                                        b?.payload || b?.title || ""
                                    )
                                })
                            );
                        }
                        return elCar;
                    });

                    await sendGenericTemplate(
                        contactCar.number,
                        elementsCar,
                        getSession.facebookUserToken
                    );

                    if (ticket) {
                        const ticketDetailsCar = await ShowTicketService(
                            ticket.id,
                            companyId
                        );
                        await ticketDetailsCar.update({
                            lastMessage: formatBody(
                                elementsCar[0]?.title || "[carrossel]",
                                ticket.contact
                            )
                        });
                    }
                }
            } catch (errCar) {
                logger.warn(
                    `[FlowBuilder][carousel] Falha no node ${nodeSelected.id}: ${errCar?.message || errCar}`
                );
            }
        }

        // Nó "sendEmail": canal Meta (Messenger/Instagram) não envia
        // e-mail — apenas loga e segue o fluxo.
        if (nodeSelected.type === "sendEmail") {
            logger.warn(
                `[FlowBuilder] sendEmail não suportado em canal Meta — node=${nodeSelected.id} ignorado`
            );
        }

        // Nó "csat": envia a pergunta de avaliação e suspende o fluxo com o
        // ticket em status "nps" — a nota numérica é capturada pelo listener.
        if (nodeSelected.type === "csat") {
            try {
                await ensureTicket();

                const contactCsat = await resolveFlowContact();
                if (!ticket || !contactCsat) {
                    logger.warn(
                        `[FlowBuilder][csat] node=${nodeSelected.id} sem ticket ou contato`
                    );
                } else {
                    const varsCsat: any = ticket?.dataWebhook?.variables || {};
                    const rawCsat =
                        nodeSelected.data?.message ||
                        getSession.ratingMessage ||
                        "De 0 a 10, como você avalia nosso atendimento?";
                    const bodyCsat = formatBody(
                        replaceFlowVars(varsCsat, String(rawCsat)),
                        ticket
                    );

                    await sendText(
                        contactCsat.number,
                        bodyCsat,
                        getSession.facebookUserToken
                    );

                    const ticketDetails = await ShowTicketService(ticket.id, companyId);
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
                // Mesma resolução do ResolveAIAgentForTicketService: primeiro
                // o aiAgentId explícito do nó; depois o agente ativo cujo
                // queueIds contenha o ticket.queueId atual.
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

                    // Etapa inicial do funil (menor order) — histórico é
                    // append-only, a linha mais recente é a etapa atual.
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
                        // flowWebhook false: mensagem do usuário durante o
                        // delay não dispara a retomada genérica — só o job.
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
        // (lastFlowId aponta para este nó). Saída "a" = usuário respondeu
        // (listener retoma); saída "b" = timeout (FlowResume agendado com
        // resumeToken — invalidado se a resposta chegar antes).
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
                            dwWr.resumeTimeoutMessage = replaceFlowVars(
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
