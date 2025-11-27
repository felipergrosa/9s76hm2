import { Op } from "sequelize";
import Queue from "../../models/Queue";
import Files from "../../models/Files";
import FilesOptions from "../../models/FilesOptions";
import Ticket from "../../models/Ticket";
import Contact from "../../models/Contact";
import CreateLogTicketService from "../TicketServices/CreateLogTicketService";
import formatBody from "../../helpers/Mustache";
import SendWhatsAppMedia from "../WbotServices/SendWhatsAppMedia";
import SendWhatsAppMessage from "../WbotServices/SendWhatsAppMessage";
import logger from "../../utils/logger";
import path from "path";

interface AutoFileRequest {
  ticket: Ticket;
  contact: Contact;
  queue: Queue;
  messageBody?: string;
  trigger: "on_enter" | "on_request" | "manual";
}

interface FileDecision {
  shouldSend: boolean;
  files: FilesOptions[];
  confirmationNeeded: boolean;
  reason: string;
}

class QueueAutoFileService {

  /**
   * Avalia se deve enviar arquivos automaticamente
   */
  static async evaluateAutoSend({
    ticket,
    contact,
    queue,
    messageBody = "",
    trigger
  }: AutoFileRequest): Promise<FileDecision> {

    const decision: FileDecision = {
      shouldSend: false,
      files: [],
      confirmationNeeded: false,
      reason: "No action needed"
    };

    // Verificar se a fila tem fileListId OU folderId e estratégia configurada
    if ((!queue.fileListId && !queue.folderId) || queue.autoSendStrategy === "none") {
      decision.reason = "Queue has no file list/folder or strategy is 'none'";
      return decision;
    }

    // Verificar se a estratégia corresponde ao trigger
    if (queue.autoSendStrategy !== trigger) {
      decision.reason = `Strategy '${queue.autoSendStrategy}' doesn't match trigger '${trigger}'`;
      return decision;
    }

    // Buscar arquivos ativos da lista ou pasta
    const files = await this.getActiveFiles(queue.fileListId, queue.folderId, ticket.companyId);
    if (!files.length) {
      decision.reason = "No active files found in the list";
      return decision;
    }

    // Verificar limite de sessão
    const sessionLimit = await this.checkSessionLimit(ticket, queue.maxFilesPerSession);
    if (!sessionLimit.allowed) {
      decision.reason = `Session limit exceeded: ${sessionLimit.count}/${queue.maxFilesPerSession}`;
      return decision;
    }

    // Para trigger 'on_request', verificar se a mensagem contém palavras-chave
    if (trigger === "on_request") {
      const matchedFiles = this.matchFilesByKeywords(files, messageBody);
      if (!matchedFiles.length) {
        decision.reason = "No files matched the request keywords";
        return decision;
      }
      decision.files = matchedFiles;
    } else {
      decision.files = files;
    }

    // Determinar se precisa de confirmação
    decision.confirmationNeeded = !!queue.confirmationTemplate && trigger !== "manual";
    decision.shouldSend = !decision.confirmationNeeded;
    decision.reason = decision.confirmationNeeded
      ? "Confirmation required before sending"
      : "Ready to send files";

    return decision;
  }

  /**
   * Envia arquivos para o cliente
   */
  static async sendFiles({
    ticket,
    contact,
    queue,
    files,
    skipConfirmation = false
  }: {
    ticket: Ticket;
    contact: Contact;
    queue: Queue;
    files: FilesOptions[];
    skipConfirmation?: boolean;
  }): Promise<void> {

    try {
      // Enviar mensagem de confirmação se necessário
      if (queue.confirmationTemplate && !skipConfirmation) {
        const confirmationMessage = formatBody(queue.confirmationTemplate, ticket);
        await SendWhatsAppMessage({
          body: confirmationMessage,
          ticket,
          quotedMsg: undefined
        });

        // Log da solicitação de confirmação
        await CreateLogTicketService({
          ticketId: ticket.id,
          type: "create",
          userId: ticket.userId,
          queueId: queue.id
        });

        return; // Aguardar resposta do cliente
      }

      // Enviar arquivos
      const publicFolder = path.resolve(__dirname, "..", "..", "..", "public");

      for (const file of files) {
        const mediaSrc = {
          path: path.resolve(publicFolder, file.path)
        } as Express.Multer.File;

        await SendWhatsAppMedia({
          media: mediaSrc,
          ticket,
          body: file.description || file.name
        });

        logger.info({
          ticketId: ticket.id,
          fileId: file.id,
          fileName: file.name,
          queueId: queue.id
        }, "Auto file sent successfully");
      }

      // Log do envio
      await CreateLogTicketService({
        ticketId: ticket.id,
        type: "create",
        userId: ticket.userId,
        queueId: queue.id
      });

    } catch (error) {
      logger.error({
        error,
        ticketId: ticket.id,
        queueId: queue.id
      }, "Error sending auto files");
      throw error;
    }
  }

