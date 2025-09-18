import OpenAI from "openai";
import fs from "fs";
import { ChatRequest, IAClient, ChatWithHistoryRequest, TranscribeRequest } from "../IAClient";

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
}
