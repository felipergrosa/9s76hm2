import { QueryTypes } from "sequelize";
import sequelize from "../../database";

/**
 * Relatório de Fechamento.
 *
 * Lista tickets fechados no período (data de fechamento = TicketTraking.finishedAt)
 * com protocolo (uuid), contato, atendente, fila, assunto/resumo de fechamento
 * e duração do atendimento, além de agregados:
 *   - closed: tickets fechados no período
 *   - pending: tickets abertos/pendentes criados no período
 *   - total: closed + pending
 *   - avgDurationSeconds: tempo médio dos fechados
 */

export interface ClosingReportParams {
  companyId: number;
  startDate?: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  userId?: number;
  queueId?: number;
  subject?: string;
  page?: number;
  pageSize?: number;
}

export interface ClosingReportItem {
  id: number;
  protocol: string;
  contactName: string;
  contactNumber: string;
  userName: string;
  queueName: string;
  status: string;
  closingSubject: string | null;
  closingSummary: string | null;
  openedAt: string | null;
  closedAt: string | null;
  durationSeconds: number | null;
}

export interface ClosingReportSummary {
  total: number;
  closed: number;
  pending: number;
  avgDurationSeconds: number | null;
}

interface ClosingReportResult {
  tickets: ClosingReportItem[];
  count: number;
  hasMore: boolean;
  summary: ClosingReportSummary;
}

// Normaliza data YYYY-MM-DD para limites do dia (início/fim)
const dayStart = (date?: string): string | null =>
  date ? `${date} 00:00:00` : null;
const dayEnd = (date?: string): string | null =>
  date ? `${date} 23:59:59` : null;

const ClosingReportService = async ({
  companyId,
  startDate,
  endDate,
  userId,
  queueId,
  subject,
  page = 1,
  pageSize = 20
}: ClosingReportParams): Promise<ClosingReportResult> => {
  const replacements: Record<string, unknown> = { companyId };
  const closedWhere: string[] = [`t."companyId" = :companyId`, `t.status = 'closed'`];
  const pendingWhere: string[] = [
    `t."companyId" = :companyId`,
    `t.status in ('open', 'pending')`
  ];

  // Período: para fechados considera a data de fechamento (TicketTraking.finishedAt);
  // para pendentes considera a data de abertura do ticket
  if (startDate) {
    replacements.startDate = dayStart(startDate);
    closedWhere.push(`coalesce(tt."finishedAt", tt."closedAt") >= :startDate`);
    pendingWhere.push(`t."createdAt" >= :startDate`);
  }
  if (endDate) {
    replacements.endDate = dayEnd(endDate);
    closedWhere.push(`coalesce(tt."finishedAt", tt."closedAt") <= :endDate`);
    pendingWhere.push(`t."createdAt" <= :endDate`);
  }
  if (userId) {
    replacements.userId = Number(userId);
    closedWhere.push(`t."userId" = :userId`);
    pendingWhere.push(`t."userId" = :userId`);
  }
  if (queueId) {
    replacements.queueId = Number(queueId);
    closedWhere.push(`t."queueId" = :queueId`);
    pendingWhere.push(`t."queueId" = :queueId`);
  }
  if (subject && subject.trim() !== "") {
    replacements.subject = `%${subject.trim()}%`;
    // Assunto só existe em tickets fechados (preenchido na tela de fechamento)
    closedWhere.push(`t."closingSubject" ILIKE :subject`);
  }

  const closedFrom = `
    from "Tickets" t
    left join (
      select distinct on ("ticketId") *
      from "TicketTraking"
      where "companyId" = :companyId
      order by "ticketId", "id" desc
    ) tt on tt."ticketId" = t.id
    left join "Contacts" c on c.id = t."contactId"
    left join "Users" u on u.id = t."userId"
    left join "Queues" q on q.id = t."queueId"
    where ${closedWhere.join(" and ")}
  `;

  const safePage = Math.max(1, Number(page) || 1);
  const safePageSize = Math.min(100000, Math.max(1, Number(pageSize) || 20));
  const offset = (safePage - 1) * safePageSize;

  const listQuery = `
    select
      t.id,
      coalesce(t.uuid, t.id::text) as "protocol",
      c."name" as "contactName",
      c."number" as "contactNumber",
      u."name" as "userName",
      q."name" as "queueName",
      t.status,
      t."closingSubject",
      t."closingSummary",
      coalesce(tt."startedAt", tt."createdAt", t."createdAt") as "openedAt",
      coalesce(tt."finishedAt", tt."closedAt") as "closedAt",
      case
        when coalesce(tt."finishedAt", tt."closedAt") is not null
          then extract(epoch from (
            coalesce(tt."finishedAt", tt."closedAt") -
            coalesce(tt."startedAt", tt."createdAt", t."createdAt")
          ))::int
        else null
      end as "durationSeconds"
    ${closedFrom}
    order by coalesce(tt."finishedAt", tt."closedAt") desc nulls last, t.id desc
    limit ${safePageSize} offset ${offset}
  `;

  // Agregados em uma única query por conjunto (sem paginação)
  const closedAggQuery = `
    select
      count(*)::int as "closed",
      avg(extract(epoch from (
        coalesce(tt."finishedAt", tt."closedAt") -
        coalesce(tt."startedAt", tt."createdAt", t."createdAt")
      )))::float as "avgDurationSeconds"
    ${closedFrom}
  `;

  const pendingAggQuery = `
    select count(*)::int as "pending"
    from "Tickets" t
    where ${pendingWhere.join(" and ")}
  `;

  const [tickets, closedAggRows, pendingAggRows] = await Promise.all([
    sequelize.query<ClosingReportItem>(listQuery, {
      replacements,
      type: QueryTypes.SELECT
    }),
    sequelize.query<{ closed: number; avgDurationSeconds: number | null }>(
      closedAggQuery,
      { replacements, type: QueryTypes.SELECT }
    ),
    sequelize.query<{ pending: number }>(pendingAggQuery, {
      replacements,
      type: QueryTypes.SELECT
    })
  ]);

  const closed = Number(closedAggRows[0]?.closed || 0);
  const pending = Number(pendingAggRows[0]?.pending || 0);
  const avgDurationSeconds =
    closedAggRows[0]?.avgDurationSeconds !== null &&
    closedAggRows[0]?.avgDurationSeconds !== undefined
      ? Math.round(closedAggRows[0].avgDurationSeconds)
      : null;

  return {
    tickets,
    count: closed,
    hasMore: offset + tickets.length < closed,
    summary: {
      total: closed + pending,
      closed,
      pending,
      avgDurationSeconds
    }
  };
};

export default ClosingReportService;
