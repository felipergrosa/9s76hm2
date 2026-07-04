import axios from "axios";
import { ScraperResult } from "../../models/LeadScraperJob";

const SITUACAO_CODE: Record<string, string> = {
  ATIVA: "02", SUSPENSA: "03", INAPTA: "04", BAIXADA: "08",
};

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

export interface CnpjDiscoveryFilters {
  cnae?: string;
  situacao?: string;      // "ATIVA" | "SUSPENSA" | "INAPTA" | "BAIXADA"
  uf?: string;
  municipio?: string;
  identificadorMatrizFilial?: "1" | "2"; // 1=matriz, 2=filial
  dataAberturaInicio?: string; // YYYY-MM-DD
  dataAberturaFim?: string;
  temTelefone?: boolean;
  temEmail?: boolean;
  maxResults?: number;
}

export const searchCnpjsByFilters = async (
  filters: CnpjDiscoveryFilters,
  onProgress?: (current: number, total: number) => Promise<void>
): Promise<ScraperResult[]> => {
  const token = process.env.BRASILIO_TOKEN;
  if (!token) throw new Error(
    "Configure BRASILIO_TOKEN no .env para usar a Pesquisa Avançada. Token gratuito em brasil.io/auth/tokens/"
  );

  const params: Record<string, string> = {};
  if (filters.cnae) params.cnae_fiscal_principal = filters.cnae.replace(/\D/g, "");
  if (filters.situacao) params.situacao_cadastral = SITUACAO_CODE[filters.situacao] ?? "02";
  if (filters.uf) params.uf = filters.uf;
  if (filters.municipio) params.municipio = filters.municipio.toUpperCase().trim();
  if (filters.identificadorMatrizFilial) params.identificador_matriz_filial = filters.identificadorMatrizFilial;
  if (filters.dataAberturaInicio) params.data_inicio_atividade__gte = filters.dataAberturaInicio;
  if (filters.dataAberturaFim) params.data_inicio_atividade__lte = filters.dataAberturaFim;

  const maxResults = Math.min(filters.maxResults || 200, 1000);
  const results: ScraperResult[] = [];
  let page = 1;

  while (results.length < maxResults) {
    const pageSize = Math.min(100, maxResults - results.length);
    const { data } = await axios.get(
      "https://api.brasil.io/v1/dataset/cnpj/estabelecimentos/data/",
      {
        params: { ...params, page, page_size: pageSize },
        headers: { Authorization: `Token ${token}`, "User-Agent": "Whaticket/1.0" },
        timeout: 20000,
      }
    );

    for (const row of (data.results || []) as any[]) {
      // ponytail: tem_telefone/tem_email filtered here; Brasil.io doesn't support as query params
      const phone = row.ddd_1 && row.telefone_1
        ? `${row.ddd_1}${row.telefone_1}`.replace(/\D/g, "")
        : "";
      const email: string = row.correio_eletronico || "";

      if (filters.temTelefone && !phone) continue;
      if (filters.temEmail && !email) continue;

      const cnpj = `${row.cnpj_basico ?? ""}${row.cnpj_ordem ?? ""}${row.cnpj_dv ?? ""}`;

      results.push({
        name: row.nome_fantasia || cnpj,
        phone,
        email,
        address: [
          row.tipo_logradouro, row.logradouro, row.numero && `nº ${row.numero}`,
          row.bairro, row.municipio, row.uf,
        ].filter(Boolean).join(" "),
        cnpj,
        municipio: row.municipio || "",
        uf: row.uf || "",
        situacao: row.situacao_cadastral || "",
        cnaeDescricao: row.cnae_fiscal_principal || "",
      });
    }

    await onProgress?.(results.length, maxResults);
    if (!data.next || results.length >= maxResults) break;
    page++;
    await delay(300);
  }

  return results;
};
