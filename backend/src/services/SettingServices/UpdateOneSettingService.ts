import AppError from "../../errors/AppError";
import Setting from "../../models/Setting";
import { serviceCache } from "../../utils/serviceCache";

interface Request {
    key: string;
    value: string;
    // Quando informado, restringe o findOrCreate à empresa (rotas autenticadas).
    // Chamadas internas legadas sem companyId mantêm o escopo global anterior.
    companyId?: number;
}

const UpdateOneSettingService = async ({
    key,
    value,
    companyId
}: Request): Promise<Setting | undefined> => {
    const where: any = { key };
    if (companyId !== undefined) {
        where.companyId = companyId;
    }

    const [setting] = await Setting.findOrCreate({
        where,
        defaults: {
            key,
            value,
            ...(companyId !== undefined ? { companyId } : {})
        }
    });

    if (!setting) {
        throw new AppError("ERR_NO_SETTING_FOUND", 404);
    }

    await setting.update({ value });

    // Invalida caches de settings
    if (companyId !== undefined) {
        serviceCache.invalidate(`settings:${companyId}`);
    } else {
        // Sem companyId, limpa todas as listagens por empresa
        serviceCache.invalidatePattern(/^settings:/);
    }
    serviceCache.invalidate(`publicSetting:${key}`);

    return setting;
};

export default UpdateOneSettingService;
