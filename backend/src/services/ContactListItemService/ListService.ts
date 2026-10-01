import { Sequelize, Op } from "sequelize";
import ContactNormalizer from "../../helpers/ContactNormalizer";
import ContactListItem from "../../models/ContactListItem";
import Contact from "../../models/Contact";
import Tag from "../../models/Tag";

interface Request {
  searchParam?: string;
  pageNumber?: string;
  companyId: number | string;
  contactListId: number | string;
  orderBy?: string;
  order?: "asc" | "desc" | "ASC" | "DESC";
  limit?: string | number; // 30, 100, 500, 1000 ou "all"
}

interface Response {
  contacts: ContactListItem[];
  count: number;
  hasMore: boolean;
}

const ListService = async ({
  searchParam = "",
  pageNumber = "1",
  companyId,
  contactListId,
  orderBy,
  order,
  limit: limitParam
}: Request): Promise<Response> => {
  const whereCondition = {
    [Op.or]: [
      {
        name: Sequelize.where(
          Sequelize.fn("LOWER", Sequelize.col("ContactListItem.name")),
          "LIKE",
          `%${searchParam.toLowerCase().trim()}%`
        )
      },
      { number: { [Op.like]: `%${searchParam.toLowerCase().trim()}%` } }
    ],
    companyId,
    contactListId
  };

  // Define limite de resultados: 30, 100, 500, 1000 ou todos
  const validLimits = [30, 100, 500, 1000];
  const limitValue = typeof limitParam === "string" ? limitParam.toLowerCase() : limitParam;
  const limit = limitValue === "all" || limitValue === "todos" ? null : (validLimits.includes(Number(limitValue)) ? Number(limitValue) : 20);
  const offset = (limit || 0) * (+pageNumber - 1);

  // Define ordenação segura
  const dir = (String(order || "ASC").toUpperCase() === "DESC" ? "DESC" : "ASC") as "ASC" | "DESC";
  const by = (orderBy || "name").toLowerCase();
  // Campos na ContactListItem: name, number, email
  // Campos no Contact associado: city, segment, situation, creditLimit, bzEmpresa
  let orderClause: any[] = [["name", dir]];
  if (["name", "number", "email"].includes(by)) {
    orderClause = [[by, dir]];
  } else if (["city", "segment", "situation", "creditlimit", "bzempresa", "empresa"].includes(by)) {
    const contactField = by === "creditlimit" ? "creditLimit" : by === "bzempresa" || by === "empresa" ? "bzEmpresa" : by;
    // Sintaxe suportada pelo Sequelize para ordenar por campo do include
    orderClause = [[{ model: Contact, as: "contact" }, contactField, dir]] as any;
  } else if (by === "tags") {
    // Ordenar por tags é complexo; usar fallback por name para previsibilidade
    orderClause = [["name", dir]];
  }

  const { count, rows: contacts } = await ContactListItem.findAndCountAll({
    where: whereCondition,
    ...(limit ? { limit, offset } : {}),
    order: orderClause as any,
    subQuery: false,
    distinct: true, // Evita contagem duplicada por JOIN com tags
    include: [
      {
        model: Contact,
        as: "contact",
        attributes: [
          "id",
          "name",
          "number",
          "email",
          "profilePicUrl",
          "city",
          "segment",
          "situation",
          "creditLimit",
          "channels",
          "representativeCode",
          "bzEmpresa"
        ],
        required: false,
        include: [
          {
            model: Tag,
            as: "tags",
            attributes: ["id", "name", "color"],
            through: { attributes: [] }
          }
        ]
      }
    ]
  });

  // Pós-processamento: garantir que TODOS os itens tenham o Contact associado
  // Isso é crítico quando itens são inseridos via filtro (INSERT direto) sem associação
  const rowsAny: any[] = contacts as any[];

  // Primeiro, identificar quais itens precisam de busca
  const itemsNeedingContact = rowsAny.filter(item => !item.contact);

  // Gera as chaves candidatas para um item: canonical salvo, dígitos do number
  // e todas as variações brasileiras (±55, ±9º dígito) via ContactNormalizer
  const candidateKeysFor = (item: any): string[] => {
    const keys: string[] = [];
    const push = (v?: string | null) => {
      const d = (v || "").replace(/\D/g, "");
      if (d && !keys.includes(d)) keys.push(d);
    };
    push(item.canonicalNumber);
    ContactNormalizer.getVariations(item.number || "").variations.forEach(push);
    if (item.canonicalNumber && item.canonicalNumber !== item.number) {
      ContactNormalizer.getVariations(item.canonicalNumber).variations.forEach(push);
    }
    return keys;
  };

  if (itemsNeedingContact.length > 0) {
    // Buscar contatos por canonicalNumber OU pelas variantes
    const allKeys = Array.from(new Set(itemsNeedingContact.flatMap(candidateKeysFor)));
    const canonicalNumbers = allKeys.filter(n => n);

    if (canonicalNumbers.length > 0) {
      // Buscar contatos usando canonicalNumber
      const foundContacts = await Contact.findAll({
        where: {
          companyId,
          canonicalNumber: { [Op.in]: canonicalNumbers }
        },
        attributes: [
          "id",
          "name",
          "number",
          "canonicalNumber",
          "email",
          "profilePicUrl",
          "city",
          "segment",
          "situation",
          "creditLimit",
          "channels",
          "representativeCode",
          "bzEmpresa"
        ],
        include: [
          {
            model: Tag,
            as: "tags",
            attributes: ["id", "name", "color"],
            through: { attributes: [] }
          }
        ]
      });

      // Criar mapa de chaves -> contato (canonicalNumber, number e variantes ±55)
      const contactMap = new Map<string, any>();
      const register = (key: string | null | undefined, contact: any) => {
        const d = (key || "").replace(/\D/g, "");
        if (d && !contactMap.has(d)) contactMap.set(d, contact);
      };
      foundContacts.forEach(contact => {
        const canonical = (contact as any).canonicalNumber;
        const number = (contact as any).number;
        register(canonical, contact);
        register(number, contact);
        if (canonical) {
          register(canonical.startsWith("55") ? canonical.slice(2) : `55${canonical}`, contact);
        }
        if (number) {
          const d = number.replace(/\D/g, "");
          register(d.startsWith("55") ? d.slice(2) : `55${d}`, contact);
        }
      });

      // Associar contatos aos itens tentando todas as chaves candidatas
      itemsNeedingContact.forEach(item => {
        for (const key of candidateKeysFor(item)) {
          const found = contactMap.get(key);
          if (found) {
            item.setDataValue && item.setDataValue("contact", found);
            if (!item.contact) (item as any).contact = found;
            break;
          }
        }
      });
    }
  }

  const hasMore = limit ? count > offset + contacts.length : false;

  return {
    contacts,
    count,
    hasMore
  };
};

export default ListService;
