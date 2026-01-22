import { FindOptions } from "sequelize/types";
import Queue from "../../models/Queue";
import Whatsapp from "../../models/Whatsapp";
import Prompt from "../../models/Prompt";
import { getCachedWhatsapps } from "../../helpers/queryCache";

interface Request {
  companyId: number;
  session?: number | string;
}

const ListWhatsAppsService = async ({
  session,
  companyId
}: Request): Promise<Whatsapp[]> => {
  // Usar cache para reduzir queries repetitivas
  const whatsapps = await getCachedWhatsapps(companyId, async () => {
    const options: FindOptions = {
      where: {
        companyId
      },
      include: [
        {
          model: Queue,
          as: "queues",
          attributes: ["id", "name", "color", "greetingMessage"]
        },
        {
          model: Prompt,
          as: "prompt",
        }
      ]
    };

    if (session !== undefined && session == 0) {
      options.attributes = { exclude: ["session"] };
    }

    return Whatsapp.findAll(options);
  });

  return whatsapps;
};



export default ListWhatsAppsService;

