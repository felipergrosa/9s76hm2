// ARQUIVO COMPLETO E CORRIGIDO: backend/src/services/UserServices/UpdateUserService.ts

import * as Yup from "yup";

import AppError from "../../errors/AppError";
import ShowUserService from "./ShowUserService";
import Company from "../../models/Company";
import User from "../../models/User";

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
  permissions?: string[];
}

interface Request {
  userData: UserData;
  userId: string | number;
  companyId: number;
  requestUserId: number;
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
  requestUserId
}: Request): Promise<Response | undefined> => {
  const user = await ShowUserService(userId, companyId);

  const schema = Yup.object().shape({
    name: Yup.string().min(2),
    email: Yup.string().email(),
    profile: Yup.string(),
    password: Yup.string()
  });
  
  const { name, email, password, profile, queueIds } = userData;

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
  
  // Lógica especial para a conexão (whatsappId):
  // Só atualiza se o campo for enviado.
  if (userData.whatsappId !== undefined) {
    // CORREÇÃO: Se o valor for 0 ou qualquer outro valor "falsy" (como string vazia em tempo de execução),
    // será convertido para null. Caso contrário, usa o valor recebido.
    // Isso é seguro para o TypeScript e resolve o problema do erro 500.
    dataToUpdate.whatsappId = !userData.whatsappId ? null : userData.whatsappId;
  }

  await user.update(dataToUpdate);

  if (queueIds !== undefined) {
    await user.$set("queues", queueIds);
  }

  await user.reload();

  const company = await Company.findByPk(user.companyId);
  const oldUserEmail = user.email;

  if (company.email === oldUserEmail) {
    await company.update({
      email,
      password
    })
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
    allowedContactTags: user.allowedContactTags,
    permissions: user.permissions || []
  };

  return serializedUser;
};

export default UpdateUserService;