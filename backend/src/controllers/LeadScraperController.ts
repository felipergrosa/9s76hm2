import { Request, Response } from "express";
import { Op } from "sequelize";
import LeadScraperJob from "../models/LeadScraperJob";
import User from "../models/User";
import { createScraperJob, runScraperJob, requestJobCancel } from "../services/LeadScraper/LeadScraperJobService";
import ImportLeadsService from "../services/ContactServices/ImportLeadsService";
import { leadScraperQueue } from "../queues";
import { isApifyConfigured } from "../services/Instagram/InstagramApifyProvider";
import { isGmapsApifyConfigured } from "../services/LeadScraper/GoogleMapsApifyProvider";
import { GMAPS_SIDECAR_ENV, isSidecarAvailable } from "../services/LeadScraper/GmapsSidecarService";
import {
  getCompanyApifyTokenStatus,
  setCompanyApifyToken,
  clearCompanyApifyToken
} from "../services/LeadScraper/ApifyTokenService";
import logger from "../utils/logger";

const VALID_SOURCES = ["google_maps", "cnpj", "cnpj_search", "ig_followers", "conselho"];
const IG_HANDLE_REGEX = /^[a-zA-Z0-9._]{1,30}$/;

// Expõe (sem vazar segredos) quais motores/integrações estão configurados
// (override por empresa ou fallback global), para o frontend informar o
// usuário sobre qual engine será usada e evitar disparar buscas que vão
// falhar por falta de configuração.
export const getEngineStatus = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const apify = await isApifyConfigured(companyId);
  const gmapsSidecarConfigured = Boolean(process.env[GMAPS_SIDECAR_ENV]?.trim());
  const gmapsSidecarUp = gmapsSidecarConfigured ? await isSidecarAvailable() : false;
  const gmapsApifyAvailable = await isGmapsApifyConfigured(companyId);

  const gmapsEngine = gmapsApifyAvailable ? "apify" : gmapsSidecarUp ? "sidecar" : "puppeteer";

  return res.json({
    apify: { configured: apify },
    googleMaps: {
      engine: gmapsEngine,
      apifyAvailable: gmapsApifyAvailable,
      sidecarConfigured: gmapsSidecarConfigured,
      sidecarUp: gmapsSidecarUp
    },
    instagramFollowers: { requiresApify: true, available: apify },
    brasilIo: { configured: Boolean(process.env.BRASILIO_TOKEN?.trim()) }
  });
};

// Configurações do token Apify por empresa — nunca retorna o valor em texto
// puro, só um status mascarado (ex.: "sk-...ab12").
export const getApifyTokenStatus = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { companyId } = req.user;
    const status = await getCompanyApifyTokenStatus(companyId);
    return res.json(status);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Erro ao consultar token Apify" });
  }
};

export const saveApifyToken = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { companyId } = req.user;
    const token = String(req.body?.token || "").trim();
    if (!token) return res.status(400).json({ error: "token é obrigatório" });
    if (token.length > 500) return res.status(400).json({ error: "token inválido" });

    const masked = await setCompanyApifyToken(companyId, token);
    return res.json({ ok: true, masked });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Erro ao salvar token Apify" });
  }
};

export const deleteApifyToken = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { companyId } = req.user;
    await clearCompanyApifyToken(companyId);
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Erro ao remover token Apify" });
  }
};

