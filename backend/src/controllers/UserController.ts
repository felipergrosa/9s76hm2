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

import { head } from "lodash";
import ToggleChangeWidthService from "../services/UserServices/ToggleChangeWidthService";
import APIShowEmailUserService from "../services/UserServices/APIShowEmailUserService";
import Setting from "../models/Setting";
import fs from "fs";
import path from "path";
import multer from "multer";
import {
  buildCompanyBase,
  buildUserBase,
  buildUserAvatarRelativePath,
  sanitizeFileName
} from "../utils/publicPath";

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
    profile
  });

  return res.json({ users, count, hasMore });
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const {
    email,
    password,
    name,
    phone,
    profile,
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
    permissions
  } = req.body;
  let userCompanyId: number | null = null;

  const { dateToClient } = useDate();

  if (req.user !== undefined) {
    const { companyId: cId } = req.user;
    userCompanyId = cId;
  }

  if (
    req.url === "/signup" &&
    (await CheckSettingsHelper("userCreation")) === "disabled"
  ) {
    throw new AppError("ERR_USER_CREATION_DISABLED", 403);
  } else if (req.url !== "/signup" && req.user.profile !== "admin") {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  if (process.env.DEMO === "ON") {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  const companyUser = bodyCompanyId || userCompanyId;

  if (!companyUser) {

    const trialDays = parseInt(process.env.APP_TRIALEXPIRATION || "3", 10);

    const dataNowMoreTrialDays = new Date();
    dataNowMoreTrialDays.setDate(dataNowMoreTrialDays.getDate() + trialDays);

    const date = dataNowMoreTrialDays.toISOString().split("T")[0];

    const companyData = {
      name: companyName,
      email: email,
      phone: phone,
      planId: planId,
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
      permissions
    });

    const io = getIO();
    io.of(`/workspace-${userCompanyId}`)
      .emit(`company-${userCompanyId}-user`, {
        action: "create",
        user
      });

    return res.status(200).json(user);
  }
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { userId } = req.params;
  const { companyId } = req.user;

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

  const { id: requestUserId, companyId, profile } = req.user;
  const { userId } = req.params;
  const userData = req.body;

  // LÓGICA DE PERMISSÃO CORRIGIDA
  // Se o usuário não for admin, ele só pode alterar o próprio perfil.
  if (profile !== "admin" && userId !== requestUserId) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  const user = await UpdateUserService({
    userData,
    userId,
    companyId,
    requestUserId: +requestUserId
  });


  const io = getIO();
  io.of(`/workspace-${companyId}`)
    .emit(`company-${companyId}-user`, {
      action: "update",
      user
    });

  return res.status(200).json(user);
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { userId } = req.params;
  const { companyId, id, profile } = req.user;

  if (profile !== "admin") {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  if (process.env.DEMO === "ON") {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  const user = await User.findOne({
    where: { id: userId }
  });

  if (companyId !== user.companyId) {
    return res.status(400).json({ error: "Você não possui permissão para acessar este recurso!" });
  } else {
    await DeleteUserService(userId, companyId);

    const io = getIO();
    io.of(`/workspace-${companyId}`)
      .emit(`company-${companyId}-user`, {
        action: "delete",
        userId
      });

    return res.status(200).json({ message: "User deleted" });
  }

};

export const list = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.query;
  const { companyId: userCompanyId } = req.user;

  const users = await SimpleListService({
    companyId: companyId ? +companyId : userCompanyId
  });

  return res.status(200).json(users);
};

export const mediaUpload = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { userId } = req.params;
  const { companyId } = req.user;
  const files = req.files as Express.Multer.File[];
  const file = head(files);

  try {
    let user = await User.findByPk(userId);
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
      } catch {}
    }

    // Move o arquivo do tmp para o destino final
    fs.renameSync(file.path, absPath);

    // Armazena caminho relativo a partir de company{}/
    user.profileImage = path.posix.join("users", username, targetFileName);
    await user.save();

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
    const { profile } = req.user;

    // Validação básica do idioma
    const validLanguages = ["pt-BR", "en", "es", "tr"];
    if (!language || !validLanguages.includes(language)) {
      return res.status(400).json({ error: "Invalid language. Must be one of: pt-BR, en, es, tr" });
    }

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // ACRESCENTADO: Apenas admins podem alterar o idioma.
    if (profile !== "admin") {
      throw new AppError("ERR_NO_PERMISSION", 403);
    }

    await user.update({ language });
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

export const uploadAvatar = async (req: Request, res: Response): Promise<Response> => {
  const userId = req.params.userId;
  const file = req.file;

  if (!file) {
    return res.status(400).json({ error: "Arquivo não enviado." });
  }

  try {
    const user = await User.findByPk(userId);

    if (!user) {
      return res.status(404).json({ error: "Usuário não encontrado." });
    }

    const { companyId } = req.user;
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
      } catch {}
    }

    fs.renameSync(file.path, absPath);

    user.profileImage = path.posix.join("users", username, targetFileName);
    await user.save();

    return res.status(200).json({ success: true, profileImage: user.profileImage });
  } catch (err) {
    return res.status(500).json({ error: "Erro ao salvar imagem." });
  }
};