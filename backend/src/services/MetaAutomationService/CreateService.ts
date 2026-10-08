import MetaAutomationRule from "../../models/MetaAutomationRule";
import AppError from "../../errors/AppError";
import ValidateRuleData from "./ValidateRuleData";

interface Request {
  name: string;
  whatsappId: number;
  channel: string;
  trigger: string;
  matchValue?: string | null;
  dmText?: string | null;
  publicReplyText?: string | null;
  flowId?: number | null;
  active?: boolean;
  companyId: number;
}

const CreateService = async (data: Request): Promise<MetaAutomationRule> => {
  if (!data.whatsappId) {
    throw new AppError("Selecione a conexão (página FB / conta IG)", 400);
  }

  await ValidateRuleData(data, data.companyId);

  return MetaAutomationRule.create({
    name: data.name.trim(),
    whatsappId: data.whatsappId,
    channel: data.channel || "instagram",
    trigger: data.trigger,
    matchValue: data.matchValue || null,
    dmText: data.dmText || null,
    publicReplyText: data.publicReplyText || null,
    flowId: data.flowId || null,
    active: data.active !== undefined ? data.active : true,
    companyId: data.companyId
  } as any);
};

export default CreateService;
