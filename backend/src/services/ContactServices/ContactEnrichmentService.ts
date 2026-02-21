import Contact from "../../models/Contact";
import { getWbot } from "../../libs/wbot";
import logger from "../../utils/logger";
import { jidNormalizedUser } from "@whiskeysockets/baileys";

interface EnrichmentData {
    notify?: string;
    verifiedName?: string;
    about?: string;
    pushName?: string;
    aboutTag?: string;
    profilePicUrlHD?: string;
    isBusiness?: boolean;
    businessCategory?: string;
    businessDescription?: string;
    businessAddress?: string;
    businessEmail?: string;
    businessWebsite?: string[];
    businessHours?: any;
    businessVerifiedLevel?: string;
    businessCatalog?: any;
    isBlocked?: boolean;
    isMyContact?: boolean;
    lastSeen?: number;
    isOnline?: boolean;
    privacySettings?: any;
    rawData?: any;
}

class ContactEnrichmentService {
    /**
     * Enriquece um único contato com dados profundos do Baileys
     */
    public async enrichContact(
        contactId: number,
        whatsappId: number
    ): Promise<Contact> {
        const contact = await Contact.findByPk(contactId);
        if (!contact) {
            throw new Error("ERR_CONTACT_NOT_FOUND");
        }

        const wbot = getWbot(whatsappId);
        const jid = contact.isGroup ? contact.number : `${contact.number}@s.whatsapp.net`;
        const normalizedJid = jidNormalizedUser(jid);

        logger.info({ contactId, normalizedJid }, "[ContactEnrichment] Iniciando enriquecimento");

        const data: EnrichmentData = {
            rawData: {}
        };

        try {
            // 1. Verificar existência e obter LID/Metadata básico
            if (!contact.isGroup) {
                const [onWhatsAppResult] = await wbot.onWhatsApp(normalizedJid);
                if (onWhatsAppResult) {
                    data.rawData.onWhatsApp = onWhatsAppResult;
                    if ((onWhatsAppResult as any).lid && !contact.lidJid) {
                        await contact.update({ lidJid: (onWhatsAppResult as any).lid });
                    }
                }
            }

            // 2. Foto de Perfil HD
            try {
                const profilePicUrlHD = await wbot.profilePictureUrl(normalizedJid, "preview");
                data.profilePicUrlHD = profilePicUrlHD;
            } catch (err) {
                logger.debug({ jid: normalizedJid }, "[ContactEnrichment] Falha ao obter foto HD");
            }

            // 3. Status / About
            try {
                const status = await wbot.fetchStatus(normalizedJid) as any;
                if (status) {
                    data.about = status.status;
                    data.aboutTag = status.setAt ? new Date(Number(status.setAt) * 1000).toISOString() : undefined;
                }
            } catch (err) {
                logger.debug({ jid: normalizedJid }, "[ContactEnrichment] Falha ao obter Status/About");
            }

            // 4. Dados Business
            try {
                if (typeof wbot.getBusinessProfile === "function") {
                    const businessProfile = await wbot.getBusinessProfile(normalizedJid);
                    if (businessProfile) {
                        data.isBusiness = true;
                        data.businessCategory = businessProfile.category;
                        data.businessDescription = businessProfile.description;
                        data.businessAddress = businessProfile.address;
                        data.businessEmail = businessProfile.email;
                        data.businessWebsite = businessProfile.website;
                        data.businessHours = businessProfile.business_hours;
                        data.businessVerifiedLevel = (businessProfile as any).verified_level;

                        // Tenta capturar nome verificado, priorizando-o
                        if ((businessProfile as any).verifiedName && (!data.verifiedName || data.verifiedName !== (businessProfile as any).verifiedName)) {
                            data.verifiedName = (businessProfile as any).verifiedName;
                        }
                    }
                }
            } catch (err) {
                logger.debug({ jid: normalizedJid }, "[ContactEnrichment] Falha ao obter Business Profile");
            }

            // 5. Dados do Store (Nomes e metadados salvos no aparelho)
            try {
                const store = (wbot as any).store;
                const storeContact = store?.contacts?.[normalizedJid];
                if (storeContact) {
                    data.notify = storeContact.notify;
                    data.pushName = (storeContact as any).pushName;
                    data.verifiedName = data.verifiedName || storeContact.verifiedName;
                    data.isMyContact = true;
                    data.rawData.storeContact = storeContact;
                }
            } catch (err) {
                logger.debug({ jid: normalizedJid }, "[ContactEnrichment] Falha ao obter dados do Store");
            }

            // 6. Privacidade
            try {
                const privacy = await wbot.fetchPrivacySettings();
                data.privacySettings = privacy;
            } catch (err) {
                logger.debug({ jid: normalizedJid }, "[ContactEnrichment] Falha ao obter Privacidade");
            }

            // Atualizar o contato com os novos campos
            await contact.update({
                ...data,
                lastDiscoveryAt: new Date(),
                rawData: { ...contact.rawData, ...data.rawData }
            });

            return contact;
        } catch (err: any) {
            logger.error({ err: err.message, contactId }, "[ContactEnrichment] Erro fatal no enriquecimento");
            throw err;
        }
    }

    /**
     * Enriquece todos os contatos de uma empresa
     */
    public async enrichAllContacts(companyId: number, whatsappId: number): Promise<void> {
        const contacts = await Contact.findAll({
            where: { companyId, isGroup: false }
        });

        logger.info({ companyId, count: contacts.length }, "[ContactEnrichment] Iniciando enriquecimento em massa");

        for (const contact of contacts) {
            try {
                await this.enrichContact(contact.id, whatsappId);
                // Delay para evitar banimento por excesso de requisições de metadados
                await new Promise(resolve => setTimeout(resolve, 1500));
            } catch (err: any) {
                logger.warn({ contactId: contact.id, err: err.message }, "[ContactEnrichment] Falha ao enriquecer contato (massa)");
            }
        }
    }
}

export default new ContactEnrichmentService();
