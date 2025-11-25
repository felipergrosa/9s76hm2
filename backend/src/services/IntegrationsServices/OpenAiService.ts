import { MessageUpsertType, proto, WASocket } from "@whiskeysockets/baileys";
import {
  convertTextToSpeechAndSaveToFile,
  getBodyMessage,
  keepOnlySpecifiedChars,
  transferQueue,
  verifyMediaMessage,
  verifyMessage,
} from "../WbotServices/wbotMessageListener";
import { isNil, isNull } from "lodash";
import fs from "fs";
import path from "path";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import ResolveAIIntegrationService from "../IA/ResolveAIIntegrationService";
import IAClientFactory from "../IA/IAClientFactory";
import Ticket from "../../models/Ticket";
import Contact from "../../models/Contact";
import Message from "../../models/Message";
import TicketTraking from "../../models/TicketTraking";

type Session = WASocket & {
  id?: number;
};

interface ImessageUpsert {
  messages: proto.IWebMessageInfo[];
  type: MessageUpsertType;
}

interface IOpenAi {
  name: string;
  prompt: string;
  voice: string;
  voiceKey: string;
  voiceRegion: string;
  maxTokens: number;
  temperature: number;
  apiKey: string;
  queueId: number;
  maxMessages: number;
  model: string;
  openAiApiKey?: string;
}

interface SessionOpenAi extends OpenAI {
  id?: number;
}

interface SessionGemini extends GoogleGenerativeAI {
  id?: number;
}

const sessionsOpenAi: SessionOpenAi[] = [];
const sessionsGemini: SessionGemini[] = [];

const deleteFileSync = (path: string): void => {
  try {
    fs.unlinkSync(path);
  } catch (error) {
    console.error("Erro ao deletar o arquivo:", error);
  }
};

const sanitizeName = (name: string): string => {
  let sanitized = name.split(" ")[0];
  sanitized = sanitized.replace(/[^a-zA-Z0-9]/g, "");
  return sanitized.substring(0, 60);
};

// Prepares the AI messages from past messages
const prepareMessagesAI = (pastMessages: Message[], isGeminiModel: boolean, promptSystem: string): any[] => {
  const messagesAI = [];

  // For OpenAI, include the system prompt as a 'system' role
  if (!isGeminiModel) {
    messagesAI.push({ role: "system", content: promptSystem });
  }

  // Map past messages to AI message format
  for (const message of pastMessages) {
    if (message.mediaType === "conversation" || message.mediaType === "extendedTextMessage") {
      if (message.fromMe) {
        messagesAI.push({ role: "assistant", content: message.body });
      } else {
        messagesAI.push({ role: "user", content: message.body });
      }
    }
  }

  return messagesAI;
};

// Processes the AI response (text or audio)
const processResponse = async (
  responseText: string,
  wbot: Session,
  msg: proto.IWebMessageInfo,
  ticket: Ticket,
  contact: Contact,
  openAiSettings: IOpenAi,
  ticketTraking: TicketTraking
): Promise<void> => {
  let response = responseText;

  // Check for transfer action trigger
  if (response?.toLowerCase().includes("ação: transferir para o setor de atendimento")) {
    await transferQueue(openAiSettings.queueId, ticket, contact);
    response = response.replace(/ação: transferir para o setor de atendimento/i, "").trim();
  }

  const publicFolder: string = path.resolve(__dirname, "..", "..", "..", "public", `company${ticket.companyId}`);

  const isOfficial = (wbot as any)?.channelType === "official" || (wbot as any)?.isOfficial;

  // Send response based on preferred format (text or voice)
  if (openAiSettings.voice === "texto") {
    const sentMessage = await wbot.sendMessage(msg.key.remoteJid!, {
      text: `\u200e ${response}`,
    });
    if (!isOfficial) {
      await verifyMessage(sentMessage as any, ticket, contact);
    }
  } else {
    const fileNameWithOutExtension = `${ticket.id}_${Date.now()}`;
    try {
      await convertTextToSpeechAndSaveToFile(
        keepOnlySpecifiedChars(response),
        `${publicFolder}/${fileNameWithOutExtension}`,
        openAiSettings.voiceKey,
        openAiSettings.voiceRegion,
        openAiSettings.voice,
        "mp3"
      );
      const sendMessage = await wbot.sendMessage(msg.key.remoteJid!, {
        audio: { url: `${publicFolder}/${fileNameWithOutExtension}.mp3` },
        mimetype: "audio/mpeg",
        ptt: true,
      });
      if (!isOfficial) {
        await verifyMediaMessage(sendMessage as any, ticket, contact, ticketTraking, false, false, wbot);
      }
      deleteFileSync(`${publicFolder}/${fileNameWithOutExtension}.mp3`);
      deleteFileSync(`${publicFolder}/${fileNameWithOutExtension}.wav`);
    } catch (error) {
      console.error(`Erro para responder com audio: ${error}`);
      // Fallback to text response
      const sentMessage = await wbot.sendMessage(msg.key.remoteJid!, {
        text: `\u200e ${response}`,
      });
      if (!isOfficial) {
        await verifyMessage(sentMessage as any, ticket, contact);
      }
    }
  }
};

