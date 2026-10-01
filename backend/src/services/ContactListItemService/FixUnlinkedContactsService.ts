import ContactListItem from "../../models/ContactListItem";
import ContactList from "../../models/ContactList";
import Contact from "../../models/Contact";
import ContactNormalizer from "../../helpers/ContactNormalizer";
import AppError from "../../errors/AppError";
import { Op } from "sequelize";
import logger from "../../utils/logger";

interface Request {
    contactListId: number;
    companyId: number;
    // Quando true, remove da lista os itens que não puderam ser vinculados
    // (número sem nenhum Contact correspondente, mesmo com variações)
    removeUnlinked?: boolean;
}

interface Response {
    fixed: number;
    stillUnlinked: number;
    removed: number;
}

/**
 * Corrige vínculos de contatos não vinculados em uma lista.
 * Busca contatos pelo canonicalNumber e atualiza o ContactListItem
 * para garantir que o canonicalNumber esteja correto.
 */
const FixUnlinkedContactsService = async ({
    contactListId,
    companyId,
    removeUnlinked = false
}: Request): Promise<Response> => {
    logger.info(`Iniciando correção de vínculos para lista ${contactListId}`);

    // Segurança: garante que a lista pertence à empresa antes de alterar itens (IDOR)
    const list = await ContactList.findOne({
        where: { id: contactListId, companyId }
    });
    if (!list) {
        throw new AppError("ERR_NO_CONTACTLIST_FOUND", 404);
    }

    // Buscar itens que NÃO têm um Contact associado via canonicalNumber
    // Isso inclui itens com canonicalNumber NULL ou que não correspondem a nenhum Contact
    const allItems = await ContactListItem.findAll({
        where: {
            contactListId,
            companyId,
            isGroup: false // Grupos não precisam de vínculo
        },
        attributes: ["id", "name", "number", "canonicalNumber"],
        include: [{
            model: Contact,
            as: "contact",
            attributes: ["id"],
            required: false
        }]
    });

    // Filtrar itens sem contact vinculado
    const unlinkedItems = allItems.filter(item => !(item as any).contact?.id);

    logger.info(`Encontrados ${unlinkedItems.length} itens sem vínculo na lista ${contactListId}`);

    if (unlinkedItems.length === 0) {
        return { fixed: 0, stillUnlinked: 0, removed: 0 };
    }

    // Buscar todos os contatos da empresa para matching
    const contactsToMatch = await Contact.findAll({
        where: {
            companyId,
            canonicalNumber: { [Op.ne]: null }
        },
        attributes: ["id", "number", "canonicalNumber"]
    });

    // Criar mapa de canonicalNumber -> Contact
    const contactMap = new Map<string, any>();
    contactsToMatch.forEach(c => {
        const canonical = (c as any).canonicalNumber;
        if (canonical) {
            contactMap.set(canonical, c);
        }
    });

    let fixed = 0;
    const unfixableIds: number[] = [];

    for (const item of unlinkedItems) {
        const itemAny = item as any;

        // Tentar encontrar o Contact correspondente
        // Primeiro tenta pelo canonicalNumber do item
        let matchedContact = itemAny.canonicalNumber ? contactMap.get(itemAny.canonicalNumber) : null;

        // Se não encontrou, tenta todas as variações do número
        // (±código 55, ±9º dígito — mesma lógica do fallback do ListService)
        if (!matchedContact && (itemAny.number || itemAny.canonicalNumber)) {
            const candidates = [
                ...ContactNormalizer.getVariations(itemAny.number || "").variations,
                ...ContactNormalizer.getVariations(itemAny.canonicalNumber || "").variations
            ];

            for (const candidate of candidates) {
                if (contactMap.has(candidate)) {
                    matchedContact = contactMap.get(candidate);
                    break;
                }
            }
        }

        if (matchedContact) {
            // Atualizar o canonicalNumber do item para corresponder ao Contact
            await ContactListItem.update(
                { canonicalNumber: matchedContact.canonicalNumber },
                { where: { id: item.id, companyId } }
            );
            fixed++;
            logger.debug(`Item ${item.id} (${itemAny.name}) vinculado ao Contact ${matchedContact.id}`);
        } else {
            unfixableIds.push(item.id);
        }
    }

    let removed = 0;
    if (removeUnlinked && unfixableIds.length > 0) {
        // Remove da lista os itens sem nenhum Contact correspondente —
        // são números inválidos/inexistentes que não devem permanecer
        removed = await ContactListItem.destroy({
            where: { id: unfixableIds, contactListId, companyId }
        });
        logger.info(`Removidos ${removed} itens sem vínculo da lista ${contactListId}`);
    }

    const stillUnlinked = unlinkedItems.length - fixed - removed;

    logger.info(`Correção concluída na lista ${contactListId}: ${fixed} corrigidos, ${removed} removidos, ${stillUnlinked} ainda sem vínculo`);

    return { fixed, stillUnlinked, removed };
};

export default FixUnlinkedContactsService;
