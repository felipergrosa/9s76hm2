import axios from "axios";
import { ScraperFilters, ScraperResult } from "../../models/LeadScraperJob";
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
const DEFAULT_MAX_RESULTS = 200;
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

async function scrapeCau(
  filters: ScraperFilters,
  onProgress?: (current: number, total: number) => Promise<void>
): Promise<ScraperResult[]> {
  const tipo = filters.conselhoTipo === "empresa" ? "empresa" : "profissional";
  const layer = LAYERS[tipo];
  const url = `${CAU_BASE}/${layer.id}/query`;

  const maxResults = Math.min(
    filters.maxResults || DEFAULT_MAX_RESULTS,
    MAX_RESULTS_CAP
  );

  // Monta cláusula where a partir dos filtros disponíveis
  const condicoes: string[] = [];
  if (filters.uf) {
    const uf = sqlString(filters.uf).toUpperCase();
    if (!/^[A-Z]{2}$/.test(uf)) {
      throw new Error(`UF inválida para consulta ao CAU: "${filters.uf}"`);
    }
    condicoes.push(`uf='${uf}'`);
  }
  if (filters.municipio) {
    condicoes.push(likeClause("cidade_normalizada", filters.municipio));
  }
  if (filters.keyword) {
    condicoes.push(likeClause(layer.campoNome, filters.keyword));
  }
  if (filters.situacao) {
    condicoes.push(
      `${layer.campoSituacao}='${sqlString(filters.situacao).toUpperCase()}'`
    );
  }
  if (filters.temEmail) condicoes.push("email IS NOT NULL AND email <> ''");
  if (filters.temTelefone) {
    condicoes.push(
      tipo === "profissional"
        ? "(telefone IS NOT NULL OR celular IS NOT NULL)"
        : "telefone IS NOT NULL"
    );
  }
  const where = condicoes.length ? condicoes.join(" AND ") : "1=1";

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
