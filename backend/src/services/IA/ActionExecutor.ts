/**
 * ActionExecutor.ts
 * 
 * Executa as ações solicitadas pela IA via Function Calling
 * Recebe contexto do ticket/contato e executa funções reais (enviar arquivo, transferir, etc)
 */

import { transferQueue } from "../WbotServices/wbotMessageListener";
import { search as ragSearch } from "../RAG/RAGSearchService";
import UpdateTicketService from "../TicketServices/UpdateTicketService";
import CreateLogTicketService from "../TicketServices/CreateLogTicketService";
import FilesOptions from "../../models/FilesOptions";
import LibraryFile from "../../models/LibraryFile";
import LibraryFolder from "../../models/LibraryFolder";
import Contact from "../../models/Contact";
import Tag from "../../models/Tag";
import User from "../../models/User";
import Ticket from "../../models/Ticket";
import Queue from "../../models/Queue";
import { Op } from "sequelize";
import logger from "../../utils/logger";
import fs from "fs";
import path from "path";

interface ActionContext {
    wbot: any;
    ticket: Ticket;
    contact: Contact;
    functionName: string;
    arguments: Record<string, any>;
}

export class ActionExecutor {

    static async execute(context: ActionContext): Promise<string> {
        const { functionName, arguments: args } = context;

        logger.info(`[ActionExecutor] Executando: ${functionName}`, {
            ticketId: context.ticket.id,
            args
        });

        try {
            switch (functionName) {
                case "enviar_catalogo":
                    return await this.enviarCatalogo(context);
                case "listar_catalogos":
                    return await this.listarCatalogos(context);
                case "enviar_tabela_precos":
                    return await this.enviarTabelaPrecos(context);
                case "buscar_produto_detalhado":
                    return await this.buscarProdutoDetalhado(context);
                case "transferir_para_vendedor_responsavel":
                    return await this.transferirParaVendedor(context);
                case "transferir_para_atendente":
                    return await this.transferirParaAtendente(context);
                default:
                    logger.warn(`[ActionExecutor] Função desconhecida: ${functionName}`);
                    return `❌ Função ${functionName} não implementada`;
            }
        } catch (error: any) {
            logger.error(`[ActionExecutor] Erro ao executar ${functionName}:`, error);
            return `❌ Erro: ${error.message}`;
        }
    }

    private static async listarCatalogos(ctx: ActionContext): Promise<string> {
        let files: any[] = [];

        logger.info(`[ActionExecutor] listarCatalogos iniciado`, {
            ticketId: ctx.ticket.id,
            queueId: ctx.ticket.queueId,
            folderId: ctx.ticket.queue?.folderId,
            fileListId: ctx.ticket.queue?.fileListId
        });

        // 1. LibraryFolder
        if (ctx.ticket.queue?.folderId) {
            const libraryFiles = await LibraryFile.findAll({
                where: {
                    folderId: ctx.ticket.queue.folderId
                }
            });
            logger.info(`[ActionExecutor] LibraryFiles encontrados: ${libraryFiles.length}`);

            // Filtra arquivos que tenham tag 'catalogo'
            files = libraryFiles.filter(f =>
                f.tags && Array.isArray(f.tags) && f.tags.some((t: string) => t.toLowerCase().includes("catalogo"))
            );
            logger.info(`[ActionExecutor] LibraryFiles com tag 'catalogo': ${files.length}`);
        }

        // 2. Fallback FilesOptions
        if (files.length === 0 && ctx.ticket.queue?.fileListId) {
            files = await FilesOptions.findAll({
                where: {
                    fileId: ctx.ticket.queue.fileListId,
                    isActive: true,
                    keywords: { [Op.iLike]: `%catalogo%` }
                }
            });
            logger.info(`[ActionExecutor] FilesOptions encontrados: ${files.length}`);
        }

        if (files.length === 0) {
            logger.warn(`[ActionExecutor] Nenhum catálogo encontrado!`);
            return "Nenhum catálogo encontrado disponível para envio.";
        }

        const lista = files.map(f => `- ${f.title || f.name}`).join("\n");
        logger.info(`[ActionExecutor] Catálogos encontrados e formatados:`, { lista });
        return `Os seguintes catálogos estão disponíveis:\n${lista}\n\nPergunte ao cliente qual ele deseja receber.`;
    }

