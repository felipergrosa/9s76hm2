// ARQUIVO COMPLETO E CORRIGIDO: backend/src/services/UserServices/UpdateUserService.ts

import * as Yup from "yup";

import AppError from "../../errors/AppError";
import ShowUserService from "./ShowUserService";
import Company from "../../models/Company";
import User from "../../models/User";
import Queue from "../../models/Queue";
import Whatsapp from "../../models/Whatsapp";
import Tag from "../../models/Tag";
import Role from "../../models/Role";
import UserRole from "../../models/UserRole";
import { serviceCache } from "../../utils/serviceCache";
import EnsureAdminRoleService, {
  ADMIN_ROLE_NAME
} from "../RoleService/EnsureAdminRoleService";
import {
  AVAILABLE_PERMISSIONS,
  getAllAvailablePermissions,
  hasPermissionAsync,
  invalidateRolePermissionsCache
} from "../../helpers/PermissionAdapter";

interface UserData {
  email?: string;
  password?: string;
  name?: string;
  profile?: string;
  companyId?: number;
  queueIds?: number[];
  startWork?: string;
  endWork?: string;
  farewellMessage?: string;
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
  profileImage?: string;
  language?: string;
  allowedContactTags?: number[];
  managedUserIds?: number[];
  permissions?: string[];
  allowedConnectionIds?: number[];
  isPrivate?: boolean;
  color?: string;
}

interface Request {
  userData: UserData;
  userId: string | number;
  companyId: number;
  requestUserId: number;
  // Usuário requisitante FRESCO do DB — base de toda decisão de autorização
  requestUser: User;
}

interface Response {
  id: number;
  name: string;
  email: string;
  profile: string;
}

