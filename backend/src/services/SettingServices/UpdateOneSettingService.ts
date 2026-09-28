import AppError from "../../errors/AppError";
import Setting from "../../models/Setting";
import { serviceCache } from "../../utils/serviceCache";

interface Request {
    key: string;
    value: string;
}

const UpdateOneSettingService = async ({
    key,
    value
}: Request): Promise<Setting | undefined> => {
    const [setting] = await Setting.findOrCreate({
        where: {
            key
        },
        defaults: {
            key,
            value
        }
    });

    if (!setting) {
        throw new AppError("ERR_NO_SETTING_FOUND", 404);
    }

    await setting.update({ value });

    // Invalida caches de settings: este service não recebe companyId,
    // então limpa todas as listagens por empresa + a chave pública
    serviceCache.invalidatePattern(/^settings:/);
    serviceCache.invalidate(`publicSetting:${key}`);

    return setting;
};

export default UpdateOneSettingService;