    private static async enviarCatalogo(ctx: ActionContext): Promise<string> {
        const tipo = ctx.arguments.tipo || "completo";

        try {
            let catalogoFile: FilesOptions | null = null;

            // Tags de busca
            const searchTags = ["catalogo"];
            if (tipo && tipo !== "completo") {
                searchTags.push(tipo.toLowerCase());
            }

            // Tentar buscar primeiro no sistema NOVO (LibraryFolder)
            if (ctx.ticket.queue?.folderId) {
                catalogoFile = await this.findFileInLibraryFolder(
                    ctx.ticket.queue.folderId,
                    searchTags
                );

                if (catalogoFile) {
                    logger.info(`[ActionExecutor] Catálogo encontrado em LibraryFolder`, {
                        folderId: ctx.ticket.queue.folderId,
                        fileId: catalogoFile.id
                    });
                }
            }

            // Fallback para sistema LEGADO (fileListId)
            if (!catalogoFile && ctx.ticket.queue?.fileListId) {
                const keywords = tipo !== "completo" ? `%${tipo}%` : `%catalogo%`;
                const fileOptions = await FilesOptions.findAll({
                    where: {
                        fileId: ctx.ticket.queue.fileListId,
                        isActive: true,
                        keywords: { [Op.iLike]: keywords }
                    },
                    limit: 1
                });
                catalogoFile = fileOptions[0] || null;

                if (catalogoFile) {
                    logger.info(`[ActionExecutor] Catálogo encontrado em Files (legado)`, {
                        fileListId: ctx.ticket.queue.fileListId,
                        fileId: catalogoFile.id
                    });
                }
            }

            if (!catalogoFile) {
                logger.warn(`[ActionExecutor] Catálogo não encontrado em nenhum sistema`, {
                    queueId: ctx.ticket.queueId,
                    hasFolderId: !!ctx.ticket.queue?.folderId,
                    hasFileListId: !!ctx.ticket.queue?.fileListId
                });
                return `❌ Catálogo não configurado nesta fila`;
            }

            // Verificar se arquivo existe
            const publicFolder = path.resolve(__dirname, "..", "..", "..", "public");
            const filePath = path.resolve(publicFolder, catalogoFile.path);

            if (!fs.existsSync(filePath)) {
                logger.error(`[ActionExecutor] Arquivo não existe: ${filePath}`);
                return `❌ Arquivo do catálogo não encontrado no servidor`;
            }

            // Enviar arquivo (suporta Baileys e API Oficial)
            const fileBuffer = fs.readFileSync(filePath);
            const fileName = catalogoFile.name || "Catalogo.pdf";
            const mimeType = "application/pdf";

            // Detectar se é API Oficial
            const isOfficial = (ctx.wbot as any)?.channelType === "official" || (ctx.wbot as any)?.isOfficial;

            if (isOfficial) {
                // API Oficial: usar sendDocumentMessage
                const recipient = `${ctx.contact.number}`;
                await (ctx.wbot as any).sendDocumentMessage(recipient, fileBuffer, fileName, mimeType);
                logger.info(`[ActionExecutor] Catálogo enviado via API Oficial`, { ticketId: ctx.ticket.id });
            } else {
                // Baileys: usar sendMessage
                const number = `${ctx.contact.number}@${ctx.ticket.isGroup ? "g.us" : "s.whatsapp.net"}`;
                await ctx.wbot.sendMessage(number, {
                    document: fileBuffer,
                    fileName,
                    mimetype: mimeType
                });
                logger.info(`[ActionExecutor] Catálogo enviado via Baileys`, { ticketId: ctx.ticket.id });
            }

            return `✅ Catálogo ${tipo} enviado!`;

        } catch (error: any) {
            logger.error("[ActionExecutor] Erro ao enviar catálogo:", error);
            return `❌ Erro ao enviar catálogo: ${error.message}`;
        }
    }