const UpdateUserService = async ({
  userData,
  userId,
  companyId,
  requestUserId,
  requestUser
}: Request): Promise<Response | undefined> => {
  // Capacidades do editor — sempre derivadas do usuário FRESCO do banco
  const isRequestSuper = requestUser?.super === true;
  const isRequestAdmin = requestUser?.profile === "admin";
  const canEditUsersPerm = requestUser
    ? await hasPermissionAsync(requestUser, "users.edit")
    : false;
  const canEditPrivileged = isRequestSuper || isRequestAdmin || canEditUsersPerm;

  // SEGURANÇA: super admin pode editar usuário de outra empresa — resolve a
  // empresa do usuário alvo antes do ShowUserService (que filtra por companyId)
  let targetCompanyId = companyId;
  if (isRequestSuper) {
    const target = await User.findByPk(userId);
    if (!target) {
      throw new AppError("ERR_NO_USER_FOUND", 404);
    }
    targetCompanyId = target.companyId;
  }

  const user = await ShowUserService(userId, targetCompanyId);

  const schema = Yup.object().shape({
    name: Yup.string().min(2),
    email: Yup.string().email(),
    profile: Yup.string(),
    password: Yup.string()
  });

  const { name, email, password, profile, queueIds, color } = userData;

  try {
    await schema.validate({ name, email, password, profile });
  } catch (err: any) {
    throw new AppError(err.message);
  }

  const dataToUpdate: UserData = {};

  if (userData.email) { dataToUpdate.email = userData.email; }
  if (userData.name) { dataToUpdate.name = userData.name; }
  if (userData.password) { dataToUpdate.password = userData.password; }
  if (userData.profile) { dataToUpdate.profile = userData.profile; }
  if (userData.startWork) { dataToUpdate.startWork = userData.startWork; }
  if (userData.endWork) { dataToUpdate.endWork = userData.endWork; }
  if (userData.farewellMessage) { dataToUpdate.farewellMessage = userData.farewellMessage; }
  if (userData.allTicket) { dataToUpdate.allTicket = userData.allTicket; }
  if (userData.defaultTheme) { dataToUpdate.defaultTheme = userData.defaultTheme; }
  if (userData.defaultMenu) { dataToUpdate.defaultMenu = userData.defaultMenu; }
  if (userData.allowGroup !== undefined) { dataToUpdate.allowGroup = userData.allowGroup; }
  if (userData.allHistoric) { dataToUpdate.allHistoric = userData.allHistoric; }
  if (userData.allUserChat) { dataToUpdate.allUserChat = userData.allUserChat; }
  if (userData.userClosePendingTicket) { dataToUpdate.userClosePendingTicket = userData.userClosePendingTicket; }
  if (userData.showDashboard) { dataToUpdate.showDashboard = userData.showDashboard; }
  if (userData.defaultTicketsManagerWidth) { dataToUpdate.defaultTicketsManagerWidth = userData.defaultTicketsManagerWidth; }
  if (userData.allowRealTime) { dataToUpdate.allowRealTime = userData.allowRealTime; }
  if (userData.profileImage) { dataToUpdate.profileImage = userData.profileImage; }
  if (userData.allowConnections) { dataToUpdate.allowConnections = userData.allowConnections; }
  if (userData.language) { dataToUpdate.language = userData.language; }
  if (color !== undefined) { (dataToUpdate as any).color = color; }
  // Atualiza allowedContactTags apenas se enviado (pode ser [] para limpar)
  if (userData.hasOwnProperty("allowedContactTags")) {
    dataToUpdate.allowedContactTags = Array.isArray(userData.allowedContactTags)
      ? userData.allowedContactTags
      : [];
  }
  // Atualiza permissions apenas se enviado (pode ser [] para limpar)
  if (userData.hasOwnProperty("permissions")) {
    dataToUpdate.permissions = Array.isArray(userData.permissions)
      ? userData.permissions
      : [];
  }

  // Atualiza managedUserIds apenas se enviado (pode ser [] para limpar)
  if (userData.hasOwnProperty("managedUserIds")) {
    (dataToUpdate as any).managedUserIds = Array.isArray((userData as any).managedUserIds)
      ? (userData as any).managedUserIds
      : [];
  }

  // Atualiza supervisorViewMode apenas se enviado
  if ((userData as any).hasOwnProperty("supervisorViewMode")) {
    (dataToUpdate as any).supervisorViewMode = (userData as any).supervisorViewMode || "include";
  }

  // Lógica especial para a conexão (whatsappId):
  // Só atualiza se o campo for enviado.
  if (userData.whatsappId !== undefined) {
    // CORREÇÃO: Se o valor for 0 ou qualquer outro valor "falsy" (como string vazia em tempo de execução),
    // será convertido para null. Caso contrário, usa o valor recebido.
    // Isso é seguro para o TypeScript e resolve o problema do erro 500.
    dataToUpdate.whatsappId = !userData.whatsappId ? null : userData.whatsappId;
  }

  // Atualiza super apenas se enviado com valor definido
  // (o controller sempre inclui a chave, possivelmente undefined)
  if ((userData as any).super !== undefined) {
    (dataToUpdate as any).super = (userData as any).super;
  }

  // Atualiza allowedConnectionIds apenas se enviado
  if (userData.hasOwnProperty("allowedConnectionIds")) {
    (dataToUpdate as any).allowedConnectionIds = Array.isArray(userData.allowedConnectionIds)
      ? userData.allowedConnectionIds
      : [];
  }

  // Atualiza isPrivate apenas se enviado
  if (userData.hasOwnProperty("isPrivate")) {
    (dataToUpdate as any).isPrivate = userData.isPrivate;
  }

  if (!canEditPrivileged) {
    // SEGURANÇA (N2): editor sem users.edit/admin só pode alterar campos do
    // próprio perfil — qualquer campo privilegiado que tenha passado é
    // descartado aqui (defesa em profundidade à whitelist do controller).
    const SELF_EDIT_ALLOWED = new Set([
      "name",
      "password",
      "defaultTheme",
      "defaultMenu",
      "language",
      "color",
      "farewellMessage",
      "startWork",
      "endWork"
    ]);
    Object.keys(dataToUpdate).forEach(key => {
      if (!SELF_EDIT_ALLOWED.has(key)) {
        delete (dataToUpdate as any)[key];
      }
    });
  } else {
    // SEGURANÇA: concessão de profile "admin" ou flag super é exclusiva de
    // requestUser super. Elevar um usuário a admin/super não pode ser feita
    // por admin comum nem por quem só tem users.edit.
    if (userData.profile === "admin" && user.profile !== "admin" && !isRequestSuper) {
      throw new AppError("ERR_NO_PERMISSION - SOMENTE SUPER ADMIN PODE CONCEDER ADMIN", 403);
    }
    // Qualquer ALTERAÇÃO da flag super (conceder ou rebaixar) exige requestUser super
    if (
      (userData as any).super !== undefined &&
      (userData as any).super !== (user as any).super &&
      !isRequestSuper
    ) {
      throw new AppError("ERR_NO_PERMISSION - ONLY SUPER ADMIN", 403);
    }

    // SEGURANÇA: permissions precisam pertencer ao catálogo conhecido.
    // Requisitante não-super não pode conceder permissões do grupo super.
    if (dataToUpdate.permissions) {
      const catalog = new Set(getAllAvailablePermissions());
      const superGroup = new Set<string>(AVAILABLE_PERMISSIONS.super);
      for (const p of dataToUpdate.permissions) {
        if (!catalog.has(p)) {
          throw new AppError(`Permissão desconhecida: ${p}`, 400);
        }
        if (!isRequestSuper && superGroup.has(p)) {
          throw new AppError("ERR_NO_PERMISSION - PERMISSAO RESTRITA A SUPER ADMIN", 403);
        }
      }
    }

    // SEGURANÇA: IDs referenciados precisam pertencer à empresa do usuário alvo
    // (evita vincular filas/conexões/tags/usuários de outro tenant).
    const uniqueIds = (arr: number[]) => Array.from(new Set((arr || []).map(Number)));
    if (queueIds !== undefined && Array.isArray(queueIds) && queueIds.length > 0) {
      const found = await Queue.count({ where: { id: queueIds, companyId: targetCompanyId } });
      if (found !== uniqueIds(queueIds).length) {
        throw new AppError("ERR_QUEUE_NOT_FOUND", 400);
      }
    }
    if (dataToUpdate.whatsappId) {
      const whatsapp = await Whatsapp.findOne({
        where: { id: dataToUpdate.whatsappId, companyId: targetCompanyId }
      });
      if (!whatsapp) {
        throw new AppError("ERR_WAPP_NOT_FOUND", 400);
      }
    }
    if (dataToUpdate.allowedConnectionIds && dataToUpdate.allowedConnectionIds.length > 0) {
      const found = await Whatsapp.count({
        where: { id: dataToUpdate.allowedConnectionIds, companyId: targetCompanyId }
      });
      if (found !== uniqueIds(dataToUpdate.allowedConnectionIds).length) {
        throw new AppError("ERR_WAPP_NOT_FOUND", 400);
      }
    }
    if (dataToUpdate.allowedContactTags && dataToUpdate.allowedContactTags.length > 0) {
      const found = await Tag.count({
        where: { id: dataToUpdate.allowedContactTags, companyId: targetCompanyId }
      });
      if (found !== uniqueIds(dataToUpdate.allowedContactTags).length) {
        throw new AppError("ERR_TAG_NOT_FOUND", 400);
      }
    }
    if ((dataToUpdate as any).managedUserIds && (dataToUpdate as any).managedUserIds.length > 0) {
      const found = await User.count({
        where: { id: (dataToUpdate as any).managedUserIds, companyId: targetCompanyId }
      });
      if (found !== uniqueIds((dataToUpdate as any).managedUserIds).length) {
        throw new AppError("ERR_NO_USER_FOUND", 400);
      }
    }
  }

  // Profile anterior à atualização — necessário para detectar promoção/
  // rebaixamento de admin e sincronizar a UserRole "Administrador" (fase 3).
  const previousProfile = user.profile;

  await user.update(dataToUpdate);

  // Invalida o cache do usuário usado pelo middleware checkPermission (chave user:{id})
  serviceCache.invalidate(`user:${user.id}`);

  // Fase 3 (composição de permissões): mudança de profile ⇄ admin sincroniza
  // a UserRole da Role de sistema "Administrador" da empresa do usuário alvo.
  // - promoção para admin: garante a Role e vincula (sem ela, o admin cairia
  //   no fallback legado de blanket total — sem granularidade).
  // - rebaixamento de admin: remove a UserRole da "Administrador" — rebaixar
  //   tem que tirar os poderes delegados pela Role.
  if (dataToUpdate.profile && dataToUpdate.profile !== previousProfile) {
    if (dataToUpdate.profile === "admin") {
      const adminRole = await EnsureAdminRoleService(targetCompanyId);
      await UserRole.findOrCreate({
        where: { userId: user.id, roleId: adminRole.id },
        defaults: {
          userId: user.id,
          roleId: adminRole.id,
          companyId: targetCompanyId
        } as any
      });
      invalidateRolePermissionsCache(user.id, targetCompanyId);
    } else if (previousProfile === "admin") {
      const adminRole = await Role.findOne({
        where: { name: ADMIN_ROLE_NAME, companyId: targetCompanyId }
      });
      if (adminRole) {
        await UserRole.destroy({
          where: { userId: user.id, roleId: adminRole.id, companyId: targetCompanyId }
        });
        invalidateRolePermissionsCache(user.id, targetCompanyId);
      }
    }
  }

  // Filas são campo privilegiado: só atualizáveis por users.edit/admin/super
  if (queueIds !== undefined && canEditPrivileged) {
    await user.$set("queues", queueIds);
  }

  await user.reload();

  const company = await Company.findByPk(user.companyId);
  const oldUserEmail = user.email;

  // Sincroniza credenciais da empresa-dona apenas com campos efetivamente
  // aplicados ao usuário (evita mass-assignment de e-mail em auto-edição)
  if (company && company.email === oldUserEmail) {
    const companySync: any = {};
    if (dataToUpdate.email !== undefined) {
      companySync.email = dataToUpdate.email;
    }
    if (dataToUpdate.password !== undefined) {
      companySync.password = dataToUpdate.password;
    }
    if (Object.keys(companySync).length > 0) {
      await company.update(companySync);
    }
  }

  const serializedUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    profile: user.profile,
    companyId: user.companyId,
    company,
    queues: user.queues,
    startWork: user.startWork,
    endWork: user.endWork,
    greetingMessage: user.farewellMessage,
    allTicket: user.allTicket,

    defaultMenu: user.defaultMenu,
    defaultTheme: user.defaultTheme,
    allowGroup: user.allowGroup,
    allHistoric: user.allHistoric,
    userClosePendingTicket: user.userClosePendingTicket,
    showDashboard: user.showDashboard,
    defaultTicketsManagerWidth: user.defaultTicketsManagerWidth,
    allowRealTime: user.allowRealTime,
    allowConnections: user.allowConnections,
    profileImage: user.profileImage,
    color: (user as any).color,
    allowedContactTags: user.allowedContactTags,
    managedUserIds: (user as any).managedUserIds || [],
    supervisorViewMode: (user as any).supervisorViewMode || "include",
    permissions: user.permissions || []
  };

  return serializedUser;
};

export default UpdateUserService;