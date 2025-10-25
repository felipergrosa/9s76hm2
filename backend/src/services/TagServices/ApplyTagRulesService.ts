import { Op, fn, col, where as sequelizeWhere } from "sequelize";
import Contact from "../../models/Contact";
import TagRule from "../../models/TagRule";
import ContactTag from "../../models/ContactTag";
import Tag from "../../models/Tag";

interface Request {
  companyId: number;
  contactId?: number; // Se fornecido, aplica apenas neste contato
  tagId?: number; // Se fornecido, aplica apenas regras desta tag
}

interface AppliedRule {
  tagId: number;
  tagName: string;
  contactsAffected: number;
}

const ApplyTagRulesService = async ({
  companyId,
  contactId,
  tagId
}: Request): Promise<AppliedRule[]> => {
  const results: AppliedRule[] = [];

  // Busca regras ativas
  const whereRule: any = { companyId, active: true };
  if (tagId) {
    whereRule.tagId = tagId;
  }

  const rules = await TagRule.findAll({
    where: whereRule,
    include: [{ model: Tag, as: "tag", attributes: ["id", "name"] }]
  });

  if (rules.length === 0) {
    return results;
  }

  // Agrupa regras por tag e lógica
  const rulesByTag = new Map<number, { tag: Tag; andRules: TagRule[]; orRules: TagRule[] }>();
  for (const rule of rules) {
    if (!rulesByTag.has(rule.tagId)) {
      rulesByTag.set(rule.tagId, { tag: rule.tag, andRules: [], orRules: [] });
    }
    const group = rulesByTag.get(rule.tagId)!;
    if (rule.logic === "OR") {
      group.orRules.push(rule);
    } else {
      group.andRules.push(rule);
    }
  }

  // Para cada tag, aplica suas regras
  for (const [currentTagId, { tag, andRules, orRules }] of rulesByTag.entries()) {
    const tagName = tag.name;
    
    let matchingContactIds: number[] = [];

    // Processa regras AND
    if (andRules.length > 0) {
      const whereContact: any = { companyId };
      if (contactId) {
        whereContact.id = contactId;
      }

      // Aplica cada regra AND como condição
      for (const rule of andRules) {
      const fieldValue = rule.value;

      switch (rule.operator) {
        case "equals":
          whereContact[rule.field] = fieldValue;
          break;

        case "not_equals":
          whereContact[rule.field] = { [Op.ne]: fieldValue };
          break;

        case "contains":
          whereContact[rule.field] = { [Op.like]: `%${fieldValue}%` };
          break;

        case "not_contains":
          whereContact[rule.field] = { [Op.notLike]: `%${fieldValue}%` };
          break;

        case "starts_with":
          whereContact[rule.field] = { [Op.like]: `${fieldValue}%` };
          break;

        case "ends_with":
          whereContact[rule.field] = { [Op.like]: `%${fieldValue}` };
          break;

        case "in":
          // value deve ser JSON array: ["valor1", "valor2"]
          try {
            const parsed = JSON.parse(fieldValue);
            const values = Array.isArray(parsed) ? parsed : [parsed];
            const lowered = values.map(v => String(v).toLowerCase());
            if (!whereContact[Op.and]) whereContact[Op.and] = [];
            (whereContact[Op.and] as any[]).push({
              [Op.or]: [
                sequelizeWhere(fn('LOWER', col(`${rule.field}`)), { [Op.in]: lowered }),
                { [rule.field]: { [Op.in]: values } }
              ]
            });
          } catch (err) {
            console.warn(`TagRule ${rule.id}: valor 'in' inválido`, err);
          }
          break;

        case "not_in":
          try {
            const values = JSON.parse(fieldValue);
            if (Array.isArray(values)) {
              whereContact[rule.field] = { [Op.notIn]: values };
            }
          } catch (err) {
            console.warn(`TagRule ${rule.id}: valor 'not_in' inválido`, err);
          }
          break;

        case "greater_than":
          whereContact[rule.field] = { [Op.gt]: fieldValue };
          break;

        case "greater_or_equal":
          whereContact[rule.field] = { [Op.gte]: fieldValue };
          break;

        case "less_than":
          whereContact[rule.field] = { [Op.lt]: fieldValue };
          break;

        case "less_or_equal":
          whereContact[rule.field] = { [Op.lte]: fieldValue };
          break;

        case "not_null":
          whereContact[rule.field] = { [Op.ne]: null };
          break;

        case "is_null":
          whereContact[rule.field] = { [Op.is]: null };
          break;

        default:
          console.warn(`TagRule ${rule.id}: operador '${rule.operator}' não suportado`);
      }
    }

      // Busca contatos que atendem TODAS as regras AND
      const andContacts = await Contact.findAll({
        where: whereContact,
        attributes: ["id"]
      });
      
      matchingContactIds = andContacts.map(c => c.id);
    }

    // Processa regras OR (qualquer uma das regras)
    if (orRules.length > 0) {
      const orContactIds: number[] = [];
      
      for (const rule of orRules) {
        const whereContact: any = { companyId };
        if (contactId) {
          whereContact.id = contactId;
        }

        const fieldValue = rule.value;

        // Aplica operador (mesmo switch de antes)
        switch (rule.operator) {
          case "in": {
            try {
              const parsed = JSON.parse(fieldValue);
              const values = Array.isArray(parsed) ? parsed : [parsed];
              const lowered = values.map(v => String(v).toLowerCase());
              if (!whereContact[Op.and]) whereContact[Op.and] = [];
              (whereContact[Op.and] as any[]).push({
                [Op.or]: [
                  sequelizeWhere(fn('LOWER', col(`${rule.field}`)), { [Op.in]: lowered }),
                  { [rule.field]: { [Op.in]: values } }
                ]
              });
            } catch (err) {
              console.warn(`TagRule ${rule.id}: valor 'in' inválido (OR)`, err);
            }
            break;
          }
          case "equals":
            whereContact[rule.field] = fieldValue;
            break;
          case "contains":
            whereContact[rule.field] = { [Op.like]: `%${fieldValue}%` };
            break;
        }

        const contacts = await Contact.findAll({
          where: whereContact,
          attributes: ["id"]
        });

        orContactIds.push(...contacts.map(c => c.id));
      }

      // Combina AND e OR: (AND) OU (qualquer OR)
      if (matchingContactIds.length > 0) {
        matchingContactIds = [...new Set([...matchingContactIds, ...orContactIds])];
      } else {
        matchingContactIds = [...new Set(orContactIds)];
      }
    }

    let contactsAffected = 0;

    // Aplica a tag aos contatos encontrados
    for (const contactIdToTag of matchingContactIds) {
      const existing = await ContactTag.findOne({
        where: { contactId: contactIdToTag, tagId: currentTagId }
      });

      if (!existing) {
        await ContactTag.create({
          contactId: contactIdToTag,
          tagId: currentTagId
        });
        contactsAffected++;
      }
    }

    // Atualiza histórico nas regras
    await TagRule.update(
      { 
        lastAppliedAt: new Date(),
        lastContactsAffected: contactsAffected
      },
      { where: { tagId: currentTagId, companyId } }
    );

    results.push({
      tagId: currentTagId,
      tagName,
      contactsAffected
    });
  }

  return results;
};

export default ApplyTagRulesService;
