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
import WabaPricingRate from "../models/WabaPricingRate";
import { getMetaAxiosClient } from "../services/MetaServices/metaApiClient";
import {
  getUsdToBrlRate,
  SyncWabaPricing
} from "../services/MetaServices/WabaPricingService";
import {
  validateTemplatePayload,
  validateMessageSendTtlSeconds
} from "../services/MetaServices/validateTemplateComponents";

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
// Anexa custo estimado por envio (R$) a cada template conforme sua categoria.
// Uma única query carrega os rates da conexão e indexa por categoria.
const withEstimatedCost = async (
  templates: any[],
  whatsappId: number,
  companyId: number
): Promise<any[]> => {
  try {
    const rates = await WabaPricingRate.findAll({
      where: { companyId, whatsappId, country: "BR" }
    });
    if (rates.length === 0) return templates;

    const rateByCategory = new Map<string, number>();
    rates.forEach(r => {
      const value = Number(r.rateBrl ?? r.rate);
      if (Number.isFinite(value)) rateByCategory.set(r.category, value);
    });

    return templates.map(t => ({
      ...t,
      estimatedCost: rateByCategory.get(t.category) ?? null
    }));
  } catch {
    // Falha na consulta de custo não deve impedir a listagem de templates
    return templates;
  }
};

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

    return res.json({
      templates: await withEstimatedCost(templates, Number(whatsappId), companyId)
    });
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

    return res.json({
      templates: await withEstimatedCost(templates, Number(whatsappId), companyId),
      stale: true
    });
  }
};

// GET /meta-templates/:whatsappId/pricing
// Tarifas vigentes por categoria (R$), cotação USD→BRL e gasto real dos
// últimos 30 dias conforme pricing_analytics da Meta
export const pricing = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { whatsappId } = req.params;
  const { companyId } = req.user;

  const whatsapp = await getOfficialWhatsapp(whatsappId, companyId);

  const [rates, usdToBrl] = await Promise.all([
    WabaPricingRate.findAll({
      where: { companyId, whatsappId: Number(whatsappId), country: "BR" },
      order: [["category", "ASC"]]
    }),
    getUsdToBrlRate(companyId)
  ]);

  // Gasto real consolidado dos últimos 30 dias (billed, na moeda da WABA)
  let billedLast30d: any = null;
  try {
    const client = getMetaAxiosClient(whatsapp);
    const end = Math.floor(Date.now() / 1000);
    const start = end - 30 * 24 * 60 * 60;
    const { data } = await client.get(`/${whatsapp.wabaBusinessAccountId}`, {
      params: {
        fields:
          "pricing_analytics" +
          `.start(${start})` +
          `.end(${end})` +
          ".granularity(MONTHLY)" +
          ".metric_types(COST,VOLUME)" +
          ".dimensions(PRICING_CATEGORY,PRICING_TYPE)"
      }
    });

    const points = (data?.pricing_analytics?.data || []).flatMap(
      (e: any) => e.data_points || []
    );

    const byCategory: Record<string, { cost: number; volume: number }> = {};
    let totalCost = 0;
    let totalVolume = 0;
    points.forEach((p: any) => {
      if (p.pricing_type !== "REGULAR") return;
      const cat = p.pricing_category || "OUTROS";
      const agg = byCategory[cat] || { cost: 0, volume: 0 };
      agg.cost += Number(p.cost || 0);
      agg.volume += Number(p.volume || 0);
      byCategory[cat] = agg;
      totalCost += Number(p.cost || 0);
      totalVolume += Number(p.volume || 0);
    });

    billedLast30d = { totalCost, totalVolume, byCategory };
  } catch (err: any) {
    // WABA via Solution Partner não retorna COST — segue sem o consolidado
    logger.warn(
      `[MetaTemplateController] pricing_analytics indisponível: ${err.message}`
    );
  }

  return res.json({
    rates: rates.map(r => ({
      category: r.category,
      country: r.country,
      rate: r.rate !== null ? Number(r.rate) : null,
      currency: r.currency,
      rateBrl: r.rateBrl !== null ? Number(r.rateBrl) : null,
      tier: r.tier,
      source: r.source,
      lastSyncAt: r.lastSyncAt
    })),
    usdToBrl,
    billedLast30d
  });
};

