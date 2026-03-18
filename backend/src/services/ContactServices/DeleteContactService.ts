import Contact from "../../models/Contact";
import AppError from "../../errors/AppError";
import fs from "fs";
import path from "path";
import GetUserPersonalTagContactIds from "../../helpers/GetUserPersonalTagContactIds";

interface Request {
  id: string;
  companyId: number;
  userId?: number;
}

const DeleteContactService = async ({ id, companyId, userId }: Request): Promise<void> => {
  const contact = await Contact.findOne({
    where: { id }
  });

  if (!contact) {
    throw new AppError("ERR_NO_CONTACT_FOUND", 404);
  }

  if (contact.companyId !== companyId) {
    throw new AppError("Não é possível excluir registro de outra empresa", 403);
  }

  // Restrição de carteira: se usuário é restrito, só permite excluir contato dentro da carteira
  if (userId) {
    const walletResult = await GetUserPersonalTagContactIds(userId, companyId);
    if (walletResult.hasWalletRestriction) {
      const allowedContactIds = walletResult.contactIds;
      if (!allowedContactIds.includes(Number(contact.id))) {
        throw new AppError("FORBIDDEN_CONTACT_ACCESS", 403);
      }
    }
  }

  // Remoção em cascata dos arquivos do contato
  try {
    const publicFolder = path.resolve(__dirname, "..", "..", "..", "public");
    const rel = path.posix.join(`company${contact.companyId}`, "contacts", String((contact as any).uuid || ""));
    const target = path.resolve(publicFolder, rel);

    // Segurança: garantir que o caminho alvo está dentro de public/
    if (target.startsWith(publicFolder) && fs.existsSync(target)) {
      // fs.rmSync disponível no Node 14+
      fs.rmSync(target, { recursive: true, force: true });
    }
  } catch (e) {
    // Não bloquear exclusão do contato por erro de I/O
    console.error("[DeleteContactService] Erro ao remover arquivos do contato:", e);
  }

  await contact.destroy();
};

export default DeleteContactService;
