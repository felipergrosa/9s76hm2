import CompaniesSettings from "../../models/CompaniesSettings";
import WabaPricingRate from "../../models/WabaPricingRate";
import Whatsapp from "../../models/Whatsapp";
import logger from "../../utils/logger";
import { getMetaAxiosClient } from "./metaApiClient";

// Categorias cobradas pela Meta mapeadas para as categorias de template.
// AUTHENTICATION_INTERNATIONAL é a mesma tarifa-base de AUTHENTICATION para o
// mercado de destino; SERVICE/FREE_* são envios gratuitos.
const CATEGORY_MAP: Record<string, string> = {
  MARKETING: "MARKETING",
  MARKETING_LITE: "MARKETING",
  UTILITY: "UTILITY",
  AUTHENTICATION: "AUTHENTICATION",
  AUTHENTICATION_INTERNATIONAL: "AUTHENTICATION",
  SERVICE: "SERVICE"
};

// Janela de histórico usada para derivar o rate efetivo (cost/volume)
const RATE_LOOKBACK_DAYS = 90;

/**
 * Cotação USD→BRL da empresa.
 * Prioridade: CompaniesSettings.usdToBrlRate → env USD_BRL_RATE → 5.60
 */
export const getUsdToBrlRate = async (companyId: number): Promise<number> => {
  try {
    const settings = await CompaniesSettings.findOne({ where: { companyId } });
    const configured = parseFloat(settings?.usdToBrlRate || "");
    if (Number.isFinite(configured) && configured > 0) {
      return configured;
    }
  } catch (err: any) {
    logger.warn(`[WabaPricing] Falha ao ler cotação da empresa ${companyId}: ${err.message}`);
  }

  const envRate = parseFloat(process.env.USD_BRL_RATE || "");
  if (Number.isFinite(envRate) && envRate > 0) return envRate;

  return 5.6;
};

/**
 * Retorna o custo estimado por envio (em BRL) para uma categoria de template.
 * Busca o rate da conexão (whatsappId + categoria + país) e converte para BRL.
 * Retorna null quando não há dado (sem estimativa possível).
 */
export const getSendCostBrl = async ({
  companyId,
  whatsappId,
  category,
  country = "BR"
}: {
  companyId: number;
  whatsappId: number;
  category: string;
  country?: string;
}): Promise<number | null> => {
  const mapped = CATEGORY_MAP[category?.toUpperCase()] || category?.toUpperCase();

  // Envios gratuitos (janela de atendimento, entry points) — custo zero real
  if (!mapped || mapped === "SERVICE") return 0;

  const rate = await WabaPricingRate.findOne({
    where: { companyId, whatsappId, category: mapped, country }
  });

  if (!rate) return null;

  // rateBrl pode estar null em registros legados — recalcula com a cotação atual
  if (rate.rateBrl !== null && rate.rateBrl !== undefined) {
    return Number(rate.rateBrl);
  }
  if (rate.rate !== null && rate.rate !== undefined) {
    const fx = await getUsdToBrlRate(companyId);
    return Number(rate.rate) * fx;
  }
  return null;
};

interface PricingDataPoint {
  start: number;
  end: number;
  country?: string;
  tier?: string;
  pricing_type?: string;
  pricing_category?: string;
  volume?: number;
  cost?: number;
}

/**
 * Sincroniza as tarifas efetivas de uma conexão oficial consultando
 * pricing_analytics da Meta: rate = Σcost / Σvolume por (país, categoria)
 * considerando apenas mensagens cobradas (pricing_type = REGULAR).
 *
 * Retorna a quantidade de rates atualizados. Erros da Meta são logados e
 * propagados como AppError legível.
 */
export const SyncWabaPricing = async ({
  whatsapp,
  companyId
}: {
  whatsapp: Whatsapp;
  companyId: number;
}): Promise<number> => {
  if (whatsapp.channelType !== "official" || !whatsapp.wabaBusinessAccountId) {
    return 0;
  }

  const client = getMetaAxiosClient(whatsapp);
  const end = Math.floor(Date.now() / 1000);
  const start = end - RATE_LOOKBACK_DAYS * 24 * 60 * 60;

  const { data } = await client.get(`/${whatsapp.wabaBusinessAccountId}`, {
    params: {
      fields:
        "pricing_analytics" +
        `.start(${start})` +
        `.end(${end})` +
        ".granularity(MONTHLY)" +
        ".metric_types(COST,VOLUME)" +
        ".dimensions(PRICING_CATEGORY,PRICING_TYPE,COUNTRY,TIER)"
    }
  });

  const dataPoints: PricingDataPoint[] = (data?.pricing_analytics?.data || [])
    .flatMap((entry: any) => entry.data_points || []);

  // Agrega por (country, category): soma custo e volume dos datapoints pagos
  const aggregated = new Map<
    string,
    { cost: number; volume: number; tier?: string }
  >();

  dataPoints.forEach(dp => {
    if (dp.pricing_type !== "REGULAR" || !dp.pricing_category) return;
    const category = CATEGORY_MAP[dp.pricing_category];
    if (!category || category === "SERVICE") return;

    const country = (dp.country || "BR").toUpperCase();
    const key = `${country}|${category}`;
    const current = aggregated.get(key) || { cost: 0, volume: 0 };
    current.cost += Number(dp.cost || 0);
    current.volume += Number(dp.volume || 0);
    if (dp.tier) current.tier = dp.tier;
    aggregated.set(key, current);
  });

  const fx = await getUsdToBrlRate(companyId);
  let upserted = 0;

  for (const [key, agg] of aggregated) {
    if (agg.volume <= 0) continue;
    const [country, category] = key.split("|");
    const rate = agg.cost / agg.volume;

    // findOrCreate + update: índice único (whatsappId, category, country)
    // garante idempotência mesmo em chamadas concorrentes
    const [record] = await WabaPricingRate.findOrCreate({
      where: { whatsappId: whatsapp.id, category, country },
      defaults: { companyId } as any
    });
    await record.update({
      companyId,
      rate,
      currency: "USD", // custo vem na moeda da WABA (normalmente USD)
      rateBrl: rate * fx,
      tier: agg.tier || null,
      source: "meta",
      lastSyncAt: new Date()
    } as any);
    upserted += 1;
  }

  logger.info(
    `[WabaPricing] ${whatsapp.name}: ${upserted} tarifas atualizadas ` +
    `(${dataPoints.length} datapoints, ${aggregated.size} pares país/categoria)`
  );

  return upserted;
};

/**
 * Sincroniza tarifas de todas as conexões oficiais da empresa (ou de todas
 * as empresas quando companyId é omitido). Falhas por conexão são isoladas.
 */
export const SyncAllWabaPricing = async (
  companyId?: number
): Promise<{ synced: number; errors: number }> => {
  const where: any = { channelType: "official" };
  if (companyId) where.companyId = companyId;

  const whatsapps = await Whatsapp.findAll({ where });
  let synced = 0;
  let errors = 0;

  for (const whatsapp of whatsapps) {
    try {
      synced += await SyncWabaPricing({
        whatsapp,
        companyId: whatsapp.companyId
      });
    } catch (err: any) {
      errors += 1;
      logger.warn(
        `[WabaPricing] Falha ao sincronizar ${whatsapp.name} (${whatsapp.id}): ${err.message}`
      );
    }
  }

  return { synced, errors };
};