export const startJob = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { companyId } = req.user;
    const { source, filters } = req.body;

    if (!VALID_SOURCES.includes(source)) {
      return res.status(400).json({ error: "source inválido" });
    }
    if (!filters || typeof filters !== "object" || Array.isArray(filters)) {
      return res.status(400).json({ error: "filters deve ser um objeto" });
    }

    if (filters.maxResults !== undefined) {
      const n = Number(filters.maxResults);
      if (!Number.isFinite(n)) return res.status(400).json({ error: "maxResults deve ser um inteiro" });
      filters.maxResults = Math.min(Math.max(Math.trunc(n), 1), 5000);
    }
    if (filters.cnpjs !== undefined) {
      if (!Array.isArray(filters.cnpjs)) return res.status(400).json({ error: "cnpjs deve ser um array" });
      if (filters.cnpjs.length > 500) return res.status(400).json({ error: "máximo de 500 CNPJs por job" });
    }
    if (filters.igTargetHandle !== undefined) {
      const handle = String(filters.igTargetHandle).trim().replace(/^@+/, "");
      if (!IG_HANDLE_REGEX.test(handle)) return res.status(400).json({ error: "igTargetHandle inválido" });
      filters.igTargetHandle = handle;
    }
    // Geo (busca por área no mapa): lat/lng obrigatórios juntos, radiusKm opcional
    if (filters.lat !== undefined || filters.lng !== undefined) {
      const lat = Number(filters.lat);
      const lng = Number(filters.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
        return res.status(400).json({ error: "lat/lng inválidos" });
      }
      filters.lat = lat;
      filters.lng = lng;
      const r = Number(filters.radiusKm ?? 5);
      filters.radiusKm = Number.isFinite(r) ? Math.min(Math.max(r, 0.5), 50) : 5;
    }

    // Anti-concorrência: apenas 1 job ativo por empresa
    const active = await LeadScraperJob.findOne({
      where: { companyId, status: { [Op.in]: ["pending", "running"] } },
      attributes: ["id"]
    });
    if (active) return res.status(409).json({ error: "Já existe um job em andamento para esta empresa" });

    const job = await createScraperJob(companyId, source, filters);

    try {
      await leadScraperQueue.add("RunJob", { jobId: job.id }, {
        jobId: String(job.id),
        attempts: 1,
        removeOnComplete: true,
        removeOnFail: false
      });
    } catch (qErr: any) {
      // Fallback se a fila/Redis estiver indisponível: executa em background como antes
      logger.warn(`[LeadScraper] fila indisponível (${qErr?.message}), executando job ${job.id} via setImmediate`);
      setImmediate(() => {
        runScraperJob(job.id).catch((e: any) =>
          logger.error(`[LeadScraper] job ${job.id} falhou: ${e?.message}`)
        );
      });
    }

    return res.status(201).json(job);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Erro ao iniciar job" });
  }
};

export const listJobs = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { companyId } = req.user;
    const attributes = ["id", "source", "status", "progress", "totalFound", "filters", "createdAt"];
    const order: any = [["createdAt", "DESC"]];

    // Retrocompatibilidade: sem ?page retorna array plano (formato esperado pelo frontend atual)
    if (req.query.page === undefined) {
      const jobs = await LeadScraperJob.findAll({ where: { companyId }, attributes, order, limit: 30 });
      return res.json(jobs);
    }

    const page = Math.max(1, parseInt(String(req.query.page), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit), 10) || 30));
    const { rows, count } = await LeadScraperJob.findAndCountAll({
      where: { companyId },
      attributes,
      order,
      limit,
      offset: (page - 1) * limit
    });
    return res.json({ jobs: rows, count, pages: Math.ceil(count / limit) });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Erro ao listar jobs" });
  }
};

export const getJob = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { companyId } = req.user;
    const job = await LeadScraperJob.findOne({ where: { id: req.params.id, companyId } });
    if (!job) return res.status(404).json({ error: "Job não encontrado" });
    return res.json(job);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Erro ao buscar job" });
  }
};

// Exclui um job finalizado do histórico (jobs em andamento não são removíveis)
export const deleteJob = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { companyId } = req.user;
    const job = await LeadScraperJob.findOne({ where: { id: req.params.id, companyId } });
    if (!job) return res.status(404).json({ error: "Job não encontrado" });
    if (job.status === "pending" || job.status === "running") {
      return res.status(409).json({ error: "Job em andamento não pode ser excluído" });
    }
    await job.destroy();
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Erro ao excluir job" });
  }
};

// Cancela um job pendente ou em andamento: sinaliza o processor para abortar
// no próximo checkpoint e remove o item da fila Bull se ainda não iniciou.
export const stopJob = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { companyId } = req.user;
    const job = await LeadScraperJob.findOne({ where: { id: req.params.id, companyId } });
    if (!job) return res.status(404).json({ error: "Job não encontrado" });
    if (job.status !== "pending" && job.status !== "running") {
      return res.status(409).json({ error: "Job já finalizado" });
    }

    requestJobCancel(job.id);

    // Se ainda aguardando na fila, remove para não disparar o processor
    // (remove() falha em job "active" — nesse caso o cancelamento cooperativo cuida)
    try {
      const bullJob = await leadScraperQueue.getJob(String(job.id));
      if (bullJob) await bullJob.remove().catch(() => {});
    } catch {}

    await job.update({ status: "cancelled", errorMessage: "Cancelado pelo usuário" });
    logger.info(`[LeadScraperJob] jobId=${job.id} cancelado por companyId=${companyId}`);
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Erro ao cancelar job" });
  }
};

