import { FindOptions } from "sequelize/types";
import Queue from "../../models/Queue";
import Whatsapp from "../../models/Whatsapp";

interface Request {
  session?: number | string;
  companyId?: number;
}

const ListAllWhatsAppsService = async ({
  session,
  companyId,
}: Request): Promise<Whatsapp[]> => {
  const options: FindOptions = {
    include: [
      {
        model: Queue,
        as: "queues",
        attributes: ["id", "name", "color", "greetingMessage"]
      }
    ]
  };

  // Sem companyId (super admin) lista todas; com companyId restringe à empresa.
  if (companyId !== undefined) {
    options.where = { companyId };
  }

  if (session !== undefined && session == 0) {
    options.attributes = { exclude: ["session"] };
  }

  const whatsapps = await Whatsapp.findAll(options);

  return whatsapps;
};

export default ListAllWhatsAppsService;
