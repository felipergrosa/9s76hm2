import Contact from "../../models/Contact";
import RefreshContactAvatarService from "./RefreshContactAvatarService";

interface Request {
  companyId: number;
  contactIds?: number[];
  limit?: number;
}

const BulkRefreshContactAvatarsService = async ({ 
  companyId, 
  contactIds, 
  limit = 50 
}: Request): Promise<void> => {
  try {

    const whereClause: any = { companyId };
    if (contactIds && contactIds.length > 0) {
      whereClause.id = contactIds;
    }

    const contacts = await Contact.findAll({
      where: whereClause,
      limit,
      order: [['updatedAt', 'ASC']] // Prioriza contatos mais antigos
    });
    

    // Processa contatos em paralelo (máximo 5 por vez para não sobrecarregar)
    const batchSize = 5;
    for (let i = 0; i < contacts.length; i += batchSize) {
      const batch = contacts.slice(i, i + batchSize);
      
      await Promise.allSettled(
        batch.map(async (contact) => {
          try {
            await RefreshContactAvatarService({
              contactId: contact.id,
              companyId,
              whatsappId: contact.whatsappId
            });
          } catch (error) {
            // silencioso
          }
        })
      );

      // Pequena pausa entre lotes para não sobrecarregar
      if (i + batchSize < contacts.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // silencioso

  } catch (error) {
    // silencioso
    throw error;
  }
};

export default BulkRefreshContactAvatarsService;
