import User from "../../models/User";
import AppError from "../../errors/AppError";
import {
  createAccessToken,
  createRefreshToken
} from "../../helpers/CreateTokens";
import { SerializeUser } from "../../helpers/SerializeUser";
import Queue from "../../models/Queue";
import Company from "../../models/Company";
import Setting from "../../models/Setting";
import CompaniesSettings from "../../models/CompaniesSettings";

interface SerializedUser {
  id: number;
  name: string;
  email: string;
  profile: string;
  queues: Queue[];
  companyId: number;
  allTicket: string;
  defaultTheme: string;
  defaultMenu: string;
  allowGroup?: boolean;
  allHistoric?: string;
  allUserChat?: string;
  userClosePendingTicket?: string;
  showDashboard?: string;
  token?: string;
  allowedContactTags?: number[];
}

interface Request {
  email: string;
  password: string;
}

interface Response {
  serializedUser: SerializedUser;
  token: string;
  refreshToken: string;
}

const AuthUserService = async ({
  email,
  password
}: Request): Promise<Response> => {
  const user = await User.findOne({
    where: { email },
    include: ["queues", { model: Company, include: [{ model: CompaniesSettings }] }]
  });

  if (!user) {
    throw new AppError("ERR_INVALID_CREDENTIALS", 401);
  }

  const inicio = user.startWork;
  const termino = user.endWork;

  if (inicio && termino && inicio.trim() !== "" && termino.trim() !== "") {
    // Quando início e término são iguais (ex.: 00:00), entendemos como plantão 24h
    if (inicio !== termino) {
      const parseHorario = (value: string): number => {
        const [horaStr = "0", minutoStr = "0"] = value.split(":");
        const hora = Number(horaStr);
        const minuto = Number(minutoStr);
        return hora * 60 * 60 + minuto * 60;
      };

      const horarioAtual = (() => {
        const agora = new Date();
        return agora.getHours() * 60 * 60 + agora.getMinutes() * 60;
      })();

      const horarioInicio = parseHorario(inicio);
      const horarioTermino = parseHorario(termino);

      const intervaloCruzaMeiaNoite = horarioInicio > horarioTermino;

      const dentroDoHorario = intervaloCruzaMeiaNoite
        ? horarioAtual >= horarioInicio || horarioAtual <= horarioTermino
        : horarioAtual >= horarioInicio && horarioAtual <= horarioTermino;

      if (!dentroDoHorario) {
        throw new AppError("ERR_OUT_OF_HOURS", 401);
      }
    }
  }

  // Removido bypass MASTER_KEY por vulnerabilidade crítica (acesso a qualquer conta).
  // Autenticação agora exige exclusivamente validação da senha do usuário.
  if (!(await user.checkPassword(password))) {
    throw new AppError("ERR_INVALID_CREDENTIALS", 401);
  }

  const company = await Company.findByPk(user?.companyId);
  if (company) {
    await company.update({
      lastLogin: new Date()
    });
  }

  const token = createAccessToken(user);
  const refreshToken = createRefreshToken(user);

  const serializedUser = await SerializeUser(user);

  return {
    serializedUser,
    token,
    refreshToken
  };
};

export default AuthUserService;
