import Tag from "../../models/Tag";
import AppError from "../../errors/AppError";
import ContactTag from "../../models/ContactTag";

const DeleteService = async (id: string | number): Promise<void> => {
  const tag = await Tag.findOne({
    where: { id }
  });

  if (!tag) {
    throw new AppError("ERR_NO_TAG_FOUND", 404);
  }

  // Remove a tag de todos os contatos que a possuem
  await ContactTag.destroy({
    where: {
      tagId: id
    }
  });

  await tag.destroy();
};

export default DeleteService;
