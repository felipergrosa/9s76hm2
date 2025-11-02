import { Request } from "express";
import AuditLog from "../models/AuditLog";
import User from "../models/User";

interface AuditLogData {
  userId?: number;
  userName?: string;
  companyId: number;
  action: string;
  entity: string;
  entityId?: string | number;
  details?: any;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Registra um log de auditoria
 */
export const createAuditLog = async (data: AuditLogData): Promise<void> => {
  try {
    await AuditLog.create({
      userId: data.userId || null,
      userName: data.userName || "Sistema",
      companyId: data.companyId,
      action: data.action,
      entity: data.entity,
      entityId: data.entityId ? String(data.entityId) : null,
      details: data.details ? JSON.stringify(data.details) : null,
      ipAddress: data.ipAddress || null,
      userAgent: data.userAgent || null
    });
  } catch (error) {
    // Não deve quebrar a aplicação se falhar o log
    console.error("[AuditLogger] Erro ao criar log:", error);
  }
};

/**
 * Extrai IP do request
 */
export const getIpFromRequest = (req: Request): string => {
  return (
    (req.headers["x-forwarded-for"] as string)?.split(',')[0] ||
    (req.headers["x-real-ip"] as string) ||
    req.socket.remoteAddress ||
    "unknown"
  );
};

/**
 * Cria log a partir de um request HTTP
 */
export const createAuditLogFromRequest = async (
  req: Request,
  action: string,
  entity: string,
  entityId?: string | number,
  details?: any
): Promise<void> => {
  const user = (req as any).user; // vem do middleware isAuth
  const fullUser = (req as any).fullUser; // se usar attachUserToRequest

  if (!user) return;

  await createAuditLog({
    userId: user.id,
    userName: fullUser?.name || user.name || "Usuário",
    companyId: user.companyId,
    action,
    entity,
    entityId,
    details,
    ipAddress: getIpFromRequest(req),
    userAgent: req.headers["user-agent"] || "unknown"
  });
};

/**
 * Ações padrão de auditoria
 */
export const AuditActions = {
  // CRUD
  CREATE: "Criação",
  UPDATE: "Atualização", 
  DELETE: "Deleção",
  
  // Autenticação
  LOGIN: "Login",
  LOGOUT: "Logout",
  
  // Permissões
  PERMISSION_CHANGE: "Alteração de Permissões",
  ROLE_CHANGE: "Alteração de Perfil",
  
  // Campanhas
  CAMPAIGN_START: "Campanha Iniciada",
  CAMPAIGN_STOP: "Campanha Parada",
  
  // Tickets
  TICKET_TRANSFER: "Ticket Transferido",
  TICKET_CLOSE: "Ticket Fechado",
  
  // Conexões
  CONNECTION_CONNECT: "Conexão Conectada",
  CONNECTION_DISCONNECT: "Conexão Desconectada",
  
  // Importação
  IMPORT_START: "Importação Iniciada",
  IMPORT_COMPLETE: "Importação Concluída",
  
  // Configurações
  SETTINGS_CHANGE: "Configurações Alteradas"
};

/**
 * Entidades do sistema
 */
export const AuditEntities = {
  USER: "Usuário",
  CONTACT: "Contato",
  TICKET: "Atendimento",
  CAMPAIGN: "Campanha",
  CONTACT_LIST: "Lista de Contatos",
  CONNECTION: "Conexão",
  QUEUE: "Fila",
  TAG: "Tag",
  QUICK_MESSAGE: "Resposta Rápida",
  SETTING: "Configuração",
  COMPANY: "Empresa",
  FLOWBUILDER: "Fluxo"
};
