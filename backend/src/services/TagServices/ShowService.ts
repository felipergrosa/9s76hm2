import Tag from "../../models/Tag";
import AppError from "../../errors/AppError";

const TagService = async (id: string | number, companyId: number): Promise<Tag> => {
  // Filtra por companyId para impedir acesso cross-tenant
  const tag = await Tag.findOne({
    where: { id, companyId },
    include: [ "contacts"]
  });

  if (!tag) {
    throw new AppError("ERR_NO_TAG_FOUND", 404);
  }

  return tag;
};

export default TagService;
