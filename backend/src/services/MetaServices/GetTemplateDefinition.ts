import GetApprovedTemplates, { MetaTemplate } from "./GetApprovedTemplates";
import Whatsapp from "../../models/Whatsapp";
import logger from "../../utils/logger";

export interface TemplateParameter {
    index: number;
    component: "HEADER" | "BODY" | "FOOTER";
    example?: string;
}

export interface TemplateDefinition {
    name: string;
    language: string;
    status: string;
    hasButtons: boolean;
    buttons: Array<{ type: string; text: string; }>;
    parameters: TemplateParameter[];
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

        template.components.forEach(component => {
            // Extrair botões
            if (component.type === "BUTTONS" && component.buttons) {
                buttons.push(...component.buttons);
            }

            // Extrair parâmetros do example
            if (component.example) {
                // Parâmetros do BODY
                if (component.type === "BODY" && component.example.body_text) {
                    // body_text é array de arrays: [[param1, param2, ...]]
                    const bodyParams = component.example.body_text[0] || [];
                    bodyParams.forEach((example, index) => {
                        parameters.push({
                            index: index + 1,
                            component: "BODY",
                            example
                        });
                    });
                }

                // Parâmetros do HEADER
                if (component.type === "HEADER" && component.example.header_text) {
                    component.example.header_text.forEach((example, index) => {
                        parameters.push({
                            index: index + 1,
                            component: "HEADER",
                            example
                        });
                    });
                }
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
            buttons,
            parameters
        };
    } catch (error: any) {
        logger.error(`[GetTemplateDefinition] Erro: ${error.message}`);
        throw error;
    }
};

export default GetTemplateDefinition;
