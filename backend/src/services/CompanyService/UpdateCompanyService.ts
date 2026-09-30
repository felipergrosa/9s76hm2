import AppError from "../../errors/AppError";
import Company from "../../models/Company";
import Setting from "../../models/Setting";
import User from "../../models/User";
import { serviceCache } from "../../utils/serviceCache";

interface CompanyData {
  name: string;
  id?: number | string;
  phone?: string;
  email?: string;
  status?: boolean;
  planId?: number;
  campaignsEnabled?: boolean;
  dueDate?: string;
  recurrence?: string;
  document?: string;
  paymentMethod?: string;
  password?: string;
}

const UpdateCompanyService = async (
  companyData: CompanyData
): Promise<Company> => {

  const company = await Company.findByPk(companyData.id);
  const {
    name,
    phone,
    email,
    status,
    planId,
    campaignsEnabled,
    dueDate,
    recurrence,
    document,
    paymentMethod,
    password
  } = companyData;

  if (!company) {
    throw new AppError("ERR_NO_COMPANY_FOUND", 404);
  }

  // Troca de e-mail da empresa/usuário-dono: só executa quando e-mail foi enviado
  if (email !== undefined) {
    const existUser = await User.findOne({
      where: {
        companyId: company.id,
        email: email
      }
    });

    if (existUser && existUser.email !== company.email) {
      throw new AppError("Usuário já existe com esse e-mail!", 404)
    }
  }

  // Atualiza credenciais do usuário-dono apenas quando e-mail/senha foram
  // enviados (uso exclusivo do super; não-super recebe whitelist no controller).
  // O hook @BeforeUpdate do model User hasheia a senha (bcrypt cost 12).
  if (email !== undefined || password !== undefined) {
    const user = await User.findOne({
      where: {
        companyId: company.id,
        email: company.email
      }
    });

    if (!user) {
      throw new AppError("ERR_NO_USER_FOUND", 404)
    }

    const userData: any = {};
    if (email !== undefined) { userData.email = email; }
    if (password !== undefined) { userData.password = password; }
    await user.update(userData);

    // Invalida o cache do usuário usado pelo middleware checkPermission (chave user:{id})
    serviceCache.invalidate(`user:${user.id}`);
  }

  // Atualiza somente campos efetivamente enviados (evita sobrescrever com undefined)
  const companyFields: any = {};
  if (name !== undefined) { companyFields.name = name; }
  if (phone !== undefined) { companyFields.phone = phone; }
  if (email !== undefined) { companyFields.email = email; }
  if (status !== undefined) { companyFields.status = status; }
  if (planId !== undefined) { companyFields.planId = planId; }
  if (dueDate !== undefined) { companyFields.dueDate = dueDate; }
  if (recurrence !== undefined) { companyFields.recurrence = recurrence; }
  if (document !== undefined) { companyFields.document = document; }
  if (paymentMethod !== undefined) { companyFields.paymentMethod = paymentMethod; }

  await company.update(companyFields);

  if (companyData.campaignsEnabled !== undefined) {
    const [setting, created] = await Setting.findOrCreate({
      where: {
        companyId: company.id,
        key: "campaignsEnabled"
      },
      defaults: {
        companyId: company.id,
        key: "campaignsEnabled",
        value: `${campaignsEnabled}`
      }
    });
    if (!created) {
      await setting.update({ value: `${campaignsEnabled}` });
    }

    // Invalida o cache da listagem de settings da empresa (chave settings:{companyId})
    serviceCache.invalidate(`settings:${company.id}`);
  }

  return company;
};

export default UpdateCompanyService;
