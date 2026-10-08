import axios, { AxiosInstance } from "axios";
import AppError from "../../errors/AppError";
import logger from "../../utils/logger";
import { isValidCPF, isValidCNPJ } from "../../utils/validators";

// Cliente da API Asaas v3 — usado pelo nó "asaasCharge" do FlowBuilder
// (2ª via de boleto + PIX). Credencial global por env nesta versão:
// ASAAS_API_KEY (obrigatória) e ASAAS_BASE_URL (opcional — produção
// api.asaas.com/v3; sandbox https://sandbox.asaas.com/api/v3).
const ASAAS_TIMEOUT_MS = 10000;
const ASAAS_DEFAULT_BASE_URL = "https://api.asaas.com/v3";

export interface AsaasCustomer {
  id: string;
  name: string;
  cpfCnpj?: string;
}

export interface AsaasPayment {
  id: string;
  value: number;
  dueDate: string;
  status: string;
  description?: string;
  invoiceNumber?: string;
  invoiceUrl?: string;
  bankSlipUrl?: string;
  billingType?: string;
}

export interface AsaasPixQrCode {
  encodedImage?: string;
  payload?: string;
  expirationDate?: string;
}

export interface AsaasPendingCharges {
  customer: AsaasCustomer | null;
  payments: AsaasPayment[];
}

// Monta o client autenticado. Falha cedo e com mensagem amigável quando a
// env ASAAS_API_KEY não está definida — sem vazar a chave em log/erro.
const getClient = (): AxiosInstance => {
  const apiKey = (process.env.ASAAS_API_KEY || "").trim();
  if (!apiKey) {
    throw new AppError(
      "Integração Asaas não configurada: defina ASAAS_API_KEY no ambiente do backend.",
      400
    );
  }
  const baseURL = (process.env.ASAAS_BASE_URL || ASAAS_DEFAULT_BASE_URL)
    .trim()
    .replace(/\/+$/, "");
  return axios.create({
    baseURL,
    timeout: ASAAS_TIMEOUT_MS,
    headers: {
      "Content-Type": "application/json",
      // Asaas autentica via header access_token com a apiKey ($aact_...)
      access_token: apiKey
    }
  });
};

// Converte erros do axios/Asaas em AppError amigável. Não propaga o body
// bruto para evitar vazar dados da conta; guarda o detalhe no log.
const asaasError = (err: any, contexto: string): AppError => {
  const status = err?.response?.status;
  const detail = err?.response?.data?.errors?.[0]?.description;
  logger.warn(
    `[AsaasService] ${contexto} falhou status=${status ?? "?"}: ${detail || err?.message || err}`
  );
  if (status === 401 || status === 403) {
    return new AppError("Asaas recusou a credencial (ASAAS_API_KEY inválida).", 502);
  }
  if (err?.code === "ECONNABORTED" || err?.code === "ETIMEDOUT") {
    return new AppError("Asaas não respondeu a tempo. Tente novamente.", 504);
  }
  return new AppError(
    `Falha ao consultar o Asaas${detail ? `: ${detail}` : "."}`,
    502
  );
};

// Normaliza e valida CPF/CNPJ. Retorna os dígitos ou "" quando inválido.
export const normalizeCpfCnpj = (doc: string): string => {
  const digits = String(doc || "").replace(/\D/g, "");
  if (digits.length === 11 && isValidCPF(digits)) return digits;
  if (digits.length === 14 && isValidCNPJ(digits)) return digits;
  return "";
};

// Busca o cliente Asaas pelo CPF/CNPJ (já normalizado).
export const findCustomerByCpfCnpj = async (
  cpfCnpjDigits: string
): Promise<AsaasCustomer | null> => {
  const client = getClient();
  try {
    const resp = await client.get("/customers", {
      params: { cpfCnpj: cpfCnpjDigits }
    });
    const customer = resp?.data?.data?.[0];
    return customer ? { id: customer.id, name: customer.name, cpfCnpj: customer.cpfCnpj } : null;
  } catch (err) {
    throw asaasError(err, "GET /customers");
  }
};

// Lista cobranças em aberto do cliente: OVERDUE (vencidas — caso clássico
// de 2ª via) + PENDING (a vencer), ordenadas por vencimento.
export const listPendingPaymentsByCpfCnpj = async (
  cpfCnpjDigits: string
): Promise<AsaasPendingCharges> => {
  const customer = await findCustomerByCpfCnpj(cpfCnpjDigits);
  if (!customer) {
    return { customer: null, payments: [] };
  }

  const client = getClient();
  try {
    const [overdue, pending] = await Promise.all([
      client.get("/payments", {
        params: { customer: customer.id, status: "OVERDUE", limit: 10 }
      }),
      client.get("/payments", {
        params: { customer: customer.id, status: "PENDING", limit: 10 }
      })
    ]);
    const payments: AsaasPayment[] = [
      ...(overdue?.data?.data || []),
      ...(pending?.data?.data || [])
    ].sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)));
    return { customer, payments };
  } catch (err) {
    throw asaasError(err, "GET /payments");
  }
};

// PIX da cobrança: retorna { encodedImage (PNG base64), payload (copia-e-cola) }
// ou null quando a cobrança não tem PIX disponível.
export const getPixQrCode = async (
  paymentId: string
): Promise<AsaasPixQrCode | null> => {
  const client = getClient();
  try {
    const resp = await client.get(`/payments/${paymentId}/pixQrCode`);
    const data = resp?.data;
    if (!data?.payload && !data?.encodedImage) return null;
    return data;
  } catch (err) {
    // Cobrança sem PIX (ex.: boleto puro) retorna erro — não é fatal
    logger.warn(
      `[AsaasService] GET /payments/${paymentId}/pixQrCode: ${err?.response?.status ?? err?.message}`
    );
    return null;
  }
};

// Linha digitável do boleto (identificationField) ou null quando não há.
export const getBoletoIdentificationField = async (
  paymentId: string
): Promise<string | null> => {
  const client = getClient();
  try {
    const resp = await client.get(`/payments/${paymentId}/identificationField`);
    return resp?.data?.identificationField || null;
  } catch (err) {
    logger.warn(
      `[AsaasService] GET /payments/${paymentId}/identificationField: ${err?.response?.status ?? err?.message}`
    );
    return null;
  }
};
