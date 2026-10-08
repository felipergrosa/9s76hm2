import { Request, Response } from "express";
import ClosingReportService, {
  ClosingReportItem
} from "../services/TicketServices/ClosingReportService";

interface IndexQuery {
  startDate?: string;
  endDate?: string;
  userId?: string;
  queueId?: string;
  subject?: string;
  page?: string;
  pageSize?: string;
}

// Escapa valor para célula CSV (envolve em aspas e duplica aspas internas)
const csvCell = (value: string | number | null | undefined): string =>
  `"${String(value ?? "").replace(/"/g, '""')}"`;

// Formata duração em segundos para "Xh YYm" (pt-BR)
const formatDuration = (seconds: number | null | undefined): string => {
  if (seconds === null || seconds === undefined || Number.isNaN(seconds)) {
    return "";
  }
  const total = Math.max(0, Math.round(seconds));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

const buildParams = (query: IndexQuery, companyId: number) => ({
  companyId,
  startDate: query.startDate || undefined,
  endDate: query.endDate || undefined,
  userId: query.userId ? Number(query.userId) : undefined,
  queueId: query.queueId ? Number(query.queueId) : undefined,
  subject: query.subject || undefined
});

/**
 * Lista paginada do relatório de fechamento + agregados
 * GET /closing-report
 */
export const index = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { page, pageSize, ...rest } = req.query as IndexQuery;

  const { tickets, count, hasMore, summary } = await ClosingReportService({
    ...buildParams(rest, Number(companyId)),
    page: page ? Number(page) : 1,
    pageSize: pageSize ? Number(pageSize) : 20
  });

  return res.json({ tickets, count, hasMore, summary });
};

/**
 * Exporta o relatório de fechamento em CSV (mesmos filtros, sem paginação)
 * GET /closing-report/export
 */
export const exportCsv = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { companyId } = req.user;
  const query = req.query as IndexQuery;

  // Busca tudo sem paginação (pageSize alto; o service limita em 100000)
  const { tickets } = await ClosingReportService({
    ...buildParams(query, Number(companyId)),
    page: 1,
    pageSize: 100000
  });

  const csvLines = [
    [
      "Protocolo",
      "Contato",
      "Atendente",
      "Fila",
      "Status",
      "Assunto",
      "Resumo",
      "Data Abertura",
      "Data Fechamento",
      "Duração"
    ]
      .map(csvCell)
      .join(",")
  ];

  tickets.forEach((ticket: ClosingReportItem) => {
    const openedAt = ticket.openedAt
      ? new Date(ticket.openedAt).toLocaleString("pt-BR")
      : "";
    const closedAt = ticket.closedAt
      ? new Date(ticket.closedAt).toLocaleString("pt-BR")
      : "";
    csvLines.push(
      [
        ticket.protocol,
        ticket.contactName,
        ticket.userName,
        ticket.queueName,
        ticket.status,
        ticket.closingSubject,
        ticket.closingSummary,
        openedAt,
        closedAt,
        formatDuration(ticket.durationSeconds)
      ]
        .map(csvCell)
        .join(",")
    );
  });

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    "attachment; filename=relatorio-fechamento.csv"
  );
  res.send("﻿" + csvLines.join("\n")); // BOM para UTF-8
};
