import { Client, LocalAuth } from "whatsapp-web.js";
import logger from "../../utils/logger";
import GetDefaultWhatsApp from "../../helpers/GetDefaultWhatsApp";
import LabelSyncService from "./LabelSyncService";
import GetDeviceLabelsService from "./GetDeviceLabelsService";
import ShowBaileysService from "../BaileysServices/ShowBaileysService";
import { getAllChatLabels, mapLabelIdsToTags, getLabelMap } from "../../libs/labelCache";
import { getUnlabeledJids } from "./GetDeviceContactsService";
// No vincular ao modelo Whatsapp nem emitir eventos de socket para evitar
// qualquer interferncia com a sesso Baileys. O QR/status ficam s apenas em memria
// e s expostos pelos endpoints especficos deste servio.

interface DeviceLabel {
  id: string;
  name: string;
  color?: string;
  count?: number;
}

interface DeviceContact {
  id: string;
  name: string;
  number: string;
  tags: DeviceLabel[];
}

class WhatsAppWebLabelsService {
  private clients: Map<number, Client> = new Map();
  private isInitializing: Map<number, boolean> = new Map();
  private qrCodes: Map<number, string> = new Map();
  private connectionStatus: Map<number, string> = new Map();
  // Cache de contatos "Sem etiqueta (salvos)" por whatsappId
  private unlabeledCache: Map<number, { ts: number; contacts: DeviceContact[] }> = new Map();
  // Progresso da coleta de labels/contatos
  private labelsProgress: Map<number, { percent: number; phase: string }> = new Map();
  private cancelRequested: Map<number, boolean> = new Map();

  private setProgress(whatsappId: number, percent: number, phase: string) {
    const p = Math.max(0, Math.min(100, Math.round(percent)));
    this.labelsProgress.set(whatsappId, { percent: p, phase });
  }

  getLabelsProgress(whatsappId: number) {
    return this.labelsProgress.get(whatsappId) || { percent: 0, phase: 'idle' };
  }

  requestCancel(whatsappId: number) {
    this.cancelRequested.set(whatsappId, true);
    // Zera o progresso imediatamente
    this.labelsProgress.delete(whatsappId);
  }

  private isCancelled(whatsappId: number) {
    return this.cancelRequested.get(whatsappId) === true;
  }

  private clearCancel(whatsappId: number) {
    this.cancelRequested.delete(whatsappId);
  }

