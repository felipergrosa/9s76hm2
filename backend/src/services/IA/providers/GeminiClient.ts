import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import path from "path";
import { ChatRequest, IAClient, ChatWithHistoryRequest, TranscribeRequest } from "../IAClient";

export default class GeminiClient implements IAClient {
  private client: GoogleGenerativeAI;

  constructor(private apiKey: string) {
    this.client = new GoogleGenerativeAI(this.apiKey);
  }

  async chat(req: ChatRequest): Promise<string> {
    const model = this.client.getGenerativeModel({
      model: req.model,
      systemInstruction: req.system || undefined,
    });

    const history = [] as any[];
    if (Array.isArray(req.fewShots)) {
      req.fewShots.forEach(fs => {
        history.push({ role: "user", parts: [{ text: fs.user }] });
        history.push({ role: "model", parts: [{ text: fs.assistant }] });
      });
    }

    const chat = model.startChat({
      history,
      generationConfig: {
        temperature: req.temperature,
        topP: req.top_p,
        maxOutputTokens: req.max_tokens,
      }
    });

    const result = await chat.sendMessage(req.user);
    return (result.response?.text?.() || "").trim();
  }

  async chatWithHistory(req: ChatWithHistoryRequest): Promise<string> {
    const model = this.client.getGenerativeModel({
      model: req.model,
      systemInstruction: req.system || undefined,
    });

    const history = (req.history || []).map(m => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }]
    }));

    const chat = model.startChat({
      history,
      generationConfig: {
        temperature: req.temperature,
        topP: req.top_p,
        maxOutputTokens: req.max_tokens,
      }
    });

    const result = await chat.sendMessage(req.user);
    return (result.response?.text?.() || "").trim();
  }

  async transcribe(req: TranscribeRequest): Promise<string> {
    const model = this.client.getGenerativeModel({
      model: req.model || "gemini-2.0-pro",
    });

    const fileExt = path.extname(req.filePath).toLowerCase();
    let mimeType = req.mimeType || "audio/mp3";
    switch (fileExt) {
      case ".wav": mimeType = "audio/wav"; break;
      case ".mp3": mimeType = "audio/mp3"; break;
      case ".aac": mimeType = "audio/aac"; break;
      case ".ogg": mimeType = "audio/ogg"; break;
      case ".flac": mimeType = "audio/flac"; break;
      case ".aiff": mimeType = "audio/aiff"; break;
    }

    const audioFileBase64 = fs.readFileSync(req.filePath, { encoding: 'base64' });

    const transcriptionRequest = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [
            { text: "Gere uma transcrição precisa deste áudio." },
            { inlineData: { mimeType, data: audioFileBase64 } },
          ],
        },
      ],
    });

    return (transcriptionRequest.response?.text?.() || "").trim();
  }
}
