import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import Contact from "../../models/Contact";
import fs from "fs";
import path from "path";
import { parse, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import logger from "../../utils/logger";

interface ExportChatParams {
  ticketId: string | number;
  companyId: number;
  format: "json" | "csv" | "txt";
  includeMedia?: boolean;
}

interface ExportResult {
  url?: string;
  filename: string;
  success: boolean;
  error?: string;
}

const ExportChatService = async ({
  ticketId,
  companyId,
  format,
  includeMedia = false
}: ExportChatParams): Promise<ExportResult> => {
  try {
    // Buscar ticket com informações
    const ticket = await Ticket.findByPk(ticketId, {
      include: [
        { model: Contact, as: "contact" }
      ]
    });

    if (!ticket) {
      return { success: false, filename: "", error: "Ticket não encontrado" };
    }

    if (ticket.companyId !== companyId) {
      return { success: false, filename: "", error: "Acesso negado" };
    }

    // Buscar mensagens
    const messages = await Message.findAll({
      where: { ticketId: ticket.id },
      order: [["createdAt", "ASC"]],
      include: [
        {
          model: Contact,
          as: "contact",
          attributes: ["name", "number"]
        },
        {
          model: Ticket,
          as: "ticket",
          attributes: ["id"]
        }
      ]
    });

    if (!messages || messages.length === 0) {
      return { success: false, filename: "", error: "Nenhuma mensagem encontrada" };
    }

    // Preparar dados para exportação
    const exportData = messages.map(msg => ({
      id: msg.id,
      body: msg.body,
      fromMe: msg.fromMe,
      mediaType: msg.mediaType,
      mediaUrl: msg.mediaUrl,
      createdAt: msg.createdAt,
      contactName: msg.fromMe ? "Eu" : ticket.contact?.name || "Contato",
      timestamp: format(msg.createdAt, "dd/MM/yyyy HH:mm:ss", { locale: ptBR })
    }));

    // Gerar nome do arquivo
    const contactName = ticket.contact?.name?.replace(/[^a-zA-Z0-9]/g, "_") || "contato";
    const timestamp = format(new Date(), "yyyyMMdd_HHmmss");
    const filename = `chat_${contactName}_${ticket.id}_${timestamp}`;

    // Criar diretório se não existir
    const exportDir = path.resolve(__dirname, "..", "..", "..", "public", "exports");
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
      fs.chmodSync(exportDir, 0o777);
    }

    let filePath: string;
    let fileUrl: string;

    switch (format) {
      case "json":
        filePath = path.join(exportDir, `${filename}.json`);
        fileUrl = `/exports/${filename}.json`;
        
        const jsonData = {
          exportInfo: {
            ticketId: ticket.id,
            contact: ticket.contact,
            exportedAt: new Date(),
            totalMessages: messages.length,
            includeMedia
          },
          messages: exportData
        };
        
        fs.writeFileSync(filePath, JSON.stringify(jsonData, null, 2), "utf8");
        break;

      case "csv":
        filePath = path.join(exportDir, `${filename}.csv`);
        fileUrl = `/exports/${filename}.csv`;
        
        // Cabeçalho CSV
        let csvContent = "Data,Hora,Contato,Mensagem,Tipo,Mídia\n";
        
        exportData.forEach(msg => {
          const [date, time] = msg.timestamp.split(" ");
          const body = msg.body.replace(/"/g, '""'); // Escapar aspas
          csvContent += `"${date}","${time}","${msg.contactName}","${body}","${msg.mediaType}","${msg.mediaUrl || ""}"\n`;
        });
        
        fs.writeFileSync(filePath, "\uFEFF" + csvContent, "utf8"); // BOM para Excel
        break;

      case "txt":
        filePath = path.join(exportDir, `${filename}.txt`);
        fileUrl = `/exports/${filename}.txt`;
        
        let txtContent = `=====================================\n`;
        txtContent += `CONVERSA EXPORTADA\n`;
        txtContent += `=====================================\n`;
        txtContent += `Contato: ${ticket.contact?.name || "Desconhecido"} (${ticket.contact?.number})\n`;
        txtContent += `Ticket ID: ${ticket.id}\n`;
        txtContent += `Data da Exportação: ${format(new Date(), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}\n`;
        txtContent += `Total de Mensagens: ${messages.length}\n`;
        txtContent += `=====================================\n\n`;
        
        exportData.forEach(msg => {
          txtContent += `[${msg.timestamp}] ${msg.contactName}\n`;
          if (msg.mediaType !== "text" && msg.mediaType !== "chat") {
            txtContent += `[${msg.mediaType.toUpperCase()}] ${msg.mediaUrl || ""}\n`;
          }
          txtContent += `${msg.body}\n`;
          txtContent += `-------------------------------------\n\n`;
        });
        
        fs.writeFileSync(filePath, txtContent, "utf8");
        break;

      default:
        return { success: false, filename: "", error: "Formato não suportado" };
    }

    // Ajustar permissões
    fs.chmodSync(filePath, 0o644);

    logger.info(`[ExportChat] Conversa exportada: ${filename}.${format}`);

    return {
      success: true,
      filename: `${filename}.${format}`,
      url: fileUrl
    };

  } catch (error: any) {
    logger.error(`[ExportChat] Erro ao exportar conversa: ${error.message}`);
    return {
      success: false,
      filename: "",
      error: error.message
    };
  }
};

export default ExportChatService;
