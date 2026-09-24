import axios from "axios";
import { ScraperFilters, ScraperResult } from "../../models/LeadScraperJob";
import { toArray, resolveMaxResults } from "./ScraperFilterUtils";
import logger from "../../utils/logger";

// ============================================================================
// Scraper de conselhos profissionais. Fonte implementada: CAU (Arquitetura).
//
// Estrutura REAL descoberta via probe (ArcGIS REST aberto, sem auth/captcha):
//   Catálogo: https://gisserver.caubr.gov.br/server/rest/services?f=pjson
//   Serviço:  CAUBR/SICCAU/FeatureServer  (capabilities: "Query", maxRecordCount: 6000)
//
//   Layer 0 "Arquitetos e Urbanistas" (profissionais) — campos relevantes:
//     nome, nome_social, registro_nacional (ex.: "00A1728202"),
//     situacao_registro_ultimo (ATIVO|INTERROMPIDO|CANCELADO|SUSPENSO|null),
//     tipo_registro_ultimo, ativo ("Sim"/"Não"), uf, cidade_normalizada,
//     regional, email, telefone, celular,
//     logradouro_tipo, logradouro, logradouro_numero, logradouro_complemento,
//     bairro, cep, objectid (OID p/ paginação)
//     OBS: existem cpf/data_nascimento — NÃO são solicitados em outFields
//          (não coletar dados pessoais sensíveis desnecessários).
//
//   Layer 1 "Empresas de Arquitetura e Urbanismo" — campos relevantes:
//     razao_social, cnpj (14 dígitos, sem máscara), registro_nacional,
//     situacao_registro, tipo_registro, ativa ("Sim"/"Não"),
//     uf, cidade_normalizada, regional, email, telefone, cnae_arquitetura,
//     tipologradouro, logradouro, numero, complemento, bairro, cep, objectid
//
//   Query: GET .../FeatureServer/{layerId}/query
//     ?where=uf='SP' AND cidade_normalizada LIKE '%São Paulo%'
//     &outFields=...&orderByFields=objectid ASC
//     &resultOffset=0&resultRecordCount=1000&returnGeometry=false&f=json
//   Paginação estável exige orderByFields; "exceededTransferLimit": true
//   indica que há mais registros. Página curta (< recordCount) = fim.
//
//   Contagens reais (probe): uf='SP' → 111.379 profissionais;
//   situacao_registro_ultimo='ATIVO' em SP → 76.940.
// ============================================================================

const CAU_BASE =
  "https://gisserver.caubr.gov.br/server/rest/services/CAUBR/SICCAU/FeatureServer";

const LAYERS = {
  profissional: {
    id: 0,
    categoria: "Arquiteto e Urbanista",
    campos: [
      "nome",
      "registro_nacional",
      "situacao_registro_ultimo",
      "tipo_registro_ultimo",
      "ativo",
      "uf",
      "cidade_normalizada",
      "regional",
      "email",
      "telefone",
      "celular",
      "logradouro_tipo",
      "logradouro",
      "logradouro_numero",
      "logradouro_complemento",
      "bairro",
      "cep",
    ],
    campoNome: "nome",
    campoSituacao: "situacao_registro_ultimo",
  },
  empresa: {
    id: 1,
    categoria: "Empresa de Arquitetura e Urbanismo",
    campos: [
      "razao_social",
      "cnpj",
      "registro_nacional",
      "situacao_registro",
      "tipo_registro",
      "ativa",
      "uf",
      "cidade_normalizada",
      "regional",
      "email",
      "telefone",
      "cnae_arquitetura",
      "tipologradouro",
      "logradouro",
      "numero",
      "complemento",
      "bairro",
      "cep",
    ],
    campoNome: "razao_social",
    campoSituacao: "situacao_registro",
  },
} as const;

const PAGE_SIZE = 1000; // maxRecordCount do serviço é 6000; 1000 é gentil com o servidor
const MAX_RESULTS_CAP = 2000;
const DELAY_MS = 300;
const TIMEOUT_MS = 20000;
const MAX_RETRIES = 2;

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

