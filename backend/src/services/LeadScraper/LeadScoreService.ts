import { ScraperResult } from "../../models/LeadScraperJob";

// Lead score 0-100: soma ponderada de sinais de contatibilidade e qualidade,
// com cap em 100. Roda ao FIM do pipeline — precisa do hasWhatsapp/whatsappChecked
// preenchidos pela validação WhatsApp (LeadScraperJobService chama logo antes
// de marcar o job como "done").

const normUpper = (s: string) =>
  s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toUpperCase();

const parseRating = (v?: string): number | null => {
  // rating pode vir "4,5" (pt-BR) ou "4.5" — aceita ambos
  const n = parseFloat(String(v || "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

export const scoreLead = (r: ScraperResult): void => {
  let score = 0;

  // WhatsApp confirmado é o sinal mais forte de contatibilidade
  if (r.hasWhatsapp === true) score += 30;
  else if (r.phone) score += 8;

  // CNPJ ativo na Receita = empresa real e operante; CNPJ sem situação
  // conhecida ainda vale (cadastro existe, só não veio o status)
  if (r.cnpj) {
    const sit = normUpper(String(r.situacao || ""));
    score += sit.includes("ATIV") ? 25 : 15;
  }

  if (r.website) score += 10;
  if (r.instagram) score += 10;

  // sinais de negócio ativo vindos do detail page do Maps (add-on)
  if (r.hasPopularTimes) score += 8;     // histograma de movimento = loja com fluxo
  else if (r.openingHours) score += 4;   // horário cadastrado = perfil mantido

  // decisores extraídos do site (add-on leads enrichment) — contato direto
  // com quem decide, vale quase tanto quanto WhatsApp confirmado
  if (r.decisionMakers?.length) score += 15;

  // nota alta só conta com massa de avaliações — 5.0 com 2 reviews é ruído
  const rating = parseRating(r.rating);
  if (rating !== null) {
    if (rating >= 4.5 && (r.reviewsCount || 0) >= 10) score += 15;
    else if (rating >= 4.0) score += 8;
  }

  if (r.email) score += 10;

  r.leadScore = Math.min(score, 100);
  r.leadTier = r.leadScore >= 75 ? "gold" : r.leadScore >= 45 ? "silver" : "bronze";
};

export const scoreResults = (results: ScraperResult[]): void => {
  for (const r of results) scoreLead(r);
};
