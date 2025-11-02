import { Request, Response } from "express";
import ListAuditLogsService from "../services/AuditLogServices/ListAuditLogsService";

interface IndexQuery {
  searchParam?: string;
  action?: string;
  entity?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
  pageNumber?: string;
}

/**
 * Lista logs de auditoria com filtros
 */
export const index = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = (req.user as any);
  const {
    searchParam,
    action,
    entity,
    userId,
    startDate,
    endDate,
    pageNumber
  } = req.query as IndexQuery;

  const { logs, count, hasMore } = await ListAuditLogsService({
    companyId,
    searchParam,
    action,
    entity,
    userId: userId ? Number(userId) : undefined,
    startDate,
    endDate,
    pageNumber
  });

  return res.json({ logs, count, hasMore });
};

/**
 * Exporta logs para CSV
 */
export const exportCsv = async (req: Request, res: Response): Promise<void> => {
  const { companyId } = (req.user as any);
  const {
    searchParam,
    action,
    entity,
    userId,
    startDate,
    endDate
  } = req.query as IndexQuery;

  // Busca todos os logs sem paginação
  const { logs } = await ListAuditLogsService({
    companyId,
    searchParam,
    action,
    entity,
    userId: userId ? Number(userId) : undefined,
    startDate,
    endDate,
    pageNumber: "1"
  });

  // Monta CSV
  const csvLines = [
    "Data/Hora,Usuário,Ação,Entidade,Código,Detalhes"
  ];

  logs.forEach(log => {
    const date = new Date(log.createdAt).toLocaleString("pt-BR");
    const details = log.details ? log.details.replace(/"/g, '""') : "";
    csvLines.push(
      `"${date}","${log.userName}","${log.action}","${log.entity}","${log.entityId || ""}","${details}"`
    );
  });

  const csv = csvLines.join("\n");

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", "attachment; filename=audit-logs.csv");
  res.send("\uFEFF" + csv); // BOM para UTF-8
};
