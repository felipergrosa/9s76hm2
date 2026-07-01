import { Request, Response } from "express";
import logger from "../utils/logger";
import Whatsapp from "../models/Whatsapp";
import { handleMessage } from "../services/FacebookServices/facebookMessageListener";
import { extractCommentFromWebhook, replyCommentWithDM } from "../services/FacebookServices/CommentToDMService";
import {
  checkMetaWebhookSignature,
  WEBHOOK_SIGNATURE_ENFORCE
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
    console.log(30, "WebHookController", { body })

    const signatureHeader = req.headers["x-hub-signature-256"] as string | undefined;
    const isSignatureValid = await checkMetaWebhookSignature(
      req.rawBody,
      signatureHeader,
      "Facebook/Instagram"
    );

    if (!isSignatureValid && WEBHOOK_SIGNATURE_ENFORCE) {
      logger.warn(`[Webhook] Requisição rejeitada: assinatura HMAC inválida (enforce ativo)`);
      return res.status(403).json({ message: "Forbidden" });
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

        if (getTokenPage) {
          entry.messaging?.forEach((data: any) => {
            handleMessage(getTokenPage, data, channel, getTokenPage.companyId);
          });

          // Comment-to-DM: reply privately to Facebook/Instagram comments
          const comment = extractCommentFromWebhook({ entry: [entry] });
          if (comment) {
            replyCommentWithDM(getTokenPage, comment).catch(() => {});
          }
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