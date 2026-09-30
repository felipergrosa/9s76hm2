import Setting from "../../models/Setting";

interface Request {
    key: string;
    // Quando informado, restringe a busca à empresa (rotas autenticadas).
    // Chamadas internas legadas sem companyId mantêm o escopo global anterior.
    companyId?: number;
}

const GetSettingService = async ({
    key,
    companyId
}: Request): Promise<any | undefined> => {

    const where: any = { key };
    if (companyId !== undefined) {
        where.companyId = companyId;
    }

    const setting = await Setting.findOne({
        where
    });
    if (setting === null) {
        return "enabled"
    }

    return setting;
};

export default GetSettingService;
