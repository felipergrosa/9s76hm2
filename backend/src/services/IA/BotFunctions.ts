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
        description: "SEMPRE use esta função PRIMEIRO quando o cliente perguntar 'quais catálogos vocês têm?', 'que catálogos existem?', 'quais produtos vocês vendem?' ou qualquer pergunta sobre QUAIS catálogos estão disponíveis. Esta função lista todos os catálogos para o cliente escolher.",
        parameters: {
            type: "object",
            properties: {}
        }
    },
    {
        name: "enviar_catalogo",
        description: "Use esta função para ENVIAR um catálogo específico em PDF. Use quando o cliente já souber qual catálogo quer (ex: 'catálogo completo', 'catálogo de pendentes') ou após listar os catálogos disponíveis.",
        parameters: {
            type: "object",
            properties: {
                tipo: {
                    type: "string",
                    description: "Nome ou tipo do catálogo (ex: 'completo', 'pendentes', 'trilhos', 'abajures'). Se não especificado, envia o primeiro encontrado."
                }
            },
            required: []
        }
    },
    {
        name: "listar_tabelas_precos",
        description: "SEMPRE use esta função PRIMEIRO quando o cliente perguntar 'quais tabelas vocês têm?', 'quais tabelas de preço?', 'que tabelas existem?' ou qualquer pergunta sobre QUAIS tabelas estão disponíveis. Esta função lista todas as tabelas de preços para o cliente escolher.",
        parameters: {
            type: "object",
            properties: {}
        }
    },
    {
        name: "enviar_tabela_precos",
        description: "Use esta função para ENVIAR uma tabela de preços específica em PDF. Use quando o cliente já souber qual tabela quer (ex: 'tabela lite', 'tabela premium') ou após listar as tabelas disponíveis.",
        parameters: {
            type: "object",
            properties: {
                tipo: {
                    type: "string",
                    description: "Nome ou tipo da tabela (ex: 'lite', 'premium', 'completa'). Se não especificado, envia a primeira encontrada."
                }
            },
            required: []
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
        name: "buscar_e_enviar_arquivo",
        description: "OBRIGATÓRIO: Busca um arquivo na base de conhecimento (RAG) e ENVIA ao cliente. Use quando o cliente pedir qualquer documento, arquivo, PDF, imagem, manual, ficha técnica, etc. Esta função busca semanticamente e envia o arquivo original. SEMPRE use esta função quando cliente pedir para 'enviar', 'mandar', 'ver' algum documento.",
        parameters: {
            type: "object",
            properties: {
                termo_busca: {
                    type: "string",
                    description: "Termo de busca para encontrar o arquivo (ex: 'manual do produto X', 'ficha técnica luminária', 'catálogo completo')"
                },
                tipo_arquivo: {
                    type: "string",
                    description: "Tipo de arquivo desejado (opcional): 'pdf', 'imagem', 'documento', 'qualquer'",
                    enum: ["pdf", "imagem", "documento", "qualquer"]
                }
            },
            required: ["termo_busca"]
        }
    },
    {
        name: "listar_arquivos_disponiveis",
        description: "Lista todos os arquivos disponíveis na base de conhecimento que podem ser enviados ao cliente. Use quando o cliente perguntar 'o que vocês têm?', 'quais arquivos?', 'quais documentos disponíveis?'",
        parameters: {
            type: "object",
            properties: {
                categoria: {
                    type: "string",
                    description: "Categoria opcional para filtrar (ex: 'catalogo', 'manual', 'ficha_tecnica')"
                }
            }
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
