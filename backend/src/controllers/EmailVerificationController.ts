import { Request, Response } from "express";
import {
  isEmailVerificationEnabled,
  sendVerificationCode,
  verifyCode
} from "../services/AuthServices/EmailVerificationService";

// Resposta genérica no send: não revela se o e-mail já está cadastrado
// nem se o envio ocorreu de fato — apenas o cooldown para a UI.
const GENERIC_SEND_MESSAGE =
  "Se o e-mail for elegível, um código de verificação foi enviado.";

export const send = async (req: Request, res: Response): Promise<Response> => {
  const { email } = req.body;

  // Fail-open: sem SMTP configurado, o frontend pula a etapa de código e
  // o signup segue normalmente (ver decisão no EmailVerificationService).
  if (!isEmailVerificationEnabled()) {
    return res.status(200).json({ required: false, message: GENERIC_SEND_MESSAGE });
  }

  // Cooldown e limite de envio são reportados ao cliente (não expõem
  // existência de conta — qualquer e-mail pode solicitar código).
  const { cooldownSeconds } = await sendVerificationCode(email);
  return res
    .status(200)
    .json({ required: true, cooldownSeconds, message: GENERIC_SEND_MESSAGE });
};

export const check = async (req: Request, res: Response): Promise<Response> => {
  const { email, code } = req.body;

  // Fail-open: sem SMTP configurado não existe verificação a conferir.
  if (!isEmailVerificationEnabled()) {
    return res.status(200).json({ required: false });
  }

  // SEGURANÇA: nunca logar código nem e-mail completo (enumeração).
  const { verificationToken } = await verifyCode(email, code);

  return res.status(200).json({ verified: true, verificationToken });
};
