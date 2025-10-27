import { Sequelize, Op } from "sequelize";
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
  order
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

  const limit = 20;
  const offset = limit * (+pageNumber - 1);

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
    limit,
    offset,
    order: orderClause as any,
    subQuery: false,
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
          "channel",
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
  
  if (itemsNeedingContact.length > 0) {
    // Buscar todos os números de uma vez para otimizar
    const numbers = itemsNeedingContact.map(item => {
      const raw = (item.number || "").toString();
      const digits = raw.replace(/\D/g, "");
      return { raw, digits, item };
    }).filter(n => n.raw || n.digits);

    // Buscar contatos em lote
    const allNumbers = [...new Set(numbers.flatMap(n => [n.raw, n.digits]).filter(Boolean))];
    
    if (allNumbers.length > 0) {
      const foundContacts = await Contact.findAll({
        where: {
          companyId,
          number: { [Op.in]: allNumbers }
        },
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
          "channel",
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

      // Criar mapa de número -> contato para lookup rápido
      const contactMap = new Map();
      foundContacts.forEach(contact => {
        const num = (contact.number || "").toString();
        const digits = num.replace(/\D/g, "");
        contactMap.set(num, contact);
        contactMap.set(digits, contact);
      });

      // Associar contatos aos itens
      numbers.forEach(({ raw, digits, item }) => {
        const found = contactMap.get(raw) || contactMap.get(digits);
        if (found) {
          item.setDataValue && item.setDataValue("contact", found);
          if (!item.contact) (item as any).contact = found;
        }
      });
    }
  }

  const hasMore = count > offset + contacts.length;

  return {
    contacts,
    count,
    hasMore
  };
};

export default ListService;