    private static async enviarTabelaPrecos(ctx: ActionContext): Promise<string> {
        try {
            let tabelaFile: FilesOptions | null = null;

            // Tentar buscar primeiro no sistema NOVO (LibraryFolder)
            if (ctx.ticket.queue?.folderId) {
                tabelaFile = await this.findFileInLibraryFolder(
                    ctx.ticket.queue.folderId,
                    ["tabela", "precos", "preco", "preço", "price", "pricing"]
                );

                if (tabelaFile) {
                    logger.info(`[ActionExecutor] Tabela encontrada em LibraryFolder`, {
                        folderId: ctx.ticket.queue.folderId,
                        fileId: tabelaFile.id
                    });
                }
            }

            // Fallback para sistema LEGADO (fileListId)
            if (!tabelaFile && ctx.ticket.queue?.fileListId) {
                const fileOptions = await FilesOptions.findAll({
                    where: {
                        fileId: ctx.ticket.queue.fileListId,
                        isActive: true,
                        [Op.or]: [
                            { keywords: { [Op.iLike]: "%tabela%" } },
                            { keywords: { [Op.iLike]: "%precos%" } },
                            { keywords: { [Op.iLike]: "%preco%" } }
                        ]
                    },
                    limit: 1
                });
                tabelaFile = fileOptions[0] || null;

                if (tabelaFile) {
                    logger.info(`[ActionExecutor] Tabela encontrada em Files (legado)`, {
                        fileListId: ctx.ticket.queue.fileListId,
                        fileId: tabelaFile.id
                    });
                }
            }

            if (!tabelaFile) {
                logger.warn(`[ActionExecutor] Tabela não encontrada em nenhum sistema`, {
                    queueId: ctx.ticket.queueId,
                    hasFolderId: !!ctx.ticket.queue?.folderId,
                    hasFileListId: !!ctx.ticket.queue?.fileListId
                });
                return `❌ Tabela de preços não configurada`;
            }

            // Verificar se arquivo existe
            const publicFolder = path.resolve(__dirname, "..", "..", "..", "public");
            const filePath = path.resolve(publicFolder, tabelaFile.path);

            if (!fs.existsSync(filePath)) {
                logger.error(`[ActionExecutor] Arquivo não existe: ${filePath}`);
                return `❌ Arquivo da tabela não encontrado no servidor`;
            }

            // Enviar arquivo (suporta Baileys e API Oficial)
            const fileBuffer = fs.readFileSync(filePath);
            const fileName = tabelaFile.name || "Tabela_Precos.pdf";
            const mimeType = "application/pdf";

            // Detectar se é API Oficial
            const isOfficial = (ctx.wbot as any)?.channelType === "official" || (ctx.wbot as any)?.isOfficial;

            if (isOfficial) {
                // API Oficial: usar sendDocumentMessage
                const recipient = `${ctx.contact.number}`;
                await (ctx.wbot as any).sendDocumentMessage(recipient, fileBuffer, fileName, mimeType);
                logger.info(`[ActionExecutor] Tabela enviada via API Oficial`, { ticketId: ctx.ticket.id });
            } else {
                // Baileys: usar sendMessage
                const number = `${ctx.contact.number}@${ctx.ticket.isGroup ? "g.us" : "s.whatsapp.net"}`;
                await ctx.wbot.sendMessage(number, {
                    document: fileBuffer,
                    fileName,
                    mimetype: mimeType
                });
                logger.info(`[ActionExecutor] Tabela enviada via Baileys`, { ticketId: ctx.ticket.id });
            }

            logger.info(`[ActionExecutor] Tabela enviada`, { ticketId: ctx.ticket.id });
            return "✅ Tabela de preços enviada!";

        } catch (error: any) {
            logger.error("[ActionExecutor] Erro ao enviar tabela:", error);
            return `❌ Erro: ${error.message}`;
        }
    }

    private static async buscarProdutoDetalhado(ctx: ActionContext): Promise<string> {
        const nomeProduto = ctx.arguments.nome_produto;

        try {
            const hits = await ragSearch({
                companyId: ctx.ticket.companyId,
                query: `detalhes especificações características ${nomeProduto}`,
                k: 3,
                tags: ctx.ticket.queue?.ragCollection
                    ? [`collection:${ctx.ticket.queue.ragCollection}`]
                    : []
            });

            if (hits.length === 0) {
                return `❌ Não encontrei informações sobre "${nomeProduto}" na base de dados`;
            }

            const info = hits.map(h => h.content).join("\n\n");
            return `✅ Informações sobre "${nomeProduto}":\n\n${info}`;

        } catch (error: any) {
            logger.error("[ActionExecutor] Erro ao buscar produto:", error);
            return `❌ Erro: ${error.message}`;
        }
    }

