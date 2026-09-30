import * as Yup from "yup";

import AppError from "../../errors/AppError";
import Tag from "../../models/Tag";
import ShowService from "./ShowService";

interface TagData {
  id?: number;
  name?: string;
  color?: string;
  kanban?: number;
  timeLane?: number;
  nextLaneId?: number;
  greetingMessageLane: string;
  rollbackLaneId?: number;
  userId?: number;
}

interface Request {
  tagData: TagData;
  id: string | number;
  companyId: number;
}

const UpdateUserService = async ({
  tagData,
  id,
  companyId
}: Request): Promise<Tag | undefined> => {
  // Busca já filtrada por companyId (isolação entre empresas)
  const tag = await ShowService(id, companyId);

  const schema = Yup.object().shape({
    name: Yup.string().min(3)
  });

  const { name, color, kanban,
    timeLane,
    nextLaneId = null,
    greetingMessageLane,
    rollbackLaneId = null,
    userId } = tagData;

  try {
    await schema.validate({ name });
  } catch (err: any) {
    throw new AppError(err.message);
  }

  await tag.update({
    name,
    color,
    kanban,
    timeLane,
    nextLaneId: String(nextLaneId) === "" ? null : nextLaneId,
    greetingMessageLane,
    rollbackLaneId: String(rollbackLaneId) === "" ? null : rollbackLaneId,
    userId
  });

  await tag.reload();
  return tag;
};

export default UpdateUserService;
