import { Request, Response } from "express";
import logger from "../utils/logger";
import Whatsapp from "../models/Whatsapp";
import { handleMessage } from "../services/FacebookServices/facebookMessageListener";
import { takeThreadControl } from "../services/FacebookServices/graphAPI";
import { extractCommentFromWebhook, replyCommentWithDM } from "../services/FacebookServices/CommentToDMService";
import {
  checkMetaWebhookSignature
} from "../services/WebhookService/CheckMetaWebhookSignature";

export const index = async (req: Request, res: Response): Promise<Response> => {
  const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && typeof token === "string") {
    // Aceita o token global (comportamento atual, preservado) ou o token
    // configurado por conexão Facebook/Instagram (campo já existia, sem uso até aqui).
    const isGlobalTokenValid = !!VERIFY_TOKEN && token === VERIFY_TOKEN;
    const isPerConnectionTokenValid = !!(await Whatsapp.findOne({
      where: { metaWebhookVerifyToken: token }
    }));

    if (isGlobalTokenValid || isPerConnectionTokenValid) {
      return res.status(200).send(challenge);
    }
  }

  return res.status(403).json({
    message: "Forbidden"
  });
};

export const webHook = async (
  req: Request & { rawBody?: Buffer },
  res: Response
): Promise<Response> => {
  try {
    const { body } = req;

    const signatureHeader = req.headers["x-hub-signature-256"] as string | undefined;
    // Fail-closed: com secret configurado, assinatura inválida rejeita;
    // em produção sem nenhum secret, também rejeita.
    const isSignatureValid = await checkMetaWebhookSignature(
      req.rawBody,
      signatureHeader,
      "Facebook/Instagram"
    );

    if (!isSignatureValid) {
      logger.warn(
        `[Webhook] Requisição rejeitada: assinatura HMAC inválida ` +
        `(object=${body?.object || "?"} hasRawBody=${!!req.rawBody} hasSignature=${!!signatureHeader})`
      );
      return res.status(403).json({ message: "Forbidden" });
    }

    // Log de recebimento: permite distinguir "Meta não entrega" de
    // "entrega mas falha no processamento" nos logs de produção.
    if (body?.object) {
      const entries = Array.isArray(body.entry) ? body.entry.length : 0;
      logger.info(`[Webhook] Recebido object=${body.object} entries=${entries}`);
    }

    if (body.object === "page" || body.object === "instagram") {
      let channel: string;

      if (body.object === "page") {
        channel = "facebook";
      } else {
        channel = "instagram";
      }

      body.entry?.forEach(async (entry: any) => {
        const getTokenPage = await Whatsapp.findOne({
          where: { facebookPageUserId: entry.id, channel }
        });

        if (!getTokenPage) {
          // Diagnóstico: evento entregue pela Meta sem conexão correspondente
          // (entry.id divergente, canal errado ou conexão removida).
          logger.warn(
            `[Webhook] Evento ${body.object} sem conexão (entryId=${entry.id} channel=${channel})`
          );
          return;
        }

        entry.messaging?.forEach((data: any) => {
          // Erros async do listener não podem cair em unhandledRejection —
          // loga com contexto mínimo (sem conteúdo da mensagem).
          Promise.resolve(
            handleMessage(getTokenPage, data, channel, getTokenPage.companyId)
          ).catch(err => {
            logger.error(
              `[Webhook] Erro ao processar mensagem ${channel} ` +
              `(whatsappId=${getTokenPage.id} entryId=${entry.id}): ${err?.message || err}`
            );
          });
        });

        // Handover protocol (só Facebook/Page): quando outro app é o receptor
        // primário da página, as mensagens chegam em `standby` em vez de
        // `messaging`. Processamos a mensagem e requisitamos o controle da
        // thread para voltarmos a receber via `messaging`.
        if (channel === "facebook" && Array.isArray(entry.standby)) {
          entry.standby.forEach((data: any) => {
            // Echo do próprio envio pela página: não vira ticket.
            if (data?.sender?.id === entry.id) return;
            const psid = data?.sender?.id;
            if (psid) {
              takeThreadControl(psid, getTokenPage.facebookUserToken).then(ok => {
                if (ok) {
                  logger.info(
                    `[Webhook] Thread control requisitado (psid=${psid} entryId=${entry.id})`
                  );
                }
              });
            }
            Promise.resolve(
              handleMessage(getTokenPage, data, channel, getTokenPage.companyId)
            ).catch(err => {
              logger.error(
                `[Webhook] Erro ao processar standby ${channel} ` +
                `(whatsappId=${getTokenPage.id} entryId=${entry.id}): ${err?.message || err}`
              );
            });
          });
        }

        // Comment-to-DM: reply privately to Facebook/Instagram comments
        const comment = extractCommentFromWebhook({ entry: [entry] });
        if (comment) {
          replyCommentWithDM(getTokenPage, comment).catch(() => {});
        }
      });

      return res.status(200).json({
        message: "EVENT_RECEIVED"
      });
    }

    return res.status(404).json({
      message: body
    });
  } catch (error) {
    return res.status(500).json({
      message: error
    });
  }
};