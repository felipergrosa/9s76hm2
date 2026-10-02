import * as Yup from "yup";

import AppError from "../../errors/AppError";
import { SerializeUser } from "../../helpers/SerializeUser";
import User from "../../models/User";
import Plan from "../../models/Plan";
import Company from "../../models/Company";
import Queue from "../../models/Queue";
import Whatsapp from "../../models/Whatsapp";
import Tag from "../../models/Tag";
import UserRole from "../../models/UserRole";
import EnsureAdminRoleService from "../RoleService/EnsureAdminRoleService";
import {
  AVAILABLE_PERMISSIONS,
  getAllAvailablePermissions
} from "../../helpers/PermissionAdapter";

interface Request {
  email: string;
  password: string;
  name: string;
  queueIds?: number[];
  companyId?: number;
  profile?: string;
  startWork?: string;
  endWork?: string;
  whatsappId?: number;
  allTicket?: string;
  defaultTheme?: string;
  defaultMenu?: string;
  allowGroup?: boolean;
  allHistoric?: string;
  allUserChat?: string;
  userClosePendingTicket?: string;
  showDashboard?: string;
  defaultTicketsManagerWidth?: number;
  allowRealTime?: string;
  allowConnections?: string;
  allowedContactTags?: number[];
  managedUserIds?: number[];
  supervisorViewMode?: "include" | "exclude";
  permissions?: string[];
  allowedConnectionIds?: number[];
  isPrivate?: boolean;
  superUser?: boolean;
  color?: string;
  // Flag do requisitante (vinda do DB) — controla concessão de admin/super
  // e permissões do grupo super
  requestUserIsSuper?: boolean;
}

interface Response {
  email: string;
  name: string;
  id: number;
  profile: string;
}

const CreateUserService = async ({
  email,
  password,
  name,
  queueIds = [],
  companyId,
  profile = "user",
  startWork,
  endWork,
  whatsappId,
  allTicket,
  defaultTheme,
  defaultMenu,
  allowGroup,
  allHistoric,
  allUserChat,
  userClosePendingTicket,
  showDashboard,
  defaultTicketsManagerWidth = 550,
  allowRealTime,
  allowConnections,
  allowedContactTags = [],
  managedUserIds = [],
  supervisorViewMode = "include",
  permissions = [],
  allowedConnectionIds = [],
  isPrivate = false,
  superUser = false,
  color = "",
  requestUserIsSuper = false
}: Request): Promise<Response> => {
  // SEGURANÇA (N2): profile "admin" e flag super só podem ser concedidos por
  // requisitante super admin (defesa em profundidade — o controller já bloqueia).
  if (profile === "admin" && !requestUserIsSuper) {
    throw new AppError("ERR_NO_PERMISSION - SOMENTE SUPER ADMIN PODE CONCEDER ADMIN", 403);
  }
  if (superUser && !requestUserIsSuper) {
    throw new AppError("ERR_NO_PERMISSION - ONLY SUPER ADMIN", 403);
  }

  // SEGURANÇA: permissions precisam pertencer ao catálogo conhecido —
  // wildcards/chaves fora do catálogo são rejeitadas, e permissões do grupo
  // super só podem ser concedidas por requisitante super.
  if (permissions && permissions.length > 0) {
    const catalog = new Set(getAllAvailablePermissions());
    const superGroup = new Set<string>(AVAILABLE_PERMISSIONS.super);
    for (const p of permissions) {
      if (!catalog.has(p)) {
        throw new AppError(`Permissão desconhecida: ${p}`, 400);
      }
      if (!requestUserIsSuper && superGroup.has(p)) {
        throw new AppError("ERR_NO_PERMISSION - PERMISSAO RESTRITA A SUPER ADMIN", 403);
      }
    }
  }

  // SEGURANÇA: IDs referenciados precisam pertencer à empresa do usuário criado
  // (evita vincular filas/conexões/tags/usuários de outro tenant).
  const uniqueIds = (arr: number[]) => Array.from(new Set((arr || []).map(Number)));
  if (companyId !== undefined) {
    if (queueIds.length > 0) {
      const found = await Queue.count({ where: { id: queueIds, companyId } });
      if (found !== uniqueIds(queueIds).length) {
        throw new AppError("ERR_QUEUE_NOT_FOUND", 400);
      }
    }
    if (whatsappId) {
      const whatsapp = await Whatsapp.findOne({ where: { id: whatsappId, companyId } });
      if (!whatsapp) {
        throw new AppError("ERR_WAPP_NOT_FOUND", 400);
      }
    }
    if (allowedConnectionIds.length > 0) {
      const found = await Whatsapp.count({ where: { id: allowedConnectionIds, companyId } });
      if (found !== uniqueIds(allowedConnectionIds).length) {
        throw new AppError("ERR_WAPP_NOT_FOUND", 400);
      }
    }
    if (allowedContactTags.length > 0) {
      const found = await Tag.count({ where: { id: allowedContactTags, companyId } });
      if (found !== uniqueIds(allowedContactTags).length) {
        throw new AppError("ERR_TAG_NOT_FOUND", 400);
      }
    }
    if (managedUserIds.length > 0) {
      const found = await User.count({ where: { id: managedUserIds, companyId } });
      if (found !== uniqueIds(managedUserIds).length) {
        throw new AppError("ERR_NO_USER_FOUND", 400);
      }
    }
  }

  if (companyId !== undefined) {
    const company = await Company.findOne({
      where: {
        id: companyId
      },
      include: [{ model: Plan, as: "plan" }]
    });

    if (company !== null) {
      const usersCount = await User.count({
        where: {
          companyId
        }
      });

      if (usersCount >= company.plan.users) {
        throw new AppError(
          `Número máximo de usuários já alcançado: ${usersCount}`
        );
      }
    }
  }

  const schema = Yup.object().shape({
    name: Yup.string().required().min(2),
    allHistoric: Yup.string(),
    email: Yup.string()
      .email()
      .required()
      .test(
        "Check-email",
        "An user with this email already exists.",
        async value => {
          if (!value) return false;
          const emailExists = await User.findOne({
            where: { email: value }
          });
          return !emailExists;
        }
      ),
    password: Yup.string().required().min(5)
  });

  try {
    await schema.validate({ email, password, name });
  } catch (err) {
    throw new AppError(err.message);
  }

  const user = await User.create(
    {
      email,
      password,
      name,
      companyId,
      profile,
      startWork,
      endWork,
      whatsappId: whatsappId || null,
      allTicket,
      defaultTheme,
      defaultMenu,
      allowGroup,
      allHistoric,
      allUserChat,
      userClosePendingTicket,
      showDashboard,
      defaultTicketsManagerWidth,
      allowRealTime,
      allowConnections,
      allowedContactTags,
      managedUserIds,
      supervisorViewMode,
      permissions,
      allowedConnectionIds,
      isPrivate,
      super: superUser,
      color
    },
    { include: ["queues", "company"] }
  );

  await user.$set("queues", queueIds);

  // Fase 3 (composição de permissões): profile "admin" não é mais cobertor
  // automático — os poderes vêm da Role de sistema "Administrador" da empresa.
  if (profile === "admin" && companyId !== undefined) {
    const adminRole = await EnsureAdminRoleService(companyId);
    await UserRole.findOrCreate({
      where: { userId: user.id, roleId: adminRole.id },
      defaults: { userId: user.id, roleId: adminRole.id, companyId } as any
    });
  }

  await user.reload();

  const serializedUser = SerializeUser(user);

  return serializedUser;
};

export default CreateUserService;
