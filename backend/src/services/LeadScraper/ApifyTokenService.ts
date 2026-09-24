import Setting from "../../models/Setting";
import { encryptString, decryptString } from "../../utils/crypto";

// Per-company override for the global APIFY_TOKEN env var. Stored encrypted
// (AES-256-GCM via utils/crypto, reusing the same scheme already used for
// other secrets in this codebase) in the existing per-company Setting table
// (key/value store, already scoped by companyId — no new table needed).
const SETTING_KEY = "apifyToken";

const mask = (token: string): string =>
  token.length <= 7 ? "***" : `${token.slice(0, 3)}...${token.slice(-4)}`;

export const getCompanyApifyToken = async (
  companyId: number
): Promise<string | null> => {
  const setting = await Setting.findOne({ where: { companyId, key: SETTING_KEY } });
  if (!setting?.value) return null;
  try {
    return decryptString(setting.value);
  } catch {
    // ponytail: corrupted/unreadable ciphertext (e.g. key rotated) — treat as unset
    return null;
  }
};

export const getCompanyApifyTokenStatus = async (
  companyId: number
): Promise<{ configured: boolean; masked: string | null }> => {
  const token = await getCompanyApifyToken(companyId);
  return token ? { configured: true, masked: mask(token) } : { configured: false, masked: null };
};

export const setCompanyApifyToken = async (
  companyId: number,
  token: string
): Promise<string> => {
  const encrypted = encryptString(token);
  const [setting] = await Setting.findOrCreate({
    where: { companyId, key: SETTING_KEY },
    defaults: { companyId, key: SETTING_KEY, value: encrypted } as any
  });
  await setting.update({ value: encrypted });
  return mask(token);
};

export const clearCompanyApifyToken = async (companyId: number): Promise<void> => {
  await Setting.destroy({ where: { companyId, key: SETTING_KEY } });
};