// Limpa todo o histórico finalizado da empresa (done/error)
export const clearJobs = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { companyId } = req.user;
    const deleted = await LeadScraperJob.destroy({
      where: { companyId, status: { [Op.in]: ["done", "error", "cancelled"] } }
    });
    return res.json({ ok: true, deleted });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Erro ao limpar histórico" });
  }
};

export const importJobResults = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { companyId } = req.user;
    const { indices, contactListName, tagName, walletUserId } = req.body;
    const job = await LeadScraperJob.findOne({ where: { id: req.params.id, companyId } });
    if (!job) return res.status(404).json({ error: "Job não encontrado" });
    // cancelled é importável: leads coletados até o cancelamento continuam válidos
    if (job.status !== "done" && job.status !== "cancelled") {
      return res.status(409).json({ error: "job ainda não concluído" });
    }

    let indexSet: Set<number> | null = null;
    if (indices !== undefined && indices !== null) {
      if (!Array.isArray(indices) || !indices.every((i: any) => Number.isInteger(i) && i >= 0)) {
        return res.status(400).json({ error: "indices deve ser um array de inteiros" });
      }
      indexSet = new Set(indices);
    }
    if (contactListName !== undefined && (typeof contactListName !== "string" || contactListName.length > 100)) {
      return res.status(400).json({ error: "contactListName inválido (máx. 100 caracteres)" });
    }
    if (tagName !== undefined && (typeof tagName !== "string" || tagName.length > 100)) {
      return res.status(400).json({ error: "tagName inválido (máx. 100 caracteres)" });
    }
    let resolvedWalletUserId: number | undefined;
    if (walletUserId !== undefined && walletUserId !== null && walletUserId !== "") {
      const n = Number(walletUserId);
      if (!Number.isInteger(n)) return res.status(400).json({ error: "walletUserId inválido" });
      const owner = await User.findOne({ where: { id: n, companyId } });
      if (!owner) return res.status(400).json({ error: "Usuário da carteira não encontrado nesta empresa" });
      resolvedWalletUserId = n;
    }

    const allResults = job.results || [];
    const selectedIdx: number[] = [];
    const selected = allResults.filter((_: any, i: number) => {
      const ok = indexSet ? indexSet.has(i) : true;
      if (ok) selectedIdx.push(i);
      return ok;
    });

    const leads = selected.map((r: any) => ({
      name: r.nomeFantasia || r.name || "",
      razaoSocial: r.razaoSocial || "",
      number: (r.phone || r.instagramPhone || "").replace(/\D/g, ""),
      email: r.email || "",
      cnpj: r.cnpj || "",
      website: r.website || "",
      endereco: r.address || "",
      cidade: r.municipio || "",
      uf: r.uf || "",
      porte: r.porte || "",
      cnae: r.cnaeDescricao || "",
      instagram: r.instagram || "",
      twitter: r.twitter || "",
      linkedin: r.linkedin || "",
      // Campos opcionais consumidos pelo ImportLeadsService
      rating: r.rating || "",
      situacao: r.situacao || "",
      naturezaJuridica: r.naturezaJuridica || "",
      cnaeId: r.cnaeId || "",
      registro: r.registro || "",
      segmento: r.category || r.cnaeDescricao || "",
      googleMapsUrl: r.googleMapsUrl || ""
    }));

    const result = await ImportLeadsService({ companyId, leads, contactListName, tagName, walletUserId: resolvedWalletUserId });

    // Envia lote p/ ERP via n8n em background (sem bloquear a resposta)
    try {
      const { enqueueLeadExport } = await import("../services/LeadScraper/LeadExportService");
      await enqueueLeadExport({
        companyId,
        contactIds: result.contactIds || [],
        jobId: job.id,
        source: `lead_scraper:${job.source}`
      });
    } catch (err: any) {
      logger.warn(`[LeadScraper] Falha ao enfileirar export ERP: ${err?.message}`);
    }

    // Marca os índices importados e persiste no job (array novo p/ Sequelize detectar mudança no JSON)
    const results = [...allResults];
    selectedIdx.forEach(i => {
      results[i] = { ...results[i], imported: true };
    });
    await job.update({ results });

    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Erro ao importar leads" });
  }
};