// Escapa valor para uso seguro em cláusula where do ArcGIS (SQL-like)
const sqlString = (v: string) => v.replace(/'/g, "''").trim();

// Sanitiza termo de LIKE: remove % e _ (curingas) e escapa aspas
const likeTerm = (v: string) => sqlString(v.replace(/[%_]/g, " "));

// O ArcGIS do CAU usa LIKE case/acento-sensitivo e não suporta REPLACE/UNACCENT.
// Solução: UPPER() dos dois lados + variante do termo com vogais e 'c' trocadas
// pelo curinga '_' (cobre ã/õ/ç/acentos). Mantém OR com o literal para quando o
// usuário já digita o acento corretamente.
const likeClause = (campo: string, termo: string): string => {
  const literal = likeTerm(termo).toUpperCase();
  const wildcard = literal.replace(/[AEIOUC]/g, "_");
  // Termo só de vogais/c vira "___" — casaria tudo; usa só o literal
  if (!wildcard.replace(/_/g, "").trim()) {
    return `UPPER(${campo}) LIKE '%${literal}%'`;
  }
  if (literal === wildcard) {
    return `UPPER(${campo}) LIKE '%${literal}%'`;
  }
  return `(UPPER(${campo}) LIKE '%${literal}%' OR UPPER(${campo}) LIKE '%${wildcard}%')`;
};

// OR de N condições geradas por `build` para cada valor, entre parênteses
// quando há mais de uma (mesmo padrão que likeClause já usa para acentos).
const orClause = (valores: string[], build: (v: string) => string): string => {
  const partes = valores.map(build);
  return partes.length > 1 ? `(${partes.join(" OR ")})` : partes[0];
};

async function queryArcgis(url: string, params: Record<string, string>) {
  let lastErr: any;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const { data } = await axios.get(url, {
        params,
        timeout: TIMEOUT_MS,
        headers: { "User-Agent": "Whaticket/1.0" },
      });
      // ArcGIS retorna HTTP 200 com {error:{code,message}} em falha de query
      if (data?.error) {
        throw new Error(
          `ArcGIS error ${data.error.code}: ${data.error.message}`
        );
      }
      return data;
    } catch (err: any) {
      lastErr = err;
      const status = err.response?.status;
      logger.warn(
        `[ConselhoScraper] tentativa ${attempt + 1}/${MAX_RETRIES + 1} falhou` +
          ` (HTTP ${status ?? "?"}): ${err.message}`
      );
      // Não faz retry em erro de query do lado do servidor (400/499 = where inválida)
      if (status === 400 || status === 498 || status === 499) break;
      if (attempt < MAX_RETRIES) await delay(2000);
    }
  }
  throw lastErr;
}

function montarEndereco(a: Record<string, any>, empresa: boolean): string {
  const tipo = empresa ? a.tipologradouro : a.logradouro_tipo;
  const numero = empresa ? a.numero : a.logradouro_numero;
  const compl = empresa ? a.complemento : a.logradouro_complemento;
  return [
    [tipo, a.logradouro].filter(Boolean).join(" "),
    numero && `nº ${numero}`,
    compl,
    a.bairro,
    a.cep && `CEP ${a.cep}`,
  ]
    .filter(Boolean)
    .join(", ");
}

function mapProfissional(a: Record<string, any>): ScraperResult {
  return {
    name: a.nome || "",
    registro: a.registro_nacional || "",
    registroTipo: "CAU",
    situacao: a.situacao_registro_ultimo || "",
    category: LAYERS.profissional.categoria,
    municipio: a.cidade_normalizada || "",
    uf: a.uf || "",
    email: a.email || "",
    phone: a.celular || a.telefone || "",
    address: montarEndereco(a, false),
  };
}

function mapEmpresa(a: Record<string, any>): ScraperResult {
  return {
    name: a.razao_social || "",
    razaoSocial: a.razao_social || "",
    cnpj: a.cnpj || "",
    registro: a.registro_nacional || "",
    registroTipo: "CAU",
    situacao: a.situacao_registro || "",
    category: a.cnae_arquitetura || LAYERS.empresa.categoria,
    municipio: a.cidade_normalizada || "",
    uf: a.uf || "",
    email: a.email || "",
    phone: a.telefone || "",
    address: montarEndereco(a, true),
  };
}

