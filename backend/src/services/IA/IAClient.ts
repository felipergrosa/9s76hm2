export type Role = "system" | "user" | "assistant";

export interface FewShotPair {
  user: string;
  assistant: string;
}

export interface ChatRequest {
  model: string;
  system: string;
  user: string;
  fewShots?: FewShotPair[];
  temperature?: number;
  top_p?: number;
  presence_penalty?: number;
  max_tokens?: number;
}

export interface ChatHistoryMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatWithHistoryRequest {
  model: string;
  system?: string; // opcional para alguns provedores
  history: ChatHistoryMessage[]; // em ordem cronológica
  user: string; // última mensagem do usuário a ser respondida
  temperature?: number;
  top_p?: number;
  presence_penalty?: number;
  max_tokens?: number;
}

export interface IAClient {
  chat(req: ChatRequest): Promise<string>;
  chatWithHistory(req: ChatWithHistoryRequest): Promise<string>;
  transcribe?(req: TranscribeRequest): Promise<string>;
}

export interface TranscribeRequest {
  filePath: string;
  mimeType?: string;
  model?: string; // whisper-1 (OpenAI) ou um modelo Gemini válido
}
