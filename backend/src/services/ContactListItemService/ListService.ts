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
  
  console.log(`[ListService] Total de itens: ${rowsAny.length}, Sem contact: ${itemsNeedingContact.length}`);
  
  if (itemsNeedingContact.length > 0) {
    // Usar canonicalNumber para busca (mais preciso)
    const canonicalNumbers = itemsNeedingContact
      .map(item => item.canonicalNumber || (item.number || "").replace(/\D/g, ""))
      .filter(n => n);

    console.log(`[ListService] Buscando ${canonicalNumbers.length} números canônicos no banco...`);
    
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

      console.log(`[ListService] Encontrados ${foundContacts.length} contatos no banco`);

      // Criar mapa canonicalNumber -> contato
      const contactMap = new Map<string, any>();
      foundContacts.forEach(contact => {
        const canonical = (contact as any).canonicalNumber;
        if (canonical) {
          contactMap.set(canonical, contact);
        }
      });

      // Associar contatos aos itens
      let matched = 0;
      itemsNeedingContact.forEach(item => {
        const canonical = item.canonicalNumber || (item.number || "").replace(/\D/g, "");
        const found = contactMap.get(canonical);

        if (found) {
          item.setDataValue && item.setDataValue("contact", found);
          if (!item.contact) (item as any).contact = found;
          matched++;
        }
      });
      
      console.log(`[ListService] ${matched} de ${itemsNeedingContact.length} itens associados com sucesso`);
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
