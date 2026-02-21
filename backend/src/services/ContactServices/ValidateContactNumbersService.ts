import { WASocket } from "@whiskeysockets/baileys";
import Contact from "../../models/Contact";
import { getWbot } from "../../libs/wbot";
import logger from "../../utils/logger";
import { Op, literal } from "sequelize";
import { safeNormalizePhoneNumber } from "../../utils/phone";

const BATCH_SIZE = 50;
const DELAY_MS = 500;

export interface ValidationResult {
    contactId: number;
    name: string;
    originalNumber: string;
    status: "valid" | "corrected" | "invalid" | "error";
    newNumber?: string;
    newJid?: string;
    errorMessage?: string;
}

export interface ValidateContactNumbersResult {
    total: number;
    totalPending: number;
    validated: number;
    corrected: number;
    invalid: number;
    errors: number;
    results: ValidationResult[];
}

interface ValidateRequest {
    whatsappId: number;
    companyId: number;
    contactIds?: number[];
    mode: "nine_digit" | "all" | "no_name";
    offset?: number;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Busca o nome real do contato no WhatsApp e atualiza se for diferente
 */
const shouldOverwriteName = (currentName: string | null | undefined, digits: string): boolean => {
    const normalized = (currentName || "").trim();
    if (!normalized) return true;

    const currentDigits = normalized.replace(/\D/g, "");
    return currentDigits === digits;
};

const getWhatsappDisplayName = (jid: string, result: any, wbot: any): string | null => {
    const candidates: string[] = [];

    const pushCandidate = (value?: string) => {
        if (value && typeof value === "string") {
            const trimmed = value.trim();
            if (trimmed) {
                candidates.push(trimmed);
            }
        }
    };

    if (result) {
        pushCandidate(result.notify);
        pushCandidate(result.pushName);
        pushCandidate(result.name);
        pushCandidate(result.verifiedName);
        pushCandidate(result.businessName);
    }

    const storeContacts = wbot?.store?.contacts;
    if (storeContacts) {
        const storeEntry = storeContacts[jid] || (result?.jid ? storeContacts[result.jid] : null);
        if (storeEntry) {
            pushCandidate(storeEntry.name);
            pushCandidate(storeEntry.notify);
            pushCandidate(storeEntry.pushname);
            pushCandidate(storeEntry.verifiedName);
        }
    }

    if (typeof wbot?.contacts?.get === "function") {
        const byJid = wbot.contacts.get(jid) || (result?.jid ? wbot.contacts.get(result.jid) : null);
        if (byJid) {
            pushCandidate(byJid.name);
            pushCandidate(byJid.notify);
            pushCandidate(byJid.pushname);
            pushCandidate(byJid.verifiedName);
        }
    }

    return candidates.find(Boolean) || null;
};

const fetchAndUpdateContactName = async (contact: Contact, wbot: any): Promise<boolean> => {
    try {
        const digits = contact.number.replace(/\D/g, "");
        const jid = `${digits}@s.whatsapp.net`;

        // Buscar informações do contato no WhatsApp
        const [result] = await wbot.onWhatsApp(jid);

        if (result?.exists) {
            // Tentar obter o perfil do contato
            try {
                const profileInfo = await wbot.profilePictureUrl(jid, "preview").catch(() => null);

                // Buscar informações do contato (pushName/notify) priorizando dados retornados pela API
                let whatsappName = getWhatsappDisplayName(jid, result, wbot);

                // Sanitização: Rejeitar hashes de sistema (ex: strings com muitos underscores ou extensões de imagem)
                const isHash = whatsappName && (
                    (whatsappName.match(/_/g) || []).length > 3 ||
                    (whatsappName.match(/-/g) || []).length > 4 ||
                    /\.(jpe?g|png|gif|webp|bmp)$/i.test(whatsappName) ||
                    whatsappName.length > 50 && whatsappName.includes("_")
                );

                if (isHash) {
                    logger.warn({ whatsappName, jid }, "[ValidateContactNumbers] Nome ignorado por parecer um hash/temp");
                    whatsappName = null;
                }

                // Se encontrou um nome diferente e não é igual ao número, atualizar
                if (whatsappName &&
                    whatsappName.trim() !== "" &&
                    shouldOverwriteName(contact.name, digits) &&
                    whatsappName.replace(/\D/g, "") !== digits) {

                    await contact.update({
                        name: whatsappName.trim(),
                        remoteJid: result.jid,
                        isWhatsappValid: true
                    });

                    logger.info({
                        contactId: contact.id,
                        oldName: contact.name,
                        newName: whatsappName.trim(),
                        number: digits
                    }, "[ValidateContactNumbers] Nome atualizado via WhatsApp");

                    return true;
                }

                // Se não encontrou nome diferente, apenas marcar como válido
                if (!contact.isWhatsappValid) {
                    await contact.update({
                        remoteJid: result.jid,
                        isWhatsappValid: true
                    });
                }

                return false;
            } catch (profileError: any) {
                logger.warn({
                    contactId: contact.id,
                    error: profileError?.message
                }, "[ValidateContactNumbers] Erro ao buscar perfil do contato");

                // Apenas marcar como válido se conseguiu validar o número
                if (!contact.isWhatsappValid) {
                    await contact.update({
                        remoteJid: result.jid,
                        isWhatsappValid: true
                    });
                }
                return false;
            }
        }

        return false;
    } catch (error: any) {
        logger.warn({
            contactId: contact.id,
            error: error?.message
        }, "[ValidateContactNumbers] Erro ao buscar nome do contato");
        return false;
    }
};

const ValidateContactNumbersService = async ({
    whatsappId,
    companyId,
    contactIds,
    mode,
    offset = 0
}: ValidateRequest): Promise<ValidateContactNumbersResult> => {
    const wbot = getWbot(whatsappId);

    // Construir WHERE 
    const whereClause: any = {
        companyId,
        isGroup: false,
        number: { [Op.not]: null, [Op.ne]: "" },
        // Excluir contatos já validados (exceto no modo no_name)
        isWhatsappValid: { [Op.is]: null as any }
    };

    if (contactIds && contactIds.length > 0) {
        whereClause.id = { [Op.in]: contactIds };
    }

    // No modo no_name queremos atualizar dados mesmo que o contato já tenha sido validado antes
    if (mode === "no_name") {
        delete whereClause.isWhatsappValid;
        // Contatos onde o nome é igual ao número ou nulo/vazio
        if (process.env.DB_DIALECT === 'postgres') {
            whereClause[Op.or] = [
                { name: { [Op.eq]: null } },
                { name: { [Op.eq]: '' } },
                literal('name = number')
            ];
        } else {
            whereClause[Op.or] = [
                { name: { [Op.eq]: null } },
                { name: { [Op.eq]: '' } }
            ];
        }
    }

    // Contar total de pendentes (para o frontend saber quantos faltam)
    const totalPending = await Contact.count({ where: whereClause });

    logger.info({
        mode,
        companyId,
        contactIds: contactIds?.length,
        totalPending,
        whereClause: JSON.stringify(whereClause)
    }, "[ValidateContactNumbers] Total de contatos pendentes");

    const contacts = await Contact.findAll({
        where: whereClause,
        order: [["name", "ASC"]],
        limit: BATCH_SIZE,
        offset
    });

    // Se não for PostgreSQL e o modo for "no_name", filtrar em memória
    let filteredContacts = contacts;
    if (mode === "no_name" && process.env.DB_DIALECT !== 'postgres') {
        filteredContacts = contacts.filter(contact => {
            const name = (contact.name || '').trim();
            const number = (contact.number || '').trim();
            return name === '' || name === null || name === number;
        });
    }

    const results: ValidationResult[] = [];
    let validated = 0;
    let corrected = 0;
    let invalid = 0;
    let errors = 0;

    for (const contact of filteredContacts) {
        try {
            const { canonical } = safeNormalizePhoneNumber(contact.number);

            if (!canonical) {
                await contact.update({ isWhatsappValid: false });
                results.push({
                    contactId: contact.id,
                    name: contact.name,
                    originalNumber: contact.number,
                    status: "invalid"
                });
                invalid++;
                continue;
            }

            const jid = `${canonical}@s.whatsapp.net`;
            const [result] = await (wbot as WASocket).onWhatsApp(jid);

            if (result?.exists) {
                // Número válido — tentar atualizar nome e avatar também
                const nameUpdated = await fetchAndUpdateContactName(contact, wbot);

                // Pegar o JID correto (pode ter mudado de 12 para 13 dígitos ou vice-versa no WA)
                const correctJid = result.jid;
                const correctNumber = correctJid.split("@")[0];

                const updates: any = {
                    number: correctNumber,
                    remoteJid: correctJid,
                    canonicalNumber: correctNumber,
                    isWhatsappValid: true
                };

                await contact.update(updates);

                results.push({
                    contactId: contact.id,
                    name: contact.name,
                    originalNumber: contact.number,
                    status: nameUpdated || correctNumber !== canonical ? "corrected" : "valid",
                    newNumber: correctNumber,
                    newJid: correctJid
                });

                if (nameUpdated || correctNumber !== canonical) {
                    corrected++;
                } else {
                    validated++;
                }
            } else {
                // Inválido no WhatsApp
                await contact.update({ isWhatsappValid: false });
                results.push({
                    contactId: contact.id,
                    name: contact.name,
                    originalNumber: contact.number,
                    status: "invalid"
                });
                invalid++;
            }
        } catch (err: any) {
            const message = err?.message || "";
            let userMessage = message;

            if (message.includes("Validation error") || message.includes("SequelizeUniqueConstraintError")) {
                userMessage = "Número já pertence a outro contato (duplicado)";
            }

            logger.warn({
                contactId: contact.id,
                err: message
            }, "[ValidateContactNumbers] Erro ao validar contato");

            // Tenta marcar como inválido para não processar novamente e evitar loop infinito
            // Tenta marcar como inválido para não processar novamente e evitar loop infinito.
            // Usa update direto no Model para evitar validações de instância (dirty state) que causaram o erro original.
            try {
                await Contact.update(
                    { isWhatsappValid: false },
                    { where: { id: contact.id } }
                );
            } catch (e) {
                logger.error({ contactId: contact.id, err: e }, "Falha ao marcar contato com erro como inválido");
            }

            results.push({
                contactId: contact.id,
                name: contact.name,
                originalNumber: contact.number,
                status: "error",
                errorMessage: userMessage
            });
            errors++;
        }

        // Delay entre chamadas para evitar rate limit
        await sleep(DELAY_MS);
    }

    logger.info({
        mode,
        companyId,
        totalProcessed: filteredContacts.length,
        totalPending,
        validated,
        corrected,
        invalid,
        errors
    }, "[ValidateContactNumbers] Processamento concluído");

    return {
        total: filteredContacts.length,
        totalPending,
        validated,
        corrected,
        invalid,
        errors,
        results
    };
};

export default ValidateContactNumbersService;
