/**
 * serviço/busca de 1 configuração específica de uma empresa
 * @param:companyId, column
 * SEGURANÇA: usa allowlist de colunas + parametrização para evitar SQL Injection.
 */
import sequelize from "../../database";
import AppError from "../../errors/AppError";
import { isAllowedCompanySettingColumn } from "./_allowedColumns";

type Params = {
  companyId: any;
  column: string;
};

const FindCompanySettingOneService = async ({ companyId, column }: Params): Promise<any> => {
  // Valida coluna contra allowlist (previne SQL Injection no identificador).
  if (!isAllowedCompanySettingColumn(column)) {
    throw new AppError("ERR_INVALID_COLUMN", 400);
  }

  // Valida companyId como número inteiro.
  const cid = Number(companyId);
  if (!Number.isInteger(cid) || cid <= 0) {
    throw new AppError("ERR_INVALID_COMPANY_ID", 400);
  }

  // Nome da coluna é seguro (vindo da allowlist). companyId via replacements.
  const [results] = await sequelize.query(
    `SELECT "${column}" FROM "CompaniesSettings" WHERE "companyId" = :companyId`,
    { replacements: { companyId: cid } }
  );
  return results;
};

export default FindCompanySettingOneService;