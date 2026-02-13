import { WASocket } from "@whiskeysockets/baileys";
import { getWbot } from "../../libs/wbot";
import logger from "../../utils/logger";

interface BaileysContactData {
    jid: string;
    exists: boolean;
    onWhatsApp?: any;
    storeContacts?: any;
    profilePicture?: string | null;
    businessProfile?: any;
    timestamp: string;
}

const GetBaileysContactDataService = async (
    whatsappId: number | string,
    number: string
): Promise<BaileysContactData> => {
    const wbot = getWbot(Number(whatsappId));
    const digits = number.replace(/\D/g, "");
    const jid = `${digits}@s.whatsapp.net`;

    logger.info({ jid, whatsappId }, "[GetBaileysContactData] Iniciando descoberta de campos");

    const [result] = await wbot.onWhatsApp(jid);

    const data: BaileysContactData = {
        jid,
        exists: !!result?.exists,
        onWhatsApp: result || null,
        timestamp: new Date().toISOString()
    };

    if (result?.exists) {
        // 1. Buscar no Store (Cache de contatos)
        // Nota: Em scripts isolados o store costuma estar vazio
        const store = (wbot as any).store;
        if (store && store.contacts) {
            data.storeContacts = store.contacts[jid] || store.contacts[result.jid] || null;
        }

        // 2. Buscar Foto de Perfil
        try {
            data.profilePicture = await wbot.profilePictureUrl(jid, "image");
        } catch (err) {
            data.profilePicture = null;
        }

        // 3. Buscar Perfil Business (inclui verificação de nome se disponível)
        try {
            if (typeof wbot.getBusinessProfile === "function") {
                const business = await wbot.getBusinessProfile(jid);
                data.businessProfile = business;

                // DIAGNÓSTICO: Logar JSON completo
                if (business) {
                    console.log("[DEBUG] Business Profile Bruto:", JSON.stringify(business, null, 2));
                    // Alguns perfis retornam o nome em campos como 'name', 'verified_name', 'brand' ou 'vname'
                    data.storeContacts = (business as any).verifiedName || (business as any).name || (business as any).brand || null;
                }
            }
        } catch (err) {
            data.businessProfile = null;
        }

        // 4. Se tiver LID, tentar buscar metadados por ele (Pode trazer o nome verificado)
        if (result?.lid) {
            try {
                const lidBusiness = await (wbot as any).getBusinessProfile?.(result.lid);
                if (lidBusiness) {
                    console.log("[DEBUG] Business Profile (via LID) Bruto:", JSON.stringify(lidBusiness, null, 2));
                    (data as any).businessProfileLid = lidBusiness;
                }
            } catch (err) { }
        }

        // 5. Buscar Status/About (Às vezes ajuda a identificar)
        try {
            const status = await wbot.fetchStatus(jid);
            if (status) {
                (data as any).status = status;
            }
        } catch (err) {
            // Ignorar erro de status
        }
    }

    return data;
};

export default GetBaileysContactDataService;