    private static async transferirParaVendedor(ctx: ActionContext): Promise<string> {
        const motivo = ctx.arguments.motivo || "solicitação do cliente";

        try {
            const contact = await Contact.findByPk(ctx.ticket.contactId, {
                include: [{
                    model: Tag,
                    as: "tags",
                    where: {
                        companyId: ctx.ticket.companyId,
                        name: { [Op.like]: "#%" }
                    },
                    attributes: ["id", "name"],
                    required: false
                }]
            });

            if (!contact?.tags || contact.tags.length === 0) {
                logger.info(`[ActionExecutor] Cliente sem tags pessoais`, {
                    ticketId: ctx.ticket.id,
                    contactId: ctx.ticket.contactId
                });
                return `ℹ️ Cliente não possui vendedor específico atribuído`;
            }

            const contactTagIds = contact.tags.map(t => t.id);
            const contactTagNames = contact.tags.map(t => t.name).join(", ");

            logger.info(`[ActionExecutor] Cliente com tags: ${contactTagNames}`, {
                ticketId: ctx.ticket.id,
                tagIds: contactTagIds
            });

            const vendedores = await User.findAll({
                where: {
                    companyId: ctx.ticket.companyId,
                    allowedContactTags: {
                        [Op.overlap]: contactTagIds as any
                    }
                },
                attributes: ["id", "name", "online"],
                include: [{
                    model: Queue,
                    as: "queues",
                    where: { id: ctx.ticket.queueId },
                    required: false
                }]
            });

            if (vendedores.length === 0) {
                logger.warn(`[ActionExecutor] Nenhum vendedor para tags ${contactTagNames}`, {
                    ticketId: ctx.ticket.id
                });
                return `❌ Nenhum vendedor disponível para as tags ${contactTagNames}`;
            }

            const vendedor = vendedores.find(v => v.online) || vendedores[0];

            logger.info(`[ActionExecutor] Transferindo para ${vendedor.name}`, {
                ticketId: ctx.ticket.id,
                userId: vendedor.id,
                online: vendedor.online
            });

            await UpdateTicketService({
                ticketData: {
                    queueId: ctx.ticket.queueId,
                    userId: vendedor.id,
                    status: "open",
                    isBot: false
                },
                ticketId: ctx.ticket.id,
                companyId: ctx.ticket.companyId
            });

            await CreateLogTicketService({
                ticketId: ctx.ticket.id,
                type: "transfered",
                userId: vendedor.id
            });

            return `✅ Transferindo para ${vendedor.name} (responsável: ${contactTagNames})`;

        } catch (error: any) {
            logger.error("[ActionExecutor] Erro ao transferir por tags:", error);
            return `❌ Erro ao transferir: ${error.message}`;
        }
    }

    private static async transferirParaAtendente(ctx: ActionContext): Promise<string> {
        const motivo = ctx.arguments.motivo || "solicitação do cliente";

        try {
            logger.info(`[ActionExecutor] Transferindo para fila (pending)`, {
                ticketId: ctx.ticket.id,
                motivo
            });

            await transferQueue(ctx.ticket.queueId, ctx.ticket, ctx.contact);

            return `✅ Transferindo para atendente humano`;

        } catch (error: any) {
            logger.error("[ActionExecutor] Erro ao transferir:", error);
            return `❌ Erro ao transferir: ${error.message}`;
        }
    }

    /**
     * Busca arquivos no sistema moderno (LibraryFolder)
     * @param folderId ID da pasta ou -1 para buscar em todas
     * @param searchTags Tags para procurar
     * @returns FileOption encontrado ou null
     */
    private static async findFileInLibraryFolder(
        folderId: number,
        searchTags: string[]
    ): Promise<FilesOptions | null> {
        try {
            // Se folderId === -1, buscar em TODAS as pastas
            const whereClause: any = {};

            if (folderId !== -1) {
                whereClause.folderId = folderId;
            }

            // Buscar LibraryFiles
            const libraryFiles = await LibraryFile.findAll({
                where: whereClause,
                include: [
                    {
                        model: FilesOptions,
                        as: "fileOption",
                        where: { isActive: true },
                        required: true
                    }
                ],
                limit: 50 // Limitar para performance
            });

            // Filtrar por tags manualmente
            // Prioriza arquivos que tenham MAIS tags correspondentes
            const matchedFiles = libraryFiles.map(libraryFile => {
                const fileTags = (libraryFile.tags || []) as string[];

                // Conta quantas tags de busca foram encontradas nas tags do arquivo
                const matches = searchTags.filter(searchTag =>
                    fileTags.some(fileTag =>
                        fileTag.toLowerCase().includes(searchTag.toLowerCase())
                    )
                );

                return {
                    libraryFile,
                    matchCount: matches.length,
                    hasAll: matches.length === searchTags.length
                };
            })
                .filter(item => item.matchCount > 0)
                .sort((a, b) => {
                    // Prioridade 1: Tem todas as tags
                    if (a.hasAll && !b.hasAll) return -1;
                    if (!a.hasAll && b.hasAll) return 1;
                    // Prioridade 2: Maior número de matches
                    return b.matchCount - a.matchCount;
                });

            if (matchedFiles.length > 0) {
                const bestMatch = matchedFiles[0];
                logger.info(`[ActionExecutor] Arquivo encontrado via LibraryFolder`, {
                    libraryFileId: bestMatch.libraryFile.id,
                    matchCount: bestMatch.matchCount,
                    hasAll: bestMatch.hasAll
                });
                return bestMatch.libraryFile.fileOption;
            }

            return null;
        } catch (error: any) {
            logger.error(`[ActionExecutor] Erro ao buscar em LibraryFolder:`, error);
            return null;
        }
    }
}

export default ActionExecutor;
