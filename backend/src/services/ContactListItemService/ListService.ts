import { Sequelize, Op } from "sequelize";
import ContactListItem from "../../models/ContactListItem";
import Contact from "../../models/Contact";
import Tag from "../../models/Tag";

interface Request {
  searchParam?: string;
  pageNumber?: string;
  companyId: number | string;
  contactListId: number | string;
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
  contactListId
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

  const { count, rows: contacts } = await ContactListItem.findAndCountAll({
    where: whereCondition,
    limit,
    offset,
    order: [["name", "ASC"]],
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
          "representativeCode"
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

  const hasMore = count > offset + contacts.length;

  return {
    contacts,
    count,
    hasMore
  };
};

export default ListService;
