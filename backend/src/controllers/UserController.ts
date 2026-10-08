// ARQUIVO COMPLETO: backend/src/controllers/UserController.ts

import { Request, Response } from "express";
import { getIO } from "../libs/socket";
import { isEmpty, isNil } from "lodash";
import CheckSettingsHelper from "../helpers/CheckSettings";
import AppError from "../errors/AppError";

import CreateUserService from "../services/UserServices/CreateUserService";
import ListUsersService from "../services/UserServices/ListUsersService";
import UpdateUserService from "../services/UserServices/UpdateUserService";
import ShowUserService from "../services/UserServices/ShowUserService";
import DeleteUserService from "../services/UserServices/DeleteUserService";
import SimpleListService from "../services/UserServices/SimpleListService";
import CreateCompanyService from "../services/CompanyService/CreateCompanyService";
import { SendMail } from "../helpers/SendMail";
import { useDate } from "../utils/useDate";
import ShowCompanyService from "../services/CompanyService/ShowCompanyService";
import { getWbot } from "../libs/wbot";
import FindCompaniesWhatsappService from "../services/CompanyService/FindCompaniesWhatsappService";
import User from "../models/User";
import Plan from "../models/Plan";
import {
  isEmailVerificationEnabled,
  consumeVerificationToken
} from "../services/AuthServices/EmailVerificationService";

import { head } from "lodash";
import ToggleChangeWidthService from "../services/UserServices/ToggleChangeWidthService";
import APIShowEmailUserService from "../services/UserServices/APIShowEmailUserService";
import Setting from "../models/Setting";
import fs from "fs";
import path from "path";
import multer from "multer";
import { hasPermission, hasPermissionAsync } from "../helpers/PermissionAdapter";
import {
  buildCompanyBase,
  buildUserBase,
  buildUserAvatarRelativePath,
  sanitizeFileName
} from "../utils/publicPath";
import { serviceCache } from "../utils/serviceCache";

type IndexQuery = {
  searchParam: string;
  pageNumber: string;
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { searchParam, pageNumber } = req.query as IndexQuery;
  const { companyId, profile } = req.user;

  const { users, count, hasMore } = await ListUsersService({
    searchParam,
    pageNumber,
    companyId,
    profile,
    requestUserId: +req.user.id
  });

  return res.json({ users, count, hasMore });
};

export const list = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.query;
  const { companyId: userCompanyId } = req.user;

  // SEGURANÇA: companyId da query só é honrado para super admin
  // (verificado no usuário fresco do DB, não apenas no JWT).
  const requestUser = await User.findByPk(req.user.id);
  const isRequestSuper = requestUser?.super === true;

  const users = await SimpleListService({
    companyId: isRequestSuper && companyId ? +companyId : userCompanyId,
    requestUserId: +req.user.id
  });

  return res.status(200).json(users);
};

