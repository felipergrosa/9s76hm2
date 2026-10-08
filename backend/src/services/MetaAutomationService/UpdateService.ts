import MetaAutomationRule from "../../models/MetaAutomationRule";
import AppError from "../../errors/AppError";
import ValidateRuleData from "./ValidateRuleData";

interface Request {
  id: string | number;
  name?: string;
  whatsappId?: number;
  channel?: string;
  trigger?: string;
  matchValue?: string | null;
  dmText?: string | null;
  publicReplyText?: string | null;
  flowId?: number | null;
  autoLikeComment?: boolean;
  requireFollower?: boolean;
  nonFollowerAction?: string | null;
  nonFollowerText?: string | null;
  rewardMediaUrl?: string | null;
  rewardMediaType?: string | null;
  active?: boolean;
  companyId: number;
}

const UpdateService = async (data: Request): Promise<MetaAutomationRule> => {
  // N2 (IDOR): só localiza regra do próprio tenant
  const record = await MetaAutomationRule.findOne({
    where: { id: data.id, companyId: data.companyId }
  });

  if (!record) {
    throw new AppError("Automação não encontrada", 404);
  }

  await ValidateRuleData(data, data.companyId, true);

  const fields = [
    "name",
    "whatsappId",
    "channel",
    "trigger",
    "matchValue",
    "dmText",
    "publicReplyText",
    "flowId",
    "autoLikeComment",
    "requireFollower",
    "nonFollowerAction",
    "nonFollowerText",
    "rewardMediaUrl",
    "rewardMediaType",
    "active"
  ] as const;

  const payload: Record<string, any> = {};
  fields.forEach(field => {
    if (data[field] !== undefined) {
      payload[field] = data[field];
    }
  });

  if (payload.name !== undefined) {
    payload.name = String(payload.name).trim();
  }

  await record.update(payload);

  return record;
};

export default UpdateService;
