import fs from "fs";
import path from "path";
import Ticket from "../../models/Ticket";
import Queue from "../../models/Queue";
import ResolveAIIntegrationService from "../IA/ResolveAIIntegrationService";
import IAClientFactory from "../IA/IAClientFactory";

interface Response {
  transcribedText: string;
}

class TranscribeAudioMessageService {
  public async execute(fileName: string, companyId: number, ticketId?: number): Promise<Response | { error: string }> {
    // Validação dos parâmetros de entrada
    if (!fileName || typeof fileName !== 'string') {
      return { error: 'fileName é obrigatório e deve ser uma string.' };
    }
    if (!companyId || typeof companyId !== 'number') {
      return { error: 'companyId é obrigatório e deve ser um número.' };
    }

    const decoded = (() => {
      try {
        return decodeURIComponent(fileName);
      } catch {
        return fileName;
      }
    })();

    // Construção e verificação do caminho do arquivo (suporta formatos novos e antigos)
    const publicFolder = path.resolve(__dirname, "..", "..", "..", "public");
    const companyFolder = path.resolve(publicFolder, `company${companyId}`);
    const safeRel = decoded
      .split("?")[0]
      .split("#")[0]
      .replace(/\\/g, "/")
      .replace(/^\/+/, "");

    const candidates: string[] = [];
    let ticket: Ticket | null = null;

    if (ticketId) {
      ticket = await Ticket.findByPk(ticketId, { attributes: ["id", "queueId", "whatsappId", "contactId"] });
      // Toggle por fila: se desabilitado, não transcreve
      if (ticket?.queueId) {
        const q = await Queue.findByPk(ticket.queueId, { attributes: ["id", "sttEnabled"] });
        if (q && (q as any).sttEnabled === false) {
          return { error: "Transcrição de áudio desabilitada para esta fila" };
        }
      }
      if (ticket?.contactId) {
        candidates.push(path.resolve(companyFolder, `contact${ticket.contactId}`, path.basename(safeRel)));
      }
    }

    // Se vier com subpasta (ex: contact1676/arquivo.ogg), respeita
    if (safeRel.includes("/")) {
      candidates.push(path.resolve(companyFolder, safeRel));
    }

    // Fallback legado: companyX/arquivo
    candidates.push(path.resolve(companyFolder, path.basename(safeRel)));

    const filePath = candidates.find(p => fs.existsSync(p));
    if (!filePath) {
      try {
        console.error(`[STT] Arquivo não encontrado (companyId=${companyId}, ticketId=${ticketId})`, {
          fileName: decoded,
          candidates
        });
      } catch {}
      return { error: "Arquivo não encontrado" };
    }

    // Resolver provedor/chave no mesmo lugar do orquestrador (1 chave em 1 lugar)
    const integration = await ResolveAIIntegrationService({
      companyId,
      queueId: ticket?.queueId || null,
      whatsappId: (ticket as any)?.whatsappId || null,
      preferProvider: "openai"
    });

    if (!integration?.config?.apiKey) {
      return { error: "Chave da IA não configurada (OpenAI). Configure a integração de IA da empresa/fila." };
    }

    try {
      const client = IAClientFactory(integration.provider, integration.config.apiKey);

      if (!client.transcribe) {
        return { error: `Provedor de IA não suporta transcrição: ${String(integration.provider)}` };
      }

      const model = integration.provider === "openai"
        ? (integration.config.sttModel || "whisper-1")
        : (integration.config.sttModel || integration.config.model || "gemini-2.0-pro");

      const transcribed = await client.transcribe({ filePath, model });
      return { transcribedText: transcribed };
    } catch (error: any) {
      console.error(`[STT] Erro ao transcrever áudio (companyId=${companyId}, ticketId=${ticketId})`, error?.message);
      return { error: `Conversão para texto falhou: ${error?.message || String(error)}` };
    }
  }
}

export default TranscribeAudioMessageService;