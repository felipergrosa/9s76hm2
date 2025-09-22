import { Client, LocalAuth } from "whatsapp-web.js";
import os from "os";
import logger from "../../utils/logger";
import GetDefaultWhatsApp from "../../helpers/GetDefaultWhatsApp";
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
            logger.info(`[WhatsAppWebLabels] Verificando estado (${i+1}s): ${state}`);
            
            if (state === 'CONNECTED') {
              logger.info(`[WhatsAppWebLabels] ✅ Cliente conectado após ${i+1} segundos`);
              return client;
            }
          }
        }
        
        logger.warn(`[WhatsAppWebLabels] ⏰ Timeout aguardando conexão após 60 segundos`);
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
      this.setProgress(defaultWhatsapp.id, 5, 'iniciando');
      // logs reduzidos
      
      const client = await this.getOrCreateClient(defaultWhatsapp.id);
      
      if (!client) {
        throw new Error("Cliente WhatsApp Web não disponível. Aguarde a conexão ou escaneie o QR Code.");
      }

      // O cliente já foi validado no getOrCreateClient, então pode prosseguir
      // logs reduzidos
      
      // Aguardar um pouco mais para garantir que tudo carregou
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Verificar estado final
      const state = await client.getState();

      // logs reduzidos
      
      // Tentar buscar labels com retry
      let labels: any[] = [];
      let attempts = 0;
      const maxAttempts = 3;
      
      while (attempts < maxAttempts) {
        try {
          attempts++;
          // logs reduzidos
          
          labels = await client.getLabels();
          // logs reduzidos
          break;
          
        } catch (err: any) {
          logger.warn(`[WhatsAppWebLabels] Falha ao buscar labels (tentativa ${attempts}): ${err?.message}`);
          
          if (attempts < maxAttempts) {
            // logs reduzidos
            await new Promise(resolve => setTimeout(resolve, 5000));
          } else {
            throw new Error(`Falha ao buscar labels após ${maxAttempts} tentativas: ${err?.message}`);
          }
        }
      }
      this.setProgress(defaultWhatsapp.id, 20, 'labels_recebidas');
      
      const deviceLabels: DeviceLabel[] = [];

      const cpuCount = Number(os.cpus()?.length || 4);
      const batchSize = Math.min(10, Math.max(5, Math.floor(cpuCount / 2)));
      const total = labels.length || 1;
      for (let i = 0; i < labels.length; i += batchSize) {
        if (this.isCancelled(defaultWhatsapp.id)) {
          this.clearCancel(defaultWhatsapp.id);
          this.setProgress(defaultWhatsapp.id, 0, 'idle');
          return [];
        }
        const batch = labels.slice(i, i + batchSize);
        await Promise.all(batch.map(async (label: any) => {
          try {
            const chats = await label.getChats();
            const contactCount = chats.filter((chat: any) => {
              const id = String(chat?.id?._serialized || chat?.id || "");
              const isGroup = !!chat?.isGroup || /@g\.us$/.test(id);
              const isBroadcast = /@broadcast$/.test(id) || id === "status@broadcast";
              const isNewsletter = /@newsletter$/.test(id);
              return !isGroup && !isBroadcast && !isNewsletter;
            }).length;
            deviceLabels.push({
              id: String(label.id),
              name: String(label.name || label.id),
              color: (label as any)?.color,
              count: contactCount
            });
          } catch (e: any) {
            logger.warn(`[WhatsAppWebLabels] Falha ao processar label ${label?.name || label?.id}: ${e?.message}`);
          }
        }));
        const progress = 20 + Math.min(20, Math.floor(((i + batch.length) / total) * 20));
        this.setProgress(defaultWhatsapp.id, progress, 'contagem_por_label');
      }
      this.setProgress(defaultWhatsapp.id, 40, 'contagem_por_label');

      // Adicionar "Sem etiqueta" (apenas contatos salvos) - com cache 5 min (otimizado)
      try {
        const cache = this.unlabeledCache.get(defaultWhatsapp.id);
        const now = Date.now();
        const TTL = 5 * 60 * 1000; // 5 minutos
        let contactsWithoutLabels: DeviceContact[] = [];
        if (cache && now - cache.ts < TTL) {
          contactsWithoutLabels = cache.contacts;
        } else {
          this.setProgress(defaultWhatsapp.id, 50, 'lendo_contatos_salvos');
          if (this.isCancelled(defaultWhatsapp.id)) {
            this.clearCancel(defaultWhatsapp.id);
            this.setProgress(defaultWhatsapp.id, 0, 'idle');
            return deviceLabels;
          }
          const allContacts = await client.getContacts();
          // Apenas contatos pessoais salvos no aparelho
          const personalContacts = allContacts.filter((c: any) => {
            const jid = String(c?.id?._serialized || c?.id || "");
            const isGroup = !!c?.isGroup || /@g\.us$/.test(jid);
            const isBroadcast = /@broadcast$/.test(jid) || jid === "status@broadcast";
            const isNewsletter = /@newsletter$/.test(jid);
            const isContact = /@c\.us$/.test(jid) && !isGroup && !isBroadcast && !isNewsletter;
            const isSaved = !!(c as any)?.isMyContact;
            return isContact && isSaved;
          });

          // Montar conjunto de JIDs rotulados somando os chats de cada label (mais rápido que consultar contato a contato)
          const labeledJids = new Set<string>();
          for (let i = 0; i < labels.length; i += batchSize) {
            if (this.isCancelled(defaultWhatsapp.id)) {
              this.clearCancel(defaultWhatsapp.id);
              this.setProgress(defaultWhatsapp.id, 0, 'idle');
              return deviceLabels;
            }
            const batch = labels.slice(i, i + batchSize);
            await Promise.all(batch.map(async (lbl: any) => {
              try {
                const chats = await lbl.getChats();
                for (const chat of chats) {
                  const jid = String(chat?.id?._serialized || chat?.id || "");
                  if (/@c\.us$/.test(jid)) labeledJids.add(jid);
                }
              } catch (_) { /* ignore */ }
            }));
            const progress = 60 + Math.min(10, Math.floor(((i + batch.length) / (labels.length || 1)) * 10));
            this.setProgress(defaultWhatsapp.id, progress, 'mapeando_rotulados');
          }
          this.setProgress(defaultWhatsapp.id, 70, 'mapeando_rotulados');

          contactsWithoutLabels = [] as DeviceContact[];
          for (const c of personalContacts) {
            const jid = String(c?.id?._serialized || c?.id || "");
            if (!labeledJids.has(jid)) {
              contactsWithoutLabels.push({
                id: jid,
                name: c.name || c.pushname || c.number || 'Sem nome',
                number: c.number || jid.replace(/@.*/, ''),
                tags: []
              });
            }
          }

          this.unlabeledCache.set(defaultWhatsapp.id, { ts: now, contacts: contactsWithoutLabels });
        }

        if (contactsWithoutLabels.length > 0) {
          deviceLabels.unshift({
            id: "__unlabeled__",
            name: "Sem etiqueta",
            color: "#8D99AE",
            count: contactsWithoutLabels.length
          });
        }
      } catch (err: any) {
        logger.warn(`[WhatsAppWebLabels] ❌ Erro ao buscar contatos sem etiqueta: ${err?.message}`);
      }

      // Adicionar "Listas de transmissão" como informação (best-effort) e "Contatos salvos" + "Contatos de grupos"
      try {
        const allContacts = await client.getContacts();
        const savedPersonal = allContacts.filter((c: any) => {
          const jid = String(c?.id?._serialized || c?.id || "");
          const isGroup = !!c?.isGroup || /@g\.us$/.test(jid);
          const isBroadcast = /@broadcast$/.test(jid) || jid === "status@broadcast";
          const isNewsletter = /@newsletter$/.test(jid);
          const isContact = /@c\.us$/.test(jid) && !isGroup && !isBroadcast && !isNewsletter;
          const isSaved = !!(c as any)?.isMyContact;
          return isContact && isSaved;
        });
        if (savedPersonal.length > 0) {
          deviceLabels.unshift({ id: "__all__", name: "Todos os contatos", color: "#5E97D1", count: savedPersonal.length });
        }

        // Broadcasts / Grupos (pelo conjunto de chats)
        const allChats = await client.getChats();
        const broadcasts = allChats.filter((c: any) => {
          const jid = String(c?.id?._serialized || c?.id || "");
          const isBroadcast = /@broadcast$/.test(jid) || c?.isBroadcast;
          return isBroadcast;
        });
        if (broadcasts.length > 0) {
          deviceLabels.push({
            id: "__broadcast__",
            name: "Listas de transmissão",
            color: "#F4B400",
            count: broadcasts.length
          });
        }

        // Contatos de grupos (participantes únicos em todos os grupos)
        try {
          const groupChats = allChats.filter((c: any) => !!c?.isGroup);
          const participantIds = new Set<string>();
          for (const gc of groupChats) {
            try {
              const participants = (gc as any)?.participants || [];
              for (const p of participants) {
                const pid = String(p?.id?._serialized || p?.id || "");
                if (/@c\.us$/.test(pid)) participantIds.add(pid);
              }
            } catch (_) { /* ignore */ }
          }
          if (participantIds.size > 0) {
            deviceLabels.push({ id: "__group_participants__", name: "Contatos de grupos", color: "#7E57C2", count: participantIds.size });
          }
        } catch (e: any) {
          logger.warn(`[WhatsAppWebLabels] Falha ao computar participantes de grupos: ${e?.message}`);
        }
      } catch (e: any) {
        logger.warn(`[WhatsAppWebLabels] Falha ao computar listas de transmissão: ${e?.message}`);
      }

      this.setProgress(defaultWhatsapp.id, 100, 'concluido');
      return deviceLabels;

    } catch (error: any) {
      logger.error(`[WhatsAppWebLabels] 💥 Erro geral ao buscar labels: ${error?.message}`);
      throw error;
    }
  }

  async getContactsByLabel(companyId: number, labelId: string, whatsappId?: number): Promise<DeviceContact[]> {
    try {
      const defaultWhatsapp = await GetDefaultWhatsApp(whatsappId, companyId);
      const client = await this.getOrCreateClient(defaultWhatsapp.id);
      
      if (!client) {
        throw new Error("Cliente WhatsApp Web não disponível");
      }

      logger.info(`[WhatsAppWebLabels] Buscando contatos da label ${labelId} para whatsappId=${defaultWhatsapp.id}`);

      const contacts: DeviceContact[] = [];

      if (labelId === "__all__") {
        const allContacts = await client.getContacts();
        for (const c of allContacts) {
          const jid = String(c?.id?._serialized || c?.id || "");
          const isGroup = !!c?.isGroup || /@g\.us$/.test(jid);
          const isBroadcast = /@broadcast$/.test(jid) || jid === "status@broadcast";
          const isNewsletter = /@newsletter$/.test(jid);
          const isContact = /@c\.us$/.test(jid) && !isGroup && !isBroadcast && !isNewsletter;
          const isSaved = !!(c as any)?.isMyContact;
          if (!isContact || !isSaved) continue;
          contacts.push({ id: jid, name: c.name || c.pushname || c.number || 'Sem nome', number: c.number || jid.replace(/@.*/, ''), tags: [] });
        }
        return contacts;
      }

      if (labelId === "__unlabeled__") {
        // Contatos sem etiqueta
        const cache = this.unlabeledCache.get(defaultWhatsapp.id);
        if (cache && Date.now() - cache.ts < 5 * 60 * 1000) {
          return cache.contacts;
        }
        // Caso não exista em cache, force recálculo (reutiliza a lógica do método de labels)
        await this.getDeviceLabels(companyId, defaultWhatsapp.id);
        const refreshed = this.unlabeledCache.get(defaultWhatsapp.id);
        return refreshed?.contacts || [];
      } else if (labelId === "__broadcast__") {
        // Best-effort: não há API oficial para membros da lista; retornamos vazio e informamos no log
        logger.warn('[WhatsAppWebLabels] Listas de transmissão: API não fornece membros; retornando lista vazia (best-effort)');
      } else if (labelId === "__group_participants__") {
        // Participantes únicos de todos os grupos
        const chats = await client.getChats();
        const groupChats = chats.filter((c: any) => !!c?.isGroup);
        const participantIds = new Set<string>();
        for (const gc of groupChats) {
          try {
            const participants = (gc as any)?.participants || [];
            for (const p of participants) {
              const pid = String(p?.id?._serialized || p?.id || "");
              if (/@c\.us$/.test(pid)) participantIds.add(pid);
            }
          } catch (_) {}
        }
        for (const pid of participantIds) {
          try {
            const ct = await client.getContactById(pid);
            contacts.push({ id: pid, name: ct?.name || ct?.pushname || ct?.number || 'Sem nome', number: ct?.number || pid.replace(/@.*/, ''), tags: [] });
          } catch (_) {
            contacts.push({ id: pid, name: pid.replace(/@.*/, ''), number: pid.replace(/@.*/, ''), tags: [] });
          }
        }
        return contacts;
      } else {
        // Contatos de uma label específica
        const label = await client.getLabelById(labelId);
        if (!label) {
          throw new Error(`Label ${labelId} não encontrada`);
        }

        const chats = await label.getChats();
        
        for (const chat of chats) {
          if (!chat.isGroup) {
            const contact = await chat.getContact();
            const chatLabels = await chat.getLabels();
            
            const tags = chatLabels.map(l => ({
              id: l.id,
              name: l.name,
              color: l.hexColor
            }));

            contacts.push({
              id: contact.id._serialized,
              name: contact.name || contact.pushname || contact.number || 'Sem nome',
              number: contact.number,
              tags
            });
          }
        }
      }

      logger.info(`[WhatsAppWebLabels] Encontrados ${contacts.length} contatos para label ${labelId}`);
      return contacts;

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
