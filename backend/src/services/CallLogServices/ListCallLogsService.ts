import { QueryTypes } from "sequelize";
import sequelize from "../../database";
import { CALL_DIRECTIONS, CALL_STATUSES } from "./CreateCallLogService";

/**
 * Relatório de Chamadas (/call-report).
 *
 * Lista paginada de CallLogs do tenant com joins para exibir nome do contato,
 * atendente e conexão, além de agregados do período filtrado:
 *   - total: chamadas no filtro
 *   - answered: atendidas
 *   - missed: perdidas
 *   - avgDurationSeconds: duração média das chamadas ATENDIDAS
 */

export interface ListCallLogsParams {
  companyId: number;
  startDate?: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  userId?: number;
  direction?: string; // "in" | "out"
  status?: string; // "answered" | "missed" | "rejected" | "failed"
  page?: number;
  pageSize?: number;
}

export interface CallLogItem {
  id: number;
  number: string;
  direction: string;
  status: string;
  durationSeconds: number;
  startedAt: string;
  endedAt: string | null;
  provider: string;
  contactId: number | null;
  contactName: string | null;
  userId: number | null;
  userName: string | null;
  whatsappId: number | null;
  whatsappName: string | null;
}

export interface CallLogSummary {
  total: number;
  answered: number;
  missed: number;
  avgDurationSeconds: number | null;
}

interface ListCallLogsResult {
  callLogs: CallLogItem[];
  count: number;
  hasMore: boolean;
  summary: CallLogSummary;
}

// Normaliza data YYYY-MM-DD para limites do dia (início/fim)
const dayStart = (date?: string): string | null =>
  date ? `${date} 00:00:00` : null;
const dayEnd = (date?: string): string | null =>
  date ? `${date} 23:59:59` : null;

const ListCallLogsService = async ({
  companyId,
  startDate,
  endDate,
  userId,
  direction,
  status,
  page = 1,
  pageSize = 20
}: ListCallLogsParams): Promise<ListCallLogsResult> => {
  const replacements: Record<string, unknown> = { companyId };
  const where: string[] = [`cl."companyId" = :companyId`];

  if (startDate) {
    replacements.startDate = dayStart(startDate);
    where.push(`cl."startedAt" >= :startDate`);
  }
  if (endDate) {
    replacements.endDate = dayEnd(endDate);
    where.push(`cl."startedAt" <= :endDate`);
  }
  if (userId) {
    replacements.userId = Number(userId);
    where.push(`cl."userId" = :userId`);
  }
  // direction/status validados contra whitelist — nunca interpolar valor cru
  if (direction && (CALL_DIRECTIONS as readonly string[]).includes(direction)) {
    replacements.direction = direction;
    where.push(`cl.direction = :direction`);
  }
  if (status && (CALL_STATUSES as readonly string[]).includes(status)) {
    replacements.status = status;
    where.push(`cl.status = :status`);
  }

  const from = `
    from "CallLogs" cl
    left join "Contacts" c on c.id = cl."contactId"
    left join "Users" u on u.id = cl."userId"
    left join "Whatsapps" w on w.id = cl."whatsappId"
    where ${where.join(" and ")}
  `;

  const safePage = Math.max(1, Number(page) || 1);
  const safePageSize = Math.min(100000, Math.max(1, Number(pageSize) || 20));
  const offset = (safePage - 1) * safePageSize;

  const listQuery = `
    select
      cl.id,
      cl.number,
      cl.direction,
      cl.status,
      cl."durationSeconds",
      cl."startedAt",
      cl."endedAt",
      cl.provider,
      cl."contactId",
      c."name" as "contactName",
      cl."userId",
      u."name" as "userName",
      cl."whatsappId",
      w."name" as "whatsappName"
    ${from}
    order by cl."startedAt" desc, cl.id desc
    limit ${safePageSize} offset ${offset}
  `;

  // Agregados em uma única query (sem paginação) — média só das atendidas,
  // pois perdidas/rejeitadas têm durationSeconds 0 e enviesariam a média
  const aggQuery = `
    select
      count(*)::int as "total",
      count(*) filter (where cl.status = 'answered')::int as "answered",
      count(*) filter (where cl.status = 'missed')::int as "missed",
      avg(cl."durationSeconds") filter (where cl.status = 'answered')::float
        as "avgDurationSeconds"
    ${from}
  `;

  const [callLogs, aggRows] = await Promise.all([
    sequelize.query<CallLogItem>(listQuery, {
      replacements,
      type: QueryTypes.SELECT
    }),
    sequelize.query<{
      total: number;
      answered: number;
      missed: number;
      avgDurationSeconds: number | null;
    }>(aggQuery, { replacements, type: QueryTypes.SELECT })
  ]);

  const agg = aggRows[0] || { total: 0, answered: 0, missed: 0, avgDurationSeconds: null };
  const total = Number(agg.total || 0);
  const avgDurationSeconds =
    agg.avgDurationSeconds !== null && agg.avgDurationSeconds !== undefined
      ? Math.round(agg.avgDurationSeconds)
      : null;

  return {
    callLogs,
    count: total,
    hasMore: offset + callLogs.length < total,
    summary: {
      total,
      answered: Number(agg.answered || 0),
      missed: Number(agg.missed || 0),
      avgDurationSeconds
    }
  };
};

export default ListCallLogsService;
