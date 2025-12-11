import Tag from "../../models/Tag";
import AppError from "../../errors/AppError";
import ContactTag from "../../models/ContactTag";
import SyncContactWalletsAndPersonalTagsService from "../ContactServices/SyncContactWalletsAndPersonalTagsService";

const DeleteService = async (id: string | number): Promise<void> => {
  const tag = await Tag.findOne({
    where: { id }
  });

  if (!tag) {
    throw new AppError("ERR_NO_TAG_FOUND", 404);
  }

  // Captura contatos que possuem esta tag antes de removê-la
  const existingContactTags = await ContactTag.findAll({
    where: {
      tagId: id
    },
    attributes: ["contactId"],
    raw: true
  });

  // Remove a tag de todos os contatos que a possuem
  await ContactTag.destroy({
    where: {
      tagId: id
    }
  });

  await tag.destroy();

  const uniqueContactIds = Array.from(
    new Set(
      (existingContactTags as any[])
        .map(ct => Number(ct.contactId))
        .filter(id => Number.isInteger(id))
    )
  );

  if (uniqueContactIds.length > 0) {
    for (const contactId of uniqueContactIds) {
      try {
        await SyncContactWalletsAndPersonalTagsService({
          companyId: tag.companyId,
          contactId,
          source: "tags"
        });
      } catch (err) {
        console.warn("[TagDeleteService] Falha ao sincronizar carteiras e tags pessoais", err);
      }
    }
  }
};

export default DeleteService;
