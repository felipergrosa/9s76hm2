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
    // Extrair números únicos dos itens
    const uniqueNumbers = [...new Set(
      itemsNeedingContact
        .map(item => (item.number || "").toString().trim())
        .filter(Boolean)
    )];
    
    console.log(`[ListService] Buscando ${uniqueNumbers.length} números únicos no banco...`);
    
    if (uniqueNumbers.length > 0) {
      // Buscar contatos usando exatamente os números como estão salvos
      const foundContacts = await Contact.findAll({
        where: {
          companyId,
          number: { [Op.in]: uniqueNumbers }
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

      console.log(`[ListService] Encontrados ${foundContacts.length} contatos no banco`);

      // Criar mapa número -> contato
      const contactMap = new Map();
      foundContacts.forEach(contact => {
        const num = (contact.number || "").toString().trim();
        contactMap.set(num, contact);
      });

      // Associar contatos aos itens
      let matched = 0;
      itemsNeedingContact.forEach(item => {
        const itemNumber = (item.number || "").toString().trim();
        const found = contactMap.get(itemNumber);
        
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
