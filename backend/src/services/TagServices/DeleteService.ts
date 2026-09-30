import Tag from "../../models/Tag";
import AppError from "../../errors/AppError";
import ContactTag from "../../models/ContactTag";

const DeleteService = async (id: string | number, companyId: number): Promise<void> => {
  // Filtra por companyId para impedir exclusão cross-tenant
  const tag = await Tag.findOne({
    where: { id, companyId }
  });

  if (!tag) {
    throw new AppError("ERR_NO_TAG_FOUND", 404);
  }

  // Remove a tag de todos os contatos que a possuem (da mesma empresa)
  await ContactTag.destroy({
    where: {
      tagId: id,
      companyId
    }
  });

  await tag.destroy();
};

export default DeleteService;
