import ContactListItem from "../../models/ContactListItem";
import Contact from "../../models/Contact";
import { Op } from "sequelize";
import logger from "../../utils/logger";

interface Request {
    contactListId: number;
    companyId: number;
}

interface Response {
    fixed: number;
    stillUnlinked: number;
}

/**
 * Corrige vínculos de contatos não vinculados em uma lista.
 * Busca contatos pelo canonicalNumber e atualiza o ContactListItem
 * para garantir que o canonicalNumber esteja correto.
 */
const FixUnlinkedContactsService = async ({
    contactListId,
    companyId
}: Request): Promise<Response> => {
    logger.info(`Iniciando correção de vínculos para lista ${contactListId}`);

    // Buscar itens que NÃO têm um Contact associado via canonicalNumber
    // Isso inclui itens com canonicalNumber NULL ou que não correspondem a nenhum Contact
    const allItems = await ContactListItem.findAll({
        where: {
            contactListId,
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
        return { fixed: 0, stillUnlinked: 0 };
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

    for (const item of unlinkedItems) {
        const itemAny = item as any;

        // Tentar encontrar o Contact correspondente
        // Primeiro tenta pelo canonicalNumber do item
        let matchedContact = itemAny.canonicalNumber ? contactMap.get(itemAny.canonicalNumber) : null;

        // Se não encontrou, tenta normalizar o número do item
        if (!matchedContact && itemAny.number) {
            const digits = String(itemAny.number).replace(/\D/g, "");
            // Tenta com e sem código do país
            const candidates = [
                digits,
                digits.startsWith("55") ? digits : `55${digits}`,
                digits.startsWith("55") ? digits.slice(2) : digits
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
                { where: { id: item.id } }
            );
            fixed++;
            logger.debug(`Item ${item.id} (${itemAny.name}) vinculado ao Contact ${matchedContact.id}`);
        }
    }

    const stillUnlinked = unlinkedItems.length - fixed;

    logger.info(`Correção concluída na lista ${contactListId}: ${fixed} corrigidos, ${stillUnlinked} ainda sem vínculo`);

    return { fixed, stillUnlinked };
};

export default FixUnlinkedContactsService;
