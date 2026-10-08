import { Request, Response } from "express";

import AppError from "../errors/AppError";
import CreateCallLogService from "../services/CallLogServices/CreateCallLogService";
import ListCallLogsService, {
  CallLogItem
} from "../services/CallLogServices/ListCallLogsService";

interface IndexQuery {
  startDate?: string;
  endDate?: string;
  userId?: string;
  direction?: string;
  status?: string;
  page?: string;
  pageSize?: string;
}

// Labels pt-BR para CSV (o relatório web traduz via i18n; o CSV é standalone)
const DIRECTION_LABELS: Record<string, string> = {
  in: "Recebida",
  out: "Originada"
};
const STATUS_LABELS: Record<string, string> = {
  answered: "Atendida",
  missed: "Perdida",
  rejected: "Rejeitada",
  failed: "Falha"
};

// Escapa valor para célula CSV (envolve em aspas e duplica aspas internas)
const csvCell = (value: string | number | null | undefined): string =>
  `"${String(value ?? "").replace(/"/g, '""')}"`;

// Formata duração em segundos para "Xh YYm" (pt-BR)
const formatDuration = (seconds: number | null | undefined): string => {
  if (seconds === null || seconds === undefined || Number.isNaN(seconds)) {
    return "";
  }
  const total = Math.max(0, Math.round(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
};

const buildParams = (query: IndexQuery, companyId: number) => ({
  companyId,
  startDate: query.startDate || undefined,
  endDate: query.endDate || undefined,
  userId: query.userId ? Number(query.userId) : undefined,
  direction: query.direction || undefined,
  status: query.status || undefined
});

/**
 * Ingestão service-to-service de log de chamada — autenticado por
 * X-Service-Token (serviceTokenAuth), NÃO por sessão de usuário.
 * Consumido pelo microserviço "wacalls" (e pelo provedor SIP futuro).
 * POST /call-logs
 */
export const store = async (req: Request, res: Response): Promise<Response> => {
  const {
    companyId,
    whatsappId,
    userId,
    contactId,
    number,
    direction,
    status,
    durationSeconds,
    startedAt,
    endedAt,
    provider
  } = req.body || {};

  if (companyId === undefined || companyId === null) {
    throw new AppError("companyId é obrigatório", 400);
  }

  const callLog = await CreateCallLogService({
    companyId: Number(companyId),
    whatsappId: whatsappId ?? null,
    userId: userId ?? null,
    contactId: contactId ?? null,
    number,
    direction,
    status,
    durationSeconds: durationSeconds ?? null,
    startedAt,
    endedAt: endedAt ?? null,
    provider
  });

  return res.status(201).json(callLog);
};

/**
 * Lista paginada do relatório de chamadas + agregados
 * GET /call-logs?startDate&endDate&userId&direction&status&page&pageSize
 */
export const index = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { page, pageSize, ...rest } = req.query as IndexQuery;

  const { callLogs, count, hasMore, summary } = await ListCallLogsService({
    ...buildParams(rest, Number(companyId)),
    page: page ? Number(page) : 1,
    pageSize: pageSize ? Number(pageSize) : 20
  });

  return res.json({ callLogs, count, hasMore, summary });
};

/**
 * Exporta o relatório de chamadas em CSV (mesmos filtros, sem paginação)
 * GET /call-logs/export
 */
export const exportCsv = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { companyId } = req.user;
  const query = req.query as IndexQuery;

  // Busca tudo sem paginação (pageSize alto; o service limita em 100000)
  const { callLogs } = await ListCallLogsService({
    ...buildParams(query, Number(companyId)),
    page: 1,
    pageSize: 100000
  });

  const csvLines = [
    [
      "Número",
      "Contato",
      "Direção",
      "Status",
      "Atendente",
      "Conexão",
      "Duração",
      "Início",
      "Fim",
      "Provedor"
    ]
      .map(csvCell)
      .join(",")
  ];

  callLogs.forEach((call: CallLogItem) => {
    const startedAt = call.startedAt
      ? new Date(call.startedAt).toLocaleString("pt-BR")
      : "";
    const endedAt = call.endedAt
      ? new Date(call.endedAt).toLocaleString("pt-BR")
      : "";
    csvLines.push(
      [
        call.number,
        call.contactName || "",
        DIRECTION_LABELS[call.direction] || call.direction,
        STATUS_LABELS[call.status] || call.status,
        call.userName || "",
        call.whatsappName || "",
        formatDuration(call.durationSeconds),
        startedAt,
        endedAt,
        call.provider
      ]
        .map(csvCell)
        .join(",")
    );
  });

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    "attachment; filename=relatorio-chamadas.csv"
  );
  res.send("﻿" + csvLines.join("\n")); // BOM para UTF-8
};
