import { Op, Sequelize } from "sequelize";
import AppError from "../../errors/AppError";
import {
  createAccessToken,
  createRefreshToken
} from "../../helpers/CreateTokens";
import { SerializeUser } from "../../helpers/SerializeUser";
import Company from "../../models/Company";
import User from "../../models/User";
import ShowUserService from "../UserServices/ShowUserService";

// MODELO DE VÍNCULO (decisão de domínio): mesma identidade = mesmo e-mail
// (normalizado em lowercase) cadastrado como User em outra empresa.
// Escolhido por ser a solução mais simples que funciona — não exige
// migration nem tabela de membership, e casa com a prática atual de um
// mesmo operador ser cadastrado pelo admin em várias empresas/tenants.
// Trade-off aceito (N2): quem cadastra o e-mail na empresa alvo (admin
// daquela empresa) define o vínculo; o switch não pede senha novamente
// porque a sessão autenticada atual já é a prova de identidade.

interface SwitchableAccount {
  companyId: number;
  companyName: string;
  userId: number;
  profile: string;
}

interface SwitchResult {
  token: string;
  refreshToken: string;
  serializedUser: Awaited<ReturnType<typeof SerializeUser>>;
}

// Normaliza o e-mail para comparação case-insensitive.
const normalizeEmail = (email: string): string =>
  (email || "").trim().toLowerCase();

// Carrega o usuário dono da sessão, sempre FRESCO do banco — nunca do JWT.
const getSessionUser = async (userId: string | number): Promise<User> => {
  const user = await User.findByPk(userId);
  if (!user) {
    throw new AppError("ERR_NO_USER_FOUND", 404);
  }
  return user;
};

// Condição "usuário não deletado". Users são removidos fisicamente (destroy),
// mas o campo status pode marcar contas desativadas — NULL conta como ativa.
const notDeletedUserWhere = {
  [Op.or]: [{ status: { [Op.is]: null } }, { status: { [Op.ne]: "deleted" } }]
};

// Busca Users com o mesmo e-mail em outras empresas (ou numa empresa alvo
// específica, quando targetCompanyId é informado). A empresa é carregada
// junto (required) para garantir que o vínculo aponta para tenant existente.
const findLinkedUsers = async (
  email: string,
  excludeCompanyId: number,
  targetCompanyId?: number
): Promise<User[]> => {
  const companyFilter: Record<number | symbol, unknown> = {
    [Op.ne]: excludeCompanyId
  };
  if (targetCompanyId !== undefined) {
    companyFilter[Op.eq] = targetCompanyId;
  }

  return User.findAll({
    where: {
      companyId: companyFilter,
      [Op.and]: [
        notDeletedUserWhere,
        // Match por e-mail normalizado no banco — imune à caixa salva no
        // cadastro e ao collation da coluna.
        Sequelize.where(
          Sequelize.fn("LOWER", Sequelize.col("User.email")),
          normalizeEmail(email)
        )
      ]
    },
    attributes: ["id", "profile", "companyId"],
    include: [
      {
        model: Company,
        as: "company",
        attributes: ["id", "name"],
        required: true
      }
    ]
  });
};

export const ListSwitchableAccountsService = async (
  userId: string | number
): Promise<SwitchableAccount[]> => {
  const currentUser = await getSessionUser(userId);

  const linkedUsers = await findLinkedUsers(
    currentUser.email,
    currentUser.companyId
  );

  // SEGURANÇA: expõe apenas o nome da empresa e dados mínimos do usuário
  // vinculado — nada de e-mail, plano, vencimento ou settings da outra empresa.
  return linkedUsers.map(user => ({
    companyId: user.companyId,
    companyName: user.company?.name || `Empresa ${user.companyId}`,
    userId: user.id,
    profile: user.profile
  }));
};

export const SwitchAccountService = async (
  userId: string | number,
  targetCompanyId: number
): Promise<SwitchResult> => {
  const currentUser = await getSessionUser(userId);

  // Revalida o vínculo no momento do switch — a listagem pode estar obsoleta
  // (usuário removido da empresa alvo entre o GET e o POST).
  const [linked] = await findLinkedUsers(
    currentUser.email,
    currentUser.companyId,
    targetCompanyId
  );

  if (!linked) {
    // Mensagem genérica: não revela se a empresa ou o usuário alvo existe.
    throw new AppError("ERR_ACCOUNT_SWITCH_NOT_ALLOWED", 403);
  }

  // Usuário completo (queues, company, plano, tokenVersion) — mesmo formato
  // carregado pelo fluxo de login/refresh para a serialização ficar idêntica.
  const targetUser = await ShowUserService(linked.id, linked.companyId);

  // Reemite access + refresh token vinculados ao usuário da empresa alvo,
  // usando os mesmos helpers do login (mantém tokenVersion para revogação).
  const token = createAccessToken(targetUser);
  const refreshToken = createRefreshToken(targetUser);

  const serializedUser = await SerializeUser(targetUser);

  return { token, refreshToken, serializedUser };
};
