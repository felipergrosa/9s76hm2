import * as Yup from "yup";
import { Request, Response } from "express";
// import { getIO } from "../libs/socket";
import AppError from "../errors/AppError";
import Company from "../models/Company";

import ListCompaniesService from "../services/CompanyService/ListCompaniesService";
import CreateCompanyService from "../services/CompanyService/CreateCompanyService";
import UpdateCompanyService from "../services/CompanyService/UpdateCompanyService";
import ShowCompanyService from "../services/CompanyService/ShowCompanyService";
import UpdateSchedulesService from "../services/CompanyService/UpdateSchedulesService";
import DeleteCompanyService from "../services/CompanyService/DeleteCompanyService";
import FindAllCompaniesService from "../services/CompanyService/FindAllCompaniesService";
import ShowPlanCompanyService from "../services/CompanyService/ShowPlanCompanyService";
import User from "../models/User";
import ListCompaniesPlanService from "../services/CompanyService/ListCompaniesPlanService";

type IndexQuery = {
  searchParam: string;
  pageNumber: string;
};

type CompanyData = {
  name: string;
  id?: number;
  phone?: string;
  email?: string;
  password?: string;
  status?: boolean;
  planId?: number;
  campaignsEnabled?: boolean;
  dueDate?: string;
  recurrence?: string;
  document?: string;
  paymentMethod?: string;
};

type SchedulesData = {
  schedules: [];
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { searchParam, pageNumber } = req.query as IndexQuery;

  // Usa req.user populado pelo isAuth + usuário FRESCO do DB para flag super
  const { companyId } = req.user;
  const requestUser = await User.findByPk(req.user.id);

  if (requestUser?.super === true) {
    const { companies, count, hasMore } = await ListCompaniesService({
      searchParam,
      pageNumber
    });

    return res.json({ companies, count, hasMore });

  } else {
    // SEGURANÇA: não-super só enxerga a própria empresa (filtro obrigatório)
    const { companies, count, hasMore } = await ListCompaniesService({
      searchParam,
      pageNumber,
      companyId
    });
    return res.json({ companies, count, hasMore });

  }

};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const newCompany: CompanyData = req.body;

  const schema = Yup.object().shape({
    name: Yup.string().required(),
    password: Yup.string().required().min(5)
  });

  try {
    await schema.validate(newCompany);
  } catch (err: any) {
    throw new AppError(err.message);
  }

  const company = await CreateCompanyService(newCompany);

  return res.status(200).json(company);
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { id } = req.params;
  const { companyId } = req.user;
  const requestUser = await User.findByPk(req.user.id);

  if (requestUser?.super === true) {
    const company = await ShowCompanyService(id);
    return res.status(200).json(company);
  } else if (id !== companyId.toString()) {
    return res.status(400).json({ error: "Você não possui permissão para acessar este recurso!" });
  } else if (id === companyId.toString()) {
    const company = await ShowCompanyService(id);
    return res.status(200).json(company);
  }
};

export const list = async (req: Request, res: Response): Promise<Response> => {

  const { companyId } = req.user;
  const requestUser = await User.findByPk(req.user.id);

  if (requestUser?.super === true) {
    const companies: Company[] = await FindAllCompaniesService();
    return res.status(200).json(companies);
  } else {
    // SEGURANÇA: não-super recebe apenas a própria empresa, sem varrer a tabela
    const companies: Company[] = await Company.findAll({ where: { id: companyId } });
    return res.status(200).json(companies);
  }

};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {

  const companyData: CompanyData = req.body;

  const schema = Yup.object().shape({
    name: Yup.string()
  });

  try {
    await schema.validate(companyData);
  } catch (err: any) {
    throw new AppError(err.message);
  }

  const { id } = req.params;
  const { companyId } = req.user;
  const requestUser = await User.findByPk(req.user.id);

  if (requestUser?.super === true) {
    const company = await UpdateCompanyService({ id, ...companyData });
    return res.status(200).json(company);
  } else if (
    (companyData?.id !== undefined && String(companyData.id) !== String(id)) ||
    String(companyId) !== String(id)
  ) {
    return res.status(400).json({ error: "Você não possui permissão para acessar este recurso!" });
  } else {
    // SEGURANÇA: não-super só edita a própria empresa e apenas campos da
    // whitelist — planId, status, dueDate, recurrence, paymentMethod,
    // campaignsEnabled e credenciais do usuário-dono são exclusivos do super.
    const { name, phone, document } = companyData;
    const company = await UpdateCompanyService({ id, name, phone, document });
    return res.status(200).json(company);
  }

};

export const updateSchedules = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { schedules }: SchedulesData = req.body;
  const { id } = req.params;
  const { companyId } = req.user;
  const requestUser = await User.findByPk(req.user.id);

  if (requestUser?.super === true) {
    const company = await UpdateSchedulesService({ id, schedules });
    return res.status(200).json(company);
  } else if (companyId.toString() !== id) {
    return res.status(400).json({ error: "Você não possui permissão para acessar este recurso!" });
  } else {
    const company = await UpdateSchedulesService({ id, schedules });
    return res.status(200).json(company);
  }

};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { id } = req.params;
  const requestUser = await User.findByPk(req.user.id);

  if (requestUser?.super === true) {
    const company = await DeleteCompanyService(id);
    return res.status(200).json(company);
  } else {
    return res.status(400).json({ error: "Você não possui permissão para acessar este recurso!" });
  }

};

export const listPlan = async (req: Request, res: Response): Promise<Response> => {
  const { id } = req.params;

  // Validar se o id foi fornecido
  if (!id || id === 'undefined') {
    return res.status(400).json({ error: "ID da empresa não fornecido" });
  }

  const { companyId } = req.user;
  const requestUser = await User.findByPk(req.user.id);

  if (requestUser?.super === true) {
    const company = await ShowPlanCompanyService(id);
    return res.status(200).json(company);
  } else if (companyId.toString() !== id) {
    return res.status(400).json({ error: "Você não possui permissão para acessar este recurso!" });
  } else {
    const company = await ShowPlanCompanyService(id);
    return res.status(200).json(company);
  }

};

export const indexPlan = async (req: Request, res: Response): Promise<Response> => {
  const { searchParam, pageNumber } = req.query as IndexQuery;

  const requestUser = await User.findByPk(req.user.id);

  if (requestUser?.super === true) {
    const companies = await ListCompaniesPlanService();
    return res.json({ companies });
  } else {
    return res.status(400).json({ error: "Você não possui permissão para acessar este recurso!" });
  }

};