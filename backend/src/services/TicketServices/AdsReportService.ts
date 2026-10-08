import { QueryTypes } from "sequelize";
import sequelize from "../../database";

/**
 * Relatório de Anúncios Click-to-WhatsApp (CTWA).
 *
 * Funil: leads (tickets cuja primeira mensagem veio com referral de
 * anúncio da Meta — Ticket.ctwaClid preenchido) → convertidos.
 *
 * Marcador de conversão escolhido: ticket com status = 'closed'
 * (marcador simples e já usado pelo Relatório de Fechamento; não
 * depende de tag nem de wallet). O período filtra pela data de
 * criação do ticket (primeiro contato do lead).
 *
 * Agregação por anúncio: group by Ticket.adId (referral.source_id).
 * Leads sem adId (payload incompleto) agrupam-se sob adId null.
 */

export interface AdsReportParams {
  companyId: number;
  startDate?: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
}

export interface AdsReportAdRow {
  adId: string | null;
  headline: string | null;
  leads: number;
  closed: number;
  conversionRate: number; // % de leads convertidos (closed/leads)
  firstContactAt: string | null;
}

export interface AdsReportTotals {
  leads: number;
  closed: number;
  conversionRate: number;
  ads: number; // quantidade de anúncios distintos no período
}

interface AdsReportResult {
  ads: AdsReportAdRow[];
  totals: AdsReportTotals;
}

interface RawAdRow {
  adId: string | null;
  headline: string | null;
  leads: number;
  closed: number;
  firstContactAt: string | null;
}

// Normaliza data YYYY-MM-DD para limites do dia (início/fim)
const dayStart = (date?: string): string | null =>
  date ? `${date} 00:00:00` : null;
const dayEnd = (date?: string): string | null =>
  date ? `${date} 23:59:59` : null;

// Taxa de conversão em % com 1 casa decimal (0 quando não há leads)
const conversionRate = (closed: number, leads: number): number =>
  leads > 0 ? Math.round((closed / leads) * 1000) / 10 : 0;

const AdsReportService = async ({
  companyId,
  startDate,
  endDate
}: AdsReportParams): Promise<AdsReportResult> => {
  const replacements: Record<string, unknown> = { companyId };

  // Base do funil: tickets da empresa que vieram de anúncio CTWA
  const where: string[] = [
    `t."companyId" = :companyId`,
    `t."ctwaClid" is not null`
  ];

  if (startDate) {
    replacements.startDate = dayStart(startDate);
    where.push(`t."createdAt" >= :startDate`);
  }
  if (endDate) {
    replacements.endDate = dayEnd(endDate);
    where.push(`t."createdAt" <= :endDate`);
  }

  const query = `
    select
      t."adId" as "adId",
      max(t."adHeadline") as "headline",
      count(*)::int as "leads",
      count(*) filter (where t.status = 'closed')::int as "closed",
      min(t."createdAt") as "firstContactAt"
    from "Tickets" t
    where ${where.join(" and ")}
    group by t."adId"
    order by "leads" desc, "firstContactAt" asc
    limit 500
  `;

  const rows = await sequelize.query<RawAdRow>(query, {
    replacements,
    type: QueryTypes.SELECT
  });

  const ads: AdsReportAdRow[] = rows.map((row) => {
    const leads = Number(row.leads || 0);
    const closed = Number(row.closed || 0);
    return {
      adId: row.adId,
      headline: row.headline,
      leads,
      closed,
      conversionRate: conversionRate(closed, leads),
      firstContactAt: row.firstContactAt
    };
  });

  const totalLeads = ads.reduce((acc, ad) => acc + ad.leads, 0);
  const totalClosed = ads.reduce((acc, ad) => acc + ad.closed, 0);

  return {
    ads,
    totals: {
      leads: totalLeads,
      closed: totalClosed,
      conversionRate: conversionRate(totalClosed, totalLeads),
      ads: ads.length
    }
  };
};

export default AdsReportService;
