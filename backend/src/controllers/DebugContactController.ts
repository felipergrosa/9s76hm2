import { Request, Response } from "express";
import Contact from "../models/Contact";
import { Op } from "sequelize";
import removeAccents from "remove-accents";
import { fn, col, where, literal } from "sequelize";

/**
 * Controller para debug de busca de contatos
 */
export const debugContactSearch = async (req: Request, res: Response): Promise<Response> => {
    const { searchParam, companyId } = req.query;

    try {
        const trimmedSearchParam = String(searchParam || "").trim();
        const sanitizedSearchParam = removeAccents(trimmedSearchParam.toLocaleLowerCase());
        
        // Verificar se é um número puro
        const isPureNumber = /^\d+$/.test(trimmedSearchParam);

        // Montar condição de busca igual ao ListContactsService
        const whereCondition: any = {
            companyId,
            [Op.or]: [
                // Para busca por nome, usar unaccent apenas se não for número puro
                ...(isPureNumber ? [] : [{
                    name: where(
                        fn("LOWER", fn("unaccent", col("Contact.name"))),
                        "LIKE",
                        `%${sanitizedSearchParam}%`
                    )
                }]),
                ...(isPureNumber ? [] : [{
                    contactName: where(
                        fn("LOWER", fn("unaccent", col("Contact.contactName"))),
                        "LIKE",
                        `%${sanitizedSearchParam}%`
                    )
                }]),
                // Para números, buscar diretamente sem tratamento
                { number: { [Op.like]: `%${trimmedSearchParam}%` } },
                ...(isPureNumber ? [{
                    name: where(
                        fn("LOWER", col("Contact.name")),
                        "LIKE",
                        `%${trimmedSearchParam.toLowerCase()}%`
                    )
                }] : []),
                ...(isPureNumber ? [{
                    contactName: where(
                        fn("LOWER", col("Contact.contactName")),
                        "LIKE",
                        `%${trimmedSearchParam.toLowerCase()}%`
                    )
                }] : []),
                {
                    email: where(
                        fn("LOWER", col("Contact.email")),
                        "LIKE",
                        `%${sanitizedSearchParam.toLowerCase()}%`
                    )
                },
                // Condição especial para encontrar contatos onde o nome é um número
                ...(isPureNumber ? [
                    literal(`REGEXP_REPLACE("Contact"."name", '[^0-9]', '') = "Contact"."name" AND LOWER("Contact"."name") LIKE '%${trimmedSearchParam.toLowerCase()}%'`)
                ] : [])
            ]
        };

        // Buscar contatos
        const contacts = await Contact.findAll({
            where: whereCondition,
            attributes: ["id", "name", "number", "email", "contactName"],
            limit: 20,
            order: [["name", "ASC"]]
        });

        // Buscar alguns contatos com nome numérico para teste
        const numericNameContacts = await Contact.findAll({
            where: {
                companyId,
                name: { [Op.ne]: null },
                [Op.and]: [
                    literal(`REGEXP_REPLACE("Contact"."name", '[^0-9]', '') = "Contact"."name"`)
                ]
            },
            attributes: ["id", "name", "number", "email", "contactName"],
            limit: 10,
            order: [["name", "ASC"]]
        });

        return res.json({
            searchParam: trimmedSearchParam,
            isPureNumber,
            sanitizedSearchParam,
            foundContacts: contacts.length,
            contacts: contacts.map(c => ({
                id: c.id,
                name: c.name,
                number: c.number,
                email: c.email,
                contactName: c.contactName
            })),
            numericNameContacts: numericNameContacts.length,
            numericNameExamples: numericNameContacts.map(c => ({
                id: c.id,
                name: c.name,
                number: c.number,
                email: c.email,
                contactName: c.contactName
            }))
        });

    } catch (error: any) {
        console.error("[DebugContactSearch] Erro:", error);
        return res.status(500).json({ error: error?.message || "Erro interno" });
    }
};
