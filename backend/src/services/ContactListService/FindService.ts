import { col, fn } from "sequelize";
import ContactList from "../../models/ContactList";
import ContactListItem from "../../models/ContactListItem";

type Params = {
  companyId: string;
};

const FindService = async ({ companyId }: Params): Promise<ContactList[]> => {
  const notes: ContactList[] = await ContactList.findAll({
    where: {
      companyId
    },
    include: [
      {
        model: ContactListItem,
        as: "contacts",
        attributes: [],
        required: false
      }
    ],
    attributes: [
      "id",
      "name",
      "savedFilter",
      [fn("count", col("contacts.id")), "contactsCount"]
    ],
    group: ["ContactList.id"],
    subQuery: false,
    order: [["name", "ASC"]]
  });

  return notes;
};

export default FindService;
