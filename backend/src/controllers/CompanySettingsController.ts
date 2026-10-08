/** 
 * @TercioSantos-0 |
 * controller/get/todas as configurações de 1 empresa |
 * controller/get/1 configuração específica |
 * controller/put/atualização de 1 configuração |
 * @param:companyId
 */
import { Request, Response } from "express";
import FindCompanySettingsService from "../services/CompaniesSettings/FindCompanySettingsService";
import UpdateCompanySettingsService from "../services/CompaniesSettings/UpdateCompanySettingService";
import FindCompanySettingOneService from "../services/CompaniesSettings/FindCompanySettingOneService";
import User from "../models/User";

type IndexGetCompanySettingQuery = {
  companyId: number;
  column: string;
  data:string;
};

type IndexGetCompanySettingOneQuery = {
  column: string;
};

// Sentinela para campos sensíveis já preenchidos (senha do troncal SIP).
// O frontend usa para exibir "senha já cadastrada" sem expor o valor.
const SENSITIVE_VALUE_MASK = "__set__";

export const show = async (
    req: Request,
    res: Response
  ): Promise<Response> => {
    const { companyId } = req.user;

    const settings = await FindCompanySettingsService({
      companyId
    });

    if (!settings) {
      return res.status(200).json(settings);
    }

    // Serializa para objeto plano e mascara campos sensíveis.
    // sipPassword nunca sai em claro aqui: o softphone obtém o valor real
    // apenas via GET /companySipTrunk (endpoint autenticado dedicado).
    const plain: any = settings.toJSON();
    plain.sipPasswordSet = Boolean(plain.sipPassword);
    plain.sipPassword = plain.sipPassword ? SENSITIVE_VALUE_MASK : null;

    return res.status(200).json(plain);
  };


  export const showOne = async (req: Request, res: Response): Promise<Response> => {
    const { column } = req.query as IndexGetCompanySettingOneQuery;
    const { companyId } = req.user;
    
    const setting = await FindCompanySettingOneService({
      companyId,
      column
    });

    // Mascara a senha do troncal também na leitura unitária genérica.
    if (column === "sipPassword" && setting && setting[0]) {
      return res.status(200).json({
        sipPassword: setting[0].sipPassword ? SENSITIVE_VALUE_MASK : null
      });
    }
    
    return res.status(200).json(setting[0]);
  };

  /**
   * GET /companySipTrunk — configuração do troncal SIP para o softphone.
   * Acessível a qualquer usuário autenticado da empresa (sem settings.view):
   * agentes também precisam registrar o ramal no softphone.
   * Único endpoint que expõe sipPassword — necessário para o REGISTER (digest auth)
   * do jssip, que roda no navegador.
   */
  export const showSipTrunk = async (
    req: Request,
    res: Response
  ): Promise<Response> => {
    const { companyId, id: userId } = req.user;

    const settings = await FindCompanySettingsService({ companyId });

    if (!settings || settings.sipEnabled !== "enabled" || !settings.sipHost) {
      // Não expõe nada além do status quando desabilitado/incompleto
      return res.status(200).json({ enabled: false });
    }

    // Ramal do usuário logado (Users.ramal) — usado como usuário/extensão SIP.
    const user = await User.findByPk(userId, { attributes: ["id", "ramal"] });

    return res.status(200).json({
      enabled: true,
      host: settings.sipHost,
      port: settings.sipPort,
      domain: settings.sipDomain,
      user: settings.sipUser,
      password: settings.sipPassword,
      transport: settings.sipTransport,
      callerId: settings.sipCallerId,
      ramal: user?.ramal || null
    });
  };

export const update = async(
  req: Request,
  res: Response
): Promise<Response> => {
  const {  column, data } = req.body as IndexGetCompanySettingQuery;
  const { companyId } = req.user;

  const result = await UpdateCompanySettingsService({
    companyId,
    column,
    data
  })
  
  return res.status(200).json({response:true, result:result});
}
