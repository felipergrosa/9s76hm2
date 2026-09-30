import { Request, Response } from "express";
import { getIO } from "../libs/socket";
import CreateQueueIntegrationService from "../services/QueueIntegrationServices/CreateQueueIntegrationService";
import DeleteQueueIntegrationService from "../services/QueueIntegrationServices/DeleteQueueIntegrationService";
import ListQueueIntegrationService from "../services/QueueIntegrationServices/ListQueueIntegrationService";
import ShowQueueIntegrationService from "../services/QueueIntegrationServices/ShowQueueIntegrationService";
import TestSessionIntegrationService from "../services/QueueIntegrationServices/TestSessionDialogflowService";
import UpdateQueueIntegrationService from "../services/QueueIntegrationServices/UpdateQueueIntegrationService";


// Mascara campos sensíveis (apiKey/key) do jsonContent para TODOS os tipos
// de integração — antes só "openai" era mascarado, vazando credenciais de
// n8n/gemini/deepseek/etc. Mantém só os últimos 4 caracteres.
const maskSensitiveJsonContent = (obj: any): any => {
  try {
    if (obj?.jsonContent) {
      const parsed = JSON.parse(obj.jsonContent);
      for (const field of ["apiKey", "key"]) {
        const val = parsed?.[field];
        if (typeof val === "string" && val.length > 0) {
          parsed[field] = `********${val.slice(-4)}`;
        }
      }
      obj.jsonContent = JSON.stringify(parsed);
    }
  } catch (_) {}
  return obj;
};

type IndexQuery = {
  searchParam: string;
  pageNumber: string;
  type?: string;
  excludeTypes?: string;
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { searchParam, pageNumber, type, excludeTypes } = req.query as IndexQuery;
  const { companyId } = req.user;

  const { queueIntegrations, count, hasMore } = await ListQueueIntegrationService({
    searchParam,
    pageNumber,
    companyId,
    type,
    excludeTypes
  });

  const sanitized = queueIntegrations.map(qi => {
    try {
      const obj: any = (qi as any).toJSON ? (qi as any).toJSON() : (qi as any);
      return maskSensitiveJsonContent(obj);
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

  let obj: any = queueIntegration?.toJSON ? queueIntegration.toJSON() : queueIntegration;
  obj = maskSensitiveJsonContent(obj);

  return res.status(200).json(obj);
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { integrationId } = req.params;
  const { companyId } = req.user;

  const queueIntegration = await ShowQueueIntegrationService(integrationId, companyId);

  let obj: any = queueIntegration?.toJSON ? queueIntegration.toJSON() : queueIntegration;
  obj = maskSensitiveJsonContent(obj);

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

  let obj: any = queueIntegration?.toJSON ? queueIntegration.toJSON() : queueIntegration;
  obj = maskSensitiveJsonContent(obj);

  return res.status(201).json(obj);
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { integrationId } = req.params;
  const { companyId } = req.user;

  await DeleteQueueIntegrationService(integrationId, companyId);

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