import { Request, Response } from "express";
import { getIO } from "../libs/socket";
import CreateQueueIntegrationService from "../services/QueueIntegrationServices/CreateQueueIntegrationService";
import DeleteQueueIntegrationService from "../services/QueueIntegrationServices/DeleteQueueIntegrationService";
import ListQueueIntegrationService from "../services/QueueIntegrationServices/ListQueueIntegrationService";
import ShowQueueIntegrationService from "../services/QueueIntegrationServices/ShowQueueIntegrationService";
import TestSessionIntegrationService from "../services/QueueIntegrationServices/TestSessionDialogflowService";
import UpdateQueueIntegrationService from "../services/QueueIntegrationServices/UpdateQueueIntegrationService";

type IndexQuery = {
  searchParam: string;
  pageNumber: string;
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { searchParam, pageNumber } = req.query as IndexQuery;
  const { companyId } = req.user;

  const { queueIntegrations, count, hasMore } = await ListQueueIntegrationService({
    searchParam,
    pageNumber,
    companyId
  });

  // Máscara parcial da apiKey (mantém prefixo e oculta o restante)
  const sanitized = queueIntegrations.map(qi => {
    try {
      let obj: any = (qi as any).toJSON ? (qi as any).toJSON() : (qi as any);
      if (obj?.type === "openai" && obj?.jsonContent) {
        try {
          const parsed = JSON.parse(obj.jsonContent);
          if (parsed && parsed.apiKey) {
            const key: string = String(parsed.apiKey);
            const keep = Math.min(8, key.length);
            parsed.apiKey = `${key.slice(0, keep)}********`;
            obj.jsonContent = JSON.stringify(parsed);
          }
        } catch (_) {}
      }
      return obj;
    } catch (_) {
      return qi;
    }
  });

  return res.status(200).json({ queueIntegrations: sanitized, count, hasMore });
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { type, name, projectName, jsonContent, language, urlN8N,
    typebotExpires,
    typebotKeywordFinish,
    typebotSlug,
    typebotUnknownMessage,
    typebotDelayMessage,
    typebotKeywordRestart,
    typebotRestartMessage } = req.body;
  const { companyId } = req.user;
  const queueIntegration = await CreateQueueIntegrationService({
    type, name, projectName, jsonContent, language, urlN8N, companyId,
    typebotExpires,
    typebotKeywordFinish,
    typebotSlug,
    typebotUnknownMessage,
    typebotDelayMessage,
    typebotKeywordRestart,
    typebotRestartMessage 
  });

  const io = getIO();
  io.of(`/workspace-${companyId}`)
  .emit(`company-${companyId}-queueIntegration`, {
    action: "create",
    queueIntegration
  });

  // Máscara parcial da apiKey se for OpenAI
  let obj: any = queueIntegration?.toJSON ? queueIntegration.toJSON() : queueIntegration;
  try {
    if (obj?.type === "openai" && obj?.jsonContent) {
      const parsed = JSON.parse(obj.jsonContent);
      if (parsed?.apiKey) {
        const key: string = String(parsed.apiKey);
        const keep = Math.min(8, key.length);
        parsed.apiKey = `${key.slice(0, keep)}********`;
      }
      obj.jsonContent = JSON.stringify(parsed);
    }
  } catch (_) {}

  return res.status(200).json(obj);
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { integrationId } = req.params;
  const { companyId } = req.user;

  const queueIntegration = await ShowQueueIntegrationService(integrationId, companyId);

  // Máscara parcial da apiKey se for OpenAI
  let obj: any = queueIntegration?.toJSON ? queueIntegration.toJSON() : queueIntegration;
  try {
    if (obj?.type === "openai" && obj?.jsonContent) {
      const parsed = JSON.parse(obj.jsonContent);
      if (parsed?.apiKey) {
        const key: string = String(parsed.apiKey);
        const keep = Math.min(8, key.length);
        parsed.apiKey = `${key.slice(0, keep)}********`;
      }
      obj.jsonContent = JSON.stringify(parsed);
    }
  } catch (_) {}

  return res.status(200).json(obj);
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { integrationId } = req.params;
  const integrationData = req.body;
  const { companyId } = req.user;

  const queueIntegration = await UpdateQueueIntegrationService({ integrationData, integrationId, companyId });

  const io = getIO();
  io.of(`/workspace-${companyId}`)
  .emit(`company-${companyId}-queueIntegration`, {
    action: "update",
    queueIntegration
  });

  // Mascarar apiKey se for OpenAI
  let obj: any = queueIntegration?.toJSON ? queueIntegration.toJSON() : queueIntegration;
  try {
    if (obj?.type === "openai" && obj?.jsonContent) {
      const parsed = JSON.parse(obj.jsonContent);
      if (parsed?.apiKey) {
        const key: string = String(parsed.apiKey);
        const keep = Math.min(8, key.length);
        parsed.apiKey = `${key.slice(0, keep)}********`;
      }
      obj.jsonContent = JSON.stringify(parsed);
    }
  } catch (_) {}

  return res.status(201).json(obj);
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { integrationId } = req.params;
  const { companyId } = req.user;

  await DeleteQueueIntegrationService(integrationId);

  const io = getIO();
  io.of(`/workspace-${companyId}`)
  .emit(`company-${companyId}-queueIntegration`, {
    action: "delete",
    integrationId: +integrationId
  });

  return res.status(200).send();
};

export const testSession = async (req: Request, res: Response): Promise<Response> => {
  const { projectName, jsonContent, language } = req.body;
  const { companyId } = req.user;

  const response = await TestSessionIntegrationService({ projectName, jsonContent, language });

  const io = getIO();
  io.of(`/workspace-${companyId}`)
  .emit(`company-${companyId}-queueIntegration`, {
    action: "testSession",
    response
  });

  return res.status(200).json(response);
};