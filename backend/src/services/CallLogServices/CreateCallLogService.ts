import { Op } from "sequelize";
import AppError from "../../errors/AppError";
import CallLog from "../../models/CallLog";
import Contact from "../../models/Contact";
import User from "../../models/User";
import Whatsapp from "../../models/Whatsapp";

/**
 * Cria um registro de chamada reportado por um provedor interno
 * (microserviço "wacalls" ou SIP). Chamado apenas por POST /call-logs,
 * autenticado via serviceTokenAuth — não é endpoint de usuário.
 */

// Valores aceitos — a tabela usa STRING (não ENUM) então a validação é aqui
export const CALL_DIRECTIONS = ["in", "out"] as const;
export const CALL_STATUSES = ["answered", "missed", "rejected", "failed"] as const;
export const CALL_PROVIDERS = ["wacalls", "sip"] as const;

export interface CreateCallLogParams {
  companyId: number;
  whatsappId?: number | null;
  userId?: number | null;
  contactId?: number | null;
  number: string;
  direction: string;
  status: string;
  durationSeconds?: number | null;
  startedAt: string | Date;
  endedAt?: string | Date | null;
  provider?: string;
}

// Aceita apenas dígitos — comparação com Contact.number (armazenado sem "+")
const digitsOnly = (value: string): string => value.replace(/\D/g, "");

// Valida FK opcional: o registro precisa existir E pertencer ao mesmo tenant
// (helper genérico tipado quebrava com Bluebird — checagens inline por model)
const existsInCompany = (record: unknown, label: string): void => {
  if (!record) {
    throw new AppError(`${label} inválido para esta empresa`, 400);
  }
};

const CreateCallLogService = async (
  params: CreateCallLogParams
): Promise<CallLog> => {
  const companyId = Number(params.companyId);
  if (!Number.isInteger(companyId) || companyId <= 0) {
    throw new AppError("companyId é obrigatório", 400);
  }

  const number = typeof params.number === "string" ? params.number.trim() : "";
  if (!number) {
    throw new AppError("number é obrigatório", 400);
  }

  if (!CALL_DIRECTIONS.includes(params.direction as any)) {
    throw new AppError(
      `direction inválida — aceitas: ${CALL_DIRECTIONS.join(", ")}`,
      400
    );
  }
  if (!CALL_STATUSES.includes(params.status as any)) {
    throw new AppError(
      `status inválido — aceitos: ${CALL_STATUSES.join(", ")}`,
      400
    );
  }

  const provider = params.provider || "wacalls";
  if (!CALL_PROVIDERS.includes(provider as any)) {
    throw new AppError(
      `provider inválido — aceitos: ${CALL_PROVIDERS.join(", ")}`,
      400
    );
  }

  const startedAt = new Date(params.startedAt);
  if (Number.isNaN(startedAt.getTime())) {
    throw new AppError("startedAt inválido/ausente", 400);
  }

  let endedAt: Date | null = null;
  if (params.endedAt) {
    endedAt = new Date(params.endedAt);
    if (Number.isNaN(endedAt.getTime())) {
      throw new AppError("endedAt inválido", 400);
    }
  }

  // Duração: usa o valor reportado; se ausente e houver endedAt, deriva do intervalo
  let durationSeconds = Number(params.durationSeconds);
  if (!Number.isFinite(durationSeconds) || durationSeconds < 0) {
    durationSeconds = endedAt
      ? Math.max(0, Math.round((endedAt.getTime() - startedAt.getTime()) / 1000))
      : 0;
  }

  const whatsappId = params.whatsappId ? Number(params.whatsappId) : null;
  const userId = params.userId ? Number(params.userId) : null;
  let contactId = params.contactId ? Number(params.contactId) : null;

  // Integridade de tenant: FKs opcionais só podem apontar para o mesmo companyId
  if (whatsappId) {
    existsInCompany(
      await Whatsapp.findOne({ where: { id: whatsappId, companyId }, attributes: ["id"] }),
      "whatsappId"
    );
  }
  if (userId) {
    existsInCompany(
      await User.findOne({ where: { id: userId, companyId }, attributes: ["id"] }),
      "userId"
    );
  }

  // Resolução de contato: se o provedor não mandou contactId, tenta casar
  // pelo número dentro do tenant (melhora o relatório com nome do contato)
  if (!contactId) {
    const contact = await Contact.findOne({
      where: {
        companyId,
        number: { [Op.in]: [number, digitsOnly(number)] }
      },
      attributes: ["id"]
    });
    contactId = contact?.id ?? null;
  } else {
    existsInCompany(
      await Contact.findOne({ where: { id: contactId, companyId }, attributes: ["id"] }),
      "contactId"
    );
  }

  return CallLog.create({
    companyId,
    whatsappId,
    userId,
    contactId,
    number,
    direction: params.direction,
    status: params.status,
    durationSeconds,
    startedAt,
    endedAt,
    provider
  });
};

export default CreateCallLogService;
