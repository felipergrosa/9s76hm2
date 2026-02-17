import { Op, Sequelize } from "sequelize";
import Contact from "../../models/Contact";
import logger from "../../utils/logger";
import { safeNormalizePhoneNumber } from "../../utils/phone";

interface FindDuplicatesParams {
  companyId: number;
  criteria?: "number" | "name" | "both";
  contactId?: number;
}

interface DuplicateGroup {
  criteriaType: string;
  criteriaValue: string;
  contacts: Array<{
    id: number;
    name: string;
    number: string;
    canonicalNumber?: string;
    createdAt: Date;
    ticketsCount?: number;
    messagesCount?: number;
  }>;
}

interface FindDuplicatesResult {
  duplicateGroups: DuplicateGroup[];
  totalDuplicates: number;
  suggestions: string[];
}

const FindDuplicatesService = async ({
  companyId,
  criteria = "both",
  contactId
}: FindDuplicatesParams): Promise<FindDuplicatesResult> => {
  try {
    logger.info(`Iniciando busca de duplicados - Empresa: ${companyId}, Critério: ${criteria}`);

    const duplicateGroups: DuplicateGroup[] = [];
    const suggestions: string[] = [];

    // Se contactId for especificado, buscar duplicados específicos deste contato
    if (contactId) {
      const targetContact = await Contact.findOne({
        where: { id: contactId, companyId }
      });

      if (!targetContact) {
        throw new Error("Contato não encontrado");
      }

      // Buscar por número normalizado
      if (criteria === "number" || criteria === "both") {
        const { canonical } = safeNormalizePhoneNumber(targetContact.number);
        if (canonical) {
          const duplicatesByNumber = await Contact.findAll({
            where: {
              companyId,
              id: { [Op.ne]: contactId },
              [Op.or]: [
                { number: targetContact.number },
                { canonicalNumber: canonical },
                { number: canonical }
              ]
            },
            attributes: ["id", "name", "number", "canonicalNumber", "createdAt"],
            order: [["createdAt", "ASC"]]
          });

          if (duplicatesByNumber.length > 0) {
            duplicateGroups.push({
              criteriaType: "number",
              criteriaValue: canonical,
              contacts: [
                {
                  id: targetContact.id,
                  name: targetContact.name,
                  number: targetContact.number,
                  canonicalNumber: targetContact.canonicalNumber,
                  createdAt: targetContact.createdAt
                },
                ...duplicatesByNumber.map(contact => ({
                  id: contact.id,
                  name: contact.name,
                  number: contact.number,
                  canonicalNumber: contact.canonicalNumber,
                  createdAt: contact.createdAt
                }))
              ]
            });
          }
        }
      }

      // Buscar por nome similar
      if (criteria === "name" || criteria === "both") {
        const cleanName = targetContact.name.trim().toLowerCase();
        if (cleanName.length > 3) {
          const duplicatesByName = await Contact.findAll({
            where: {
              companyId,
              id: { [Op.ne]: contactId },
              name: { [Op.iLike]: `%${cleanName}%` }
            },
            attributes: ["id", "name", "number", "canonicalNumber", "createdAt"],
            order: [["createdAt", "ASC"]]
          });

          if (duplicatesByName.length > 0) {
            duplicateGroups.push({
              criteriaType: "name",
              criteriaValue: cleanName,
              contacts: [
                {
                  id: targetContact.id,
                  name: targetContact.name,
                  number: targetContact.number,
                  canonicalNumber: targetContact.canonicalNumber,
                  createdAt: targetContact.createdAt
                },
                ...duplicatesByName.map(contact => ({
                  id: contact.id,
                  name: contact.name,
                  number: contact.number,
                  canonicalNumber: contact.canonicalNumber,
                  createdAt: contact.createdAt
                }))
              ]
            });
          }
        }
      }
    } else {
      // Busca geral por duplicados na empresa
      
      // Duplicados por número canônico
      if (criteria === "number" || criteria === "both") {
        const numberDuplicates = await Contact.findAll({
          where: {
            companyId,
            canonicalNumber: { [Op.ne]: null }
          },
          attributes: ["canonicalNumber"],
          group: ["canonicalNumber"],
          having: Sequelize.literal("COUNT(*) > 1")
        });

        for (const duplicate of numberDuplicates) {
          const contacts = await Contact.findAll({
            where: {
              companyId,
              canonicalNumber: duplicate.canonicalNumber
            },
            attributes: ["id", "name", "number", "canonicalNumber", "createdAt"],
            order: [["createdAt", "ASC"]]
          });

          if (contacts.length > 1) {
            duplicateGroups.push({
              criteriaType: "number",
              criteriaValue: duplicate.canonicalNumber,
              contacts: contacts.map(contact => ({
                id: contact.id,
                name: contact.name,
                number: contact.number,
                canonicalNumber: contact.canonicalNumber,
                createdAt: contact.createdAt
              }))
            });
          }
        }
      }

      // Duplicados por nome similar (apenas nomes com mais de 5 caracteres)
      if (criteria === "name" || criteria === "both") {
        const nameDuplicates = await Contact.findAll({
          where: {
            companyId,
            name: { 
              [Op.ne]: null,
              [Op.not]: "",
            }
          },
          attributes: ["name"],
          group: [Sequelize.fn("LOWER", Sequelize.fn("TRIM", Sequelize.col("name")))],
          having: Sequelize.literal("COUNT(*) > 1 AND LENGTH(TRIM(name)) > 5")
        });

        for (const duplicate of nameDuplicates) {
          const cleanName = duplicate.name.trim().toLowerCase();
          const contacts = await Contact.findAll({
            where: {
              companyId,
              name: { [Op.iLike]: cleanName }
            },
            attributes: ["id", "name", "number", "canonicalNumber", "createdAt"],
            order: [["createdAt", "ASC"]]
          });

          if (contacts.length > 1) {
            duplicateGroups.push({
              criteriaType: "name",
              criteriaValue: cleanName,
              contacts: contacts.map(contact => ({
                id: contact.id,
                name: contact.name,
                number: contact.number,
                canonicalNumber: contact.canonicalNumber,
                createdAt: contact.createdAt
              }))
            });
          }
        }
      }
    }

    // Gerar sugestões
    if (duplicateGroups.length > 0) {
      suggestions.push("Recomendamos manter o contato mais antigo e mesclar os dados dos demais.");
      suggestions.push("Verifique se os contatos realmente são da mesma pessoa antes de mesclar.");
      suggestions.push("Contatos com mais histórico de mensagens geralmente são preferíveis para manter.");
    }

    const totalDuplicates = duplicateGroups.reduce((sum, group) => sum + group.contacts.length, 0);

    logger.info(`Busca de duplicados concluída: ${duplicateGroups.length} grupos, ${totalDuplicates} contatos duplicados`);

    return {
      duplicateGroups,
      totalDuplicates,
      suggestions
    };

  } catch (error: any) {
    logger.error(`Erro ao buscar duplicados: ${error.message}`);
    throw error;
  }
};

export default FindDuplicatesService;
