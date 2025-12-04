/**
 * BotFunctions.ts
 * 
 * Define as funções disponíveis para o bot usar via Function Calling (OpenAI/Gemini)
 * Estas funções permitem que a IA execute ações reais ao invés de apenas responder com texto
 */

export interface BotFunction {
    name: string;
    description: string;
    parameters: {
        type: "object";
        properties: Record<string, any>;
        required?: string[];
    };
}

/**
 * Lista de funções que o bot pode executar
 * A IA irá escolher qual função chamar baseado no contexto da conversa
 */
export const BOT_AVAILABLE_FUNCTIONS: BotFunction[] = [
    {
        name: "listar_catalogos",
        description: "SEMPRE use esta função quando o cliente mencionar 'catálogo' pela primeira vez ou se houver dúvida sobre qual catálogo enviar. Esta função lista todos os catálogos disponíveis.",
        parameters: {
            type: "object",
            properties: {}
        }
    },
    {
        name: "enviar_catalogo",
        description: "OBRIGATÓRIO: Use esta função para ENVIAR o arquivo PDF do catálogo quando o cliente pedir 'catálogo', 'produtos' ou 'o que vocês vendem'. NUNCA diga que não consegue enviar - USE esta função.",
        parameters: {
            type: "object",
            properties: {
                tipo: {
                    type: "string",
                    description: "Nome ou tipo do catálogo (ex: 'completo', 'premium', 'lite'). Padrão: 'completo'"
                }
            },
            required: []
        }
    },
    {
        name: "enviar_tabela_precos",
        description: "OBRIGATÓRIO: Use esta função para ENVIAR a tabela de preços em PDF quando o cliente perguntar sobre 'preços', 'valores', 'quanto custa' ou 'tabela'. NUNCA diga que não consegue - USE esta função.",
        parameters: {
            type: "object",
            properties: {}
        }
    },
    {
        name: "buscar_produto_detalhado",
        description: "Busca informações detalhadas de um produto específico no RAG e retorna ficha técnica, especificações e detalhes. Use quando cliente mencionar um produto específico.",
        parameters: {
            type: "object",
            properties: {
                nome_produto: {
                    type: "string",
                    description: "Nome ou código do produto mencionado pelo cliente"
                }
            },
            required: ["nome_produto"]
        }
    },
    {
        name: "transferir_para_vendedor_responsavel",
        description: "Transfere a conversa automaticamente para o vendedor RESPONSÁVEL pelo cliente, baseado nas tags pessoais compartilhadas (ex: #BRUNA, #FELIPE). Use quando: 1) Cliente pedir para falar com vendedor específico, 2) Cliente já tem vendedor atribuído (tags pessoais), 3) Situação requer vendedor que conhece histórico do cliente.",
        parameters: {
            type: "object",
            properties: {
                motivo: {
                    type: "string",
                    description: "Motivo da transferência para logs"
                }
            },
            required: ["motivo"]
        }
    },
    {
        name: "transferir_para_atendente",
        description: "Transfere para QUALQUER atendente humano disponível na fila (sem preferência). Use quando: 1) Cliente pedir atendente mas NÃO mencionar nome específico, 2) Dúvida muito complexa, 3) Reclamação ou problema que precisa de humano.",
        parameters: {
            type: "object",
            properties: {
                motivo: {
                    type: "string",
                    description: "Motivo da transferência"
                }
            },
            required: ["motivo"]
        }
    }
];
