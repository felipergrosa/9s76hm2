import crypto from "crypto";
import nodemailer from "nodemailer";
import { Op } from "sequelize";

import EmailVerificationCode from "../../models/EmailVerificationCode";
import AppError from "../../errors/AppError";
import logger from "../../utils/logger";

// ========== Parâmetros de segurança do fluxo (N2) ==========
// Código numérico de 6 dígitos, válido por 15 min, máx. 5 tentativas,
// reenvio com cooldown de 60s e limite de envios por e-mail por janela.
const CODE_LENGTH = 6;
const CODE_TTL_MS = 15 * 60 * 1000; // 15 minutos
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 60 * 1000; // 60 segundos
const SEND_WINDOW_MS = 60 * 60 * 1000; // janela de 1h para rate-limit por e-mail
const MAX_SENDS_PER_WINDOW = 5;
// Token opaco devolvido pelo check e exigido no signup (uso único, 30 min).
const VERIFIED_TOKEN_TTL_MS = 30 * 60 * 1000;

// E-mail sempre normalizado para evitar mismatch entre send/check/signup.
export const normalizeEmail = (email: string): string =>
  String(email || "").trim().toLowerCase();

// Detecção de configuração de e-mail: aceita as duas convenções do projeto
// (SMTP_* do forgot-password em SessionController e MAIL_* de helpers/SendMail).
// DECISÃO (fail-open): se NENHUM transporte estiver configurado, a verificação
// é desligada — /verify-email/send responde { required: false } e o signup
// segue sem código. Justificativa: hoje o signup já envia e-mail de
// boas-vindas em try/catch silencioso (UserController.store), ou seja, o
// produto já opera "e-mail opcional". Fail-closed bloquearia 100% dos
// cadastros em instalações sem SMTP — risco de disponibilidade maior que o
// ganho de segurança, já que o gate só existe quando o envio é possível.
const isSmtpConfigured = (): boolean =>
  Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

const isMailConfigured = (): boolean =>
  Boolean(process.env.MAIL_HOST && process.env.MAIL_USER && process.env.MAIL_PASS);

export const isEmailVerificationEnabled = (): boolean =>
  isSmtpConfigured() || isMailConfigured();

// Transporter criado sob demanda (lazy) — preserva a ordem de carregamento
// das variáveis de ambiente e prioriza SMTP_* (convenção mais nova do projeto).
let mailTransporter: nodemailer.Transporter | null = null;

const getMailTransporter = (): nodemailer.Transporter => {
  if (!mailTransporter) {
    mailTransporter = isSmtpConfigured()
      ? nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT) || 587,
          secure: process.env.SMTP_SECURE === "true",
          auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        })
      : nodemailer.createTransport({
          host: process.env.MAIL_HOST,
          port: Number(process.env.MAIL_PORT) || 587,
          auth: { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS }
        });
  }
  return mailTransporter;
};

const getFromAddress = (): string =>
  process.env.SMTP_FROM || process.env.MAIL_FROM || process.env.SMTP_USER || process.env.MAIL_USER;

// Hash do código com o e-mail como "salt" contextual: impede reuso de hash
// entre e-mails e nunca persiste o código em claro.
const hashCode = (email: string, code: string): string =>
  crypto.createHash("sha256").update(`${email}:${code}`).digest("hex");

const generateCode = (): string => {
  // Gera 6 dígitos com crypto (evita Math.random em fluxo de autenticação).
  const n = crypto.randomInt(0, 10 ** CODE_LENGTH);
  return n.toString().padStart(CODE_LENGTH, "0");
};

interface SendResult {
  cooldownSeconds: number;
}

/**
 * Cria e envia um novo código de verificação para o e-mail.
 * Aplica cooldown de reenvio (60s) e rate-limit por e-mail (5 envios/hora).
 */
