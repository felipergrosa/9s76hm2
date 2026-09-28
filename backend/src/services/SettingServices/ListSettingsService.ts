import Setting from "../../models/Setting";
import { withCache } from "../../utils/serviceCache";

interface Request {
  companyId: number;
}

const ListSettingsService = async ({
  companyId
}: Request): Promise<Setting[] | undefined> => {
  // Cache curto (60s) por empresa; invalidado em UpdateSettingService/UpdateOneSettingService
  const settings = await withCache(
    `settings:${companyId}`,
    async () => {
      // await dentro do async garante Promise nativa (findAll retorna Bluebird)
      const list = await Setting.findAll({
        where: {
          companyId
        }
      });
      return list;
    },
    60 * 1000
  );

  return settings;
};

export default ListSettingsService;
