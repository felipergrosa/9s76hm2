import { Op } from "sequelize";
import Contact from "../../models/Contact";
import logger from "../../utils/logger";

interface Request {
  companyId: number;
  dryRun?: boolean; // Se true, apenas simula sem alterar dados
}

interface Response {
  processed: number;
  normalized: number;
  errors: number;
  details: Array<{
    id: number;
    name: string;
    originalNumber: string;
    normalizedNumber: string;
    action: 'normalized' | 'kept' | 'error';
  }>;
}

const normalizePhoneNumber = (value: string | null | undefined): { normalized: string | null; shouldUpdate: boolean } => {
  if (!value) return { normalized: null, shouldUpdate: false };
  
  const original = String(value).trim();
  if (!original) return { normalized: null, shouldUpdate: false };
  
  // Remove todos os caracteres não numéricos
  const digitsOnly = original.replace(/\D/g, "");
  if (!digitsOnly) return { normalized: null, shouldUpdate: false };
  
  // Remove zeros à esquerda
  let normalized = digitsOnly.replace(/^0+/, "");
  if (!normalized) return { normalized: null, shouldUpdate: false };
  
  // Se tem 10 ou 11 dígitos e não começa com 55, adiciona DDI brasileiro
  if (!normalized.startsWith("55") && normalized.length >= 10 && normalized.length <= 11) {
    normalized = `55${normalized}`;
  }
  
  // Só atualiza se realmente mudou
  const shouldUpdate = normalized !== original;
  
  return { normalized, shouldUpdate };
};

const NormalizeContactNumbersService = async ({
  companyId,
  dryRun = false
}: Request): Promise<Response> => {
  try {
    logger.info(`Iniciando normalização de números de contatos - Empresa: ${companyId}, DryRun: ${dryRun}`);
    
    // Buscar todos os contatos da empresa
    const contacts = await Contact.findAll({
      where: { 
        companyId,
        number: { [Op.ne]: null } // Apenas contatos com número
      },
      attributes: ['id', 'name', 'number'],
      order: [['id', 'ASC']]
    });
    
    logger.info(`Encontrados ${contacts.length} contatos para processar`);
    
    let processed = 0;
    let normalized = 0;
    let errors = 0;
    const details: Response['details'] = [];
    
    for (const contact of contacts) {
      try {
        processed++;
        
        const { normalized: newNumber, shouldUpdate } = normalizePhoneNumber(contact.number);
        
        if (shouldUpdate && newNumber) {
          if (!dryRun) {
            // Atualizar o contato
            await contact.update({ number: newNumber });
          }
          
          normalized++;
          details.push({
            id: contact.id,
            name: contact.name,
            originalNumber: contact.number,
            normalizedNumber: newNumber,
            action: 'normalized'
          });
          
          logger.debug(`Contato ${contact.id} normalizado: ${contact.number} → ${newNumber}`);
        } else {
          details.push({
            id: contact.id,
            name: contact.name,
            originalNumber: contact.number,
            normalizedNumber: contact.number,
            action: 'kept'
          });
        }
        
      } catch (error: any) {
        errors++;
        details.push({
          id: contact.id,
          name: contact.name,
          originalNumber: contact.number,
          normalizedNumber: contact.number,
          action: 'error'
        });
        
        logger.error(`Erro ao normalizar contato ${contact.id}:`, {
          message: error.message,
          contactId: contact.id,
          originalNumber: contact.number
        });
      }
    }
    
    const result = {
      processed,
      normalized,
      errors,
      details
    };
    
    logger.info(`Normalização concluída - Processados: ${processed}, Normalizados: ${normalized}, Erros: ${errors}`);
    
    if (dryRun) {
      logger.info("Modo DryRun ativo - nenhuma alteração foi salva no banco");
    }
    
    return result;
    
  } catch (error: any) {
    logger.error('Erro no serviço de normalização de números:', {
      message: error.message,
      stack: error.stack,
      companyId,
      dryRun
    });
    throw error;
  }
};

export default NormalizeContactNumbersService;
