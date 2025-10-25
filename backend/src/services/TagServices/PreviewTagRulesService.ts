import { Op, fn, col, where as sequelizeWhere } from "sequelize";
import Contact from "../../models/Contact";
import TagRule from "../../models/TagRule";
import Tag from "../../models/Tag";

interface Request {
  companyId: number;
  tagId: number;
}

interface PreviewResult {
  tagId: number;
  tagName: string;
  contactsCount: number;
  contacts: Array<{
    id: number;
    name: string;
    number: string;
    email?: string;
  }>;
}

const PreviewTagRulesService = async ({
  companyId,
  tagId
}: Request): Promise<PreviewResult> => {
  // Busca regras ativas da tag
  const rules = await TagRule.findAll({
    where: { companyId, tagId, active: true },
    include: [{ model: Tag, as: "tag", attributes: ["id", "name"] }]
  });

  if (rules.length === 0) {
    return {
      tagId,
      tagName: "",
      contactsCount: 0,
      contacts: []
    };
  }

  const tagName = rules[0].tag.name;

  // Monta where condition baseado nas regras
  const whereContact: any = { companyId };

  console.log(`[PreviewTagRules] Processando ${rules.length} regras para tag ${tagId}`);

  for (const rule of rules) {
    const fieldValue = rule.value;
    console.log(`[PreviewTagRules] Regra: field=${rule.field}, operator=${rule.operator}, value=${fieldValue}`);

    switch (rule.operator) {
      case "equals": {
        // Case-insensitive usando LOWER
        if (!whereContact[Op.and]) whereContact[Op.and] = [];
        (whereContact[Op.and] as any[]).push(
          sequelizeWhere(fn('LOWER', col(`${rule.field}`)), fieldValue.toLowerCase())
        );
        break;
      }
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
        try {
          const parsed = JSON.parse(fieldValue);
          const values = Array.isArray(parsed) ? parsed : [parsed];
          const lowered = values.map(v => String(v).toLowerCase());
          if (!whereContact[Op.and]) whereContact[Op.and] = [];
          (whereContact[Op.and] as any[]).push(
            sequelizeWhere(fn('LOWER', col(`${rule.field}`)), { [Op.in]: lowered })
          );
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
    }
  }

  console.log(`[PreviewTagRules] Where condition:`, JSON.stringify(whereContact, null, 2));

  // Busca contatos que atendem as regras (máximo 50 para preview)
  const matchingContacts = await Contact.findAll({
    where: whereContact,
    attributes: ["id", "name", "number", "email", "city"],
    limit: 50
  });

  console.log(`[PreviewTagRules] Encontrados ${matchingContacts.length} contatos`);
  if (matchingContacts.length > 0) {
    console.log(`[PreviewTagRules] Primeiro contato:`, {
      id: matchingContacts[0].id,
      name: matchingContacts[0].name,
      city: matchingContacts[0].city
    });
  }

  return {
    tagId,
    tagName,
    contactsCount: matchingContacts.length,
    contacts: matchingContacts.map(c => ({
      id: c.id,
      name: c.name,
      number: c.number,
      email: c.email
    }))
  };
};

export default PreviewTagRulesService;
