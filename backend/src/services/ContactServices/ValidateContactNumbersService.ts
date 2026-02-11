import { WASocket } from "@whiskeysockets/baileys";
import Contact from "../../models/Contact";
import { getWbot } from "../../libs/wbot";
import logger from "../../utils/logger";
import { Op } from "sequelize";

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
    mode: "nine_digit" | "all";
    offset?: number;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Remove dígito 9 de número BR celular.
 * 55 + DDD(2) + 9 + 8dígitos = 13 dígitos → 55 + DDD(2) + 8dígitos = 12 dígitos
 */
const removeNineDigit = (number: string): string | null => {
    const digits = number.replace(/\D/g, "");

    // Deve começar com 55, ter 13 dígitos, e o 5º dígito deve ser 9
    if (digits.length !== 13 || !digits.startsWith("55")) return null;

    const ddd = digits.substring(2, 4);
    const ninthDigit = digits.charAt(4);
    const rest = digits.substring(5);

    if (ninthDigit !== "9") return null;

    // Validar que o primeiro dígito do subscriber começa com [6-9] (celular)
    if (!/^[6-9]/.test(rest)) return null;

    return `55${ddd}${rest}`;
};

/**
 * Verifica se um número é BR com potencial dígito 9 extra.
 */
const isBrazilianWithNine = (number: string): boolean => {
    const digits = number.replace(/\D/g, "");
    return digits.length === 13 && digits.startsWith("55") && digits.charAt(4) === "9";
};

/**
 * Verifica se um número é BR (começa com 55, tem 12 ou 13 dígitos).
 */
const isBrazilian = (number: string): boolean => {
    const digits = number.replace(/\D/g, "");
    return (digits.length === 12 || digits.length === 13) && digits.startsWith("55");
};

const ValidateContactNumbersService = async ({
    whatsappId,
    companyId,
    contactIds,
    mode,
    offset = 0
}: ValidateRequest): Promise<ValidateContactNumbersResult> => {
    const wbot = getWbot(whatsappId);

    // Construir WHERE com filtros de número BR diretamente no SQL
    const whereClause: any = {
        companyId,
        isGroup: false,
        number: { [Op.not]: null, [Op.ne]: "" },
        // Excluir contatos já validados
        isWhatsappValid: { [Op.is]: null as any }
    };

    if (contactIds && contactIds.length > 0) {
        whereClause.id = { [Op.in]: contactIds };
    }

    // Buscar contatos BR aplicando filtro de dígitos
    if (mode === "nine_digit") {
        // 55 + DDD(2) + 9 + 8dígitos = 13 dígitos, começa com 55, 5º dígito é 9
        whereClause.number = {
            ...whereClause.number,
            [Op.regexp]: '^55[0-9]{2}9[6-9][0-9]{7}$'
        };
    } else {
        // Qualquer BR: começa com 55, 12 ou 13 dígitos
        whereClause.number = {
            ...whereClause.number,
            [Op.regexp]: '^55[0-9]{10,11}$'
        };
    }

    // Contar total de pendentes (para o frontend saber quantos faltam)
    const totalPending = await Contact.count({ where: whereClause });

    const contacts = await Contact.findAll({
        where: whereClause,
        order: [["name", "ASC"]],
        limit: BATCH_SIZE,
        offset
    });

    const results: ValidationResult[] = [];
    let validated = 0;
    let corrected = 0;
    let invalid = 0;
    let errors = 0;

    for (const contact of contacts) {
        try {
            const digits = contact.number.replace(/\D/g, "");
            const jid = `${digits}@s.whatsapp.net`;

            // Passo 1: Validar número original
            const [result] = await (wbot as WASocket).onWhatsApp(jid);

            if (result?.exists) {
                // Número válido — atualizar JID correto se necessário
                const correctJid = result.jid;
                const correctNumber = correctJid.split("@")[0];

                if (correctNumber !== digits) {
                    // WhatsApp retornou um JID diferente (corrigido pelo próprio WA)
                    await contact.update({
                        number: correctNumber,
                        remoteJid: correctJid,
                        canonicalNumber: correctNumber,
                        isWhatsappValid: true
                    });
                    results.push({
                        contactId: contact.id,
                        name: contact.name,
                        originalNumber: digits,
                        status: "corrected",
                        newNumber: correctNumber,
                        newJid: correctJid
                    });
                    corrected++;
                } else {
                    if (!contact.isWhatsappValid) {
                        await contact.update({ isWhatsappValid: true });
                    }
                    results.push({
                        contactId: contact.id,
                        name: contact.name,
                        originalNumber: digits,
                        status: "valid"
                    });
                    validated++;
                }
            } else {
                // Passo 2: Se inválido e tem dígito 9, tentar sem
                const numberWithout9 = removeNineDigit(digits);

                if (numberWithout9) {
                    await sleep(DELAY_MS);
                    const jidWithout9 = `${numberWithout9}@s.whatsapp.net`;
                    const [retryResult] = await (wbot as WASocket).onWhatsApp(jidWithout9);

                    if (retryResult?.exists) {
                        const correctJid = retryResult.jid;
                        const correctNumber = correctJid.split("@")[0];

                        await contact.update({
                            number: correctNumber,
                            remoteJid: correctJid,
                            canonicalNumber: correctNumber,
                            isWhatsappValid: true
                        });

                        results.push({
                            contactId: contact.id,
                            name: contact.name,
                            originalNumber: digits,
                            status: "corrected",
                            newNumber: correctNumber,
                            newJid: correctJid
                        });
                        corrected++;
                    } else {
                        await contact.update({ isWhatsappValid: false });
                        results.push({
                            contactId: contact.id,
                            name: contact.name,
                            originalNumber: digits,
                            status: "invalid"
                        });
                        invalid++;
                    }
                } else {
                    await contact.update({ isWhatsappValid: false });
                    results.push({
                        contactId: contact.id,
                        name: contact.name,
                        originalNumber: digits,
                        status: "invalid"
                    });
                    invalid++;
                }
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
            try {
                await contact.update({ isWhatsappValid: false });
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

    return {
        total: contacts.length,
        totalPending,
        validated,
        corrected,
        invalid,
        errors,
        results
    };
};

export default ValidateContactNumbersService;
