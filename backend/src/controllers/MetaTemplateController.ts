import { Request, Response } from "express";
import fs from "fs";
import path from "path";
import AppError from "../errors/AppError";
import logger from "../utils/logger";
import Whatsapp from "../models/Whatsapp";
import WhatsappTemplate from "../models/WhatsappTemplate";
import { getIO } from "../libs/socket";
import {
  createAuditLogFromRequest,
  AuditActions,
  AuditEntities
} from "../helpers/AuditLogger";
import ListWabaTemplates, {
  WabaTemplateItem
} from "../services/MetaServices/ListWabaTemplates";
import CreateWabaTemplate from "../services/MetaServices/CreateWabaTemplate";
import UpdateWabaTemplate from "../services/MetaServices/UpdateWabaTemplate";
import DeleteWabaTemplate from "../services/MetaServices/DeleteWabaTemplate";
import UploadTemplateHeaderMedia from "../services/MetaServices/UploadTemplateHeaderMedia";
import SyncWabaTemplates from "../services/MetaServices/SyncWabaTemplates";
import { validateTemplatePayload } from "../services/MetaServices/validateTemplateComponents";

// Busca a conexão WhatsApp da empresa e garante que é do canal oficial (Meta)
const getOfficialWhatsapp = async (
  whatsappId: string,
  companyId: number
): Promise<Whatsapp> => {
  const whatsapp = await Whatsapp.findOne({
    where: { id: Number(whatsappId), companyId }
  });

  if (!whatsapp) {
    throw new AppError("ERR_NO_WHATSAPP_FOUND", 404);
  }

  if (whatsapp.channelType !== "official") {
    throw new AppError("ERR_WHATSAPP_NOT_OFFICIAL", 400);
  }

  return whatsapp;
};

// Notifica o frontend via socket sobre mudança de status de template da Meta
const emitTemplateStatus = (
  companyId: number,
  template: { id: string; name?: string; status?: string }
): void => {
  try {
    const io = getIO();
    io.of(`/workspace-${companyId}`).emit(`company-${companyId}-meta-template`, {
      action: "status",
      template
    });
  } catch {
    // Socket pode não estar inicializado (ex.: testes) — não deve quebrar o fluxo
  }
};

// Faz JSON.parse de components quando chega como string (requests multipart)
const parseComponents = (components: any): any[] => {
  if (typeof components !== "string") {
    return components;
  }

  try {
    return JSON.parse(components);
  } catch {
    throw new AppError("ERR_INVALID_COMPONENTS_JSON", 400);
  }
};

// Deriva o formato do HEADER a partir do mimetype do arquivo enviado
const headerFormatFromMime = (mimeType: string): string => {
  if (mimeType.startsWith("image/")) return "IMAGE";
  if (mimeType === "video/mp4") return "VIDEO";
  if (mimeType === "application/pdf") return "DOCUMENT";
  throw new AppError("ERR_UNSUPPORTED_HEADER_MEDIA_TYPE", 400);
};

// Injeta (ou substitui) o componente HEADER com o header_handle retornado pela Meta
const upsertHeaderComponent = (
  components: any[],
  format: string,
  headerHandle: string
): any[] => {
  const headerComponent = {
    type: "HEADER",
    format,
    example: { header_handle: [headerHandle] }
  };

  const list = Array.isArray(components) ? [...components] : [];
  const headerIndex = list.findIndex(c => c?.type === "HEADER");

  // HEADER precisa ser o primeiro componente do template
  if (headerIndex >= 0) {
    list[headerIndex] = headerComponent;
  } else {
    list.unshift(headerComponent);
  }

  return list;
};

