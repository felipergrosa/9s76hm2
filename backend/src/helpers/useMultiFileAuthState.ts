import { proto } from "@whiskeysockets/baileys";
import {
  AuthenticationCreds,
  AuthenticationState,
  SignalDataTypeMap
} from "@whiskeysockets/baileys";
import { initAuthCreds } from "@whiskeysockets/baileys";
import { BufferJSON } from "@whiskeysockets/baileys";
import cacheLayer from "../libs/cache";
import Whatsapp from "../models/Whatsapp";
import fs from "fs";
import path from "path";

export const useMultiFileAuthState = async (
  whatsapp: Whatsapp
): Promise<{ state: AuthenticationState; saveCreds: () => Promise<void> }> => {
  const driver = (process.env.SESSIONS_DRIVER || "").toLowerCase() || (process.env.REDIS_URI ? "redis" : "fs");

  // Base dir padrão: private/sessions/<companyId>/<whatsappId>
  const baseDir = path.resolve(
    process.cwd(),
    process.env.SESSIONS_DIR || "private/sessions",
    String(whatsapp.companyId || "0"),
    String(whatsapp.id)
  );

  // Log informativo (uma vez por instância) para diagnosticar driver/dir
  try {
    console.log(
      `[BaileysAuth] driver=${driver} baseDir=${baseDir} whatsappId=${whatsapp.id} companyId=${whatsapp.companyId}`
    );
  } catch {}

  const ensureDir = async () => {
    if (driver === "fs") {
      await fs.promises.mkdir(baseDir, { recursive: true }).catch(() => {});
    }
  };

  // Em Windows, nomes de arquivos não podem conter caracteres reservados. Também evitamos '@' e '::' usados pelo Baileys em IDs.
  const sanitizeFileName = (name: string) =>
    name
      .replace(/[<>:\\"/\\|?*]/g, "_") // caracteres inválidos gerais
      .replace(/@/g, "_at_")
      .replace(/::/g, "__");

  const fsPathFor = (file: string) => path.join(baseDir, `${sanitizeFileName(file)}.json`);

  const writeData = async (data: any, file: string) => {
    try {
      if (driver === "redis") {
        await cacheLayer.set(
          `sessions:${whatsapp.id}:${file}`,
          JSON.stringify(data, BufferJSON.replacer)
        );
      } else {
        await ensureDir();
        const p = fsPathFor(file);
        await fs.promises.writeFile(p, JSON.stringify(data, BufferJSON.replacer), "utf-8");
      }
    } catch (error) {
      console.log("writeData error", error);
      return null;
    }
  };

  const readData = async (file: string) => {
    try {
      if (driver === "redis") {
        const data = await cacheLayer.get(`sessions:${whatsapp.id}:${file}`);
        return data ? JSON.parse(data, BufferJSON.reviver) : null;
      } else {
        const p = fsPathFor(file);
        try {
          const raw = await fs.promises.readFile(p, "utf-8");
          return JSON.parse(raw, BufferJSON.reviver);
        } catch {
          return null;
        }
      }
    } catch (error) {
      return null;
    }
  };

  const removeData = async (file: string) => {
    try {
      if (driver === "redis") {
        await cacheLayer.del(`sessions:${whatsapp.id}:${file}`);
      } else {
        const p = fsPathFor(file);
        await fs.promises.unlink(p).catch(() => {});
      }
    } catch {}
  };

  const creds: AuthenticationCreds =
    (await readData("creds")) || initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const data: { [_: string]: SignalDataTypeMap[typeof type] } = {};
          await Promise.all(
            ids.map(async id => {
              let value = await readData(`${type}-${id}`);
              if (type === "app-state-sync-key" && value) {
                value = proto.Message.AppStateSyncKeyData.fromObject(value);
              }

              data[id] = value;
            })
          );

          return data;
        },
        set: async data => {
          const tasks: Promise<void>[] = [];
          for (const category in data) {
            for (const id in data[category]) {
              const value = data[category][id];
              const file = `${category}-${id}`;
              tasks.push(value ? writeData(value, file) : removeData(file));
            }
          }

          await Promise.all(tasks);
        }
      }
    },
    saveCreds: () => {
      return writeData(creds, "creds");
    }
  };
};