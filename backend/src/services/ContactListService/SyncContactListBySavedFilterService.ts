import ContactList from "../../models/ContactList";
import AddFilteredContactsToListService from "../ContactListItemService/AddFilteredContactsToListService";
import logger from "../../utils/logger";

interface Request {
  contactListId: number;
  companyId: number;
}

const SyncContactListBySavedFilterService = async ({ contactListId, companyId }: Request) => {
  const list = await ContactList.findByPk(contactListId);
  if (!list) {
    logger.warn(`Lista ${contactListId} não encontrada para sincronização`);
    return { added: 0, duplicated: 0, errors: 0 };
  }

  const savedFilter = (list as any).savedFilter;
  if (!savedFilter) {
    logger.info(`Lista ${contactListId} sem savedFilter. Ignorando.`);
    return { added: 0, duplicated: 0, errors: 0 };
  }

  logger.info(`Sincronizando lista ${contactListId} com savedFilter (modo aditivo, sem remover existentes)`);

  // Estratégia aditiva: apenas adiciona novos contatos que atendam ao filtro,
  // evitando duplicados por número/email (lógica interna do AddFilteredContactsToListService)
  const result = await AddFilteredContactsToListService({
    contactListId,
    companyId,
    filters: savedFilter
  });

  logger.info(`Sincronização concluída da lista ${contactListId}:`, result);
  return result;
};

export default SyncContactListBySavedFilterService;
