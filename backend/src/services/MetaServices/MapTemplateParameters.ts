import { TemplateParameter } from "./GetTemplateDefinition";
import Contact from "../../models/Contact";
import logger from "../../utils/logger";

/**
 * Mapeia parâmetros de um template para dados de um contato do CRM
 * Estratégias de match:
 * 1. Por similaridade do exemplo (se contém "nome", "email", etc)
 * 2. Por ordem (parâmetro 1 = nome, parâmetro 2 = email, etc)
 */
export const MapTemplateParameters = (
    parameters: TemplateParameter[],
    contact: any
): any[] => {
    try {
        if (!parameters || parameters.length === 0) {
            return [];
        }

        logger.info(
            `[MapTemplateParameters] Mapeando ${parameters.length} parâmetros para contato ${contact.id} (${contact.name})`
        );

        // Agrupar por componente (body, header, footer)
        const bodyParams = parameters.filter(p => p.component === "BODY");
        const headerParams = parameters.filter(p => p.component === "HEADER");

        const components: any[] = [];

        // Mapear parâmetros do BODY
        if (bodyParams.length > 0) {
            const mappedParams = bodyParams.map(param => {
                let value = "";

                // Estratégia 1: Match por similaridade do exemplo
                const exampleLower = (param.example || "").toLowerCase();

                if (exampleLower.includes("nome") || exampleLower.includes("name")) {
                    value = contact.name || "Cliente";
                } else if (exampleLower.includes("email") || exampleLower.includes("e-mail")) {
                    value = contact.email || "";
                } else if (exampleLower.includes("telefone") || exampleLower.includes("phone") || exampleLower.includes("celular")) {
                    value = contact.number || "";
                } else if (exampleLower.includes("codigo") || exampleLower.includes("código") || exampleLower.includes("code")) {
                    value = String(contact.id || "");
                } else {
                    // Estratégia 2: Fallback por ordem
                    switch (param.index) {
                        case 1:
                            value = contact.name || "Cliente";
                            break;
                        case 2:
                            value = contact.email || contact.number || "";
                            break;
                        case 3:
                            value = String(contact.id || "");
                            break;
                        default:
                            value = "";
                    }
                }

                logger.debug(
                    `[MapTemplateParameters] Param ${param.index} (${param.example}) -> "${value}"`
                );

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
                // Header geralmente é texto simples, imagem, vídeo ou documento
                // Por ora, usar nome do contato como fallback
                const value = contact.name || "Cliente";

                logger.debug(
                    `[MapTemplateParameters] Header param ${param.index} (${param.example}) -> "${value}"`
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
