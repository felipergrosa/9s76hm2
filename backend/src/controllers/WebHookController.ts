import { Request, Response } from "express";
import logger from "../utils/logger";
import Whatsapp from "../models/Whatsapp";
import { handleMessage } from "../services/FacebookServices/facebookMessageListener";
import { takeThreadControl } from "../services/FacebookServices/graphAPI";
import { extractCommentFromWebhook, replyCommentWithDM } from "../services/FacebookServices/CommentToDMService";
import { processMetaAutomationEvent } from "../services/FacebookServices/MetaAutomationService";
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
      let channel: "facebook" | "instagram";

      if (body.object === "page") {
        channel = "facebook";
      } else {
        channel = "instagram";
      }

      body.entry?.forEach(async (entry: any) => {
        // IG: entry.id é o instagram_business_account, gravado em
        // facebookPageUserId (MetaOAuthController grava a connectionKey lá);
        // fallback em instagramAccountId cobre conexões legadas.
        // FB: entry.id é o page id → facebookPageUserId.
        let getTokenPage = await Whatsapp.findOne({
          where: { facebookPageUserId: entry.id, channel }
        });

        if (!getTokenPage && channel === "instagram") {
          getTokenPage = await Whatsapp.findOne({
            where: { instagramAccountId: entry.id, channel }
          });
        }

        if (!getTokenPage) {
          // Diagnóstico: evento entregue pela Meta sem conexão correspondente
          // (entry.id divergente, canal errado ou conexão removida).
          logger.warn(
            `[Webhook] Evento ${body.object} sem conexão (entryId=${entry.id} channel=${channel})`
          );
          return;
        }

        // Alias const: narrowing de `let` não entra em closures
        const tokenPage = getTokenPage;

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

        // Automação Meta: comentários e menções disparam o matcher de
        // palavras-chave, reutilizando a mesma conexão resolvida das DMs.
        // TODO: assinar comments/mentions — a assinatura de subscribed_fields
        // fica em MetaOAuthService.subscribePageWebhook (outro arquivo); os
        // campos exclusivos do objeto "Instagram" (comments, mentions) também
        // precisam estar ativos no webhook do app no dashboard da Meta.
        const fireAutomationEvent = (event: {
          trigger: "comment_keyword" | "story_mention";
          commentText?: string;
          commentId?: string;
          postId?: string;
          mediaId?: string;
          username?: string;
          senderId?: string;
          ref?: string;
        }) => {
          Promise.resolve(
            processMetaAutomationEvent({
              companyId: tokenPage.companyId,
              whatsappId: tokenPage.id,
              channel,
              ...event
            })
          ).catch(err => {
            logger.error(
              `[Webhook] Erro no matcher ${event.trigger} ${channel} ` +
              `(whatsappId=${tokenPage.id} entryId=${entry.id}): ${err?.message || err}`
            );
          });
        };

        if (Array.isArray(entry.changes)) {
          entry.changes.forEach((change: any) => {
            const val = change?.value || {};

            if (change?.field === "comments") {
              // Comentário em post do Instagram:
              // value = { id (commentId), text, media_id (post), from: {id, username}, timestamp }
              fireAutomationEvent({
                trigger: "comment_keyword",
                commentText: val.text,
                commentId: val.id || val.comment_id,
                mediaId: val.media_id || val.media?.id,
                username: val.from?.username,
                senderId: val.from?.id
              });
              return;
            }

            if (change?.field === "mentions") {
              // Menção IG (story/mídia): value = { comment_id? | media_id, ... }
              fireAutomationEvent({
                trigger: "story_mention",
                mediaId: val.media_id,
                commentId: val.comment_id,
                senderId: val.from?.id || val.sender_id || val.user_id
              });
              return;
            }

            if (
              change?.field === "feed" &&
              channel === "facebook" &&
              val.item === "comment" &&
              val.verb === "add"
            ) {
              // Comentário no feed da página FB: mesmo matcher do
              // CommentToDMService (que continua executando acima).
              fireAutomationEvent({
                trigger: "comment_keyword",
                commentText: val.message,
                commentId: val.comment_id || val.id,
                postId: val.post_id || val.parent_id,
                username: val.from?.name,
                senderId: val.from?.id
              });
            }
          });
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