// GET /meta-templates/:whatsappId?status=
// Sincroniza templates com a Meta e persiste localmente; se a Meta falhar,
// faz fallback para os dados persistidos (resposta com stale: true)
export const index = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { whatsappId } = req.params;
  const { status } = req.query;
  const { companyId } = req.user;

  const whatsapp = await getOfficialWhatsapp(whatsappId, companyId);

  try {
    const synced = await SyncWabaTemplates({ whatsapp, companyId });

    const templates: WabaTemplateItem[] = status
      ? synced.filter(t => (t as any).status === status)
      : synced;

    return res.json({ templates });
  } catch (syncError: any) {
    logger.warn(
      `[MetaTemplateController] Falha ao consultar Meta, usando cache local: ${syncError.message}`
    );
    // Fallback resiliente: retorna o último estado persistido localmente,
    // mapeado para o mesmo shape que a Meta devolve (snake_case, id = metaTemplateId)
    const local = await WhatsappTemplate.findAll({
      where: { companyId, whatsappId: Number(whatsappId) }
    });

    const mapped = local.map(t => ({
      id: t.metaTemplateId,
      name: t.name,
      language: t.language,
      category: t.category,
      status: t.status,
      parameter_format: t.parameterFormat,
      components: t.components,
      rejected_reason: t.rejectedReason
    }));

    const templates = status
      ? mapped.filter(t => t.status === status)
      : mapped;

    return res.json({ templates, stale: true });
  }
};

// POST /meta-templates/:whatsappId
// Cria template na Meta. Suporta multipart com campo "headerFile" para
// upload de mídia do HEADER (imagem, vídeo mp4 ou pdf)
export const store = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { whatsappId } = req.params;
  const { companyId } = req.user;
  const {
    name,
    category,
    language,
    parameterFormat
  } = req.body;

  // Em multipart (com headerFile) boolean/number chegam como string — coagir
  const allowCategoryChange =
    req.body.allowCategoryChange === undefined
      ? undefined
      : req.body.allowCategoryChange === true || req.body.allowCategoryChange === "true";
  const messageSendTtlSeconds =
    req.body.messageSendTtlSeconds === undefined || req.body.messageSendTtlSeconds === ""
      ? undefined
      : Number(req.body.messageSendTtlSeconds);

  const whatsapp = await getOfficialWhatsapp(whatsappId, companyId);

  if (!name) {
    throw new AppError("ERR_TEMPLATE_NAME_REQUIRED", 400);
  }

  let components = parseComponents(req.body.components);

  // Se veio arquivo de mídia, sobe para a Meta e injeta o handle no HEADER
  const file = req.file as Express.Multer.File | undefined;
  let headerMediaPath: string | undefined;
  if (file) {
    const headerHandle = await UploadTemplateHeaderMedia({
      whatsapp,
      fileBuffer: file.buffer,
      fileName: file.originalname,
      mimeType: file.mimetype
    });

    // Persiste o arquivo localmente — a Meta não devolve a mídia de exemplo
    // depois, e o header_handle não é baixável. Sem o arquivo local seria
    // impossível reenviar a mídia no envio do template.
    const dir = path.resolve("public", `company${companyId}`, "meta-templates");
    fs.mkdirSync(dir, { recursive: true });
    const safeName = `${Date.now()}_${String(file.originalname).replace(/[^\w.\-]/g, "_")}`;
    fs.writeFileSync(path.join(dir, safeName), file.buffer);
    headerMediaPath = `meta-templates/${safeName}`;

    components = upsertHeaderComponent(
      components,
      headerFormatFromMime(file.mimetype),
      headerHandle
    );
  }

  validateTemplatePayload({ name, category, language, components });

  const { id, status: templateStatus } = await CreateWabaTemplate({
    whatsapp,
    name,
    category,
    language,
    parameterFormat,
    components,
    allowCategoryChange,
    messageSendTtlSeconds
  });

  // Cache local imediato (a lista da Meta pode demorar a refletir o novo template)
  await WhatsappTemplate.upsert({
    companyId,
    whatsappId: Number(whatsappId),
    metaTemplateId: id,
    name,
    language: language || null,
    category: category || null,
    status: templateStatus || "PENDING",
    parameterFormat: parameterFormat ? String(parameterFormat).toUpperCase() : null,
    components,
    headerMediaPath: headerMediaPath || null,
    lastSyncedAt: new Date()
  } as any);

  emitTemplateStatus(companyId, { id, name, status: templateStatus });

  await createAuditLogFromRequest(
    req,
    AuditActions.CREATE,
    AuditEntities.TEMPLATE,
    id,
    { whatsappId: Number(whatsappId), name, category, language }
  );

  return res.status(201).json({ template: { id, status: templateStatus, name } });
};

