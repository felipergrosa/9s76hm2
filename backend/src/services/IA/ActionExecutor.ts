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
                case "listar_tabelas_precos":
                    return await this.listarTabelasPrecos(context);
                case "listar_informativos":
                    return await this.listarInformativos(context);
                case "enviar_informativo":
                    return await this.enviarInformativo(context);
                case "buscar_produto_detalhado":
                    return await this.buscarProdutoDetalhado(context);
                case "buscar_e_enviar_arquivo":
                    return await this.buscarEEnviarArquivo(context);
                case "listar_arquivos_disponiveis":
                    return await this.listarArquivosDisponiveis(context);
                case "transferir_para_vendedor_responsavel":
                    return await this.transferirParaVendedor(context);
                case "transferir_para_atendente":
                    return await this.transferirParaAtendente(context);
                case "atualizar_contato":
                    return await this.atualizarContato(context);
                case "verificar_cadastro_completo":
                    return await this.verificarCadastroCompleto(context);
                // Funções SDR
                case "calcular_score_lead":
                    return await this.calcularScoreLead(context);
                case "registrar_resposta_qualificacao":
                    return await this.registrarRespostaQualificacao(context);
                case "enviar_link_agendamento":
                    return await this.enviarLinkAgendamento(context);
                case "transferir_para_closer":
                    return await this.transferirParaCloser(context);
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
            let libraryFiles: any[] = [];

            if (ctx.ticket.queue.folderId === -1) {
                // folderId = -1 significa "todas as pastas da empresa"
                logger.info(`[ActionExecutor] Buscando em TODAS as pastas da empresa ${ctx.ticket.companyId}`);
                
                const allFolders = await LibraryFolder.findAll({
                    where: { companyId: ctx.ticket.companyId }
                });
                
                const folderIds = allFolders.map(f => f.id);
                logger.info(`[ActionExecutor] Pastas encontradas: ${folderIds.join(", ")}`);  
                
                libraryFiles = await LibraryFile.findAll({
                    where: {
                        folderId: { [Op.in]: folderIds }
                    }
                });
            } else {
                // Busca em pasta específica
                logger.info(`[ActionExecutor] Buscando na pasta ${ctx.ticket.queue.folderId}`);
                libraryFiles = await LibraryFile.findAll({
                    where: {
                        folderId: ctx.ticket.queue.folderId
                    }
                });
            }
            
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
            return "Não encontrei catálogos disponíveis no momento. Posso te ajudar de outra forma?";
        }

        // Formatar lista de catálogos
        const lista = files.map(f => `• ${f.title || f.name}`).join("\n");
        logger.info(`[ActionExecutor] Catálogos encontrados:`, { count: files.length, lista });
        
        return `Temos os seguintes catálogos disponíveis:\n\n${lista}\n\nQual deles você gostaria de receber?`;
    }

    /**
     * Lista as tabelas de preços disponíveis para o cliente escolher
     */
    private static async listarTabelasPrecos(ctx: ActionContext): Promise<string> {
        let files: any[] = [];

        logger.info(`[ActionExecutor] listarTabelasPrecos iniciado`, {
            ticketId: ctx.ticket.id,
            queueId: ctx.ticket.queueId,
            folderId: ctx.ticket.queue?.folderId,
            fileListId: ctx.ticket.queue?.fileListId
        });

        // Tags para buscar tabelas de preços
        const tabelaTags = ["tabela", "precos", "preco", "preço", "price", "pricing", "valores"];

        // 1. LibraryFolder
        if (ctx.ticket.queue?.folderId) {
            let libraryFiles: any[] = [];

            if (ctx.ticket.queue.folderId === -1) {
                // folderId = -1 significa "todas as pastas da empresa"
                logger.info(`[ActionExecutor] Buscando tabelas em TODAS as pastas da empresa ${ctx.ticket.companyId}`);
                
                const allFolders = await LibraryFolder.findAll({
                    where: { companyId: ctx.ticket.companyId }
                });
                
                const folderIds = allFolders.map(f => f.id);
                logger.info(`[ActionExecutor] Pastas encontradas: ${folderIds.join(", ")}`);  
                
                libraryFiles = await LibraryFile.findAll({
                    where: {
                        folderId: { [Op.in]: folderIds }
                    }
                });
            } else {
                // Busca em pasta específica
                logger.info(`[ActionExecutor] Buscando tabelas na pasta ${ctx.ticket.queue.folderId}`);
                libraryFiles = await LibraryFile.findAll({
                    where: {
                        folderId: ctx.ticket.queue.folderId
                    }
                });
            }
            
            logger.info(`[ActionExecutor] LibraryFiles encontrados: ${libraryFiles.length}`);

            // Filtra arquivos que tenham tags relacionadas a tabela de preços
            files = libraryFiles.filter(f =>
                f.tags && Array.isArray(f.tags) && f.tags.some((t: string) => 
                    tabelaTags.some(tag => t.toLowerCase().includes(tag))
                )
            );
            logger.info(`[ActionExecutor] LibraryFiles com tags de tabela: ${files.length}`);
        }

        // 2. Fallback FilesOptions
        if (files.length === 0 && ctx.ticket.queue?.fileListId) {
            files = await FilesOptions.findAll({
                where: {
                    fileId: ctx.ticket.queue.fileListId,
                    isActive: true,
                    [Op.or]: tabelaTags.map(tag => ({
                        keywords: { [Op.iLike]: `%${tag}%` }
                    }))
                }
            });
            logger.info(`[ActionExecutor] FilesOptions (tabelas) encontrados: ${files.length}`);
        }

        if (files.length === 0) {
            logger.warn(`[ActionExecutor] Nenhuma tabela de preços encontrada!`);
            return "Não encontrei tabelas de preços disponíveis no momento. Posso te ajudar de outra forma?";
        }

        // Formatar lista de tabelas
        const lista = files.map(f => `• ${f.title || f.name}`).join("\n");
        logger.info(`[ActionExecutor] Tabelas de preços encontradas:`, { count: files.length, lista });
        
        return `Temos as seguintes tabelas de preços disponíveis:\n\n${lista}\n\nQual delas você gostaria de receber?`;
    }

    private static async listarInformativos(ctx: ActionContext): Promise<string> {
        let files: any[] = [];

        logger.info(`[ActionExecutor] listarInformativos iniciado`, {
            ticketId: ctx.ticket.id,
            queueId: ctx.ticket.queueId,
            folderId: ctx.ticket.queue?.folderId,
            fileListId: ctx.ticket.queue?.fileListId
        });

        // Tags para buscar informativos
        const searchTags = ["informativo", "informativos", "negociacao", "politica", "cst", "cif", "fob"];

        // Tentar buscar no sistema NOVO (LibraryFolder)
        if (ctx.ticket.queue?.folderId) {
            files = await this.findAllFilesInLibraryFolder(
                ctx.ticket.queue.folderId,
                searchTags,
                ctx.ticket.companyId
            );

            logger.info(`[ActionExecutor] Informativos em LibraryFolder:`, { count: files.length });
        }

        // Fallback para sistema LEGADO (fileListId)
        if (files.length === 0 && ctx.ticket.queue?.fileListId) {
            const fileOptions = await FilesOptions.findAll({
                where: {
                    fileId: ctx.ticket.queue.fileListId,
                    isActive: true,
                    [Op.or]: [
                        { keywords: { [Op.iLike]: "%informativo%" } },
                        { keywords: { [Op.iLike]: "%negociacao%" } },
                        { keywords: { [Op.iLike]: "%politica%" } },
                        { keywords: { [Op.iLike]: "%cst%" } },
                        { keywords: { [Op.iLike]: "%cif%" } }
                    ]
                }
            });
            files = fileOptions;
            logger.info(`[ActionExecutor] Informativos em Files (legado):`, { count: files.length });
        }

        if (files.length === 0) {
            logger.warn(`[ActionExecutor] Nenhum informativo encontrado!`);
            return "Não encontrei informativos disponíveis no momento. Posso te ajudar de outra forma?";
        }

        // Formatar lista de informativos
        const lista = files.map(f => `• ${f.title || f.name}`).join("\n");
        logger.info(`[ActionExecutor] Informativos encontrados:`, { count: files.length, lista });

        return `Temos os seguintes informativos disponíveis:\n\n${lista}\n\nQual deles você gostaria de receber?`;
    }

    private static async enviarInformativo(ctx: ActionContext): Promise<string> {
        const tipo = ctx.arguments.tipo || "";

        try {
            let informativoFile: FilesOptions | null = null;

            logger.info(`[ActionExecutor] enviarInformativo iniciado`, {
                ticketId: ctx.ticket.id,
                tipo
            });

            // Tags para buscar informativos
            const baseTags = ["informativo", "informativos", "negociacao", "politica", "cst", "cif", "fob"];

            // Tentar buscar no sistema NOVO (LibraryFolder)
            if (ctx.ticket.queue?.folderId) {
                const allInformativos = await this.findAllFilesInLibraryFolder(
                    ctx.ticket.queue.folderId,
                    baseTags,
                    ctx.ticket.companyId
                );

                logger.info(`[ActionExecutor] Informativos encontrados: ${allInformativos.length}`, {
                    informativos: allInformativos.map(f => f.name)
                });

                if (allInformativos.length > 0) {
                    if (tipo) {
                        // Se tipo especificado, buscar pelo nome do arquivo
                        const tipoLower = tipo.toLowerCase();
                        informativoFile = allInformativos.find(f => 
                            f.name?.toLowerCase().includes(tipoLower)
                        ) || null;
                        
                        logger.info(`[ActionExecutor] Busca por tipo "${tipo}": ${informativoFile ? 'encontrado' : 'não encontrado'}`, {
                            fileName: informativoFile?.name
                        });
                    }
                    
                    // Se não encontrou pelo tipo ou tipo não especificado, pegar o primeiro
                    if (!informativoFile) {
                        informativoFile = allInformativos[0];
                    }
                }

                if (informativoFile) {
                    logger.info(`[ActionExecutor] Informativo selecionado em LibraryFolder`, {
                        folderId: ctx.ticket.queue.folderId,
                        fileId: informativoFile.id,
                        fileName: informativoFile.name
                    });
                }
            }

            // Fallback para sistema LEGADO (fileListId)
            if (!informativoFile && ctx.ticket.queue?.fileListId) {
                const whereConditions: any = {
                    fileId: ctx.ticket.queue.fileListId,
                    isActive: true,
                    [Op.or]: [
                        { keywords: { [Op.iLike]: "%informativo%" } },
                        { keywords: { [Op.iLike]: "%negociacao%" } },
                        { keywords: { [Op.iLike]: "%cst%" } }
                    ]
                };
                
                if (tipo) {
                    whereConditions.name = { [Op.iLike]: `%${tipo}%` };
                }
                
                const fileOptions = await FilesOptions.findAll({
                    where: whereConditions,
                    limit: 10
                });
                
                if (tipo && fileOptions.length === 0) {
                    delete whereConditions.name;
                    const allFiles = await FilesOptions.findAll({
                        where: whereConditions,
                        limit: 10
                    });
                    const tipoLower = tipo.toLowerCase();
                    informativoFile = allFiles.find(f => 
                        f.name?.toLowerCase().includes(tipoLower)
                    ) || allFiles[0] || null;
                } else {
                    informativoFile = fileOptions[0] || null;
                }

                if (informativoFile) {
                    logger.info(`[ActionExecutor] Informativo encontrado em Files (legado)`, {
                        fileListId: ctx.ticket.queue.fileListId,
                        fileId: informativoFile.id,
                        fileName: informativoFile.name
                    });
                }
            }

            if (!informativoFile) {
                logger.warn(`[ActionExecutor] Informativo não encontrado`, {
                    queueId: ctx.ticket.queueId,
                    tipo
                });
                return tipo 
                    ? `❌ Informativo "${tipo}" não encontrado. Use listar_informativos para ver as opções disponíveis.`
                    : `❌ Informativo não configurado nesta fila`;
            }

            // Verificar se arquivo existe
            const publicFolder = path.resolve(__dirname, "..", "..", "..", "public");
            const filePath = path.resolve(publicFolder, informativoFile.path);

            if (!fs.existsSync(filePath)) {
                logger.error(`[ActionExecutor] Arquivo não existe: ${filePath}`);
                return `❌ Arquivo do informativo não encontrado no servidor`;
            }

            // Enviar arquivo
            const fileBuffer = fs.readFileSync(filePath);
            const fileName = informativoFile.name || "Informativo.pdf";
            const mimeType = "application/pdf";

            const isOfficial = (ctx.wbot as any)?.channelType === "official" || (ctx.wbot as any)?.isOfficial;

            if (isOfficial) {
                const adapter = ctx.wbot as any;
                await adapter.sendDocumentMessage(
                    ctx.contact.number + "@s.whatsapp.net",
                    fileBuffer,
                    fileName,
                    mimeType,
                    filePath
                );
            } else {
                await ctx.wbot.sendMessage(ctx.contact.number + "@s.whatsapp.net", {
                    document: fileBuffer,
                    mimetype: mimeType,
                    fileName: fileName
                });
            }

            logger.info(`[ActionExecutor] Informativo enviado`, { ticketId: ctx.ticket.id, fileName });
            return `✅ Informativo "${fileName}" enviado com sucesso!`;

        } catch (error: any) {
            logger.error("[ActionExecutor] Erro ao enviar informativo:", error);
            return `❌ Erro ao enviar informativo: ${error.message}`;
        }
    }

    private static async enviarCatalogo(ctx: ActionContext): Promise<string> {
        const tipo = ctx.arguments.tipo || "";

        try {
            let catalogoFile: FilesOptions | null = null;

            logger.info(`[ActionExecutor] enviarCatalogo iniciado`, {
                ticketId: ctx.ticket.id,
                tipo
            });

            // Tentar buscar primeiro no sistema NOVO (LibraryFolder)
            if (ctx.ticket.queue?.folderId) {
                // Buscar TODOS os catálogos primeiro
                const baseTags = ["catalogo", "catalogue", "catalog"];
                const allCatalogs = await this.findAllFilesInLibraryFolder(
                    ctx.ticket.queue.folderId,
                    baseTags,
                    ctx.ticket.companyId
                );

                logger.info(`[ActionExecutor] Catálogos encontrados: ${allCatalogs.length}`, {
                    catalogos: allCatalogs.map(f => f.name)
                });

                if (allCatalogs.length > 0) {
                    if (tipo) {
                        // Se tipo especificado, buscar pelo nome do arquivo
                        const tipoLower = tipo.toLowerCase();
                        catalogoFile = allCatalogs.find(f => 
                            f.name?.toLowerCase().includes(tipoLower)
                        ) || null;
                        
                        logger.info(`[ActionExecutor] Busca por tipo "${tipo}": ${catalogoFile ? 'encontrado' : 'não encontrado'}`, {
                            fileName: catalogoFile?.name
                        });
                    }
                    
                    // Se não encontrou pelo tipo ou tipo não especificado, pegar o primeiro
                    if (!catalogoFile) {
                        catalogoFile = allCatalogs[0];
                    }
                }

                if (catalogoFile) {
                    logger.info(`[ActionExecutor] Catálogo selecionado em LibraryFolder`, {
                        folderId: ctx.ticket.queue.folderId,
                        fileId: catalogoFile.id,
                        fileName: catalogoFile.name
                    });
                }
            }

            // Fallback para sistema LEGADO (fileListId)
            if (!catalogoFile && ctx.ticket.queue?.fileListId) {
                const whereConditions: any = {
                    fileId: ctx.ticket.queue.fileListId,
                    isActive: true,
                    keywords: { [Op.iLike]: "%catalogo%" }
                };
                
                // Se tipo especificado, filtrar pelo nome também
                if (tipo) {
                    whereConditions.name = { [Op.iLike]: `%${tipo}%` };
                }
                
                const fileOptions = await FilesOptions.findAll({
                    where: whereConditions,
                    limit: 10
                });
                
                // Se tipo especificado mas não encontrou com filtro de nome, buscar sem filtro
                if (tipo && fileOptions.length === 0) {
                    delete whereConditions.name;
                    const allFiles = await FilesOptions.findAll({
                        where: whereConditions,
                        limit: 10
                    });
                    // Tentar encontrar pelo nome
                    const tipoLower = tipo.toLowerCase();
                    catalogoFile = allFiles.find(f => 
                        f.name?.toLowerCase().includes(tipoLower)
                    ) || allFiles[0] || null;
                } else {
                    catalogoFile = fileOptions[0] || null;
                }

                if (catalogoFile) {
                    logger.info(`[ActionExecutor] Catálogo encontrado em Files (legado)`, {
                        fileListId: ctx.ticket.queue.fileListId,
                        fileId: catalogoFile.id,
                        fileName: catalogoFile.name
                    });
                }
            }

            if (!catalogoFile) {
                logger.warn(`[ActionExecutor] Catálogo não encontrado em nenhum sistema`, {
                    queueId: ctx.ticket.queueId,
                    tipo,
                    hasFolderId: !!ctx.ticket.queue?.folderId,
                    hasFileListId: !!ctx.ticket.queue?.fileListId
                });
                return tipo 
                    ? `❌ Catálogo "${tipo}" não encontrado. Use listar_catalogos para ver as opções disponíveis.`
                    : `❌ Catálogo não configurado nesta fila`;
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
                // API Oficial: usar sendDocumentMessage (com filePath para mediaUrl)
                const recipient = `${ctx.contact.number}`;
                await (ctx.wbot as any).sendDocumentMessage(recipient, fileBuffer, fileName, mimeType, filePath);
                logger.info(`[ActionExecutor] Catálogo enviado via API Oficial`, { ticketId: ctx.ticket.id, filePath });
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

            logger.info(`[ActionExecutor] Catálogo enviado`, { ticketId: ctx.ticket.id, fileName });
            return `✅ Catálogo "${fileName}" enviado com sucesso!`;

        } catch (error: any) {
            logger.error("[ActionExecutor] Erro ao enviar catálogo:", error);
            return `❌ Erro ao enviar catálogo: ${error.message}`;
        }
    }

    private static async enviarTabelaPrecos(ctx: ActionContext): Promise<string> {
        const tipo = ctx.arguments.tipo || "";
        
        try {
            let tabelaFile: FilesOptions | null = null;

            logger.info(`[ActionExecutor] enviarTabelaPrecos iniciado`, {
                ticketId: ctx.ticket.id,
                tipo
            });

            // Tentar buscar primeiro no sistema NOVO (LibraryFolder)
            if (ctx.ticket.queue?.folderId) {
                // Buscar TODAS as tabelas de preço primeiro
                const baseTags = ["tabela", "precos", "preco", "preço", "price", "pricing"];
                const allTables = await this.findAllFilesInLibraryFolder(
                    ctx.ticket.queue.folderId,
                    baseTags,
                    ctx.ticket.companyId
                );

                logger.info(`[ActionExecutor] Tabelas encontradas: ${allTables.length}`, {
                    tabelas: allTables.map(f => f.name)
                });

                if (allTables.length > 0) {
                    if (tipo) {
                        // Se tipo especificado, buscar pelo nome do arquivo
                        const tipoLower = tipo.toLowerCase();
                        tabelaFile = allTables.find(f => 
                            f.name?.toLowerCase().includes(tipoLower)
                        ) || null;
                        
                        logger.info(`[ActionExecutor] Busca por tipo "${tipo}": ${tabelaFile ? 'encontrado' : 'não encontrado'}`, {
                            fileName: tabelaFile?.name
                        });
                    }
                    
                    // Se não encontrou pelo tipo ou tipo não especificado, pegar a primeira
                    if (!tabelaFile) {
                        tabelaFile = allTables[0];
                    }
                }

                if (tabelaFile) {
                    logger.info(`[ActionExecutor] Tabela selecionada em LibraryFolder`, {
                        folderId: ctx.ticket.queue.folderId,
                        fileId: tabelaFile.id,
                        fileName: tabelaFile.name
                    });
                }
            }

            // Fallback para sistema LEGADO (fileListId)
            if (!tabelaFile && ctx.ticket.queue?.fileListId) {
                const whereConditions: any = {
                    fileId: ctx.ticket.queue.fileListId,
                    isActive: true,
                    [Op.or]: [
                        { keywords: { [Op.iLike]: "%tabela%" } },
                        { keywords: { [Op.iLike]: "%precos%" } },
                        { keywords: { [Op.iLike]: "%preco%" } }
                    ]
                };
                
                // Se tipo especificado, filtrar pelo nome também
                if (tipo) {
                    whereConditions.name = { [Op.iLike]: `%${tipo}%` };
                }
                
                const fileOptions = await FilesOptions.findAll({
                    where: whereConditions,
                    limit: 10
                });
                
                // Se tipo especificado mas não encontrou com filtro de nome, buscar sem filtro
                if (tipo && fileOptions.length === 0) {
                    delete whereConditions.name;
                    const allFiles = await FilesOptions.findAll({
                        where: whereConditions,
                        limit: 10
                    });
                    // Tentar encontrar pelo nome
                    const tipoLower = tipo.toLowerCase();
                    tabelaFile = allFiles.find(f => 
                        f.name?.toLowerCase().includes(tipoLower)
                    ) || allFiles[0] || null;
                } else {
                    tabelaFile = fileOptions[0] || null;
                }

                if (tabelaFile) {
                    logger.info(`[ActionExecutor] Tabela encontrada em Files (legado)`, {
                        fileListId: ctx.ticket.queue.fileListId,
                        fileId: tabelaFile.id,
                        fileName: tabelaFile.name
                    });
                }
            }

            if (!tabelaFile) {
                logger.warn(`[ActionExecutor] Tabela não encontrada em nenhum sistema`, {
                    queueId: ctx.ticket.queueId,
                    tipo,
                    hasFolderId: !!ctx.ticket.queue?.folderId,
                    hasFileListId: !!ctx.ticket.queue?.fileListId
                });
                return tipo 
                    ? `❌ Tabela de preços "${tipo}" não encontrada. Use listar_tabelas_precos para ver as opções disponíveis.`
                    : `❌ Tabela de preços não configurada`;
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
                // API Oficial: usar sendDocumentMessage (com filePath para mediaUrl)
                const recipient = `${ctx.contact.number}`;
                await (ctx.wbot as any).sendDocumentMessage(recipient, fileBuffer, fileName, mimeType, filePath);
                logger.info(`[ActionExecutor] Tabela enviada via API Oficial`, { ticketId: ctx.ticket.id, filePath });
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

            logger.info(`[ActionExecutor] Tabela enviada`, { ticketId: ctx.ticket.id, fileName });
            return `✅ Tabela de preços "${fileName}" enviada com sucesso!`;

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
            // 1. Buscar atendente da carteira do contato
            const ContactWallet = (await import("../../models/ContactWallet")).default;
            const User = (await import("../../models/User")).default;
            
            const wallet = await ContactWallet.findOne({
                where: {
                    contactId: ctx.contact.id,
                    companyId: ctx.ticket.companyId
                },
                include: [{
                    model: User,
                    as: "wallet",
                    attributes: ["id", "name", "email"]
                }]
            });

            if (wallet && wallet.wallet) {
                // Encontrou atendente da carteira - transferir direto para ele
                const atendente = wallet.wallet;
                
                logger.info(`[ActionExecutor] Transferindo para atendente da carteira: ${atendente.name}`, {
                    ticketId: ctx.ticket.id,
                    userId: atendente.id,
                    motivo
                });

                // Atualizar ticket com userId do atendente e status open
                const UpdateTicketService = (await import("../TicketServices/UpdateTicketService")).default;
                await UpdateTicketService({
                    ticketData: {
                        status: "open",
                        userId: atendente.id,
                        isBot: false
                    },
                    ticketId: ctx.ticket.id,
                    companyId: ctx.ticket.companyId
                });

                return `✅ Transferindo para ${atendente.name} (seu atendente)`;
            }

            // 2. Não encontrou carteira - colocar na fila para qualquer atendente
            logger.info(`[ActionExecutor] Sem carteira definida, transferindo para fila (pending)`, {
                ticketId: ctx.ticket.id,
                contactId: ctx.contact.id,
                motivo
            });

            await transferQueue(ctx.ticket.queueId, ctx.ticket, ctx.contact);

            return `✅ Transferindo para atendente humano disponível`;

        } catch (error: any) {
            logger.error("[ActionExecutor] Erro ao transferir:", error);
            return `❌ Erro ao transferir: ${error.message}`;
        }
    }

    /**
     * Atualiza dados cadastrais do contato
     */
    private static async atualizarContato(ctx: ActionContext): Promise<string> {
        const { cnpj, razaoSocial, nomeFantasia, email, cidade, segmento } = ctx.arguments;

        try {
            logger.info(`[ActionExecutor] Atualizando contato ${ctx.contact.id}`, {
                cnpj, razaoSocial, nomeFantasia, email, cidade, segmento
            });

            const Contact = (await import("../../models/Contact")).default;
            const Tag = (await import("../../models/Tag")).default;
            const ContactTag = (await import("../../models/ContactTag")).default;

            // Buscar contato atual
            const contact = await Contact.findByPk(ctx.contact.id);
            if (!contact) {
                return `❌ Contato não encontrado`;
            }

            // Preparar dados para atualização
            const updateData: any = {};
            
            if (cnpj) {
                // Limpar CNPJ (remover pontos, barras, traços)
                updateData.cnpj = cnpj.replace(/[^\d]/g, '');
            }
            if (razaoSocial) {
                updateData.name = razaoSocial;
            }
            if (nomeFantasia) {
                updateData.fantasyName = nomeFantasia;
            }
            if (email) {
                updateData.email = email.toLowerCase().trim();
            }
            if (cidade) {
                updateData.city = cidade;
            }
            if (segmento) {
                updateData.segment = segmento;
            }

            // Atualizar contato
            await contact.update(updateData);

            // Buscar configuração do agente para tag
            const AIAgent = (await import("../../models/AIAgent")).default;
            const agentConfig = await AIAgent.findOne({
                where: {
                    companyId: ctx.ticket.companyId,
                    status: "active"
                }
            });

            // Adicionar tag de lead qualificado se configurado
            if (agentConfig?.qualifiedLeadTag) {
                // Buscar ou criar tag
                let tag = await Tag.findOne({
                    where: {
                        name: agentConfig.qualifiedLeadTag,
                        companyId: ctx.ticket.companyId
                    }
                });

                if (!tag) {
                    tag = await Tag.create({
                        name: agentConfig.qualifiedLeadTag,
                        color: "#4CAF50", // Verde
                        companyId: ctx.ticket.companyId
                    });
                }

                // Verificar se já tem a tag
                const existingTag = await ContactTag.findOne({
                    where: {
                        contactId: ctx.contact.id,
                        tagId: tag.id
                    }
                });

                if (!existingTag) {
                    await ContactTag.create({
                        contactId: ctx.contact.id,
                        tagId: tag.id,
                        companyId: ctx.ticket.companyId
                    });
                    logger.info(`[ActionExecutor] Tag "${agentConfig.qualifiedLeadTag}" adicionada ao contato ${ctx.contact.id}`);
                }
            }

            const camposAtualizados = Object.keys(updateData).join(", ");
            logger.info(`[ActionExecutor] Contato ${ctx.contact.id} atualizado: ${camposAtualizados}`);

            return `✅ Dados atualizados com sucesso: ${camposAtualizados}`;

        } catch (error: any) {
            logger.error("[ActionExecutor] Erro ao atualizar contato:", error);
            return `❌ Erro ao atualizar dados: ${error.message}`;
        }
    }

    /**
     * Verifica se o contato possui cadastro completo para receber materiais
     */
    private static async verificarCadastroCompleto(ctx: ActionContext): Promise<string> {
        try {
            logger.info(`[ActionExecutor] Verificando cadastro do contato ${ctx.contact.id}`);

            const Contact = (await import("../../models/Contact")).default;
            const AIAgent = (await import("../../models/AIAgent")).default;

            // Buscar contato com dados atualizados
            const contact = await Contact.findByPk(ctx.contact.id);
            if (!contact) {
                return `❌ Contato não encontrado`;
            }

            // Buscar configuração do agente
            const agentConfig = await AIAgent.findOne({
                where: {
                    companyId: ctx.ticket.companyId,
                    status: "active"
                }
            });

            // Se não exige qualificação, retornar OK
            if (!agentConfig?.requireLeadQualification) {
                return `✅ CADASTRO_COMPLETO: Qualificação não é obrigatória`;
            }

            // Verificar campos obrigatórios
            const requiredFields = agentConfig.requiredLeadFields || ["cnpj", "email"];
            const fieldMapping: any = agentConfig.leadFieldMapping || {
                "cnpj": "cnpj",
                "razaoSocial": "name",
                "email": "email"
            };

            const missingFields: string[] = [];
            const presentFields: string[] = [];

            for (const field of requiredFields) {
                const contactField = fieldMapping[field] || field;
                const value = (contact as any)[contactField];
                
                if (!value || value.toString().trim() === "") {
                    missingFields.push(field);
                } else {
                    presentFields.push(field);
                }
            }

            if (missingFields.length === 0) {
                logger.info(`[ActionExecutor] Contato ${ctx.contact.id} possui cadastro completo`);
                return `✅ CADASTRO_COMPLETO: Cliente qualificado. Campos preenchidos: ${presentFields.join(", ")}`;
            } else {
                logger.info(`[ActionExecutor] Contato ${ctx.contact.id} faltam campos: ${missingFields.join(", ")}`);
                return `❌ CADASTRO_INCOMPLETO: Faltam os seguintes dados: ${missingFields.join(", ")}. Solicite essas informações ao cliente antes de enviar materiais.`;
            }

        } catch (error: any) {
            logger.error("[ActionExecutor] Erro ao verificar cadastro:", error);
            return `❌ Erro ao verificar cadastro: ${error.message}`;
        }
    }

    // ========== FUNÇÕES SDR ==========

    /**
     * Calcula o score do lead baseado nas regras configuradas
     */
    private static async calcularScoreLead(ctx: ActionContext): Promise<string> {
        try {
            logger.info(`[ActionExecutor] Calculando score do lead ${ctx.contact.id}`);

            const Contact = (await import("../../models/Contact")).default;
            const AIAgent = (await import("../../models/AIAgent")).default;

            const contact = await Contact.findByPk(ctx.contact.id);
            if (!contact) {
                return `❌ Contato não encontrado`;
            }

            // Buscar configuração do agente
            const agentConfig = await AIAgent.findOne({
                where: {
                    companyId: ctx.ticket.companyId,
                    status: "active"
                }
            });

            if (!agentConfig?.sdrEnabled) {
                return `ℹ️ Modo SDR não está habilitado`;
            }

            const scoringRules: any = agentConfig.sdrScoringRules || {};
            const icp: any = agentConfig.sdrICP || {};
            let score = 0;
            const scoreDetails: string[] = [];

            // Verificar CNPJ
            if ((contact as any).cnpj) {
                score += scoringRules.hasCnpj || 15;
                scoreDetails.push(`CNPJ: +${scoringRules.hasCnpj || 15}`);
            }

            // Verificar Email
            if ((contact as any).email) {
                score += scoringRules.hasEmail || 10;
                scoreDetails.push(`Email: +${scoringRules.hasEmail || 10}`);
            }

            // Verificar match com ICP (segmento)
            const contactSegment = ((contact as any).segment || "").toLowerCase();
            const icpSegments = (icp.segments || []).map((s: string) => s.toLowerCase());
            if (contactSegment && icpSegments.some((s: string) => contactSegment.includes(s))) {
                score += scoringRules.icpMatch || 20;
                scoreDetails.push(`Match ICP: +${scoringRules.icpMatch || 20}`);
            }

            // Verificar região
            const contactCity = ((contact as any).city || "").toLowerCase();
            const contactRegion = ((contact as any).region || "").toLowerCase();
            const icpRegions = (icp.regions || []).map((r: string) => r.toLowerCase());
            if (icpRegions.some((r: string) => contactCity.includes(r) || contactRegion.includes(r))) {
                score += 10;
                scoreDetails.push(`Região ICP: +10`);
            }

            // Verificar respostas de qualificação salvas no contato
            const qualificationData = (contact as any).extraInfo?.sdrQualification || {};
            const answeredQuestions = Object.keys(qualificationData).length;
            if (answeredQuestions > 0) {
                const questionPoints = answeredQuestions * (scoringRules.answeredQuestion || 10);
                score += questionPoints;
                scoreDetails.push(`${answeredQuestions} perguntas respondidas: +${questionPoints}`);
            }

            const minScore = agentConfig.sdrMinScoreToTransfer || 70;
            const isQualified = score >= minScore;

            // Adicionar tag de lead quente se qualificado
            if (isQualified && agentConfig.sdrHotLeadTag) {
                const Tag = (await import("../../models/Tag")).default;
                const ContactTag = (await import("../../models/ContactTag")).default;

                let tag = await Tag.findOne({
                    where: {
                        name: agentConfig.sdrHotLeadTag,
                        companyId: ctx.ticket.companyId
                    }
                });

                if (!tag) {
                    tag = await Tag.create({
                        name: agentConfig.sdrHotLeadTag,
                        color: "#FF5722",
                        companyId: ctx.ticket.companyId
                    });
                }

                const existingTag = await ContactTag.findOne({
                    where: { contactId: ctx.contact.id, tagId: tag.id }
                });

                if (!existingTag) {
                    await ContactTag.create({
                        contactId: ctx.contact.id,
                        tagId: tag.id,
                        companyId: ctx.ticket.companyId
                    });
                }
            }

            logger.info(`[ActionExecutor] Score do lead ${ctx.contact.id}: ${score}/${minScore}`);

            return `📊 SCORE DO LEAD: ${score} pontos
${scoreDetails.length > 0 ? `\nDetalhes:\n${scoreDetails.join("\n")}` : ""}
\nScore mínimo para transferência: ${minScore} pontos
\n${isQualified ? "🔥 LEAD QUALIFICADO! Pronto para transferir para closer." : `⏳ Faltam ${minScore - score} pontos para qualificação.`}`;

        } catch (error: any) {
            logger.error("[ActionExecutor] Erro ao calcular score:", error);
            return `❌ Erro ao calcular score: ${error.message}`;
        }
    }

    /**
     * Registra resposta de qualificação do lead
     */
    private static async registrarRespostaQualificacao(ctx: ActionContext): Promise<string> {
        const { tipo_pergunta, resposta, positiva } = ctx.arguments;

        try {
            logger.info(`[ActionExecutor] Registrando resposta de qualificação`, {
                contactId: ctx.contact.id,
                tipo: tipo_pergunta,
                positiva
            });

            const Contact = (await import("../../models/Contact")).default;
            const contact = await Contact.findByPk(ctx.contact.id);
            
            if (!contact) {
                return `❌ Contato não encontrado`;
            }

            // Atualizar extraInfo com dados de qualificação
            const extraInfo = (contact as any).extraInfo || {};
            extraInfo.sdrQualification = extraInfo.sdrQualification || {};
            extraInfo.sdrQualification[tipo_pergunta] = {
                resposta,
                positiva: positiva !== false,
                timestamp: new Date().toISOString()
            };

            await contact.update({ extraInfo });

            logger.info(`[ActionExecutor] Resposta de qualificação registrada para ${ctx.contact.id}`);

            return `✅ Resposta registrada: ${tipo_pergunta} = "${resposta}" (${positiva !== false ? "positiva" : "negativa"})`;

        } catch (error: any) {
            logger.error("[ActionExecutor] Erro ao registrar resposta:", error);
            return `❌ Erro ao registrar resposta: ${error.message}`;
        }
    }

    /**
     * Envia link de agendamento para o cliente
     */
    private static async enviarLinkAgendamento(ctx: ActionContext): Promise<string> {
        const { motivo } = ctx.arguments;

        try {
            logger.info(`[ActionExecutor] Enviando link de agendamento`, {
                contactId: ctx.contact.id,
                motivo
            });

            const AIAgent = (await import("../../models/AIAgent")).default;
            const agentConfig = await AIAgent.findOne({
                where: {
                    companyId: ctx.ticket.companyId,
                    status: "active"
                }
            });

            if (!agentConfig?.sdrSchedulingEnabled || !agentConfig.sdrCalendarLink) {
                return `❌ Agendamento não está configurado. Configure o link do calendário nas configurações do agente.`;
            }

            const schedulingMessage = agentConfig.sdrSchedulingMessage || 
                "Que tal agendarmos uma conversa com nosso especialista?";

            logger.info(`[ActionExecutor] Link de agendamento: ${agentConfig.sdrCalendarLink}`);

            return `📅 ENVIAR_AGENDAMENTO:
${schedulingMessage}

🔗 Link para agendar: ${agentConfig.sdrCalendarLink}`;

        } catch (error: any) {
            logger.error("[ActionExecutor] Erro ao enviar link de agendamento:", error);
            return `❌ Erro ao enviar link: ${error.message}`;
        }
    }

    /**
     * Transfere lead qualificado para closer
     */
    private static async transferirParaCloser(ctx: ActionContext): Promise<string> {
        const { motivo, resumo_qualificacao } = ctx.arguments;

        try {
            logger.info(`[ActionExecutor] Transferindo para closer`, {
                ticketId: ctx.ticket.id,
                contactId: ctx.contact.id,
                motivo
            });

            const AIAgent = (await import("../../models/AIAgent")).default;
            const agentConfig = await AIAgent.findOne({
                where: {
                    companyId: ctx.ticket.companyId,
                    status: "active"
                }
            });

            const handoffMessage = agentConfig?.sdrHandoffMessage || 
                "Vou transferir você para um de nossos especialistas!";

            // Salvar resumo da qualificação no ticket
            if (resumo_qualificacao) {
                const Ticket = (await import("../../models/Ticket")).default;
                const ticket = await Ticket.findByPk(ctx.ticket.id);
                if (ticket) {
                    const currentInfo = (ticket as any).extraInfo || {};
                    currentInfo.sdrQualificationSummary = resumo_qualificacao;
                    currentInfo.sdrTransferReason = motivo;
                    currentInfo.sdrTransferTimestamp = new Date().toISOString();
                    await ticket.update({ extraInfo: currentInfo });
                }
            }

            // Usar a lógica existente de transferência
            const ContactWallet = (await import("../../models/ContactWallet")).default;
            const User = (await import("../../models/User")).default;
            
            const wallet = await ContactWallet.findOne({
                where: {
                    contactId: ctx.contact.id,
                    companyId: ctx.ticket.companyId
                },
                include: [{
                    model: User,
                    as: "wallet",
                    attributes: ["id", "name", "email"]
                }]
            });

            if (wallet && wallet.wallet) {
                const atendente = wallet.wallet;
                
                const UpdateTicketService = (await import("../TicketServices/UpdateTicketService")).default;
                await UpdateTicketService({
                    ticketData: {
                        status: "open",
                        userId: atendente.id,
                        isBot: false
                    },
                    ticketId: ctx.ticket.id,
                    companyId: ctx.ticket.companyId
                });

                return `🔥 LEAD QUALIFICADO TRANSFERIDO!
${handoffMessage}

📋 Resumo: ${resumo_qualificacao || motivo}
👤 Closer: ${atendente.name}`;
            }

            // Fallback: transferir para fila
            await transferQueue(ctx.ticket.queueId, ctx.ticket, ctx.contact);

            return `🔥 LEAD QUALIFICADO TRANSFERIDO!
${handoffMessage}

📋 Resumo: ${resumo_qualificacao || motivo}
👤 Aguardando próximo closer disponível`;

        } catch (error: any) {
            logger.error("[ActionExecutor] Erro ao transferir para closer:", error);
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
        searchTags: string[],
        companyId?: number
    ): Promise<FilesOptions | null> {
        try {
            // Se folderId === -1, buscar em TODAS as pastas da empresa
            let folderIds: number[] = [];

            if (folderId === -1 && companyId) {
                logger.info(`[ActionExecutor] folderId=-1, buscando em todas as pastas da empresa ${companyId}`);
                const allFolders = await LibraryFolder.findAll({
                    where: { companyId }
                });
                folderIds = allFolders.map(f => f.id);
                logger.info(`[ActionExecutor] Pastas da empresa: ${folderIds.join(", ")}`);
            } else if (folderId !== -1) {
                folderIds = [folderId];
            }

            if (folderIds.length === 0) {
                logger.warn(`[ActionExecutor] Nenhuma pasta para buscar`);
                return null;
            }

            // Buscar LibraryFiles
            const libraryFiles = await LibraryFile.findAll({
                where: {
                    folderId: { [Op.in]: folderIds }
                },
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

    /**
     * Busca TODOS os arquivos que correspondem às tags no sistema moderno (LibraryFolder)
     * @param folderId ID da pasta ou -1 para buscar em todas
     * @param searchTags Tags para procurar
     * @returns Array de FileOptions encontrados
     */
    private static async findAllFilesInLibraryFolder(
        folderId: number,
        searchTags: string[],
        companyId?: number
    ): Promise<FilesOptions[]> {
        try {
            // Se folderId === -1, buscar em TODAS as pastas da empresa
            let folderIds: number[] = [];

            if (folderId === -1 && companyId) {
                const allFolders = await LibraryFolder.findAll({
                    where: { companyId }
                });
                folderIds = allFolders.map(f => f.id);
            } else if (folderId !== -1) {
                folderIds = [folderId];
            }

            if (folderIds.length === 0) {
                return [];
            }

            // Buscar LibraryFiles
            const libraryFiles = await LibraryFile.findAll({
                where: {
                    folderId: { [Op.in]: folderIds }
                },
                include: [
                    {
                        model: FilesOptions,
                        as: "fileOption",
                        where: { isActive: true },
                        required: true
                    }
                ],
                limit: 50
            });

            // Filtrar por tags manualmente
            const matchedFiles = libraryFiles
                .filter(libraryFile => {
                    const fileTags = (libraryFile.tags || []) as string[];
                    // Verifica se pelo menos uma tag de busca corresponde
                    return searchTags.some(searchTag =>
                        fileTags.some(fileTag =>
                            fileTag.toLowerCase().includes(searchTag.toLowerCase())
                        )
                    );
                })
                .map(libraryFile => libraryFile.fileOption)
                .filter((f): f is FilesOptions => f !== null && f !== undefined);

            return matchedFiles;
        } catch (error: any) {
            logger.error(`[ActionExecutor] Erro ao buscar todos em LibraryFolder:`, error);
            return [];
        }
    }

    /**
     * Busca arquivo no RAG e envia ao cliente
     * Esta é a função principal para integração RAG + envio de arquivos
     */
    private static async buscarEEnviarArquivo(ctx: ActionContext): Promise<string> {
        const termoBusca = ctx.arguments.termo_busca;
        const tipoArquivo = ctx.arguments.tipo_arquivo || "qualquer";

        logger.info(`[ActionExecutor] buscarEEnviarArquivo iniciado`, {
            ticketId: ctx.ticket.id,
            termoBusca,
            tipoArquivo
        });

        try {
            // 1. Buscar no RAG com informações do arquivo
            const hits = await ragSearch({
                companyId: ctx.ticket.companyId,
                query: termoBusca,
                k: 5,
                tags: ctx.ticket.queue?.ragCollection
                    ? [`collection:${ctx.ticket.queue.ragCollection}`]
                    : []
            });

            logger.info(`[ActionExecutor] RAG retornou ${hits.length} resultados`, {
                ticketId: ctx.ticket.id,
                hits: hits.map(h => ({
                    title: h.title,
                    source: h.source,
                    mimeType: h.mimeType,
                    libraryFileId: h.libraryFileId,
                    fileOptionId: h.fileOptionId,
                    distance: h.distance
                }))
            });

            if (hits.length === 0) {
                return `❌ Não encontrei nenhum arquivo relacionado a "${termoBusca}" na base de conhecimento.`;
            }

            // 2. Filtrar por tipo de arquivo se especificado
            let filteredHits = hits;
            if (tipoArquivo !== "qualquer") {
                const mimeTypeMap: Record<string, string[]> = {
                    "pdf": ["application/pdf"],
                    "imagem": ["image/jpeg", "image/png", "image/gif", "image/webp"],
                    "documento": ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]
                };
                const allowedMimes = mimeTypeMap[tipoArquivo] || [];
                if (allowedMimes.length > 0) {
                    filteredHits = hits.filter(h => h.mimeType && allowedMimes.some(m => h.mimeType!.includes(m)));
                }
            }

            // 3. Encontrar o melhor resultado com arquivo enviável
            let fileToSend: FilesOptions | null = null;
            let selectedHit: any = null;

            for (const hit of filteredHits) {
                // Tentar via fileOptionId direto (mais eficiente)
                if (hit.fileOptionId) {
                    const fileOption = await FilesOptions.findByPk(hit.fileOptionId);
                    if (fileOption && fileOption.isActive && fileOption.path) {
                        fileToSend = fileOption;
                        selectedHit = hit;
                        logger.info(`[ActionExecutor] Arquivo encontrado via fileOptionId`, {
                            fileOptionId: hit.fileOptionId,
                            path: fileOption.path
                        });
                        break;
                    }
                }

                // Tentar via libraryFileId
                if (hit.libraryFileId) {
                    const libraryFile = await LibraryFile.findByPk(hit.libraryFileId, {
                        include: [{
                            model: FilesOptions,
                            as: "fileOption",
                            where: { isActive: true },
                            required: false
                        }]
                    });
                    if (libraryFile?.fileOption && libraryFile.fileOption.path) {
                        fileToSend = libraryFile.fileOption;
                        selectedHit = hit;
                        logger.info(`[ActionExecutor] Arquivo encontrado via libraryFileId`, {
                            libraryFileId: hit.libraryFileId,
                            path: libraryFile.fileOption.path
                        });
                        break;
                    }
                }

                // Tentar via source (caminho do arquivo original)
                if (hit.source) {
                    const publicFolder = path.resolve(__dirname, "..", "..", "..", "public");
                    const sourcePath = path.resolve(publicFolder, hit.source);
                    
                    if (fs.existsSync(sourcePath)) {
                        // Criar um FilesOptions virtual para envio
                        fileToSend = {
                            path: hit.source,
                            name: hit.title || path.basename(hit.source),
                            mediaType: hit.mimeType || "application/octet-stream"
                        } as FilesOptions;
                        selectedHit = hit;
                        logger.info(`[ActionExecutor] Arquivo encontrado via source`, {
                            source: hit.source,
                            sourcePath
                        });
                        break;
                    }
                }
            }

            if (!fileToSend) {
                // Se não encontrou arquivo enviável, retornar informação textual
                const bestHit = filteredHits[0] || hits[0];
                logger.warn(`[ActionExecutor] Nenhum arquivo enviável encontrado`, {
                    ticketId: ctx.ticket.id,
                    bestHitTitle: bestHit.title,
                    bestHitSource: bestHit.source
                });
                
                return `📄 Encontrei informações sobre "${termoBusca}":\n\n**${bestHit.title}**\n${bestHit.content.substring(0, 500)}...\n\n⚠️ O arquivo original não está disponível para envio direto. Posso ajudar de outra forma?`;
            }

            // 4. Enviar o arquivo
            const publicFolder = path.resolve(__dirname, "..", "..", "..", "public");
            const filePath = path.resolve(publicFolder, fileToSend.path);

            if (!fs.existsSync(filePath)) {
                logger.error(`[ActionExecutor] Arquivo não existe no disco: ${filePath}`);
                return `❌ O arquivo "${selectedHit.title}" foi encontrado na base de conhecimento, mas não está disponível no servidor.`;
            }

            const fileBuffer = fs.readFileSync(filePath);
            const fileName = fileToSend.name || selectedHit.title || "arquivo";
            const mimeType = fileToSend.mediaType || selectedHit.mimeType || "application/octet-stream";

            // Detectar se é API Oficial
            const isOfficial = (ctx.wbot as any)?.channelType === "official" || (ctx.wbot as any)?.isOfficial;
            const number = `${ctx.contact.number}@${ctx.ticket.isGroup ? "g.us" : "s.whatsapp.net"}`;

            // Determinar tipo de envio baseado no mimeType
            if (mimeType.startsWith("image/")) {
                if (isOfficial) {
                    // Passar filePath para construir mediaUrl corretamente
                    await (ctx.wbot as any).sendImageMessage(ctx.contact.number, fileBuffer, fileName, filePath);
                } else {
                    await ctx.wbot.sendMessage(number, {
                        image: fileBuffer,
                        caption: `📎 ${fileName}`
                    });
                }
            } else if (mimeType.startsWith("video/")) {
                if (isOfficial) {
                    // Passar filePath para construir mediaUrl corretamente
                    await (ctx.wbot as any).sendVideoMessage(ctx.contact.number, fileBuffer, fileName, filePath);
                } else {
                    await ctx.wbot.sendMessage(number, {
                        video: fileBuffer,
                        caption: `📎 ${fileName}`
                    });
                }
            } else if (mimeType.startsWith("audio/")) {
                if (isOfficial) {
                    // Passar filePath para construir mediaUrl corretamente
                    await (ctx.wbot as any).sendAudioMessage(ctx.contact.number, fileBuffer, fileName, filePath);
                } else {
                    await ctx.wbot.sendMessage(number, {
                        audio: fileBuffer,
                        mimetype: mimeType
                    });
                }
            } else {
                // Documento (PDF, Excel, etc)
                if (isOfficial) {
                    await (ctx.wbot as any).sendDocumentMessage(ctx.contact.number, fileBuffer, fileName, mimeType, filePath);
                } else {
                    await ctx.wbot.sendMessage(number, {
                        document: fileBuffer,
                        fileName,
                        mimetype: mimeType
                    });
                }
            }

            logger.info(`[ActionExecutor] Arquivo enviado com sucesso`, {
                ticketId: ctx.ticket.id,
                fileName,
                mimeType,
                fileSize: fileBuffer.length,
                filePath
            });

            return `✅ Arquivo "${fileName}" enviado com sucesso!`;

        } catch (error: any) {
            logger.error("[ActionExecutor] Erro ao buscar e enviar arquivo:", error);
            return `❌ Erro ao buscar/enviar arquivo: ${error.message}`;
        }
    }

    /**
     * Lista todos os arquivos disponíveis na base de conhecimento
     */
    private static async listarArquivosDisponiveis(ctx: ActionContext): Promise<string> {
        const categoria = ctx.arguments.categoria;

        logger.info(`[ActionExecutor] listarArquivosDisponiveis iniciado`, {
            ticketId: ctx.ticket.id,
            categoria
        });

        try {
            // 1. Buscar arquivos via LibraryFolder vinculados à fila
            let arquivos: { nome: string; tipo: string; descricao?: string }[] = [];

            // Via QueueRAGSource (pastas vinculadas à fila)
            if (ctx.ticket.queue?.id) {
                const QueueRAGSource = (await import("../../models/QueueRAGSource")).default;
                const sources = await QueueRAGSource.findAll({
                    where: { queueId: ctx.ticket.queue.id },
                    include: [{
                        model: LibraryFolder,
                        as: "folder",
                        include: [{
                            model: LibraryFile,
                            as: "files",
                            include: [{
                                model: FilesOptions,
                                as: "fileOption",
                                where: { isActive: true },
                                required: true
                            }]
                        }]
                    }]
                });

                for (const source of sources) {
                    const folder = (source as any).folder;
                    if (folder?.files) {
                        for (const file of folder.files) {
                            if (file.fileOption) {
                                const tags = file.tags || [];
                                // Filtrar por categoria se especificada
                                if (categoria && !tags.some((t: string) => t.toLowerCase().includes(categoria.toLowerCase()))) {
                                    continue;
                                }
                                arquivos.push({
                                    nome: file.title || file.fileOption.name,
                                    tipo: this.getMimeTypeLabel(file.fileOption.mediaType),
                                    descricao: file.fileOption.description || undefined
                                });
                            }
                        }
                    }
                }
            }

            // Via folderId direto (sistema legado)
            if (arquivos.length === 0 && ctx.ticket.queue?.folderId) {
                const folderId = ctx.ticket.queue.folderId;
                let folderIds: number[] = [];

                if (folderId === -1) {
                    const allFolders = await LibraryFolder.findAll({
                        where: { companyId: ctx.ticket.companyId }
                    });
                    folderIds = allFolders.map(f => f.id);
                } else {
                    folderIds = [folderId];
                }

                const libraryFiles = await LibraryFile.findAll({
                    where: { folderId: { [Op.in]: folderIds } },
                    include: [{
                        model: FilesOptions,
                        as: "fileOption",
                        where: { isActive: true },
                        required: true
                    }]
                });

                for (const file of libraryFiles) {
                    const tags = file.tags || [];
                    if (categoria && !tags.some((t: string) => t.toLowerCase().includes(categoria.toLowerCase()))) {
                        continue;
                    }
                    arquivos.push({
                        nome: file.title || file.fileOption?.name || "Arquivo",
                        tipo: this.getMimeTypeLabel(file.fileOption?.mediaType),
                        descricao: file.fileOption?.description || undefined
                    });
                }
            }

            // Via fileListId (sistema mais antigo)
            if (arquivos.length === 0 && ctx.ticket.queue?.fileListId) {
                const fileOptions = await FilesOptions.findAll({
                    where: {
                        fileId: ctx.ticket.queue.fileListId,
                        isActive: true
                    }
                });

                for (const file of fileOptions) {
                    if (categoria && file.keywords && !file.keywords.toLowerCase().includes(categoria.toLowerCase())) {
                        continue;
                    }
                    arquivos.push({
                        nome: file.name,
                        tipo: this.getMimeTypeLabel(file.mediaType),
                        descricao: file.description || undefined
                    });
                }
            }

            if (arquivos.length === 0) {
                return `📂 Não encontrei arquivos disponíveis${categoria ? ` na categoria "${categoria}"` : ""}.`;
            }

            // Formatar lista
            const lista = arquivos.map(a => {
                let item = `• **${a.nome}** (${a.tipo})`;
                if (a.descricao) item += `\n  _${a.descricao}_`;
                return item;
            }).join("\n");

            return `📂 **Arquivos disponíveis${categoria ? ` (${categoria})` : ""}:**\n\n${lista}\n\nQual arquivo você gostaria de receber?`;

        } catch (error: any) {
            logger.error("[ActionExecutor] Erro ao listar arquivos:", error);
            return `❌ Erro ao listar arquivos: ${error.message}`;
        }
    }

    /**
     * Converte mimeType para label amigável
     */
    private static getMimeTypeLabel(mimeType?: string): string {
        if (!mimeType) return "Arquivo";
        if (mimeType.includes("pdf")) return "PDF";
        if (mimeType.includes("image")) return "Imagem";
        if (mimeType.includes("video")) return "Vídeo";
        if (mimeType.includes("audio")) return "Áudio";
        if (mimeType.includes("word") || mimeType.includes("document")) return "Documento";
        if (mimeType.includes("excel") || mimeType.includes("spreadsheet")) return "Planilha";
        return "Arquivo";
    }
}

export default ActionExecutor;