// POST /meta-templates/:whatsappId/pricing/sync
// Força o recálculo das tarifas a partir de pricing_analytics (útil no
// primeiro uso — o cron diário também popula automaticamente)
export const pricingSync = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { whatsappId } = req.params;
  const { companyId } = req.user;

  const whatsapp = await getOfficialWhatsapp(whatsappId, companyId);
  const updated = await SyncWabaPricing({ whatsapp, companyId });

  return res.json({ updated });
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

  // Se veio arquivo de mídia, sobe para a Meta e injeta o handle no HEADER.
  // O multer (diskStorage) já gravou o arquivo na pasta final do tenant.
  const file = req.file as Express.Multer.File | undefined;
  let headerMediaPath: string | undefined;
  if (file) {
    try {
      const headerHandle = await UploadTemplateHeaderMedia({
        whatsapp,
        fileBuffer: fs.readFileSync(file.path),
        fileName: file.originalname,
        mimeType: file.mimetype
      });

      // Persiste o path local — a Meta não devolve a mídia de exemplo depois,
      // e o header_handle não é baixável. Sem o arquivo local seria impossível
      // reenviar a mídia no envio do template.
      headerMediaPath = `meta-templates/${file.filename}`;

      components = upsertHeaderComponent(
        components,
        headerFormatFromMime(file.mimetype),
        headerHandle
      );
    } catch (err) {
      // Falha no upload para a Meta: remove o arquivo para não deixar órfão
      fs.unlink(file.path, () => {});
      throw err;
    }
  }

  validateTemplatePayload({
    name,
    category,
    language,
    components,
    messageSendTtlSeconds
  });

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
  const { name, category } = req.body;

  // Em multipart boolean/number chegam como string — coagir
  const messageSendTtlSeconds =
    req.body.messageSendTtlSeconds === undefined ||
    req.body.messageSendTtlSeconds === ""
      ? undefined
      : Number(req.body.messageSendTtlSeconds);

  const whatsapp = await getOfficialWhatsapp(whatsappId, companyId);

  // A faixa de TTL válida depende da categoria — quando não enviada,
  // usa a categoria do cache local do template
  if (messageSendTtlSeconds !== undefined) {
    let ttlCategory = category;
    if (!ttlCategory) {
      const cached = await WhatsappTemplate.findOne({
        where: {
          companyId,
          whatsappId: Number(whatsappId),
          metaTemplateId: templateId
        },
        attributes: ["category"]
      });
      ttlCategory = cached?.category || undefined;
    }
    validateMessageSendTtlSeconds(messageSendTtlSeconds, ttlCategory);
  }

  let components = parseComponents(req.body.components);

  // Edição com nova mídia de header: sobe para a Meta e injeta o novo handle.
  // Sem arquivo, o frontend preserva o example.header_handle existente.
  const file = req.file as Express.Multer.File | undefined;
  if (file) {
    try {
      const headerHandle = await UploadTemplateHeaderMedia({
        whatsapp,
        fileBuffer: fs.readFileSync(file.path),
        fileName: file.originalname,
        mimeType: file.mimetype
      });

      const headerMediaPath = `meta-templates/${file.filename}`;

      components = upsertHeaderComponent(
        components,
        headerFormatFromMime(file.mimetype),
        headerHandle
      );

    await WhatsappTemplate.update(
      { headerMediaPath },
      { where: { whatsappId: Number(whatsappId), companyId, metaTemplateId: templateId } }
    );
    } catch (err) {
      // Falha no upload/update: remove o arquivo para não deixar órfão
      fs.unlink(file.path, () => {});
      throw err;
    }
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