export const listAvailable = async (req: Request, res: Response): Promise<Response> => {
  const { companyId: userCompanyId } = req.user;

  const users = await SimpleListService({
    companyId: userCompanyId
  });

  // Retorna apenas dados básicos para seleção
  const basicUsers = users.map(u => ({
    id: u.id,
    name: u.name,
    email: u.email,
    profile: u.profile,
    queues: (u as any).queues || []
  }));

  return res.json(basicUsers);
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { userId } = req.params;
  const { companyId, id } = req.user;

  // Autorização feita na rota via checkPermission("users.delete") —
  // o usuário alvo continua confinado à empresa do editor (super pode cross-tenant).

  if (process.env.DEMO === "ON") {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  // SEGURANÇA: usuário alvo é sempre buscado dentro da empresa do editor;
  // apenas super admin (verificado no DB) pode remover usuário de outra empresa.
  const requestUser = await User.findByPk(id);
  const isRequestSuper = requestUser?.super === true;

  const user = await User.findOne({
    where: isRequestSuper ? { id: userId } : { id: userId, companyId }
  });

  if (!user) {
    return res.status(404).json({ error: "Usuário não encontrado." });
  }

  if (companyId !== user.companyId && !isRequestSuper) {
    return res.status(400).json({ error: "Você não possui permissão para acessar este recurso!" });
  } else {
    await DeleteUserService(userId, user.companyId);

    const io = getIO();
    io.of(`/workspace-${companyId}`)
      .emit(`company-${companyId}-user`, {
        action: "delete",
        userId
      });

    return res.status(200).json({ message: "User deleted" });
  }
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const {
    email,
    password,
    name,
    phone,
    profile: rawProfile,
    companyId: bodyCompanyId,
    queueIds,
    companyName,
    planId,
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
    allowedContactTags,
    permissions: rawPermissions,
    allowedConnectionIds: rawAllowedConnectionIds,
    isPrivate: rawIsPrivate,
    color,
    ramal // Ramal interno (referência Fluxoo — cadastro simples)
  } = req.body;
  let userCompanyId: number | null = null;

  const { dateToClient } = useDate();

  // SEGURANÇA (N2): decisões de autorização usam o usuário FRESCO do banco,
  // não apenas os dados do JWT (profile/super podem estar desatualizados).
  let requestUser: User | null = null;
  if (req.user !== undefined) {
    requestUser = await User.findByPk(req.user.id);
    userCompanyId = requestUser?.companyId ?? req.user.companyId;
  }
  const isRequestSuper = requestUser?.super === true;

  // SEGURANÇA: Sanitiza campos privilegiados em rota pública /signup.
  // Previne escalação de privilégio por usuário auto-cadastrado.
  const isPublicSignup = req.url === "/signup";

  // Autorização de criação autenticada fica na rota (checkPermission("users.create"));
  // aqui só resta o gate do signup público e o anti-escalação de `super`.
  if (
    isPublicSignup &&
    (await CheckSettingsHelper("userCreation")) === "disabled"
  ) {
    throw new AppError("ERR_USER_CREATION_DISABLED", 403);
  }

  const profile = isPublicSignup ? "user" : rawProfile;
  const permissions = isPublicSignup ? [] : rawPermissions;
  const allowedConnectionIds = isPublicSignup ? [] : rawAllowedConnectionIds;
  const isPrivate = isPublicSignup ? false : rawIsPrivate;
  if (isPublicSignup && req.body.super === true) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  if (process.env.DEMO === "ON") {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  // SEGURANÇA (N2): com e-mail configurado, o signup público só conclui com um
  // verificationToken válido (emitido por /auth/verify-email/check após o
  // código de 6 dígitos). Token é de uso único e casa com o e-mail do body.
  // Fail-open: sem SMTP configurado, o cadastro segue sem verificação.
  if (isPublicSignup && isEmailVerificationEnabled()) {
    const verified = await consumeVerificationToken(
      email,
      req.body.emailVerificationToken
    );
    if (!verified) {
      throw new AppError("ERR_EMAIL_VERIFICATION_REQUIRED", 400);
    }
  }

  // SEGURANÇA: no signup público o companyId do body é SEMPRE ignorado —
  // o fluxo público cria uma empresa nova. companyId do body só é honrado
  // quando o requisitante autenticado é super admin; demais usuários são
  // forçados à própria empresa (evita criação cross-tenant).
  const companyUser = isPublicSignup
    ? null
    : isRequestSuper
      ? bodyCompanyId || userCompanyId
      : userCompanyId;

  if (!companyUser) {

    // SEGURANÇA: no signup público o planId do body é ignorado — usa o menor
    // plano público cadastrado (evita auto-atribuição de plano superior).
    let safePlanId = planId;
    if (isPublicSignup) {
      const defaultPlan = await Plan.findOne({
        where: { isPublic: true },
        order: [["users", "ASC"], ["id", "ASC"]]
      });
      safePlanId = defaultPlan?.id;
    }

    const trialDays = parseInt(process.env.APP_TRIALEXPIRATION || "3", 10);

    const dataNowMoreTrialDays = new Date();
    dataNowMoreTrialDays.setDate(dataNowMoreTrialDays.getDate() + trialDays);

    const date = dataNowMoreTrialDays.toISOString().split("T")[0];

    const companyData = {
      name: companyName,
      email: email,
      phone: phone,
      planId: safePlanId,
      status: true,
      dueDate: date,
      recurrence: "",
      document: "",
      paymentMethod: "",
      password: password,
      companyUserName: name,
      startWork: startWork,
      endWork: endWork,
      defaultTheme: 'light',
      defaultMenu: 'closed',
      allowGroup: false,
      allHistoric: false,
      userClosePendingTicket: 'enabled',
      showDashboard: 'disabled',
      defaultTicketsManagerWidth: 550,
      allowRealTime: 'disabled',
      allowConnections: 'disabled'
    };

    const user = await CreateCompanyService(companyData);

    try {
      const _email = {
        to: email,
        subject: `Login e senha da Empresa ${companyName}`,
        text: `Olá ${name}, este é um email sobre o cadastro da ${companyName}!<br><br>
        Segue os dados da sua empresa:<br><br>Nome: ${companyName}<br>Email: ${email}<br>Senha: ${password}<br>Data Vencimento Trial: ${dateToClient(date)}`
      }

      await SendMail(_email)
    } catch (error) {
      console.log('Não consegui enviar o email')
    }

    try {
      const company = await ShowCompanyService(1);
      const whatsappCompany = await FindCompaniesWhatsappService(company.id)

      if (whatsappCompany.whatsapps[0].status === "CONNECTED" && (phone !== undefined || !isNil(phone) || !isEmpty(phone))) {
        const whatsappId = whatsappCompany.whatsapps[0].id
        const wbot = getWbot(whatsappId);

        const body = `Olá ${name}, este é uma mensagem sobre o cadastro da ${companyName}!\n\nSegue os dados da sua empresa:\n\nNome: ${companyName}\nEmail: ${email}\nSenha: ${password}\nData Vencimento Trial: ${dateToClient(date)}`

        await wbot.sendMessage(`55${phone}@s.whatsapp.net`, { text: body });
      }
    } catch (error) {
      console.log('Não consegui enviar a mensagem')
    }

    return res.status(200).json(user);
  }

  if (companyUser) {
    // Apenas Super Admin pode setar Super Admin na criação (flag do DB, não do JWT)
    const { "super": superUser } = req.body;
    if (superUser && !isRequestSuper) {
      throw new AppError("ERR_NO_PERMISSION - ONLY SUPER ADMIN", 403);
    }

    const user = await CreateUserService({
      email,
      password,
      name,
      profile,
      companyId: companyUser,
      queueIds,
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
      defaultTicketsManagerWidth,
      allowRealTime,
      allowConnections,
      allowedContactTags,
      permissions,
      allowedConnectionIds,
      isPrivate,
      color,
      ramal,
      superUser,
      requestUserIsSuper: isRequestSuper
    });

    const io = getIO();
    io.of(`/workspace-${companyUser}`)
      .emit(`company-${companyUser}-user`, {
        action: "create",
        user
      });

    return res.status(200).json(user);
  }
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { userId } = req.params;
  const { companyId, id: requestUserId } = req.user;

  // Permite buscar próprios dados mesmo sem users.view
  const isOwnProfile = +userId === +requestUserId;
  const canView = isOwnProfile || hasPermission(req.user, "users.view");

  if (!canView) {
    throw new AppError("ERR_NO_PERMISSION: users.view", 403);
  }

  const user = await ShowUserService(userId, companyId);

  return res.status(200).json(user);
};

export const showEmail = async (req: Request, res: Response): Promise<Response> => {
  const { email } = req.params;

  const user = await APIShowEmailUserService(email);

  return res.status(200).json(user);
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  if (process.env.DEMO === "ON") {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  const { id: requestUserId, companyId } = req.user as any;
  const { userId } = req.params;

  // Buscar usuário completo do banco para ter acesso às permissões
  // (decisões de autorização usam sempre o usuário FRESCO, não o JWT)
  const currentUser = await User.findByPk(requestUserId);
  if (!currentUser) {
    throw new AppError("ERR_USER_NOT_FOUND", 404);
  }

  // LÓGICA DE PERMISSÃO ATUALIZADA
  // Quem tem users.edit (admin via Role/blanket, super ou ACL) edita qualquer
  // usuário; demais só editam o próprio perfil com users.edit-own.
  const isEditingOwnProfile = parseInt(userId) === parseInt(requestUserId);
  const isRequestSuper = currentUser.super === true;
  const canEditOwnProfile = await hasPermissionAsync(currentUser, "users.edit-own");
  const canEditUsers = await hasPermissionAsync(currentUser, "users.edit");

  if (!isRequestSuper && !canEditUsers && !(isEditingOwnProfile && canEditOwnProfile)) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  // Apenas Super Admin pode setar Super Admin (verificado no DB)
  const { "super": superUser } = req.body;
  if (superUser && !isRequestSuper) {
    throw new AppError("ERR_NO_PERMISSION - ONLY SUPER ADMIN", 403);
  }

  // SEGURANÇA (N2): editor sem users.edit/admin recebe whitelist estrita de
  // campos (auto-edição) — todo o restante do body é descartado para evitar
  // mass-assignment/auto-escalada (profile, permissions, super, queues etc).
  const SELF_EDIT_ALLOWED_FIELDS = new Set([
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
  const canEditPrivileged = isRequestSuper || canEditUsers;
  const userData: any = {};
  Object.keys(req.body || {}).forEach(key => {
    if (canEditPrivileged || SELF_EDIT_ALLOWED_FIELDS.has(key)) {
      userData[key] = req.body[key];
    }
  });

  const user = await UpdateUserService({
    userData: { ...userData, super: superUser }, // Pass super explicitly
    userId,
    companyId,
    requestUserId: +requestUserId,
    requestUser: currentUser
  });

  const io = getIO();
  io.of(`/workspace-${companyId}`)
    .emit(`company-${companyId}-user`, {
      action: "update",
      user
    });

  return res.status(200).json(user);
};

export const mediaUpload = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { userId } = req.params;
  const { id: requestUserId, companyId } = req.user as any;
  const files = req.files as Express.Multer.File[];
  const file = head(files);

  // Buscar usuário completo do banco para ter acesso às permissões
  const currentUser = await User.findByPk(requestUserId);
  if (!currentUser) {
    throw new AppError("ERR_USER_NOT_FOUND", 404);
  }

  // Verificação de permissão para upload de avatar via media-upload
  const isEditingOwnProfile = parseInt(userId) === parseInt(requestUserId);
  const isRequestSuper = currentUser.super === true;
  const canEditOwnProfile = await hasPermissionAsync(currentUser, "users.edit-own");
  const canEditUsers = await hasPermissionAsync(currentUser, "users.edit");

  if (!isRequestSuper && !canEditUsers && !(isEditingOwnProfile && canEditOwnProfile)) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  try {
    // SEGURANÇA: usuário alvo confinado à empresa do editor (super pode cross-tenant)
    let user = await User.findOne({
      where: isRequestSuper ? { id: userId } : { id: userId, companyId }
    });
    if (!user) throw new AppError("ERR_NO_USER_FOUND", 404);

    // Deriva username a partir do nome do usuário, sanetizando
    const username = sanitizeFileName(String(user.name || `user-${user.id}`)).toLowerCase();
    const ext = path.extname(file.originalname) || path.extname(file.filename) || ".jpg";
    const targetFileName = `avatar${ext}`;

    const relativeDir = buildUserBase(companyId, username); // company{}/users/{username}
    const relativePath = buildUserAvatarRelativePath(companyId, username, targetFileName);

    const publicRoot = path.resolve(__dirname, "..", "..", "public");
    const absDir = path.resolve(publicRoot, relativeDir);
    const absPath = path.resolve(publicRoot, relativePath);

    if (!fs.existsSync(absDir)) {
      fs.mkdirSync(absDir, { recursive: true });
    }

    // Remove avatar anterior se existir e for diferente
    if (user.profileImage) {
      const oldAbs = path.resolve(publicRoot, buildCompanyBase(companyId), user.profileImage.startsWith("company") ? user.profileImage : path.posix.join("", user.profileImage));
      try {
        if (fs.existsSync(oldAbs)) fs.unlinkSync(oldAbs);
      } catch { }
    }

    // Move o arquivo do tmp para o destino final
    fs.renameSync(file.path, absPath);

    // Armazena caminho relativo a partir de company{}/
    user.profileImage = path.posix.join("users", username, targetFileName);
    await user.save();

    // Invalida o cache do usuário usado pelo middleware checkPermission (chave user:{id})
    serviceCache.invalidate(`user:${user.id}`);

    user = await ShowUserService(userId, companyId);

    const io = getIO();
    io.of(`/workspace-${companyId}`)
      .emit(`company-${companyId}-user`, {
        action: "update",
        user
      });

    return res.status(200).json({ user, message: "Imagem atualizada" });
  } catch (err: any) {
    throw new AppError(err.message);
  }
};

export const uploadAvatar = async (req: Request, res: Response): Promise<Response> => {
  const userId = req.params.userId;
  const file = req.file;
  const { id: requestUserId, companyId } = req.user;

  // Buscar usuário completo do banco para ter acesso às permissões
  const currentUser = await User.findByPk(requestUserId);
  if (!currentUser) {
    throw new AppError("ERR_USER_NOT_FOUND", 404);
  }

  // Verificação de permissão para upload de avatar
  const isEditingOwnProfile = parseInt(userId) === parseInt(requestUserId);
  const isRequestSuper = currentUser.super === true;
  const canEditOwnProfile = await hasPermissionAsync(currentUser, "users.edit-own");
  const canEditUsers = await hasPermissionAsync(currentUser, "users.edit");

  if (!isRequestSuper && !canEditUsers && !(isEditingOwnProfile && canEditOwnProfile)) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  if (!file) {
    return res.status(400).json({ error: "Arquivo não enviado." });
  }

  try {
    // SEGURANÇA: usuário alvo confinado à empresa do editor (super pode cross-tenant)
    const user = await User.findOne({
      where: isRequestSuper ? { id: userId } : { id: userId, companyId }
    });

    if (!user) {
      return res.status(404).json({ error: "Usuário não encontrado." });
    }

    const username = sanitizeFileName(String(user.name || `user-${user.id}`)).toLowerCase();
    const ext = path.extname(file.originalname) || path.extname(file.filename) || ".jpg";
    const targetFileName = `avatar${ext}`;

    const relativeDir = buildUserBase(companyId, username);
    const relativePath = buildUserAvatarRelativePath(companyId, username, targetFileName);

    const publicRoot = path.resolve(__dirname, "..", "..", "public");
    const absDir = path.resolve(publicRoot, relativeDir);
    const absPath = path.resolve(publicRoot, relativePath);

    if (!fs.existsSync(absDir)) {
      fs.mkdirSync(absDir, { recursive: true });
    }

    // Remove avatar anterior se existir
    if (user.profileImage) {
      try {
        const oldAbs = path.resolve(publicRoot, buildCompanyBase(companyId), user.profileImage.startsWith("company") ? user.profileImage : path.posix.join("", user.profileImage));
        if (fs.existsSync(oldAbs)) fs.unlinkSync(oldAbs);
      } catch { }
    }

    fs.renameSync(file.path, absPath);

    user.profileImage = path.posix.join("users", username, targetFileName);
    await user.save();

    // Invalida o cache do usuário usado pelo middleware checkPermission (chave user:{id})
    serviceCache.invalidate(`user:${user.id}`);

    return res.status(200).json({ success: true, profileImage: user.profileImage });
  } catch (err) {
    return res.status(500).json({ error: "Erro ao salvar imagem." });
  }
};

export const toggleChangeWidht = async (req: Request, res: Response): Promise<Response> => {
  var { userId } = req.params;
  const { defaultTicketsManagerWidth } = req.body;

  const { companyId } = req.user;
  const user = await ToggleChangeWidthService({ userId, defaultTicketsManagerWidth });

  const io = getIO();
  io.of(`/workspace-${companyId}`)
    .emit(`company-${companyId}-user`, {
      action: "update",
      user
    });

  return res.status(200).json(user);
};

export const getUserCreationStatus = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const setting = await Setting.findOne({
      where: {
        companyId: 1,
        key: "userCreation",
      },
    });

    if (!setting) {
      return res.status(200).json({ userCreation: "disabled" }); // Valor padrão
    }

    return res.status(200).json({ userCreation: setting.value });
  } catch (error) {
    return res
      .status(500)
      .json({ error: "Failed to fetch user creation status" });
  }
};

export const updateLanguage = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { userId } = req.params;
    const { language } = req.body;
    const { companyId } = req.user;

    // Validação básica do idioma
    const validLanguages = ["pt-BR", "en", "es", "tr"];
    if (!language || !validLanguages.includes(language)) {
      return res.status(400).json({ error: "Invalid language. Must be one of: pt-BR, en, es, tr" });
    }

    // Usuário requisitante FRESCO do DB para decisões de autorização
    const requestUser = await User.findByPk(req.user.id);
    if (!requestUser) {
      return res.status(404).json({ error: "User not found" });
    }

    // SEGURANÇA: usuário alvo confinado à empresa do editor (super pode cross-tenant)
    const user = await User.findOne({
      where: requestUser.super === true ? { id: userId } : { id: userId, companyId }
    });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Qualquer usuário pode alterar o PRÓPRIO idioma; alterar o idioma de
    // outro usuário exige users.edit (super/admin passam por hasPermissionAsync).
    const canEditUsers = await hasPermissionAsync(requestUser, "users.edit");
    if (!canEditUsers && parseInt(userId) !== parseInt(req.user.id)) {
      throw new AppError("ERR_NO_PERMISSION", 403);
    }

    await user.update({ language });

    // Invalida o cache do usuário usado pelo middleware checkPermission (chave user:{id})
    serviceCache.invalidate(`user:${user.id}`);

    return res.status(200).json({ id: user.id, language: user.language });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

// Configuração do multer (salva em TMP antes de mover para a estrutura final)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.resolve(__dirname, "..", "..", "public", "tmp");
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname) || ".jpg";
    const fileName = `${Date.now()}-${sanitizeFileName(file.fieldname)}${ext}`;
    cb(null, fileName);
  }
});

export const upload = multer({ storage });