// Monta a cláusula where para um layer (profissional|empresa) a partir dos filtros.
function buildWhere(
  filters: ScraperFilters,
  tipo: "profissional" | "empresa"
): string {
  const layer = LAYERS[tipo];
  const condicoes: string[] = [];

  const ufs = toArray(filters.uf).map(v => sqlString(v).toUpperCase());
  if (ufs.length) {
    for (const uf of ufs) {
      if (!/^[A-Z]{2}$/.test(uf)) {
        throw new Error(`UF inválida para consulta ao CAU: "${uf}"`);
      }
    }
    condicoes.push(orClause(ufs, uf => `uf='${uf}'`));
  }

  const municipios = toArray(filters.municipio);
  if (municipios.length) {
    condicoes.push(orClause(municipios, m => likeClause("cidade_normalizada", m)));
  }

  const regionais = toArray(filters.regional);
  if (regionais.length) {
    condicoes.push(orClause(regionais, r => likeClause("regional", r)));
  }

  if (filters.keyword) {
    condicoes.push(likeClause(layer.campoNome, filters.keyword));
  }

  const situacoes = toArray(filters.situacao).map(v => sqlString(v).toUpperCase());
  if (situacoes.length) {
    condicoes.push(orClause(situacoes, s => `${layer.campoSituacao}='${s}'`));
  }

  if (filters.temEmail) condicoes.push("email IS NOT NULL AND email <> ''");
  if (filters.temTelefone) {
    condicoes.push(
      tipo === "profissional"
        ? "(telefone IS NOT NULL OR celular IS NOT NULL)"
        : "telefone IS NOT NULL"
    );
  }

  return condicoes.length ? condicoes.join(" AND ") : "1=1";
}

// Executa a busca paginada em um único layer, até `maxResults`.
async function scrapeLayer(
  filters: ScraperFilters,
  tipo: "profissional" | "empresa",
  maxResults: number,
  onProgress?: (current: number, total: number) => Promise<void>
): Promise<ScraperResult[]> {
  const layer = LAYERS[tipo];
  const url = `${CAU_BASE}/${layer.id}/query`;
  const where = buildWhere(filters, tipo);

  logger.info(
    `[ConselhoScraper] CAU/${tipo} layer=${layer.id} where="${where}" max=${maxResults}`
  );

  const results: ScraperResult[] = [];
  let offset = 0;
  const mapper = tipo === "empresa" ? mapEmpresa : mapProfissional;

  while (results.length < maxResults) {
    const recordCount = Math.min(PAGE_SIZE, maxResults - results.length);
    const data = await queryArcgis(url, {
      where,
      outFields: layer.campos.join(","),
      orderByFields: "objectid ASC",
      resultOffset: String(offset),
      resultRecordCount: String(recordCount),
      returnGeometry: "false",
      f: "json",
    });

    const features: any[] = data.features || [];
    for (const feat of features) {
      const lead = mapper(feat.attributes || {});
      if (lead.name) results.push(lead);
    }

    await onProgress?.(Math.min(results.length, maxResults), maxResults);

    // Fim: página curta ou sem flag de continuação
    const temMais =
      data.exceededTransferLimit === true || features.length === recordCount;
    if (features.length === 0 || !temMais) break;

    offset += features.length;
    await delay(DELAY_MS);
  }

  logger.info(
    `[ConselhoScraper] CAU/${tipo}: ${results.length} leads coletados`
  );
  return results;
}

async function scrapeCau(
  filters: ScraperFilters,
  onProgress?: (current: number, total: number) => Promise<void>
): Promise<ScraperResult[]> {
  const maxResults = resolveMaxResults(filters.maxResults, MAX_RESULTS_CAP);

  if (filters.conselhoTipo === "ambos") {
    // ponytail: split simples 50/50 em vez de intercalar as duas queries.
    const metade = Math.ceil(maxResults / 2);
    const profissionais = await scrapeLayer(filters, "profissional", metade, onProgress);
    const empresas = await scrapeLayer(filters, "empresa", metade, onProgress);
    return [...profissionais, ...empresas].slice(0, maxResults);
  }

  const tipo = filters.conselhoTipo === "empresa" ? "empresa" : "profissional";
  return scrapeLayer(filters, tipo, maxResults, onProgress);
}

export const scrapeConselho = async (
  filters: ScraperFilters,
  onProgress?: (current: number, total: number) => Promise<void>
): Promise<ScraperResult[]> => {
  const conselho = filters.conselho || "cau";
  if (conselho !== "cau") {
    // Estrutura pronta para extensão: novos conselhos ganham um scrapeXxx aqui
    throw new Error(
      `Conselho "${conselho}" ainda não suportado. Disponível: "cau".`
    );
  }
  return scrapeCau(filters, onProgress);
};
