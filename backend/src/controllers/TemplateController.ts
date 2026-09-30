import { Request, Response } from "express";
import GetTemplateDefinition from "../services/MetaServices/GetTemplateDefinition";
import AppError from "../errors/AppError";
import Whatsapp from "../models/Whatsapp";

export const getTemplateDefinition = async (
    req: Request,
    res: Response
): Promise<Response> => {
    try {
        const { whatsappId, templateName } = req.params;
        const { language = "pt_BR" } = req.query;
        const { companyId } = req.user;

        if (!whatsappId || !templateName) {
            throw new AppError("whatsappId e templateName são obrigatórios", 400);
        }

        // Escopo por empresa: a definição do template só pode ser lida
        // via conexão que pertence ao tenant do usuário.
        const whatsapp = await Whatsapp.findOne({
            where: { id: whatsappId, companyId },
            attributes: ["id"]
        });
        if (!whatsapp) {
            throw new AppError("ERR_NO_WAPP_FOUND", 404);
        }

        const definition = await GetTemplateDefinition(
            Number(whatsappId),
            templateName,
            language as string
        );

        return res.json(definition);
    } catch (err: any) {
        if (err instanceof AppError) {
            return res.status(err.statusCode).json({ error: err.message });
        }
        return res.status(500).json({ error: err.message || "Erro interno do servidor" });
    }
};
