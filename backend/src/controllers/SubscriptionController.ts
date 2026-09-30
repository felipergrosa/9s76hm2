import { Request, Response } from "express";
import express from "express";
import * as Yup from "yup";
import * as dotenv from 'dotenv';
import * as crypto from "crypto";
import mercadopago from 'mercadopago'; // Remover se não estiver sendo usado
import AppError from "../errors/AppError";
import Company from "../models/Company";
import Invoices from "../models/Invoices";
import Setting from "../models/Setting";
import { getIO } from "../libs/socket";
import logger from "../utils/logger";
import axios from 'axios';

dotenv.config();

// Configure Mercado Pago
const accessToken = process.env.MP_ACCESS_TOKEN;
const webhookSecret = process.env.MP_WEBHOOK_SECRET;

/**
 * Valida a assinatura do webhook do Mercado Pago (headers x-signature/x-request-id).
 * Manifesto conforme doc oficial: "id:{data.id};request-id:{x-request-id};ts:{ts};"
 */
const isValidMpSignature = (
  signatureHeader: string,
  requestId: string,
  dataId: string,
  secret: string
): boolean => {
  const parts: Record<string, string> = {};
  signatureHeader.split(",").forEach(part => {
    const [key, value] = part.split("=");
    if (key && value) parts[key.trim()] = value.trim();
  });

  const ts = parts["ts"];
  const v1 = parts["v1"];
  if (!ts || !v1) return false;

  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const expected = crypto.createHmac("sha256", secret).update(manifest).digest("hex");

  const expectedBuf = Buffer.from(expected);
  const receivedBuf = Buffer.from(v1);
  return expectedBuf.length === receivedBuf.length && crypto.timingSafeEqual(expectedBuf, receivedBuf);
};

// Endpoint para criar uma nova assinatura
export const createSubscription = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId } = req.user;

  // Schema de validação — o preço NUNCA é aceito do cliente
  const schema = Yup.object().shape({
    invoiceId: Yup.number().required()
  });

  // Validação do payload
  if (!(await schema.isValid(req.body))) {
    throw new AppError("Validation fails", 400);
  }

  const { invoiceId } = req.body;

  // Segurança: valor cobrado é sempre o da fatura no banco, da empresa do usuário logado
  const invoice = await Invoices.findOne({ where: { id: invoiceId, companyId } });
  if (!invoice) {
    throw new AppError("ERR_NO_INVOICE_FOUND", 404);
  }

  const unitPrice = Number(invoice.value);

  // Dados para criar a preferência de pagamento
  const data = {
    back_urls: {
      success: `${process.env.FRONTEND_URL}/financeiro`,
      failure: `${process.env.FRONTEND_URL}/financeiro`
    },
    auto_return: "approved",
    external_reference: String(invoice.id),
    items: [
      {
        title: `#Fatura:${invoiceId}`,
        quantity: 1,
        currency_id: 'BRL',
        unit_price: unitPrice
      }
    ]
  };

  try {
    // Chamada para criar a preferência no Mercado Pago
    const response = await axios.post('https://api.mercadopago.com/checkout/preferences', data, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}` // Usando accessToken aqui
      }
    });
    
    const urlMcPg = response.data.init_point;

    return res.json({ urlMcPg });
  } catch (error) {
    console.error(error);
    throw new AppError("Problema encontrado, entre em contato com o suporte!", 400);
  }
};

// Webhook do Mercado Pago
export const webhook = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { evento, data } = req.body;

  // Resposta para testes de webhook
  if (evento === "teste_webhook") {
    return res.json({ ok: true });
  }

  if (data && data.id) {
    // Segurança: id do pagamento precisa ser numérico (vai interpolado na URL da API do MP)
    const paymentId = Number(data.id);
    if (!Number.isFinite(paymentId)) {
      return res.status(400).json({ ok: false });
    }

    // Validação de assinatura do MP: enforce apenas quando MP_WEBHOOK_SECRET está configurado.
    // Sem o secret, mantém o comportamento atual (consulta à API do MP valida o pagamento).
    if (webhookSecret) {
      const xSignature = req.headers["x-signature"] as string | undefined;
      const xRequestId = req.headers["x-request-id"] as string | undefined;
      if (!xSignature || !xRequestId || !isValidMpSignature(xSignature, xRequestId, String(data.id), webhookSecret)) {
        logger.warn(`[Subscription] Webhook MP com assinatura inválida (paymentId=${paymentId})`);
        return res.status(401).json({ ok: false });
      }
    } else {
      logger.warn("[Subscription] MP_WEBHOOK_SECRET não configurado — webhook sem validação de assinatura");
    }

    try {
      const paymentResponse = await axios.get(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}` // Usando accessToken aqui
        }
      });

      const paymentDetails = paymentResponse.data;

      // Processar pagamento aprovado
      if (paymentDetails.status === "approved") {
        // Vincula a fatura via external_reference; fallback ao título legado "#Fatura:{id}"
        let invoiceID: string | undefined = paymentDetails.external_reference;
        if (!invoiceID) {
          const title = paymentDetails.additional_info?.items?.[0]?.title || "";
          invoiceID = title.replace("#Fatura:", "") || undefined;
        }
        const invoice = invoiceID ? await Invoices.findByPk(invoiceID) : null;

        if (invoice) {
          // Segurança: não marcar como paga se o valor recebido for menor que o da fatura
          const paidAmount = Number(paymentDetails.transaction_amount);
          if (!Number.isFinite(paidAmount) || paidAmount < Number(invoice.value)) {
            logger.warn(`[Subscription] Pagamento ${paymentId} com valor insuficiente para a fatura ${invoice.id}`);
            return res.json({ ok: true });
          }

          const companyId = invoice.companyId;
          const company = await Company.findByPk(companyId);

          if (company) {
            // Idempotência: só estende dueDate/marca paga uma vez (transição de status)
            if (invoice.status !== "paid") {
              const expiresAt = new Date(company.dueDate);
              expiresAt.setDate(expiresAt.getDate() + 30);
              const newDueDate = expiresAt.toISOString().split("T")[0];

              await company.update({ dueDate: newDueDate });
              await invoice.update({ status: "paid" });
            }

            const io = getIO();
            const companyUpdate = await Company.findOne({ where: { id: companyId } });

            io.emit(`company-${companyId}-payment`, {
              action: paymentDetails.status,
              company: companyUpdate
            });
          }
        }
      }
    } catch (error) {
      console.error(error);
      throw new AppError("Erro ao processar pagamento.", 400);
    }
  }

  return res.json({ ok: true });
};

// Endpoint de registro de webhook ainda não implementado — responde 501 explícito
export const createWebhook = async (
  req: Request,
  res: Response
): Promise<Response> => {
  return res.status(501).json({ error: "ERR_NOT_IMPLEMENTED" });
};

