import axios from "axios";
import { ScraperResult } from "../../models/LeadScraperJob";

export const enrichCnpj = async (cnpj: string): Promise<ScraperResult | null> => {
  const cleaned = cnpj.replace(/\D/g, "");
  if (cleaned.length !== 14) return null;
  try {
    const { data } = await axios.get(
      `https://brasilapi.com.br/api/cnpj/v1/${cleaned}`,
      { timeout: 10000, headers: { "User-Agent": "Whaticket/1.0" } }
    );
    const logradouro = [
      data.descricao_tipo_de_logradouro, data.logradouro,
      data.numero && `nº ${data.numero}`, data.bairro
    ].filter(Boolean).join(" ");

    return {
      name: data.nome_fantasia || data.razao_social || "",
      phone: data.ddd_telefone_1 ? data.ddd_telefone_1.replace(/\D/g, "") : "",
      email: data.email || "",
      address: `${logradouro} - ${data.municipio || ""}/${data.uf || ""}`.trim(),
      cnpj: cleaned,
      razaoSocial: data.razao_social || "",
      nomeFantasia: data.nome_fantasia || "",
      cnaeDescricao: data.cnae_fiscal_descricao || "",
      situacao: data.descricao_situacao_cadastral || "",
      porte: data.descricao_porte || "",
      municipio: data.municipio || "",
      uf: data.uf || ""
    };
  } catch {
    return null;
  }
};
