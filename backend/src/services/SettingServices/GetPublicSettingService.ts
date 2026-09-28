import Setting from "../../models/Setting";
import { withCache } from "../../utils/serviceCache";

interface Request {
  key: string;
}

const publicSettingsKeys = [
  "allowSignup",
  "primaryColorLight",
  "primaryColorDark",
  "appLogoLight",
  "appLogoDark",
  "appLogoFavicon",
  "appName",
  "viewMode"
]

const GetPublicSettingService = async ({
  key
}: Request): Promise<string | undefined> => {
  if (!publicSettingsKeys.includes(key)) {
    return null;
  }

  // Cache curto (60s) por chave pública; invalidado em UpdateSettingService/UpdateOneSettingService
  const value = await withCache(
    `publicSetting:${key}`,
    async () => {
      const setting = await Setting.findOne({
        where: {
          companyId: 1,
          key
        }
      });

      return setting?.value;
    },
    60 * 1000
  );

  return value;
};

export default GetPublicSettingService;