// Handles OpenAI request
const handleOpenAIRequest = async (openai: SessionOpenAi, messagesAI: any[], openAiSettings: IOpenAi): Promise<string> => {
  try {
    const chat = await openai.chat.completions.create({
      model: openAiSettings.model,
      messages: messagesAI,
      max_tokens: openAiSettings.maxTokens,
      temperature: openAiSettings.temperature,
    });
    return chat.choices[0].message?.content || "";
  } catch (error) {
    console.error("OpenAI request error:", error);
    throw error;
  }
};

// Handles Gemini request
const handleGeminiRequest = async (
  gemini: SessionGemini,
  messagesAI: any[],
  openAiSettings: IOpenAi,
  bodyMessage: string,
  promptSystem: string
): Promise<string> => {
  try {
    const model = gemini.getGenerativeModel({
      model: openAiSettings.model,
      systemInstruction: promptSystem, // Use system instruction for Gemini
    });

    // Map messages to Gemini format
    const geminiHistory = messagesAI.map(msg => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    }));

    const chat = model.startChat({ history: geminiHistory });
    const result = await chat.sendMessage(bodyMessage);
    return result.response.text();
  } catch (error) {
    console.error("Gemini request error:", error);
    throw error;
  }
};

// Main function to handle AI interactions
export const handleOpenAi = async (
  openAiSettings: IOpenAi,
  msg: proto.IWebMessageInfo,
  wbot: Session,
  ticket: Ticket,
  contact: Contact,
  mediaSent: Message | undefined,
  ticketTraking: TicketTraking
): Promise<void> => {
  if (contact.disableBot) {
    return;
  }

  const bodyMessage = getBodyMessage(msg);
  if (!bodyMessage && !msg.message?.audioMessage) return;

  if (!openAiSettings) return;

  if (msg.messageStubType) return;

  const publicFolder: string = path.resolve(__dirname, "..", "..", "..", "public", `company${ticket.companyId}`);

  // Resolver credenciais/modelo a partir da fila/conexão/empresa
  try {
    const preferProvider = (openAiSettings?.model || "").toLowerCase().includes("gemini") ? "gemini" : "openai";
    const resolved = await ResolveAIIntegrationService({
      companyId: ticket.companyId,
      queueId: openAiSettings?.queueId || ticket.queueId,
      whatsappId: ticket.whatsappId,
      preferProvider: preferProvider as any
    });
    const cfg = resolved?.config || {};

    try {
      // Log de debug sem expor a chave, apenas a origem
      console.log("[IA][wbot][resolve-config]", {
        companyId: ticket.companyId,
        queueId: openAiSettings?.queueId || ticket.queueId,
        whatsappId: ticket.whatsappId,
        provider: resolved?.provider,
        hasPromptApiKey: !!openAiSettings?.apiKey,
        hasIntegrationApiKey: !!cfg.apiKey,
        chosenSource: cfg.apiKey ? "integration" : (openAiSettings?.apiKey ? "prompt" : "none")
      });
    } catch {}

    const model = openAiSettings?.model || cfg.model || (resolved?.provider === "gemini" ? "gemini-2.0-pro" : "gpt-4o-mini");
    const apiKey = cfg.apiKey || openAiSettings?.apiKey;
    const maxTokens = (openAiSettings?.maxTokens ?? cfg.maxTokens ?? 400) as number;
    const temperature = (openAiSettings?.temperature ?? cfg.temperature ?? 0.7) as number;

    // Efetivar configurações consolidadas sem perder demais campos do settings original
    openAiSettings = {
      ...openAiSettings,
      model,
      apiKey,
      maxTokens,
      temperature
    } as IOpenAi;
  } catch {
    // silencioso: manter openAiSettings como veio
  }

  const isOpenAIModel = ["gpt-3.5-turbo-1106", "gpt-4o", "gpt-4o-mini"].includes(openAiSettings.model) || openAiSettings.model?.toLowerCase().startsWith("gpt");
  const isGeminiModel = ["gemini-2.0-pro", "gemini-2.0-flash", "gemini-1.5-pro", "gemini-1.5-flash"].includes(openAiSettings.model) || openAiSettings.model?.toLowerCase().includes("gemini");

  let openai: SessionOpenAi | null = null;
  let gemini: SessionGemini | null = null;

  // Validate apiKey obrigatória
  if (!openAiSettings.apiKey) {
    console.error("[IA][wbot] Nenhuma API key configurada. Configure em Integrações → Queue Integration.");
    return;
  }

  // Initialize AI provider based on model
  if (isOpenAIModel) {
    const openAiIndex = sessionsOpenAi.findIndex(s => s.id === ticket.id);
    if (openAiIndex === -1) {
      openai = new OpenAI({ apiKey: openAiSettings.apiKey }) as SessionOpenAi;
      openai.id = ticket.id;
      sessionsOpenAi.push(openai);
    } else {
      openai = sessionsOpenAi[openAiIndex];
    }
  } else if (isGeminiModel) {
    const geminiIndex = sessionsGemini.findIndex(s => s.id === ticket.id);
    if (geminiIndex === -1) {
      gemini = new GoogleGenerativeAI(openAiSettings.apiKey) as SessionGemini;
      gemini.id = ticket.id;
      sessionsGemini.push(gemini);
    } else {
      gemini = sessionsGemini[geminiIndex];
    }
  } else {
    console.error(`Unsupported model: ${openAiSettings.model}`);
    return;
  }

  // Initialize OpenAI for transcription if specified
  if (isOpenAIModel && openAiSettings.openAiApiKey && !openai) {
    const openAiIndex = sessionsOpenAi.findIndex(s => s.id === ticket.id);
    if (openAiIndex === -1) {
      openai = new OpenAI({ apiKey: openAiSettings.openAiApiKey || openAiSettings.apiKey }) as SessionOpenAi;
      openai.id = ticket.id;
      sessionsOpenAi.push(openai);
    } else {
      openai = sessionsOpenAi[openAiIndex];
    }
  }

  // Fetch past messages
  const messages = await Message.findAll({
    where: { ticketId: ticket.id },
    order: [["createdAt", "ASC"]],
    limit: openAiSettings.maxMessages,
  });

  // Debug: log total de mensagens encontradas
  console.log("[IA][DEBUG] Mensagens buscadas do banco:", {
    ticketId: ticket.id,
    totalMessages: messages.length,
    messages: messages.map(m => ({
      id: m.id,
      fromMe: m.fromMe,
      mediaType: m.mediaType,
      body: m.body?.substring(0, 50)
    }))
  });

  // Format system prompt
  const clientName = sanitizeName(contact.name || "Amigo(a)");
  const fantasyName = (contact as any)?.fantasyName || "";
  const contactPerson = (contact as any)?.contactName || "";
  const city = (contact as any)?.city || "";
  const region = (contact as any)?.region || "";
  const segment = (contact as any)?.segment || "";
  const situation = (contact as any)?.situation || "";

  const crmContextLines: string[] = [];
  if (fantasyName) crmContextLines.push(`- Empresa do cliente: ${fantasyName}`);
  if (contactPerson) crmContextLines.push(`- Pessoa de contato: ${contactPerson}`);
  if (city || region) crmContextLines.push(`- Localização: ${city || ""}${city && region ? " - " : ""}${region || ""}`.trim());
  if (segment) crmContextLines.push(`- Segmento: ${segment}`);
  if (situation) crmContextLines.push(`- Situação no CRM: ${situation}`);

  const crmBlock = crmContextLines.length
    ? `\nDados conhecidos do cliente (CRM, quando disponíveis):\n${crmContextLines.join("\n")}\n`
    : "";

  const promptSystem = `Instruções do Sistema:
  - Use o nome ${clientName} nas respostas para que o cliente se sinta mais próximo e acolhido, sem exagerar nem repetir o nome em todas as frases.
  - Certifique-se de que a resposta tenha até ${openAiSettings.maxTokens} tokens e termine de forma completa, sem cortes.
  - Evite repetir sempre a mesma saudação em todas as mensagens. Depois da primeira interação, foque em responder diretamente ao que o cliente pediu na última mensagem.
  - Se for preciso transferir para outro setor, comece a resposta com 'Ação: Transferir para o setor de atendimento'.
  ${crmBlock}
  Prompt Específico:
  ${openAiSettings.prompt}
  
  Siga essas instruções com cuidado para garantir um atendimento claro, personalizado e amigável em todas as respostas.`;

  // Debug: log do promptSystem gerado
  console.log("[IA][DEBUG] PromptSystem gerado:", {
    ticketId: ticket.id,
    promptLength: promptSystem.length,
    promptPreview: promptSystem.substring(0, 300)
  });

  // Handle text message
  if (msg.message?.conversation || msg.message?.extendedTextMessage?.text) {
    const messagesAI = prepareMessagesAI(messages, isGeminiModel, promptSystem);

    // Debug: log do histórico preparado para IA
    console.log("[IA][DEBUG] Histórico preparado para IA:", {
      ticketId: ticket.id,
      totalInHistory: messagesAI.length,
      history: messagesAI.map(m => ({
        role: m.role,
        content: m.content?.substring(0, 50)
      }))
    });

    try {
      let responseText: string | null = null;
      const provider = isGeminiModel ? "gemini" : "openai";
      const t0 = Date.now();

      // Tenta via IAClientFactory (unificado)
      try {
        const client = IAClientFactory(provider as any, openAiSettings.apiKey);
        const history = messagesAI
          .filter(m => m.role !== "system")
          .map(m => ({ role: m.role as "user" | "assistant", content: m.content }));
        responseText = await client.chatWithHistory({
          model: openAiSettings.model,
          system: promptSystem,
          history,
          user: bodyMessage!,
          temperature: openAiSettings.temperature,
          max_tokens: openAiSettings.maxTokens,
        });
      } catch (e) {
        // Fallback seguro: mantém implementação anterior por provedor
        if (isOpenAIModel && openai) {
          messagesAI.push({ role: "user", content: bodyMessage! });
          responseText = await handleOpenAIRequest(openai, messagesAI, openAiSettings);
        } else if (isGeminiModel && gemini) {
          responseText = await handleGeminiRequest(gemini, messagesAI, openAiSettings, bodyMessage!, promptSystem);
        }
      }

      if (!responseText) {
        console.error("No response from AI provider");
        return;
      }

      const latency = Date.now() - t0;
      try {
        console.log("[IA][wbot][text]", {
          provider,
          model: openAiSettings.model,
          latencyMs: latency,
          companyId: ticket.companyId,
          ticketId: ticket.id,
        });
      } catch {}

      await processResponse(responseText, wbot, msg, ticket, contact, openAiSettings, ticketTraking);
    } catch (error: any) {
      console.error("AI request failed:", error);
      const sentMessage = await wbot.sendMessage(msg.key.remoteJid!, {
        text: "Desculpe, estou com dificuldades técnicas para processar sua solicitação no momento. Por favor, tente novamente mais tarde.",
      });
      const isOfficial = (wbot as any)?.channelType === "official" || (wbot as any)?.isOfficial;
      if (!isOfficial) {
        await verifyMessage(sentMessage as any, ticket, contact);
      }
    }
  }
  // Handle audio message
  else if (msg.message?.audioMessage && mediaSent) {
    const messagesAI = prepareMessagesAI(messages, isGeminiModel, promptSystem);

    try {
      const mediaUrl = mediaSent.mediaUrl!.split("/").pop();
      const audioFilePath = `${publicFolder}/${mediaUrl}`;

      if (!fs.existsSync(audioFilePath)) {
        console.error(`Arquivo de áudio não encontrado: ${audioFilePath}`);
        const sentMessage = await wbot.sendMessage(msg.key.remoteJid!, {
          text: "Desculpe, não foi possível processar seu áudio. Por favor, tente novamente.",
        });
        await verifyMessage(sentMessage!, ticket, contact);
        return;
      }

      let transcription: string | null = null;
      const provider = isGeminiModel ? "gemini" : "openai";

      if (isOpenAIModel) {
        // Tenta via IAClientFactory (OpenAI Whisper)
        try {
          const client = IAClientFactory("openai" as any, openAiSettings.apiKey);
          const t0 = Date.now();
          if (client.transcribe) {
            transcription = await client.transcribe({ filePath: audioFilePath, model: "whisper-1" });
          }
          const latency = Date.now() - t0;
          if (transcription) {
            try { console.log("[IA][wbot][transcribe]", { provider: "openai", model: "whisper-1", latencyMs: latency, companyId: ticket.companyId, ticketId: ticket.id }); } catch {}
          }
        } catch {}

        // Fallback para implementação antiga, se necessário
        if (!transcription && openai) {
          const t0 = Date.now();
          const file = fs.createReadStream(audioFilePath) as any;
          const transcriptionResult = await openai.audio.transcriptions.create({
            model: "whisper-1",
            file: file,
          });
          transcription = transcriptionResult.text;
          const latency = Date.now() - t0;
          if (transcription) {
            try { console.log("[IA][wbot][transcribe]", { provider: "openai", model: "whisper-1", latencyMs: latency, companyId: ticket.companyId, ticketId: ticket.id }); } catch {}
          }
        }

        if (transcription) {
          const sentTranscriptMessage = await wbot.sendMessage(msg.key.remoteJid!, {
            text: `🎤 *Sua mensagem de voz:* ${transcription}`,
          });
          await verifyMessage(sentTranscriptMessage!, ticket, contact);

          messagesAI.push({ role: "user", content: transcription });

          // Responder ao usuário: tenta via Factory com histórico, fallback para método antigo
          try {
            const client = IAClientFactory("openai" as any, openAiSettings.apiKey);
            const history = messagesAI
              .filter(m => m.role !== "system")
              .map(m => ({ role: m.role as "user" | "assistant", content: m.content }));
            const t0resp = Date.now();
            const responseText = await client.chatWithHistory({
              model: openAiSettings.model,
              system: promptSystem,
              history,
              user: transcription,
              temperature: openAiSettings.temperature,
              max_tokens: openAiSettings.maxTokens,
            });
            if (responseText) {
              const latency = Date.now() - t0resp;
              try { console.log("[IA][wbot][audio-reply]", { provider: "openai", model: openAiSettings.model, latencyMs: latency, companyId: ticket.companyId, ticketId: ticket.id }); } catch {}
              await processResponse(responseText, wbot, msg, ticket, contact, openAiSettings, ticketTraking);
            }
          } catch {
            const t0resp = Date.now();
            const responseText = await handleOpenAIRequest(openai as any, messagesAI, openAiSettings);
            if (responseText) {
              const latency = Date.now() - t0resp;
              try { console.log("[IA][wbot][audio-reply]", { provider: "openai", model: openAiSettings.model, latencyMs: latency, companyId: ticket.companyId, ticketId: ticket.id }); } catch {}
              await processResponse(responseText, wbot, msg, ticket, contact, openAiSettings, ticketTraking);
            }
          }
        }
      } else if (isGeminiModel && gemini) {
        // Tenta via IAClientFactory para transcrever e responder
        try {
          const client = IAClientFactory("gemini" as any, openAiSettings.apiKey);
          const t0 = Date.now();
          if (client.transcribe) {
            transcription = await client.transcribe({ filePath: audioFilePath, model: openAiSettings.model });
          }
          const latency = Date.now() - t0;
          if (transcription) {
            try { console.log("[IA][wbot][transcribe]", { provider: "gemini", model: openAiSettings.model, latencyMs: latency, companyId: ticket.companyId, ticketId: ticket.id }); } catch {}
          }
        } catch {}

        // Fallback para implementação antiga
        if (!transcription) {
          const model = gemini.getGenerativeModel({
            model: openAiSettings.model,
            systemInstruction: promptSystem,
          });

          const audioFileBase64 = fs.readFileSync(audioFilePath, { encoding: 'base64' });
          const fileExtension = path.extname(audioFilePath).toLowerCase();
          let mimeType = 'audio/mp3';
          switch (fileExtension) {
            case '.wav': mimeType = 'audio/wav'; break;
            case '.mp3': mimeType = 'audio/mp3'; break;
            case '.aac': mimeType = 'audio/aac'; break;
            case '.ogg': mimeType = 'audio/ogg'; break;
            case '.flac': mimeType = 'audio/flac'; break;
            case '.aiff': mimeType = 'audio/aiff'; break;
          }

          const t0 = Date.now();
          const transcriptionRequest = await model.generateContent({
            contents: [
              {
                role: "user",
                parts: [
                  { text: "Gere uma transcrição precisa deste áudio." },
                  {
                    inlineData: {
                      mimeType: mimeType,
                      data: audioFileBase64,
                    },
                  },
                ],
              },
            ],
          });

          transcription = transcriptionRequest.response.text();
          const latency = Date.now() - t0;
          if (transcription) {
            try { console.log("[IA][wbot][transcribe]", { provider: "gemini", model: openAiSettings.model, latencyMs: latency, companyId: ticket.companyId, ticketId: ticket.id }); } catch {}
          }
        }

        if (transcription) {
          const sentTranscriptMessage = await wbot.sendMessage(msg.key.remoteJid!, {
            text: `🎤 *Sua mensagem de voz:* ${transcription}`,
          });
          await verifyMessage(sentTranscriptMessage!, ticket, contact);

          messagesAI.push({ role: "user", content: transcription });

          // Responder ao usuário: tenta via Factory com histórico, fallback para método antigo
          try {
            const client = IAClientFactory("gemini" as any, openAiSettings.apiKey);
            const history = messagesAI
              .filter(m => m.role !== "system")
              .map(m => ({ role: m.role as "user" | "assistant", content: m.content }));
            const t0resp = Date.now();
            const responseText = await client.chatWithHistory({
              model: openAiSettings.model,
              system: promptSystem,
              history,
              user: transcription,
              temperature: openAiSettings.temperature,
              max_tokens: openAiSettings.maxTokens,
            });
            if (responseText) {
              const latency = Date.now() - t0resp;
              try { console.log("[IA][wbot][audio-reply]", { provider: "gemini", model: openAiSettings.model, latencyMs: latency, companyId: ticket.companyId, ticketId: ticket.id }); } catch {}
              await processResponse(responseText, wbot, msg, ticket, contact, openAiSettings, ticketTraking);
            }
          } catch {
            const t0resp = Date.now();
            const responseText = await handleGeminiRequest(gemini, messagesAI, openAiSettings, transcription, promptSystem);
            if (responseText) {
              const latency = Date.now() - t0resp;
              try { console.log("[IA][wbot][audio-reply]", { provider: "gemini", model: openAiSettings.model, latencyMs: latency, companyId: ticket.companyId, ticketId: ticket.id }); } catch {}
              await processResponse(responseText, wbot, msg, ticket, contact, openAiSettings, ticketTraking);
            }
          }
        }
      }

      if (!transcription) {
        console.warn("Transcrição vazia recebida");
        const sentMessage = await wbot.sendMessage(msg.key.remoteJid!, {
          text: "Desculpe, não consegui entender o áudio. Por favor, tente novamente ou envie uma mensagem de texto.",
        });
        await verifyMessage(sentMessage!, ticket, contact);
      }
    } catch (error: any) {
      console.error("Erro no processamento de áudio:", error);
      const errorMessage = error?.response?.error?.message || error.message || "Erro desconhecido";
      const sentMessage = await wbot.sendMessage(msg.key.remoteJid!, {
        text: `Desculpe, houve um erro ao processar sua mensagem de áudio: ${errorMessage}`,
      });
      await verifyMessage(sentMessage!, ticket, contact);
    }
  }
};

export default handleOpenAi;