export const sendVerificationCode = async (rawEmail: string): Promise<SendResult> => {
  const email = normalizeEmail(rawEmail);
  if (!email) {
    throw new AppError("ERR_VERIFICATION_INVALID_EMAIL", 400);
  }

  const now = Date.now();

  // Cooldown de reenvio: último código emitido há menos de 60s.
  const lastCode = await EmailVerificationCode.findOne({
    where: { email },
    order: [["createdAt", "DESC"]]
  });
  if (lastCode && now - new Date(lastCode.createdAt).getTime() < RESEND_COOLDOWN_MS) {
    throw new AppError("ERR_VERIFICATION_COOLDOWN", 429);
  }

  // Rate-limit por e-mail: máx. de envios na janela de 1h.
  const sendsInWindow = await EmailVerificationCode.count({
    where: { email, createdAt: { [Op.gte]: new Date(now - SEND_WINDOW_MS) } }
  });
  if (sendsInWindow >= MAX_SENDS_PER_WINDOW) {
    throw new AppError("ERR_VERIFICATION_SEND_LIMIT", 429);
  }

  const code = generateCode();

  const record = await EmailVerificationCode.create({
    email,
    codeHash: hashCode(email, code),
    attempts: 0,
    expiresAt: new Date(now + CODE_TTL_MS)
  });

  try {
    await getMailTransporter().sendMail({
      from: getFromAddress(),
      to: email,
      subject: "Código de verificação de e-mail",
      text: `Seu código de verificação é: ${code}\n\nEle expira em 15 minutos.`,
      html: `<p>Seu código de verificação é:</p><p style="font-size:28px;font-weight:bold;letter-spacing:6px">${code}</p><p>Ele expira em 15 minutos.</p>`
    });
  } catch (err) {
    // Remove o registro para não consumir o budget de envio nem travar o
    // cooldown quando o SMTP falha — o usuário pode tentar reenviar.
    await record.destroy().catch(() => undefined);
    // SEGURANÇA: nunca logar o código; logar apenas o e-mail e o erro.
    logger.error({ err, email }, "Falha ao enviar e-mail de verificação");
    throw new AppError("ERR_EMAIL_SEND_FAILED", 500);
  }

  return { cooldownSeconds: RESEND_COOLDOWN_MS / 1000 };
};

interface VerifyResult {
  verificationToken: string;
}

/**
 * Confere o código informado com o último emitido para o e-mail.
 * Em sucesso, gera um verificationToken de uso único (30 min) exigido no signup.
 */
export const verifyCode = async (rawEmail: string, code: string): Promise<VerifyResult> => {
  const email = normalizeEmail(rawEmail);
  const codeStr = String(code || "").trim();

  if (!email || !/^\d{6}$/.test(codeStr)) {
    throw new AppError("ERR_VERIFICATION_CODE_INVALID", 400);
  }

  // Compara sempre contra o código MAIS RECENTE — reenvio invalida os anteriores.
  const record = await EmailVerificationCode.findOne({
    where: { email },
    order: [["createdAt", "DESC"]]
  });

  if (!record || new Date(record.expiresAt).getTime() < Date.now()) {
    throw new AppError("ERR_VERIFICATION_CODE_EXPIRED", 400);
  }

  if (record.attempts >= MAX_ATTEMPTS) {
    throw new AppError("ERR_VERIFICATION_MAX_ATTEMPTS", 400);
  }

  if (record.codeHash !== hashCode(email, codeStr)) {
    // Conta tentativa apenas em erro de código — limite de 5 por código.
    record.attempts += 1;
    await record.save();
    throw new AppError(
      record.attempts >= MAX_ATTEMPTS
        ? "ERR_VERIFICATION_MAX_ATTEMPTS"
        : "ERR_VERIFICATION_CODE_INVALID",
      400
    );
  }

  // Sucesso: emite token opaco de uso único para o signup consumir.
  record.verifiedToken = crypto.randomBytes(32).toString("hex");
  record.verifiedTokenExpiresAt = new Date(Date.now() + VERIFIED_TOKEN_TTL_MS);
  await record.save();

  return { verificationToken: record.verifiedToken };
};

/**
 * Valida e consome o verificationToken no signup.
 * Retorna true apenas se o token existir, casar com o e-mail, não estar
 * expirado e ainda não ter sido consumido (uso único).
 */
export const consumeVerificationToken = async (
  rawEmail: string,
  token: string
): Promise<boolean> => {
  const email = normalizeEmail(rawEmail);
  if (!email || !token || typeof token !== "string") {
    return false;
  }

  const record = await EmailVerificationCode.findOne({
    where: { verifiedToken: token }
  });

  if (!record) {
    return false;
  }

  const isValid =
    record.email === email &&
    !record.consumedAt &&
    record.verifiedTokenExpiresAt &&
    new Date(record.verifiedTokenExpiresAt).getTime() > Date.now();

  if (!isValid) {
    return false;
  }

  // Invalida após uso — o mesmo token não pode concluir dois cadastros.
  record.consumedAt = new Date();
  await record.save();
  return true;
};