  async getOrCreateClient(whatsappId: number): Promise<Client | null> {
    try {
      // Se já existe cliente ativo, retorna
      if (this.clients.has(whatsappId)) {
        const client = this.clients.get(whatsappId)!;
        const state = await client.getState();
        if (state === 'CONNECTED') {
          return client;
        }
      }

      // Se está inicializando, aguarda até 60 segundos
      if (this.isInitializing.get(whatsappId)) {
        logger.info(`[WhatsAppWebLabels] Cliente ${whatsappId} já está inicializando, aguardando conexão...`);

        // Aguardar até 60 segundos pela conexão
        for (let i = 0; i < 60; i++) {
          await new Promise(resolve => setTimeout(resolve, 1000));

          if (this.clients.has(whatsappId)) {
            const client = this.clients.get(whatsappId)!;
            const state = await client.getState();
            logger.info(`[WhatsAppWebLabels] Verificando estado (${i + 1}s): ${state}`);

            if (state === 'CONNECTED') {
              logger.info(`[WhatsAppWebLabels] ✅ Cliente conectado após ${i + 1} segundos`);
              return client;
            }
          }
        }

        logger.warn(`[WhatsAppWebLabels] ⏰ Timeout aguardando conexão após 60 segundos`);

        // Se ainda existe cliente pendente, destruir para permitir nova inicialização limpa
        if (this.clients.has(whatsappId)) {
          try {
            const pendingClient = this.clients.get(whatsappId)!;
            await pendingClient.destroy();
          } catch (destroyErr: any) {
            logger.warn(`[WhatsAppWebLabels] Falha ao destruir cliente pendente após timeout: ${destroyErr?.message}`);
          }
          this.clients.delete(whatsappId);
        }
        this.isInitializing.set(whatsappId, false);
        this.connectionStatus.set(whatsappId, 'timeout');
        this.qrCodes.delete(whatsappId);
        return null;
      }

      this.isInitializing.set(whatsappId, true);
      logger.info(`[WhatsAppWebLabels] Inicializando cliente para whatsappId=${whatsappId}`);

      const client = new Client({
        authStrategy: new LocalAuth({
          clientId: `whaticket-labels-${whatsappId}`
        }),
        puppeteer: {
          headless: true,
          executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu'
          ]
        }
      });

      // Configurar eventos
      client.on('qr', (qr) => {
        // logs reduzidos
        this.qrCodes.set(whatsappId, qr);
        this.connectionStatus.set(whatsappId, 'qr_generated');
      });

      client.on('ready', () => {
        logger.info(`[WhatsAppWebLabels] ✅ Cliente CONECTADO para whatsappId=${whatsappId}`);
        this.clients.set(whatsappId, client);
        this.isInitializing.set(whatsappId, false);
        this.qrCodes.delete(whatsappId); // Limpar QR Code após conexão
        this.connectionStatus.set(whatsappId, 'connected');
      });

      client.on('authenticated', () => {
        logger.info(`[WhatsAppWebLabels] 🔐 Cliente AUTENTICADO para whatsappId=${whatsappId}`);
        this.connectionStatus.set(whatsappId, 'authenticated');
      });

      client.on('auth_failure', (msg) => {
        logger.error(`[WhatsAppWebLabels] ❌ FALHA na autenticação para whatsappId=${whatsappId}: ${msg}`);
        this.isInitializing.set(whatsappId, false);
      });

      client.on('disconnected', (reason) => {
        logger.warn(`[WhatsAppWebLabels] 🔌 Cliente DESCONECTADO para whatsappId=${whatsappId}: ${reason}`);
        this.clients.delete(whatsappId);
        this.isInitializing.set(whatsappId, false);
      });

      client.on('loading_screen', (percent, message) => {
        logger.info(`[WhatsAppWebLabels] 📊 Carregando: ${percent}% - ${message}`);
      });

      // logs reduzidos
      await client.initialize();

      // Aguardar mais tempo para garantir que está totalmente carregado
      // logs reduzidos
      await new Promise(resolve => setTimeout(resolve, 5000));

      return client;

    } catch (error: any) {
      logger.error(`[WhatsAppWebLabels] Erro ao inicializar cliente ${whatsappId}: ${error?.message}`);
      this.isInitializing.set(whatsappId, false);
      return null;
    }
  }



  async getDeviceLabels(companyId: number, whatsappId?: number): Promise<DeviceLabel[]> {
    try {
      const defaultWhatsapp = await GetDefaultWhatsApp(whatsappId, companyId);
      this.setProgress(defaultWhatsapp.id, 5, "iniciando");

      let labels: DeviceLabel[] = [];

      // 1. Tentar obter labels via WhatsApp-Web.js (se conectado)
      if (this.clients.has(defaultWhatsapp.id)) {
        try {
          const client = this.clients.get(defaultWhatsapp.id);
          const state = await client?.getState();

          if (state === 'CONNECTED') {
            logger.info(`[WhatsAppWebLabels] Cliente WWebJS conectado, buscando labels diretamente...`);
            this.setProgress(defaultWhatsapp.id, 10, "labels_recebidas");

            // @ts-ignore - getLabels existe no client do whatsapp-web.js mas pode não estar na tipagem
            const wwebLabels = await client.getLabels();

            if (Array.isArray(wwebLabels)) {
              labels = wwebLabels.map((l: any) => ({
                id: l.id,
                name: l.name,
                color: l.color ? (typeof l.color === 'number' ? l.color : l.hexColor) : undefined,
                count: 0 // WWebJS retorna count? verificar. Se não, será calculado abaixo via contatos.
              }));
              logger.info(`[WhatsAppWebLabels] ${labels.length} labels encontradas via WWebJS direct call`);
            }
          }
        } catch (wwebError: any) {
          logger.warn(`[WhatsAppWebLabels] Falha ao buscar labels via WWebJS: ${wwebError?.message}`);
        }
      }

      // 2. Se não encontrou via WWebJS, tentar via Baileys (Sync + Cache)
      if (labels.length === 0) {
        const syncResult = await LabelSyncService.sync({ companyId, whatsappId: defaultWhatsapp.id });
        logger.info(`[WhatsAppWebLabels] Sync concluído para whatsappId=${defaultWhatsapp.id}: ${JSON.stringify(syncResult)}`);

        this.setProgress(defaultWhatsapp.id, 25, "cache_consolidado");

        labels = await GetDeviceLabelsService(companyId, defaultWhatsapp.id);
      }

      // Garantir que labels especiais existam para o frontend
      const ensureSyntheticLabel = (id: string, name: string, color: string, count: number) => {
        const exists = labels.some(l => l.id === id);
        if (!exists) {
          labels = [{ id, name, color, count }, ...labels];
        }
      };

      // Contatos salvos (__all__)
      try {
        const baileysData = await ShowBaileysService(defaultWhatsapp.id);
        const parseMaybeJSON = (val: any) => {
          try {
            if (!val) return null;
            if (typeof val === "string") return JSON.parse(val);
            return val;
          } catch {
            return null;
          }
        };

        const contacts = parseMaybeJSON((baileysData as any).contacts);
        if (Array.isArray(contacts)) {
          const personal = contacts.filter((c: any) => {
            const jid = String(c?.id || "");
            return /@c\.us$/.test(jid) && !/@g\.us$/.test(jid);
          });
          ensureSyntheticLabel("__all__", "Todos os contatos", "#5E97D1", personal.length);
        }
      } catch (err: any) {
        logger.warn(`[WhatsAppWebLabels] Falha ao computar __all__: ${err?.message}`);
      }

      // Sem etiqueta (__unlabeled__)
      try {
        const unlabeledJids = await getUnlabeledJids(companyId, defaultWhatsapp.id);
        this.setProgress(defaultWhatsapp.id, 45, "sem_etiqueta");
        ensureSyntheticLabel("__unlabeled__", "Sem etiqueta", "#8D99AE", unlabeledJids.size);
      } catch (err: any) {
        logger.warn(`[WhatsAppWebLabels] Falha ao computar __unlabeled__: ${err?.message}`);
      }

      // Listas de transmissão (__broadcast__) e participantes de grupos (__group_participants__)
      try {
        const baileysData = await ShowBaileysService(defaultWhatsapp.id);
        const parseMaybeJSON = (val: any) => {
          try {
            if (!val) return null;
            if (typeof val === "string") return JSON.parse(val);
            return val;
          } catch {
            return null;
          }
        };
        const chats = parseMaybeJSON((baileysData as any).chats);
        if (Array.isArray(chats)) {
          const broadcasts = chats.filter((chat: any) => /@broadcast$/.test(String(chat?.id || "")));
          ensureSyntheticLabel("__broadcast__", "Listas de transmissão", "#F4B400", broadcasts.length);

          const groupParticipants = (() => {
            const participants = new Set<string>();
            chats
              .filter((chat: any) => /@g\.us$/.test(String(chat?.id || "")))
              .forEach((chat: any) => {
                const members = Array.isArray(chat?.participants) ? chat.participants : [];
                members.forEach((m: any) => {
                  const pid = String(m?.id || m?.jid || "");
                  if (/@c\.us$/.test(pid)) participants.add(pid);
                });
              });
            return participants.size;
          })();
          ensureSyntheticLabel("__group_participants__", "Contatos de grupos", "#7E57C2", groupParticipants);
        }
      } catch (err: any) {
        logger.warn(`[WhatsAppWebLabels] Falha ao computar labels especiais: ${err?.message}`);
      }

      this.setProgress(defaultWhatsapp.id, 100, "concluido");
      return labels;
    } catch (error: any) {
      logger.error(`[WhatsAppWebLabels] 💥 Erro ao buscar labels: ${error?.message}`);
      throw error;
    }
  }

  async getContactsByLabel(companyId: number, labelId: string, whatsappId?: number): Promise<DeviceContact[]> {
    try {
      const defaultWhatsapp = await GetDefaultWhatsApp(whatsappId, companyId);
      await LabelSyncService.sync({ companyId, whatsappId: defaultWhatsapp.id });

      const baileysData = await ShowBaileysService(defaultWhatsapp.id);
      const parseMaybeJSON = (val: any) => {
        try {
          if (!val) return null;
          if (typeof val === "string") return JSON.parse(val);
          return val;
        } catch {
          return null;
        }
      };

      const contactsRaw = parseMaybeJSON((baileysData as any).contacts);
      const chatsRaw = parseMaybeJSON((baileysData as any).chats);

      const contacts = Array.isArray(contactsRaw) ? contactsRaw : [];
      const chats = Array.isArray(chatsRaw) ? chatsRaw : [];

      const contactsMap = new Map<string, any>();
      const chatsMap = new Map<string, any>();

      contacts.forEach((c: any) => {
        if (c?.id) contactsMap.set(String(c.id), c);
      });

      chats.forEach((c: any) => {
        if (c?.id) chatsMap.set(String(c.id), c);
      });

      const chatLabels = getAllChatLabels(defaultWhatsapp.id);
      const buildTags = (jid: string) => {
        const set = chatLabels.get(jid);
        if (!set || set.size === 0) return [] as DeviceLabel[];
        return mapLabelIdsToTags(defaultWhatsapp.id, Array.from(set));
      };

      const buildContact = (jid: string): DeviceContact => {
        const baseContact = contactsMap.get(jid);
        const baseChat = chatsMap.get(jid);
        const number = (baseContact?.number || baseContact?.id || baseChat?.id || jid).toString().replace(/@.*/, "");
        const name = baseContact?.name
          || baseContact?.notify
          || baseContact?.pushname
          || baseChat?.name
          || baseChat?.notify
          || baseChat?.pushname
          || number
          || jid;
        return {
          id: jid,
          name,
          number,
          tags: buildTags(jid)
        };
      };

      const result: DeviceContact[] = [];

      if (labelId === "__all__") {
        contacts
          .filter((c: any) => {
            const jid = String(c?.id || "");
            if (!/@c\.us$/.test(jid)) return false;
            if (/@g\.us$/.test(jid)) return false;
            return true;
          })
          .forEach((c: any) => {
            const jid = String(c.id);
            result.push(buildContact(jid));
          });
        return result;
      }

      if (labelId === "__unlabeled__") {
        const cache = this.unlabeledCache.get(defaultWhatsapp.id);
        const TTL = 5 * 60 * 1000;
        if (cache && Date.now() - cache.ts < TTL) {
          return cache.contacts;
        }
        const unlabeledJids = await getUnlabeledJids(companyId, defaultWhatsapp.id);
        const contactsWithoutLabels = Array.from(unlabeledJids).map(buildContact);
        this.unlabeledCache.set(defaultWhatsapp.id, { ts: Date.now(), contacts: contactsWithoutLabels });
        return contactsWithoutLabels;
      }

      if (labelId === "__broadcast__") {
        logger.warn("[WhatsAppWebLabels] Listas de transmissão não expõem membros via API; retornando vazio");
        return [];
      }

      if (labelId === "__group_participants__") {
        const participantIds = new Set<string>();
        chats
          .filter((chat: any) => /@g\.us$/.test(String(chat?.id || "")))
          .forEach((chat: any) => {
            const participants = Array.isArray(chat?.participants) ? chat.participants : [];
            participants.forEach((p: any) => {
              const pid = String(p?.id || p?.jid || "");
              if (/@c\.us$/.test(pid)) participantIds.add(pid);
            });
          });
        participantIds.forEach(jid => result.push(buildContact(jid)));
        return result;
      }

      // Labels reais
      const matchedJids: string[] = [];
      for (const [jid, labelSet] of chatLabels.entries()) {
        if (labelSet.has(labelId)) {
          matchedJids.push(jid);
        }
      }

      if (matchedJids.length === 0) {
        logger.info(`[WhatsAppWebLabels] Nenhum contato associado à label ${labelId}`);
        return [];
      }

      matchedJids.forEach(jid => result.push(buildContact(jid)));

      logger.info(`[WhatsAppWebLabels] Encontrados ${result.length} contatos para label ${labelId}`);
      return result;

    } catch (error: any) {
      logger.error(`[WhatsAppWebLabels] Erro ao buscar contatos da label ${labelId}: ${error?.message}`);
      throw error;
    }
  }

  getQRCode(whatsappId: number): string | null {
    return this.qrCodes.get(whatsappId) || null;
  }

  getConnectionStatus(whatsappId: number): { connected: boolean; initializing: boolean; hasQR: boolean; status: string } {
    return {
      connected: this.clients.has(whatsappId),
      initializing: this.isInitializing.get(whatsappId) || false,
      hasQR: this.qrCodes.has(whatsappId),
      status: this.connectionStatus.get(whatsappId) || 'disconnected'
    };
  }

  async destroyClient(whatsappId: number): Promise<void> {
    try {
      const client = this.clients.get(whatsappId);
      if (client) {
        await client.destroy();
        this.clients.delete(whatsappId);
        this.qrCodes.delete(whatsappId);
        this.isInitializing.set(whatsappId, false);
        logger.info(`[WhatsAppWebLabels] Cliente ${whatsappId} destruído`);
      }
    } catch (error: any) {
      logger.error(`[WhatsAppWebLabels] Erro ao destruir cliente ${whatsappId}: ${error?.message}`);
    }
  }
}

// Singleton
const whatsAppWebLabelsService = new WhatsAppWebLabelsService();
export default whatsAppWebLabelsService;
