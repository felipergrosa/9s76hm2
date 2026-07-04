import { Request, Response } from "express";
import {
  loginInstagram,
  submitTwoFa,
  clearSession,
  getSessionStatus,
} from "../services/Instagram/InstagramAuthService";

export const connect = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { companyId } = req.user;
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: "username e password são obrigatórios" });

    const result = await loginInstagram(companyId, username.trim(), password);
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Erro ao conectar ao Instagram" });
  }
};

export const verify2fa = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { companyId } = req.user;
    const { pendingId, code } = req.body;
    if (!pendingId || !code) return res.status(400).json({ error: "pendingId e code são obrigatórios" });

    await submitTwoFa(companyId, pendingId, code.replace(/\D/g, ""));
    return res.json({ status: "success" });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
};

export const disconnect = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { companyId } = req.user;
    await clearSession(companyId);
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};

export const status = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { companyId } = req.user;
    const session = await getSessionStatus(companyId);
    return res.json(session ?? { status: "none" });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
};
