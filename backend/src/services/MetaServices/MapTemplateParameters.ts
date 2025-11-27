import { TemplateParameter } from "./GetTemplateDefinition";
import Contact from "../../models/Contact";
import logger from "../../utils/logger";
import moment from "moment";

export interface VariableConfig {
    type: "crm_field" | "special" | "fixed";
    source: string;
}

/**
 * Resolve uma variável configurada para seu valor final
 */
function resolveVariable(config: VariableConfig, contact: any): string {
    try {
        switch (config.type) {
            case "crm_field":
                // Campos do CRM: name, email, number, id
                return String(contact[config.source] || "");

            case "special":
                // Campos especiais do sistema
                switch (config.source) {
                    case "saudacao":
                        return getSaudacao();
                    case "data_atual":
                        return moment().format("DD/MM/YYYY");
                    case "hora_atual":
                        return moment().format("HH:mm");
                    default:
                        logger.warn(`[resolveVariable] Campo especial desconhecido: ${config.source}`);
                        return "";
                }

            case "fixed":
                // Texto fixo
                return config.source;

            default:
                logger.warn(`[resolveVariable] Tipo de variável desconhecido: ${config.type}`);
                return "";
        }
    } catch (error: any) {
        logger.error(`[resolveVariable] Erro ao resolver variável: ${error.message}`);
        return "";
    }
}

/**
 * Retorna saudação dinâmica baseada na hora atual
 */
function getSaudacao(): string {
    const hour = moment().hour();
    if (hour < 12) return "Bom dia";
    if (hour < 18) return "Boa tarde";
    return "Boa noite";
}

/**
 * Tenta detectar automaticamente o valor baseado no exemplo do parâmetro
 * (fallback quando não há mapeamento configurado)
 */
function autoDetectValue(param: TemplateParameter, contact: any): string {
    const exampleLower = (param.example || "").toLowerCase();

    if (exampleLower.includes("nome") || exampleLower.includes("name")) {
        return contact.name || "Cliente";
    } else if (exampleLower.includes("email") || exampleLower.includes("e-mail")) {
        return contact.email || "";
    } else if (exampleLower.includes("telefone") || exampleLower.includes("phone") || exampleLower.includes("celular")) {
        return contact.number || "";
    } else if (exampleLower.includes("codigo") || exampleLower.includes("código") || exampleLower.includes("code")) {
        return String(contact.id || "");
    } else {
        // Fallback por ordem
        switch (param.index) {
            case 1:
                return contact.name || "Cliente";
            case 2:
                return contact.email || contact.number || "";
            case 3:
                return String(contact.id || "");
            default:
                return "";
        }
    }
}

/**
 * Mapeia parâmetros de um template para dados de um contato do CRM
 * 
 * Estratégias de mapeamento:
 * 1. Se variablesConfig fornecido, usa mapeamento configurado
 * 2. Senão, tenta detectar automaticamente baseado no exemplo
 * 3. Senão, usa fallback por ordem (1=nome, 2=email, 3=id)
 */
export const MapTemplateParameters = (
    parameters: TemplateParameter[],
    contact: any,
    variablesConfig?: Record<string, VariableConfig>
): any[] => {
    try {
        if (!parameters || parameters.length === 0) {
            return [];
        }

        logger.info(
            `[MapTemplateParameters] Mapeando ${parameters.length} parâmetros para contato ${contact.id} (${contact.name})`
        );
        console.log("[MapTemplateParameters] VariablesConfig:", JSON.stringify(variablesConfig, null, 2));
        console.log("[MapTemplateParameters] Parameters:", JSON.stringify(parameters, null, 2));

        // Agrupar por componente (body, header, footer)
        const bodyParams = parameters.filter(p => p.component === "BODY");
        const headerParams = parameters.filter(p => p.component === "HEADER");

        const components: any[] = [];

        // Mapear parâmetros do BODY
        if (bodyParams.length > 0) {
            const mappedParams = bodyParams.map(param => {
                let value = "";

                // Estratégia 1: Usar mapeamento configurado (prioridade)
                if (variablesConfig && variablesConfig[String(param.index)]) {
                    const config = variablesConfig[String(param.index)];
                    value = resolveVariable(config, contact);
                    logger.debug(
                        `[MapTemplateParameters] Param ${param.index} via config (${config.type}:${config.source}) -> "${value}"`
                    );
                }
                // Estratégia 2: Auto-detecção por similaridade
                else {
                    value = autoDetectValue(param, contact);
                    logger.debug(
                        `[MapTemplateParameters] Param ${param.index} via auto-detect (${param.example}) -> "${value}"`
                    );
                }

                return { type: "text", text: value };
            });

            components.push({
                type: "body",
                parameters: mappedParams
            });
        }

        // Mapear parâmetros do HEADER (se houver)
        if (headerParams.length > 0) {
            const mappedParams = headerParams.map(param => {
                let value = "";

                if (variablesConfig && variablesConfig[String(param.index)]) {
                    const config = variablesConfig[String(param.index)];
                    value = resolveVariable(config, contact);
                } else {
                    value = contact.name || "Cliente";
                }

                logger.debug(
                    `[MapTemplateParameters] Header param ${param.index} -> "${value}"`
                );

                return { type: "text", text: value };
            });

            components.push({
                type: "header",
                parameters: mappedParams
            });
        }

        logger.info(
            `[MapTemplateParameters] Gerados ${components.length} component(s) com parâmetros`
        );

        return components;
    } catch (error: any) {
        logger.error(`[MapTemplateParameters] Erro: ${error.message}`);
        return [];
    }
};

export default MapTemplateParameters;
