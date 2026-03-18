import { Request, Response } from "express";
import AppError from "../errors/AppError";
import { getIO } from "../libs/socket";
import crypto from "crypto";
import nodemailer from "nodemailer";
import { Op } from "sequelize";

import AuthUserService from "../services/UserServices/AuthUserService";
import { SendRefreshToken } from "../helpers/SendRefreshToken";
import { RefreshTokenService } from "../services/AuthServices/RefreshTokenService";
import FindUserFromToken from "../services/AuthServices/FindUserFromToken";
import User from "../models/User";
import UpdateUserOnlineStatusService from "../services/UserServices/UpdateUserOnlineStatusService";

export const forgotPassword = async (req: Request, res: Response): Promise<Response> => {
  const { email } = req.body;

  console.log('Forgot password request received:', { email });

  const user = await User.findOne({ where: { email } });
  if (!user) {
    console.warn('No user found for email:', email);
    throw new AppError("E-mail não encontrado.", 404);
  }

  const token = crypto.randomBytes(32).toString("hex");
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

  user.passwordResetToken = token;
  user.passwordResetExpires = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
  await user.save();

  console.log('Password reset token generated:', {
    userId: user.id,
    email,
    token,
    expires: user.passwordResetExpires,
  });

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: email,
      subject: "Redefinição de Senha",
      text: `Clique no link para redefinir sua senha: ${resetUrl}`,
    });
    console.log('Password reset email sent to:', email);
  } catch (error) {
    console.error('Failed to send password reset email:', error);
    throw new AppError("Erro ao enviar e-mail de redefinição.", 500);
  }

  return res.status(200).json({ message: "E-mail enviado com sucesso." });
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { email, password } = req.body;

  const { token, serializedUser, refreshToken } = await AuthUserService({
    email,
    password
  });

  SendRefreshToken(res, refreshToken);

  // Atualiza status do usuário para online
  await UpdateUserOnlineStatusService({
    userId: serializedUser.id,
    companyId: serializedUser.companyId,
    online: true
  });

  const io = getIO();

  io.of(serializedUser.companyId.toString())
    .emit(`company-${serializedUser.companyId}-auth`, {
      action: "update",
      user: {
        id: serializedUser.id,
        email: serializedUser.email,
        companyId: serializedUser.companyId,
        token: serializedUser.token
      }
    });

  return res.status(200).json({
    token,
    user: serializedUser
  });
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const token: string = req.cookies.jrt;

  if (!token) {
    throw new AppError("ERR_SESSION_EXPIRED", 401);
  }

  const { user, newToken, refreshToken } = await RefreshTokenService(
    res,
    token
  );

  SendRefreshToken(res, refreshToken);

  return res.json({ token: newToken, user });
};

export const me = async (req: Request, res: Response): Promise<Response> => {
  const token: string = req.cookies.jrt;
  const user = await FindUserFromToken(token);
  const { id, profile, super: superAdmin } = user;

  if (!token) {
    throw new AppError("ERR_SESSION_EXPIRED", 401);
  }

  return res.json({ id, profile, super: superAdmin });
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { id } = req.user;
  if (id) {
    const user = await User.findByPk(id);
    await user.update({ online: false });
  }
  res.clearCookie("jrt");

  return res.send();
};

export const resetPassword = async (req: Request, res: Response): Promise<Response> => {
  const { token, newPassword } = req.body;

  console.log('Reset password request received:', { token, newPassword: '***' }); // Hide password in logs

  const user = await User.findOne({
    where: {
      passwordResetToken: token,
      passwordResetExpires: { [Op.gt]: new Date() },
    },
  });

  if (!user) {
    console.warn('No user found for token:', token);
    // Check if token exists but is expired or invalid
    const userWithToken = await User.findOne({
      where: { passwordResetToken: token },
    });
    if (userWithToken) {
      console.warn('Token found but expired or invalid:', {
        token,
        expires: userWithToken.passwordResetExpires,
      });
    }
    throw new AppError("Token inválido ou expirado.", 400);
  }

  console.log('User found for password reset:', { userId: user.id, email: user.email });

  user.password = newPassword;
  user.passwordResetToken = null;
  user.passwordResetExpires = null;
  await user.save();

  console.log('Password reset successful for user:', user.id);

  return res.status(200).json({ message: "Senha redefinida com sucesso." });
};