import Contact from "../../models/Contact";
import Whatsapp from "../../models/Whatsapp";
import { getIO } from "../../libs/socket";
import logger from "../../utils/logger";
import { getWbot } from "../../libs/wbot";

interface ValidateContactNameParams {
  contactId: string | number;
  companyId: number;
}

interface ValidateResult {
  success: boolean;
  name?: string;
  error?: string;
}

/**
 * Valida o nome de um contato buscando na API do WhatsApp
 * Usado quando o contato tem number == name (não validado)
 */
const ValidateContactNameService = async ({
  contactId,
  companyId
}: ValidateContactNameParams): Promise<ValidateResult> => {
  try {
    // 1. Buscar contato
    const contact = await Contact.findByPk(contactId);
    
    if (!contact) {
      return { success: false, error: "Contato não encontrado" };
    }

    if (contact.companyId !== companyId) {
      return { success: false, error: "Contato não pertence a esta empresa" };
    }

    // 2. Verificar se tem WhatsApp associado
    const whatsapp = await Whatsapp.findByPk(contact.whatsappId);
    
    if (!whatsapp) {
      return { success: false, error: "Contato não tem conexão WhatsApp associada" };
    }

    if (whatsapp.status !== "CONNECTED") {
      return { success: false, error: "Conexão WhatsApp não está ativa" };
    }

    // 3. Buscar informações do contato na API WhatsApp
    const wbot = getWbot(whatsapp.id);
    
    if (!wbot) {
      return { success: false, error: "WhatsApp não está conectado" };
    }

    try {
      // Formatar número para o WhatsApp
      const jid = `${contact.number}@s.whatsapp.net`;
      
      // Buscar informações do contato no store do wbot
      const contactInfo = (wbot.store as any)?.contacts?.[jid];
      
      if (contactInfo && (contactInfo.name || contactInfo.notify || (contactInfo as any).pushname)) {
        const contactName = contactInfo.name || contactInfo.notify || (contactInfo as any).pushname;
        
        // 4. Atualizar o contato com o nome real
        await contact.update({
          name: contactName,
          contactName: contactName,
          isWhatsappValid: true,
          validatedAt: new Date()
        });

        logger.info(`[ValidateContactName] Contato ${contactId} validado: ${contactName}`);

        // 5. Emitir evento para atualizar UI
        const io = getIO();
        io.of(`/workspace-${companyId}`).emit(`company-${companyId}-contact`, {
          action: "update",
          contact
        });

        return { 
          success: true, 
          name: contactName 
        };
      } else {
        return { 
          success: false, 
          error: "Nome não encontrado na API WhatsApp" 
        };
      }
    } catch (whatsappError: any) {
      logger.error(`[ValidateContactName] Erro ao buscar contato na API: ${whatsappError?.message}`);
      return { 
        success: false, 
        error: "Erro ao buscar informações na API WhatsApp" 
      };
    }

  } catch (err: any) {
    logger.error(`[ValidateContactName] Erro geral: ${err?.message}`);
    return { success: false, error: `Erro: ${err?.message}` };
  }
};

export default ValidateContactNameService;
