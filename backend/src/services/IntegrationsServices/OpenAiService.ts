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
import GetIntegrationByTypeService from "../QueueIntegrationServices/GetIntegrationByTypeService";
import FindCompanySettingOneService from "../CompaniesSettings/FindCompanySettingOneService";
import { search as ragSearch } from "../RAG/RAGSearchService";
import Ticket from "../../models/Ticket";
import Contact from "../../models/Contact";
import Message from "../../models/Message";
import TicketTraking from "../../models/TicketTraking";
import Queue from "../../models/Queue";
import { BOT_AVAILABLE_FUNCTIONS } from "../IA/BotFunctions";
import ActionExecutor from "../IA/ActionExecutor";

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

const resolveRAGConfigForTicket = async (
  ticket: Ticket
): Promise<{ enabled: boolean; k: number; tags: string[]; tagsMode?: "AND" | "OR" }> => {
  let ragEnabled = false;
  let ragTopK = 4;
  const tags: string[] = [];
  let tagsMode: "AND" | "OR" = "AND";

  try {
    const queue = await Queue.findByPk(ticket.queueId as any);

    // NOVO: Usar sistema de pastas vinculadas via QueueRAGSource
    try {
      const { default: ResolveTagsForQueueService } = await import("../QueueRAGSourceService/ResolveTagsForQueueService");
      const queueTags = await ResolveTagsForQueueService({ queueId: queue!.id });

      if (queueTags && queueTags.length > 0) {
        tags.push(...queueTags);
        tagsMode = "OR"; // Usar OR para buscar em múltiplas pastas
        console.log(`[RAG] Using ${queueTags.length} tags from linked folders for queue ${queue!.id}`);
      }
    } catch (err) {
      console.warn("[RAG] QueueRAGSourceService not available or no folders linked, falling back to ragCollection");
    }

    // FALLBACK: Backward compatibility com ragCollection (sistema antigo)
    if (tags.length === 0) {
      const collVal = (queue as any)?.ragCollection;
      const coll = collVal ? String(collVal).trim() : "";
      if (coll) {
        tags.push(`collection:${coll}`);
        console.log(`[RAG] Using legacy ragCollection: ${coll}`);
      }
    }
  } catch { }

  try {
    const knowledge = await GetIntegrationByTypeService({ companyId: ticket.companyId, type: "knowledge" });
    const j = (knowledge?.jsonContent || {}) as any;
    const ve = j?.ragEnabled;
    if (typeof ve === "boolean") ragEnabled = ve;
    if (typeof ve === "string") ragEnabled = ["enabled", "true", "on", "1"].includes(ve.toLowerCase());
    const k = Number(j?.ragTopK);
    if (!isNaN(k) && k > 0) ragTopK = Math.min(20, Math.max(1, k));
  } catch { }

  try {
    if (!ragEnabled) {
      const en = await FindCompanySettingOneService({ companyId: ticket.companyId, column: "ragEnabled" });
      const v2 = (en as any)?.[0]?.["ragEnabled"];
      ragEnabled = String(v2 || "").toLowerCase() === "enabled";
    }
  } catch { }

  try {
    const rk = await FindCompanySettingOneService({ companyId: ticket.companyId, column: "ragTopK" });
    const k2 = Number((rk as any)?.[0]?.["ragTopK"]);
    if (!isNaN(k2)) ragTopK = Math.min(20, Math.max(1, k2));
  } catch { }

  console.log("[IA][RAG][Config] Resolvido:", {
    companyId: ticket.companyId,
    queueId: ticket.queueId,
    ragEnabled,
    ragTopK,
    tags,
    tagsMode
  });

  return { enabled: ragEnabled, k: ragTopK, tags, tagsMode };
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

// Handles OpenAI request with Function Calling support
const handleOpenAIRequest = async (
  openai: SessionOpenAi,
  messagesAI: any[],
  openAiSettings: IOpenAi,
  ticket?: Ticket,
  contact?: Contact,
  wbot?: Session
): Promise<string> => {
  try {
    const now = Date.now();
    const functionsEnabled = true; // TODO: Controlar via configuração da empresa

    // Primeira chamada à IA (pode retornar function_call)
    const chatParams: any = {
      model: openAiSettings.model,
      messages: messagesAI,
      max_tokens: openAiSettings.maxTokens,
      temperature: openAiSettings.temperature,
    };

    // Adicionar functions se habilitado
    if (functionsEnabled) {
      chatParams.functions = BOT_AVAILABLE_FUNCTIONS;
      chatParams.function_call = "auto"; // Deixa IA decidir quando chamar
    }

    const chat = await openai.chat.completions.create(chatParams);
    const choice = chat.choices[0];

    console.log("[IA][OpenAI] Response:", {
      finish_reason: choice.finish_reason,
      content: choice.message?.content?.substring(0, 100),
      function_call: choice.message?.function_call
    });

    // Verificar se IA solicitou executar uma função
    if (choice.finish_reason === "function_call" && choice.message.function_call) {
      const functionCall = choice.message.function_call;
      const functionName = functionCall.name;
      const functionArgs = JSON.parse(functionCall.arguments || "{}");

      console.log(`[IA][function-call] IA solicitou função: ${functionName}`, {
        ticketId: ticket?.id,
        args: functionArgs,
        latency: Date.now() - now
      });

      // Executar ação via ActionExecutor
      let actionResult = "Função não executada (contexto insuficiente)";

      if (ticket && contact && wbot) {
        try {
          actionResult = await ActionExecutor.execute({
            wbot,
            ticket,
            contact,
            functionName,
            arguments: functionArgs
          });

          console.log(`[IA][function-call] Ação executada:`, {
            ticketId: ticket.id,
            function: functionName,
            result: actionResult.substring(0, 100)
          });
        } catch (execError: any) {
          console.error(`[IA][function-call] Erro ao executar ação:`, execError);
          actionResult = `❌ Erro ao executar ação: ${execError.message}`;
        }
      }

      // Adicionar a chamada da função e o resultado ao histórico
      messagesAI.push({
        role: "assistant",
        content: null,
        function_call: {
          name: functionName,
          arguments: functionCall.arguments
        }
      });

      messagesAI.push({
        role: "function",
        name: functionName,
        content: actionResult
      });

      // Segunda chamada à IA para gerar resposta final baseada no resultado da ação
      const finalChat = await openai.chat.completions.create({
        model: openAiSettings.model,
        messages: messagesAI,
        max_tokens: openAiSettings.maxTokens,
        temperature: openAiSettings.temperature
      });

      const responseText = finalChat.choices[0].message?.content || "";

      console.log(`[IA][function-call] Resposta final gerada`, {
        ticketId: ticket?.id,
        totalLatency: Date.now() - now
      });

      return responseText;
    }

    // Resposta normal (sem function call)
    return choice.message?.content || "";

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
    } catch { }

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

  let promptSystem = `Instruções do Sistema:
  - Use o nome ${clientName} nas respostas para que o cliente se sinta mais próximo e acolhido, sem exagerar nem repetir o nome em todas as frases.
  - Certifique-se de que a resposta tenha até ${openAiSettings.maxTokens} tokens e termine de forma completa, sem cortes.
  - Evite repetir sempre a mesma saudação em todas as mensagens. Depois da primeira interação, foque em responder diretamente ao que o cliente pediu na última mensagem.
  ${crmBlock}
  Prompt Específico:
  ${openAiSettings.prompt}
  
  Siga essas instruções com cuidado para garantir um atendimento claro, personalizado e amigável em todas as respostas.`;
  try {
    const ragCfg = await resolveRAGConfigForTicket(ticket);
    if (ragCfg.enabled && bodyMessage) {
      const hits = await ragSearch({
        companyId: ticket.companyId,
        query: bodyMessage,
        k: ragCfg.k,
        tags: ragCfg.tags,
        tagsMode: ragCfg.tagsMode
      });

      console.log("[IA][RAG][Search] Result:", {
        query: bodyMessage,
        hitsCount: Array.isArray(hits) ? hits.length : 0,
        tags: ragCfg.tags
      });

      if (Array.isArray(hits) && hits.length) {
        const context = hits.map((h, i) => `Fonte ${i + 1}:\n${h.content}`).join("\n\n");
        promptSystem = `${promptSystem}\nUse, se relevante, as fontes a seguir (não invente fatos):\n${context}`;
        try {
          console.log("[IA][rag][retrieve][wbot]", {
            companyId: ticket.companyId,
            ticketId: ticket.id,
            hits: hits.length,
            k: ragCfg.k,
            tags: ragCfg.tags,
            tagsMode: ragCfg.tagsMode
          });
        } catch { }
      }
    }
  } catch { }

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
          responseText = await handleOpenAIRequest(openai, messagesAI, openAiSettings, ticket, contact, wbot);
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
      } catch { }

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
            try { console.log("[IA][wbot][transcribe]", { provider: "openai", model: "whisper-1", latencyMs: latency, companyId: ticket.companyId, ticketId: ticket.id }); } catch { }
          }
        } catch { }

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
            try { console.log("[IA][wbot][transcribe]", { provider: "openai", model: "whisper-1", latencyMs: latency, companyId: ticket.companyId, ticketId: ticket.id }); } catch { }
          }
        }

        if (transcription) {
          const sentTranscriptMessage = await wbot.sendMessage(msg.key.remoteJid!, {
            text: `🎤 *Sua mensagem de voz:* ${transcription}`,
          });
          await verifyMessage(sentTranscriptMessage!, ticket, contact);

          messagesAI.push({ role: "user", content: transcription });

          try {
            const ragCfg = await resolveRAGConfigForTicket(ticket);
            if (ragCfg.enabled) {
              const hits = await ragSearch({
                companyId: ticket.companyId,
                query: transcription,
                k: ragCfg.k,
                tags: ragCfg.tags,
                tagsMode: ragCfg.tagsMode
              });
              if (Array.isArray(hits) && hits.length) {
                const context = hits.map((h, i) => `Fonte ${i + 1}:\n${h.content}`).join("\n\n");
                promptSystem = `${promptSystem}\nUse, se relevante, as fontes a seguir (não invente fatos):\n${context}`;
                try {
                  console.log("[IA][rag][retrieve][wbot][audio]", {
                    companyId: ticket.companyId,
                    ticketId: ticket.id,
                    hits: hits.length,
                    k: ragCfg.k,
                    tags: ragCfg.tags,
                    tagsMode: ragCfg.tagsMode
                  });
                } catch { }
              }
            }
          } catch { }

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
              try { console.log("[IA][wbot][audio-reply]", { provider: "openai", model: openAiSettings.model, latencyMs: latency, companyId: ticket.companyId, ticketId: ticket.id }); } catch { }
              await processResponse(responseText, wbot, msg, ticket, contact, openAiSettings, ticketTraking);
            }
          } catch {
            const t0resp = Date.now();
            const responseText = await handleOpenAIRequest(openai as any, messagesAI, openAiSettings);
            if (responseText) {
              const latency = Date.now() - t0resp;
              try { console.log("[IA][wbot][audio-reply]", { provider: "openai", model: openAiSettings.model, latencyMs: latency, companyId: ticket.companyId, ticketId: ticket.id }); } catch { }
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
            try { console.log("[IA][wbot][transcribe]", { provider: "gemini", model: openAiSettings.model, latencyMs: latency, companyId: ticket.companyId, ticketId: ticket.id }); } catch { }
          }
        } catch { }

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
            try { console.log("[IA][wbot][transcribe]", { provider: "gemini", model: openAiSettings.model, latencyMs: latency, companyId: ticket.companyId, ticketId: ticket.id }); } catch { }
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
              try { console.log("[IA][wbot][audio-reply]", { provider: "gemini", model: openAiSettings.model, latencyMs: latency, companyId: ticket.companyId, ticketId: ticket.id }); } catch { }
              await processResponse(responseText, wbot, msg, ticket, contact, openAiSettings, ticketTraking);
            }
          } catch {
            const t0resp = Date.now();
            const responseText = await handleGeminiRequest(gemini, messagesAI, openAiSettings, transcription, promptSystem);
            if (responseText) {
              const latency = Date.now() - t0resp;
              try { console.log("[IA][wbot][audio-reply]", { provider: "gemini", model: openAiSettings.model, latencyMs: latency, companyId: ticket.companyId, ticketId: ticket.id }); } catch { }
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
