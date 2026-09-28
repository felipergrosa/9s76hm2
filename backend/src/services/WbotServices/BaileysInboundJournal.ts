import { BufferJSON, proto } from "@whiskeysockets/baileys";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import logger from "../../utils/logger";

// O evento recebido precisa sobreviver a falhas de processamento e reinícios do processo.
// Cada socket escreve apenas no diretório de sua própria conexão.
const journalDir = (companyId: number, whatsappId: number): string => path.resolve(
  process.cwd(), "private", "baileys-inbound", String(companyId), String(whatsappId)
);

const journalPath = (companyId: number, whatsappId: number, message: proto.IWebMessageInfo): string => {
  const key = `${message.key?.remoteJid || ""}:${message.key?.id || ""}:${message.key?.participant || ""}`;
  const digest = crypto.createHash("sha256").update(key).digest("hex");
  return path.join(journalDir(companyId, whatsappId), `${digest}.json`);
};

export const persistBaileysInbound = async (
  companyId: number,
  whatsappId: number,
  message: proto.IWebMessageInfo
): Promise<string> => {
  if (!message.key?.id || !message.key?.remoteJid) throw new Error("Baileys message has no stable key");
  const dir = journalDir(companyId, whatsappId);
  const target = journalPath(companyId, whatsappId, message);
  await fs.promises.mkdir(dir, { recursive: true, mode: 0o700 });
  try {
    await fs.promises.access(target);
    return target;
  } catch (error: any) {
    if (error?.code !== "ENOENT") throw error;
  }
  const temporary = `${target}.${crypto.randomUUID()}.tmp`;
  try {
    await fs.promises.writeFile(temporary, JSON.stringify(message, BufferJSON.replacer), { flag: "wx", mode: 0o600 });
    await fs.promises.rename(temporary, target);
  } catch (error) {
    await fs.promises.unlink(temporary).catch(() => undefined);
    throw error;
  }
  return target;
};

export const listBaileysInbound = async (
  companyId: number,
  whatsappId: number
): Promise<Array<{ file: string; message: proto.IWebMessageInfo }>> => {
  const dir = journalDir(companyId, whatsappId);
  let names: string[];
  try {
    const all = await fs.promises.readdir(dir);
    // crash entre writeFile e rename deixa *.tmp órfãos — limpa no drain
    const tmp = all.filter(name => name.endsWith(".tmp"));
    for (const name of tmp) {
      await fs.promises.unlink(path.join(dir, name)).catch(() => undefined);
    }
    names = all.filter(name => name.endsWith(".json"));
  } catch (error: any) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
  const entries: Array<{ file: string; message: proto.IWebMessageInfo }> = [];
  for (const name of names) {
    const file = path.join(dir, name);
    try {
      const raw = await fs.promises.readFile(file, "utf8");
      entries.push({ file, message: JSON.parse(raw, BufferJSON.reviver) });
    } catch (error: any) {
      // arquivo corrompido não pode abortar o replay dos demais
      logger.warn(`[BaileysInbound] entrada inválida ignorada: ${file} (${error?.message})`);
    }
  }
  return entries;
};

export const removeBaileysInbound = async (file: string): Promise<void> => {
  try {
    await fs.promises.unlink(file);
  } catch (error: any) {
    // entrega duplicada (replay concorrendo com evento live) → segundo unlink é ENOENT
    if (error?.code !== "ENOENT") throw error;
  }
};

// Logout/delete da conexão: entradas pendentes de uma sessão removida não
// podem ser reprocessadas por um re-pareamento futuro do mesmo whatsappId.
export const clearBaileysInbound = async (
  companyId: number,
  whatsappId: number
): Promise<void> => {
  try {
    await fs.promises.rm(journalDir(companyId, whatsappId), { recursive: true, force: true });
  } catch (error: any) {
    logger.warn(`[BaileysInbound] falha ao limpar journal ${companyId}/${whatsappId}: ${error?.message}`);
  }
};
