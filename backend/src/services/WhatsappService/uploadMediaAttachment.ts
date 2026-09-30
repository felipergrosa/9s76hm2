import { Request, Response } from "express";
import { isNil, head } from "lodash";
import AppError from "../../errors/AppError";
import Whatsapp from "../../models/Whatsapp";
import path from "path";
import fs from "fs";

export const mediaUpload = async (req: Request, res: Response): Promise<Response> => {
    const { whatsappId } = req.params;
    const { companyId } = req.user;
    const files = req.files as Express.Multer.File[];
    const file = head(files);

    try {

      // Escopo por empresa: impede anexar mídia em conexão de outro tenant
      const whatsapp = await Whatsapp.findOne({
        where: { id: whatsappId, companyId }
      });

      if (!whatsapp) {
        throw new AppError("ERR_NO_WAPP_FOUND", 404);
      }

      whatsapp.greetingMediaAttachment = file.filename;

      await whatsapp.save();

      return res.status(200).json({ mensagem: "Arquivo adicionado!" });

    } catch (err: any) {
      throw new AppError(err.message);
    }
  };

export const deleteMedia = async (
    req: Request,
    res: Response
  ): Promise<Response> => {
    const { whatsappId } = req.params;
    const { companyId } = req.user;

    try {
      const whatsapp = await Whatsapp.findOne({
        where: { id: whatsappId, companyId }
      });

      if (!whatsapp) {
        throw new AppError("ERR_NO_WAPP_FOUND", 404);
      }

      if (whatsapp.greetingMediaAttachment) {
        const companyDir = path.resolve("public", `company${companyId}`);
        const filePath = path.resolve(companyDir, whatsapp.greetingMediaAttachment);

        // Só remove se o caminho resolvido estiver dentro da pasta da empresa
        if (filePath.startsWith(companyDir + path.sep)) {
          const fileExists = fs.existsSync(filePath);
          if (fileExists) {
            fs.unlinkSync(filePath);
          }
        }
      }

      whatsapp.greetingMediaAttachment = null
      await whatsapp.save();
      return res.send({ message: "Arquivo excluído" });
    } catch (err: any) {
      throw new AppError(err.message);
    }
};