  /**
   * Busca arquivos ativos de uma lista ou pasta
   * Prioridade: folderId > fileListId
   * folderId === -1 busca em TODAS as pastas
   */
  private static async getActiveFiles(
    fileListId: number,
    folderId: number,
    companyId: number
  ): Promise<FilesOptions[]> {

    // PRIORIDADE 1: Se tem folderId, buscar de pastas
    if (folderId) {
      return this.getFilesFromFolder(folderId, companyId);
    }

    // PRIORIDADE 2: Se tem fileListId, buscar de file lists
    if (fileListId) {
      return this.getFilesFromFileList(fileListId, companyId);
    }

    return [];
  }

  /**
   * Busca arquivos de pastas (LibraryFolders)
   */
  private static async getFilesFromFolder(
    folderId: number,
    companyId: number
  ): Promise<any[]> {

    const LibraryFolder = require("../../models/LibraryFolder").default;
    const LibraryFile = require("../../models/LibraryFile").default;

    // Se folderId === -1, buscar em TODAS as pastas
    if (folderId === -1) {
      const allFolders = await LibraryFolder.findAll({
        where: { companyId },
        include: [{
          model: LibraryFile,
          as: "files",
          required: false
        }]
      });

      const allFiles: any[] = [];
      allFolders.forEach((folder: any) => {
        if (folder.files) {
          allFiles.push(...folder.files);
        }
      });

      return allFiles;
    }

    // Buscar arquivos de uma pasta específica
    const folder = await LibraryFolder.findOne({
      where: { id: folderId, companyId },
      include: [{
        model: LibraryFile,
        as: "files",
        required: false
      }]
    });

    return folder?.files || [];
  }

  /**
   * Busca arquivos de file lists (Files)
   */
  private static async getFilesFromFileList(
    fileListId: number,
    companyId: number
  ): Promise<FilesOptions[]> {

    // Se fileListId === -1, buscar em TODAS as file lists
    if (fileListId === -1) {
      const allFileLists = await Files.findAll({
        where: {
          companyId,
          isActive: true,
          [Op.or]: [
            { validFrom: null },
            { validFrom: { [Op.lte]: new Date() } }
          ],
          [Op.and]: [
            {
              [Op.or]: [
                { validUntil: null },
                { validUntil: { [Op.gte]: new Date() } }
              ]
            }
          ]
        },
        include: [
          {
            model: FilesOptions,
            as: "options",
            where: {
              isActive: true
            },
            required: false
          }
        ]
      });

      // Combinar todas as options de todas as listas
      const allOptions: FilesOptions[] = [];
      allFileLists.forEach(fileList => {
        if (fileList.options) {
          allOptions.push(...fileList.options);
        }
      });

      return allOptions;
    }

    // Busca normal para uma file list específica
    const fileList = await Files.findOne({
      where: {
        id: fileListId,
        companyId,
        isActive: true,
        [Op.or]: [
          { validFrom: null },
          { validFrom: { [Op.lte]: new Date() } }
        ],
        [Op.and]: [
          {
            [Op.or]: [
              { validUntil: null },
              { validUntil: { [Op.gte]: new Date() } }
            ]
          }
        ]
      },
      include: [
        {
          model: FilesOptions,
          as: "options",
          where: {
            isActive: true
          },
          required: false
        }
      ]
    });

    return fileList?.options || [];
  }

  /**
   * Verifica limite de arquivos por sessão
   */
  private static async checkSessionLimit(ticket: Ticket, maxFiles: number): Promise<{ allowed: boolean, count: number }> {
    // Aqui você pode implementar lógica para contar arquivos enviados nas últimas 24h
    // Por simplicidade, vamos assumir que está permitido
    return { allowed: true, count: 0 };
  }

  /**
   * Filtra arquivos por palavras-chave na mensagem
   */
  private static matchFilesByKeywords(files: FilesOptions[], messageBody: string): FilesOptions[] {
    const normalizedMessage = messageBody.toLowerCase();

    return files.filter(file => {
      if (!file.keywords) return false;

      const keywords = file.keywords.toLowerCase().split(',').map(k => k.trim());
      return keywords.some(keyword => normalizedMessage.includes(keyword));
    });
  }

  /**
   * Processa resposta de confirmação do cliente
   */
  static async processConfirmationResponse(
    ticket: Ticket,
    messageBody: string,
    pendingFiles: FilesOptions[]
  ): Promise<boolean> {
    const normalizedResponse = messageBody.toLowerCase().trim();

    // Respostas positivas
    const positiveResponses = ['sim', 'yes', '1', 'ok', 'enviar', 'quero', 'aceito'];
    const isPositive = positiveResponses.some(response =>
      normalizedResponse.includes(response)
    );

    if (isPositive && pendingFiles.length > 0) {
      const queue = await Queue.findByPk(ticket.queueId);
      const contact = await Contact.findByPk(ticket.contactId);

      if (queue && contact) {
        await this.sendFiles({
          ticket,
          contact,
          queue,
          files: pendingFiles,
          skipConfirmation: true
        });
        return true;
      }
    }

    return false;
  }
}

export default QueueAutoFileService;
