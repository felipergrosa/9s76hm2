/**
 * serviço/atualizar 1 configuração da empresa
 * @params:companyId/column(name)/data
 * SEGURANÇA: usa allowlist de colunas + parametrização para evitar SQL Injection.
 */
import sequelize from "../../database";
import AppError from "../../errors/AppError";
import { isAllowedCompanySettingColumn } from "./_allowedColumns";

type Params = {
  companyId: number;
  column: string;
  data: string;
};

const UpdateCompanySettingsService = async ({ companyId, column, data }: Params): Promise<any> => {
  // Valida coluna contra allowlist (previne SQL Injection no identificador).
  if (!isAllowedCompanySettingColumn(column)) {
    throw new AppError("ERR_INVALID_COLUMN", 400);
  }

  // Valida companyId como número inteiro.
  const cid = Number(companyId);
  if (!Number.isInteger(cid) || cid <= 0) {
    throw new AppError("ERR_INVALID_COMPANY_ID", 400);
  }

  // Nome da coluna é seguro (vindo da allowlist). Valores via replacements.
  const [results] = await sequelize.query(
    `UPDATE "CompaniesSettings" SET "${column}" = :data WHERE "companyId" = :companyId`,
    { replacements: { data, companyId: cid } }
  );

  return results;
};

export default UpdateCompanySettingsService;