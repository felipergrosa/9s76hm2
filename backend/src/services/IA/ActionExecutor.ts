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
import Contact from "../../models/Contact";
import Tag from "../../models/Tag";
import User from "../../models/User";
import Ticket from "../../models/Ticket";
import Queue from "../../models/Queue";
import { Op } from "sequelize";
import logger from "../../utils/logger";
import fs from "fs";

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

    private static async enviarCatalogo(ctx: ActionContext): Promise<string> {
        const tipo = ctx.arguments.tipo || "completo";

        try {
            let catalogoFile: FilesOptions | null = null;

            if (ctx.ticket.queue?.fileListId) {
                const fileOptions = await FilesOptions.findAll({
                    where: {
                        fileId: ctx.ticket.queue.fileListId,
                        isActive: true,
                        keywords: { [Op.iLike]: `%catalogo%` }
                    },
                    limit: 1
                });
                catalogoFile = fileOptions[0] || null;
            }

            if (!catalogoFile) {
                logger.warn(`[ActionExecutor] Catálogo não encontrado`, { queueId: ctx.ticket.queueId });
                return `❌ Catálogo não configurado nesta fila`;
            }

            // Verificar se arquivo existe
            if (!fs.existsSync(catalogoFile.path)) {
                logger.error(`[ActionExecutor] Arquivo não existe: ${catalogoFile.path}`);
                return `❌ Arquivo do catálogo não encontrado no servidor`;
            }

            // Enviar arquivo usando wbot diretamente
            const number = `${ctx.contact.number}@${ctx.ticket.isGroup ? "g.us" : "s.whatsapp.net"}`;

            await ctx.wbot.sendMessage(number, {
                document: fs.readFileSync(catalogoFile.path),
                fileName: catalogoFile.name || "Catalogo.pdf",
                mimetype: "application/pdf"
            });

            logger.info(`[ActionExecutor] Catálogo enviado`, { ticketId: ctx.ticket.id });
            return `✅ Catálogo ${tipo} enviado!`;

        } catch (error: any) {
            logger.error("[ActionExecutor] Erro ao enviar catálogo:", error);
            return `❌ Erro ao enviar catálogo: ${error.message}`;
        }
    }

    private static async enviarTabelaPrecos(ctx: ActionContext): Promise<string> {
        try {
            let tabelaFile: FilesOptions | null = null;

            if (ctx.ticket.queue?.fileListId) {
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
            }

            if (!tabelaFile) {
                logger.warn(`[ActionExecutor] Tabela não encontrada`, { queueId: ctx.ticket.queueId });
                return `❌ Tabela de preços não configurada`;
            }

            if (!fs.existsSync(tabelaFile.path)) {
                logger.error(`[ActionExecutor] Arquivo não exists: ${tabelaFile.path}`);
                return `❌ Arquivo da tabela não encontrado no servidor`;
            }

            const number = `${ctx.contact.number}@${ctx.ticket.isGroup ? "g.us" : "s.whatsapp.net"}`;

            await ctx.wbot.sendMessage(number, {
                document: fs.readFileSync(tabelaFile.path),
                fileName: tabelaFile.name || "Tabela_Precos.pdf",
                mimetype: "application/pdf"
            });

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
}

export default ActionExecutor;
