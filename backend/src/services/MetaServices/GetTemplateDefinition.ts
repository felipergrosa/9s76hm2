import GetApprovedTemplates, { MetaTemplate } from "./GetApprovedTemplates";
import Whatsapp from "../../models/Whatsapp";
import logger from "../../utils/logger";

export interface TemplateParameter {
    index: number;
    component: "HEADER" | "BODY" | "FOOTER" | "BUTTON";
    example?: string;
    paramName?: string;  // Nome da variável quando o template usa variáveis nomeadas (ex: "v1", "v2")
}

export interface TemplateDefinition {
    name: string;
    language: string;
    status: string;
    hasButtons: boolean;
    hasHeader: boolean;  // Se o template tem componente HEADER (mesmo que fixo sem variáveis)
    buttons: Array<{ type: string; text: string; }>;
    parameters: TemplateParameter[];
    body: string;
    header?: string;
    footer?: string;
}

/**
 * Busca a definição de um template específico da Meta API
 * e extrai informações sobre parâmetros e botões
 */
export const GetTemplateDefinition = async (
    whatsappId: number,
    templateName: string,
    languageCode: string = "pt_BR"
): Promise<TemplateDefinition> => {
    try {
        logger.info(
            `[GetTemplateDefinition] Buscando definição de ${templateName} (${languageCode}) via whatsappId=${whatsappId}`
        );

        // Buscar companyId via whatsapp
        const whatsapp = await Whatsapp.findByPk(whatsappId);
        if (!whatsapp) {
            throw new Error(`WhatsApp ${whatsappId} não encontrado`);
        }

        const templates = await GetApprovedTemplates({
            whatsappId,
            companyId: whatsapp.companyId
        });

        // Buscar template específico
        const template = templates.find(
            t => t.name === templateName && t.language === languageCode
        );

        if (!template) {
            throw new Error(
                `Template ${templateName} (${languageCode}) não encontrado. ` +
                `Disponíveis: ${templates.map(t => `${t.name}(${t.language})`).join(", ")}`
            );
        }

        // Extrair parâmetros e botões
        const parameters: TemplateParameter[] = [];
        const buttons: Array<{ type: string; text: string; }> = [];

        // DEBUG: Ver estrutura completa do template
        console.log("[GetTemplateDefinition] Template completo:", JSON.stringify(template.components, null, 2));

        let body = "";
        let header: string | undefined = undefined;
        let footer: string | undefined = undefined;

        template.components.forEach(component => {
            // Extrair textos
            if (component.type === "BODY") body = component.text || "";
            if (component.type === "HEADER") header = component.text;
            if (component.type === "FOOTER") footer = component.text;

            // Extrair botões
            if (component.type === "BUTTONS" && component.buttons) {
                buttons.push(...component.buttons);

                // Detectar parâmetros em botões de URL
                component.buttons.forEach((button: any) => {
                    if (button.type === "URL" && button.url) {
                        const paramRegex = /\{\{([^}]+)\}\}/g;
                        let match;
                        while ((match = paramRegex.exec(button.url)) !== null) {
                            const varName = match[1].trim();
                            // Botões de URL geralmente usam {{1}} apenas no final
                            // Mas vamos suportar qualquer formato
                            let paramNum: number;
                            if (/^\d+$/.test(varName)) {
                                paramNum = parseInt(varName);
                            } else {
                                // Se não for numérico, ignoramos por enquanto ou usamos lógica de autoIndex?
                                // Meta geralmente usa {{1}} para URL dinâmica
                                return;
                            }

                            parameters.push({
                                index: paramNum,
                                component: "BUTTON",
                                example: "https://example.com" // Exemplo genérico
                            });
                        }
                    }
                });
            }

            // NOVA LÓGICA: Extrair parâmetros do TEXTO do template
            // Usa regex para detectar {{1}}, {{2}}, {{v1}}, {{v2}}, {{nome}}, {{email}}, etc.
            if (component.text) {
                // Regex genérico: detecta QUALQUER coisa entre {{}}
                const paramRegex = /\{\{([^}]+)\}\}/g;
                let match;
                const detectedParams = new Map<number, string>();  // index ->nome da variável
                let autoIndex = 1;  // Para variáveis sem número explícito

                while ((match = paramRegex.exec(component.text)) !== null) {
                    const varName = match[1].trim();  // "1", "v1", "nome", "email", etc
                    let paramNum: number;

                    // Detectar tipo de variável
                    if (/^\d+$/.test(varName)) {
                        // Numérica pura: {{1}}, {{2}}
                        paramNum = parseInt(varName);
                    } else if (/^v\d+$/.test(varName)) {
                        // v-numérica: {{v1}}, {{v2}}
                        paramNum = parseInt(varName.substring(1));
                    } else {
                        // Nomeada: {{nome}}, {{email}}, etc
                        // Usar autoIndex e guardar o nome
                        paramNum = autoIndex++;
                    }

                    // Guardar mapeamento (evita duplicatas)
                    if (!detectedParams.has(paramNum)) {
                        detectedParams.set(paramNum, varName);
                    }
                }

                // Extrair param_name do body_text_named_params (se existir)
                const namedParams = new Map<string, string>();  // varName -> example
                if ((component.example as any)?.body_text_named_params) {
                    (component.example as any).body_text_named_params.forEach((namedParam: any) => {
                        namedParams.set(namedParam.param_name, namedParam.example);
                    });
                }

                // Tentar também buscar do example se existir (fallback para templates antigos)
                let exampleParams: string[] = [];
                if (component.example) {
                    if (component.type === "BODY" && component.example.body_text) {
                        exampleParams = component.example.body_text[0] || [];
                    }
                    if (component.type === "HEADER" && component.example.header_text) {
                        exampleParams = component.example.header_text || [];
                    }
                }

                // Adicionar parâmetros detectados (ordenados por índice)
                Array.from(detectedParams.keys())
                    .sort((a, b) => a - b)
                    .forEach(paramNum => {
                        const varName = detectedParams.get(paramNum)!;

                        // Tentar pegar exemplo do body_text_named_params (prioridade)
                        let example = namedParams.get(varName);

                        // Se não encontrar, usar do example.body_text (fallback)
                        if (!example) {
                            example = exampleParams[paramNum - 1];
                        }

                        // Se ainda não tiver, usar o próprio varName como hint
                        if (!example) {
                            example = varName;
                        }

                        parameters.push({
                            index: paramNum,
                            component: component.type as "HEADER" | "BODY" | "FOOTER",
                            example: example,
                            paramName: /^\d+$/.test(varName) ? undefined : varName  // Só incluir paramName se NÃO for numérico
                        });
                    });
            }
        });

        logger.info(
            `[GetTemplateDefinition] Template ${templateName}: ` +
            `${parameters.length} parâmetros, ${buttons.length} botões`
        );

        return {
            name: template.name,
            language: template.language,
            status: template.status,
            hasButtons: buttons.length > 0,
            hasHeader: !!header,  // true se template tem header (fixo ou com variáveis)
            buttons,
            parameters,
            body,
            header,
            footer
        };
    } catch (error: any) {
        logger.error(`[GetTemplateDefinition] Erro: ${error.message}`);
        throw error;
    }
};

export default GetTemplateDefinition;
