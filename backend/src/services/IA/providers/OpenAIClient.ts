import OpenAI from "openai";
import fs from "fs";
import { ChatRequest, IAClient, ChatWithHistoryRequest, TranscribeRequest, FunctionCallRequest } from "../IAClient";

export default class OpenAIClient implements IAClient {
  private client: OpenAI;

  constructor(private apiKey: string) {
    this.client = new OpenAI({ apiKey: this.apiKey });
  }

  async chat(req: ChatRequest): Promise<string> {
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
    if (req.system) messages.push({ role: "system", content: req.system });
    if (Array.isArray(req.fewShots)) {
      req.fewShots.forEach(fs => {
        messages.push({ role: "user", content: fs.user });
        messages.push({ role: "assistant", content: fs.assistant });
      });
    }
    messages.push({ role: "user", content: req.user });

    const completion = await this.client.chat.completions.create({
      model: req.model,
      messages,
      temperature: req.temperature,
      top_p: req.top_p,
      presence_penalty: req.presence_penalty,
      max_tokens: req.max_tokens,
    });
    return completion.choices?.[0]?.message?.content?.trim() || "";
  }

  async chatWithHistory(req: ChatWithHistoryRequest): Promise<string> {
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];
    if (req.system) messages.push({ role: "system", content: req.system });
    if (Array.isArray(req.history)) {
      req.history.forEach(m => {
        messages.push({ role: m.role, content: m.content });
      });
    }

    const completion = await this.client.chat.completions.create({
      model: req.model,
      messages,
      temperature: req.temperature,
      top_p: req.top_p,
      presence_penalty: req.presence_penalty,
      max_tokens: req.max_tokens,
    });
    return completion.choices?.[0]?.message?.content?.trim() || "";
  }

  async transcribe(req: TranscribeRequest): Promise<string> {
    const file = fs.createReadStream(req.filePath) as any;
    const completion = await this.client.audio.transcriptions.create({
      model: req.model || "whisper-1",
      file,
    });
    // API retorna { text: string }
    const text: any = (completion as any)?.text;
    return (typeof text === "string" ? text : "").trim();
  }

  async chatWithFunctions(req: FunctionCallRequest): Promise<string> {
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

    // Adicionar system prompt
    if (req.system) messages.push({ role: "system", content: req.system });

    // Adicionar histórico
    if (Array.isArray(req.history)) {
      req.history.forEach(m => {
        messages.push({ role: m.role, content: m.content });
      });
    }

    // Adicionar mensagem do usuário
    messages.push({ role: "user", content: req.user });

    // Primeira chamada com functions
    const chatParams: any = {
      model: req.model,
      messages,
      temperature: req.temperature ?? 0.7,
      top_p: req.top_p,
      presence_penalty: req.presence_penalty,
      max_tokens: req.max_tokens ?? 400,
    };

    // Adicionar functions se fornecidas
    if (req.functions && req.functions.length > 0) {
      chatParams.functions = req.functions;
      chatParams.function_call = "auto";
    }

    const chat = await this.client.chat.completions.create(chatParams);
    const choice = chat.choices[0];

    // Verificar se IA solicitou executar uma função
    if (choice.finish_reason === "function_call" && choice.message.function_call) {
      const functionCall = choice.message.function_call;
      const functionName = functionCall.name;
      const functionArgs = JSON.parse(functionCall.arguments || "{}");

      console.log(`[OpenAIClient] Function call requested: ${functionName}`, functionArgs);

      // Executar função via callback
      let actionResult = "Função não executada (callback não fornecido)";
      if (req.onFunctionCall) {
        try {
          actionResult = await req.onFunctionCall(functionName, functionArgs);
        } catch (error: any) {
          actionResult = `Erro ao executar função: ${error.message}`;
        }
      }

      // Adicionar chamada e resultado ao histórico
      messages.push({
        role: "assistant",
        content: null,
        function_call: {
          name: functionName,
          arguments: functionCall.arguments
        }
      } as any);

      messages.push({
        role: "function",
        name: functionName,
        content: actionResult
      } as any);

      // Segunda chamada para resposta final
      const finalChat = await this.client.chat.completions.create({
        model: req.model,
        messages,
        temperature: req.temperature ?? 0.7,
        max_tokens: req.max_tokens ?? 400
      });

      return finalChat.choices[0].message?.content?.trim() || "";
    }

    // Resposta normal (sem function call)
    return choice.message?.content?.trim() || "";
  }
}
