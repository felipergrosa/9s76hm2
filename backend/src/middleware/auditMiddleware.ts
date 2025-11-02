import { Request, Response, NextFunction } from "express";
import { createAuditLogFromRequest, AuditActions } from "../helpers/AuditLogger";

interface AuditOptions {
  action?: string;
  entity: string;
  getEntityId?: (req: Request, res: Response) => string | number | undefined;
  getDetails?: (req: Request, res: Response) => any;
}

/**
 * Middleware para auditoria automática de ações
 * Usa após a execução da rota para capturar dados do response
 * 
 * Exemplo de uso:
 * router.post("/users", isAuth, UserController.store, auditAction({
 *   entity: "Usuário",
 *   action: "Criação"
 * }));
 */
export const auditAction = (options: AuditOptions) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Aguarda resposta ser enviada
    const originalSend = res.send;
    
    res.send = function(data: any): Response {
      // Restaura função original
      res.send = originalSend;
      
      // Determina ação baseada no método HTTP se não especificada
      let action = options.action;
      if (!action) {
        switch (req.method) {
          case "POST":
            action = AuditActions.CREATE;
            break;
          case "PUT":
          case "PATCH":
            action = AuditActions.UPDATE;
            break;
          case "DELETE":
            action = AuditActions.DELETE;
            break;
          default:
            action = "Ação";
        }
      }
      
      // Extrai ID da entidade
      let entityId: string | number | undefined;
      if (options.getEntityId) {
        entityId = options.getEntityId(req, res);
      } else {
        // Tenta pegar do params ou do body da resposta
        entityId = req.params.id || req.params.userId || req.params.contactId;
        
        if (!entityId && data) {
          try {
            const parsed = typeof data === 'string' ? JSON.parse(data) : data;
            entityId = parsed.id || parsed.userId;
          } catch (e) {
            // Ignora erro de parse
          }
        }
      }
      
      // Extrai detalhes
      let details: any;
      if (options.getDetails) {
        details = options.getDetails(req, res);
      } else {
        // Captura algumas informações básicas do body
        if (req.body) {
          const { password, passwordHash, ...safeBody } = req.body;
          details = {
            method: req.method,
            path: req.path,
            body: safeBody
          };
        }
      }
      
      // Registra log de forma assíncrona (não bloqueia response)
      setImmediate(() => {
        createAuditLogFromRequest(req, action!, options.entity, entityId, details)
          .catch(err => console.error("[AuditMiddleware] Erro:", err));
      });
      
      // Envia resposta normalmente
      return originalSend.call(res, data);
    };
    
    next();
  };
};

/**
 * Middleware específico para ações de usuário
 */
export const auditUserAction = (action?: string) => {
  return auditAction({
    entity: "Usuário",
    action,
    getEntityId: (req) => req.params.userId || req.body.id,
    getDetails: (req) => {
      const { password, passwordHash, ...safeBody } = req.body || {};
      return {
        ...safeBody,
        permissions: req.body.permissions?.length || 0
      };
    }
  });
};

/**
 * Middleware específico para ações de campanha
 */
export const auditCampaignAction = (action?: string) => {
  return auditAction({
    entity: "Campanha",
    action,
    getEntityId: (req) => req.params.campaignId || req.params.id,
    getDetails: (req) => ({
      name: req.body?.name,
      status: req.body?.status
    })
  });
};

/**
 * Middleware específico para ações de contato
 */
export const auditContactAction = (action?: string) => {
  return auditAction({
    entity: "Contato",
    action,
    getEntityId: (req) => req.params.contactId || req.params.id,
    getDetails: (req) => ({
      name: req.body?.name,
      number: req.body?.number ? "***" + req.body.number.slice(-4) : undefined
    })
  });
};

export default auditAction;
