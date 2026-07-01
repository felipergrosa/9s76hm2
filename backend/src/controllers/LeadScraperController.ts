import { Request, Response } from "express";
import LeadScraperJob from "../models/LeadScraperJob";
import { createScraperJob } from "../services/LeadScraper/LeadScraperJobService";
import ImportLeadsService from "../services/ContactServices/ImportLeadsService";
import { leadScraperQueue } from "../queues";

export const startJob = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { companyId } = req.user;
    const { source, filters } = req.body;
    if (!source || !filters) return res.status(400).json({ error: "source e filters são obrigatórios" });
    const job = await createScraperJob(companyId, source, filters);
    await leadScraperQueue.add("RunJob", { jobId: job.id }, { removeOnComplete: 50 });
    return res.status(201).json(job);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Erro ao iniciar job" });
  }
};

export const listJobs = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { companyId } = req.user;
    const jobs = await LeadScraperJob.findAll({
      where: { companyId },
      attributes: ["id", "source", "status", "progress", "totalFound", "filters", "createdAt"],
      order: [["createdAt", "DESC"]],
      limit: 30
    });
    return res.json(jobs);
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

export const importJobResults = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { companyId } = req.user;
    const { indices, contactListName, tagName } = req.body;
    const job = await LeadScraperJob.findOne({ where: { id: req.params.id, companyId } });
    if (!job) return res.status(404).json({ error: "Job não encontrado" });

    const allResults = job.results || [];
    const selected = indices?.length
      ? allResults.filter((_: any, i: number) => indices.includes(i))
      : allResults;

    const leads = selected.map((r: any) => ({
      name: r.nomeFantasia || r.name || "",
      razaoSocial: r.razaoSocial || "",
      number: (r.phone || "").replace(/\D/g, ""),
      email: r.email || "",
      cnpj: r.cnpj || "",
      website: r.website || "",
      endereco: r.address || "",
      cidade: r.municipio || "",
      uf: r.uf || "",
      porte: r.porte || "",
      cnae: r.cnaeDescricao || ""
    }));

    const result = await ImportLeadsService({ companyId, leads, contactListName, tagName });
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Erro ao importar leads" });
  }
};
