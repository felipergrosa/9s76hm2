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
        name: "enviar_catalogo",
        description: "Envia o catálogo completo de produtos para o cliente. Use quando o cliente pedir para ver produtos, catálogo, mostruário ou o que está disponível.",
        parameters: {
            type: "object",
            properties: {
                tipo: {
                    type: "string",
                    enum: ["completo", "promocoes", "lancamentos"],
                    description: "Tipo de catálogo a enviar. Use 'completo' por padrão."
                }
            },
            required: ["tipo"]
        }
    },
    {
        name: "enviar_tabela_precos",
        description: "Envia a tabela de preços atualizada. Use quando o cliente perguntar sobre valores, preços, orçamento ou quanto custa.",
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