// PUT /meta-templates/:whatsappId/:templateId
export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { whatsappId, templateId } = req.params;
  const { companyId } = req.user;
  const { name, category, messageSendTtlSeconds } = req.body;

  const whatsapp = await getOfficialWhatsapp(whatsappId, companyId);

  let components = parseComponents(req.body.components);

  // Edição com nova mídia de header: sobe para a Meta e injeta o novo handle.
  // Sem arquivo, o frontend preserva o example.header_handle existente.
  const file = req.file as Express.Multer.File | undefined;
  if (file) {
    const headerHandle = await UploadTemplateHeaderMedia({
      whatsapp,
      fileBuffer: file.buffer,
      fileName: file.originalname,
      mimeType: file.mimetype
    });

    const dir = path.resolve("public", `company${companyId}`, "meta-templates");
    fs.mkdirSync(dir, { recursive: true });
    const safeName = `${Date.now()}_${String(file.originalname).replace(/[^\w.\-]/g, "_")}`;
    fs.writeFileSync(path.join(dir, safeName), file.buffer);
    const headerMediaPath = `meta-templates/${safeName}`;

    components = upsertHeaderComponent(
      components,
      headerFormatFromMime(file.mimetype),
      headerHandle
    );

    await WhatsappTemplate.update(
      { headerMediaPath },
      { where: { whatsappId: Number(whatsappId), companyId, metaTemplateId: templateId } }
    );
  }

  await UpdateWabaTemplate({
    whatsapp,
    templateId,
    category,
    components,
    messageSendTtlSeconds
  });

  // Nome é imutável na Meta — se não veio no body, omite do evento
  emitTemplateStatus(companyId, name ? { id: templateId, name } : { id: templateId });

  await createAuditLogFromRequest(
    req,
    AuditActions.UPDATE,
    AuditEntities.TEMPLATE,
    templateId,
    { whatsappId: Number(whatsappId), name }
  );

  return res.json({ success: true });
};

// DELETE /meta-templates/:whatsappId/:templateId?name=
// A Meta exige name + hsm_id para deletar um template
export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { whatsappId, templateId } = req.params;
  const { name } = req.query;
  const { companyId } = req.user;

  if (!name) {
    throw new AppError("ERR_TEMPLATE_NAME_REQUIRED", 400);
  }

  const whatsapp = await getOfficialWhatsapp(whatsappId, companyId);

  await DeleteWabaTemplate({ whatsapp, templateId, name: String(name) });

  emitTemplateStatus(companyId, {
    id: templateId,
    name: String(name),
    status: "DELETED"
  });

  await createAuditLogFromRequest(
    req,
    AuditActions.DELETE,
    AuditEntities.TEMPLATE,
    templateId,
    { whatsappId: Number(whatsappId), name: String(name) }
  );

  return res.json({ success: true });
};

// DELETE /meta-templates/:whatsappId/bulk
// Remove vários templates de uma vez a partir de uma lista de IDs
export const removeBulk = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { whatsappId } = req.params;
  const { templateIds } = req.body;
  const { companyId } = req.user;

  if (!Array.isArray(templateIds) || templateIds.length === 0) {
    throw new AppError("ERR_TEMPLATE_IDS_REQUIRED", 400);
  }

  const whatsapp = await getOfficialWhatsapp(whatsappId, companyId);

  await DeleteWabaTemplate({ whatsapp, templateIds });

  try {
    const io = getIO();
    io.of(`/workspace-${companyId}`).emit(`company-${companyId}-meta-template`, {
      action: "delete",
      templateIds
    });
  } catch {
    // Socket pode não estar inicializado — não deve quebrar o fluxo
  }

  await createAuditLogFromRequest(
    req,
    AuditActions.DELETE,
    AuditEntities.TEMPLATE,
    templateIds.join(","),
    { whatsappId: Number(whatsappId), templateIds }
  );

  return res.json({ success: true });
};

export default {
  index,
  store,
  update,
  remove,
  removeBulk
};
