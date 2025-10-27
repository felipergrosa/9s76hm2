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

  // Pós-processamento: alguns itens podem não associar com Contact por diferenças de formatação do número.
  // Para esses casos, tentamos localizar o contato pelo número normalizado (apenas dígitos)
  // e preencher o campo contact dinamicamente.
  const rowsAny: any[] = contacts as any[];
  await Promise.all(
    rowsAny.map(async (item) => {
      try {
        if (item.contact) return; // já populado pela associação
        const raw = (item.number || "").toString();
        const digits = raw.replace(/\D/g, "");
        if (!raw && !digits) return;
        const found = await Contact.findOne({
          where: {
            companyId,
            [Op.or]: [
              { number: raw },
              { number: digits },
              { number: { [Op.like]: `%${digits}%` } },
              { number: { [Op.like]: `%${raw}%` } }
            ]
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
            "representativeCode"
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
        if (found) {
          // setDataValue evita mexer no modelo/associação original, mas expõe "contact" no JSON 
          item.setDataValue && item.setDataValue("contact", found);
          if (!item.contact) (item as any).contact = found;
        }
      } catch (_) {
        // silencioso: se falhar, apenas mantém contact nulo
      }
    })
  );

  const hasMore = count > offset + contacts.length;

  return {
    contacts,
    count,
    hasMore
  };
};

export default ListService;
