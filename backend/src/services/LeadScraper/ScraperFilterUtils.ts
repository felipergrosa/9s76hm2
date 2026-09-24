import { MultiValue } from "../../models/LeadScraperJob";

// Normaliza um filtro single-or-multi para array, descartando vazios.
export const toArray = (v: MultiValue | undefined | null): string[] => {
  if (v === undefined || v === null) return [];
  const arr = Array.isArray(v) ? v : [v];
  return arr.map(s => String(s).trim()).filter(Boolean);
};

// 0 ou undefined = sem limite. Aplica apenas o teto de segurança absoluto do source.
export const resolveMaxResults = (requested: number | undefined, hardCap: number): number => {
  if (requested === undefined || requested === null || requested <= 0) return hardCap;
  return Math.min(requested, hardCap);
};
