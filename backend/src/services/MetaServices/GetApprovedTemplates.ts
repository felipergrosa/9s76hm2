import axios from "axios";
import logger from "../../utils/logger";
import Whatsapp from "../../models/Whatsapp";

interface MetaTemplateComponent {
  type: "HEADER" | "BODY" | "FOOTER" | "BUTTONS";
  format?: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT";
  text?: string;
  example?: {
    header_text?: string[];
    body_text?: string[][];
  };
  buttons?: Array<{
    type: string;
    text: string;
  }>;
}

export interface MetaTemplate {
  id: string;
  name: string;
  language: string;
  status: "APPROVED" | "PENDING" | "REJECTED" | "DISABLED";
  category: "MARKETING" | "UTILITY" | "AUTHENTICATION";
  components: MetaTemplateComponent[];
}

interface GetApprovedTemplatesParams {
  whatsappId: number;
  companyId: number;
}

export const GetApprovedTemplates = async ({
  whatsappId,
  companyId
}: GetApprovedTemplatesParams): Promise<MetaTemplate[]> => {
  try {
    logger.info(`[GetApprovedTemplates] Buscando templates para whatsappId=${whatsappId}`);

    // Buscar configurações do WhatsApp
    const whatsapp = await Whatsapp.findOne({
      where: { id: whatsappId, companyId }
    });

    if (!whatsapp) {
      throw new Error("WhatsApp não encontrado");
    }

    if (whatsapp.channelType !== "official") {
      logger.warn(`[GetApprovedTemplates] WhatsApp ${whatsappId} não é API Oficial`);
      return [];
    }

    const { wabaAccessToken, wabaPhoneNumberId, wabaBusinessAccountId } = whatsapp;

    if (!wabaAccessToken || !wabaPhoneNumberId) {
      throw new Error("WhatsApp não tem configurações da API Oficial");
    }

    // Buscar WABA ID (WhatsApp Business Account ID)
    // Primeiro precisamos obter o WABA ID através do phoneNumberId
    let wabaId: string;
    
    try {
      const phoneResponse = await axios.get(
        `https://graph.facebook.com/v18.0/${wabaPhoneNumberId}`,
        {
          params: {
            access_token: wabaAccessToken,
            fields: "verified_name,display_phone_number,quality_rating"
          }
        }
      );
      
      // O WABA ID geralmente está na estrutura de dados
      // Para obter templates, podemos buscar diretamente do WABA
      // Se não temos o WABA ID, podemos buscar do próprio phoneNumberId
      logger.info(`[GetApprovedTemplates] Phone info:`, phoneResponse.data);
    } catch (err: any) {
      logger.warn(`[GetApprovedTemplates] Erro ao buscar info do phone:`, err.message);
    }

    // Buscar templates
    // API: GET /v18.0/{whatsapp-business-account-id}/message_templates
    // Usar WABA ID se disponível, senão usar phoneNumberId
    const accountId = wabaBusinessAccountId || wabaPhoneNumberId;
    const url = `https://graph.facebook.com/v18.0/${accountId}/message_templates`;
    
    logger.info(`[GetApprovedTemplates] Buscando templates em: ${url}`);

    const { data } = await axios.get(url, {
      params: {
        access_token: wabaAccessToken,
        fields: "id,name,language,status,category,components",
        limit: 100
      }
    });

    const templates: MetaTemplate[] = data.data || [];
    
    // Filtrar apenas templates aprovados
    const approved = templates.filter(t => 
      t.status === "APPROVED" && 
      t.category !== "AUTHENTICATION" // Excluir templates de autenticação
    );
    
    logger.info(`[GetApprovedTemplates] ${approved.length} de ${templates.length} templates aprovados`);
    
    return approved;
  } catch (error: any) {
    logger.error(`[GetApprovedTemplates] Erro:`, {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    
    // Se erro 403 ou 401, retornar array vazio em vez de throw
    if (error.response?.status === 403 || error.response?.status === 401) {
      logger.warn(`[GetApprovedTemplates] Sem permissão para acessar templates`);
      return [];
    }
    
    throw error;
  }
};

export default GetApprovedTemplates;
