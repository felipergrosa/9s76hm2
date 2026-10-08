import { Request, Response } from "express";
import * as Yup from "yup";
import AppError from "../errors/AppError";
import Whatsapp from "../models/Whatsapp";
import logger from "../utils/logger";
import CreateWhatsAppService from "../services/WhatsappService/CreateWhatsAppService";
import StartWhatsAppSessionUnified from "../services/WbotServices/StartWhatsAppSessionUnified";
import {
  getEmbeddedSignupCredentials,
  exchangeEmbeddedSignupCode,
  subscribeWabaToApp,
  getPhoneNumberProfile
} from "../services/MetaServices/MetaEmbeddedSignupService";
import { emitToCompanyNamespace } from "../libs/socketEmit";
import { invalidateCache, cacheKey } from "../helpers/queryCache";
import { sanitizeWhatsapp } from "../helpers/sanitizeWhatsapp";

/**
 * POST /whatsapp/embedded-signup
 *
 * Finaliza o WhatsApp Embedded Signup: recebe o `code` do FB.login e os
 * IDs escolhidos no popup da Meta (waba_id / phone_number_id), troca o
 * code por um access token e cria (ou atualiza) a conexão oficial.
 *
 * NUNCA retorna nem loga o access token — ele só é persistido no banco.
 */

// Validação de entrada (N1): só dígitos nos IDs da Meta, como retornam no
// session_info do Embedded Signup
const bodySchema = Yup.object().shape({
  code: Yup.string().required("Código de autorização (code) é obrigatório"),
  wabaId: Yup.string()
    .required("wabaId é obrigatório")
    .matches(/^\d+$/, "wabaId inválido"),
  phoneNumberId: Yup.string()
    .required("phoneNumberId é obrigatório")
    .matches(/^\d+$/, "phoneNumberId inválido"),
  name: Yup.string().min(2).max(50).nullable()
});

// Mesmo padrão do MetaOAuthController: atualiza a listagem do frontend via
// socket e invalida o query cache (senão /whatsapp fica stale por ~60s)
const notifyConnectionChange = async (
  companyId: number,
  whatsapp: Whatsapp
): Promise<void> => {
  try {
    await invalidateCache(cacheKey("whatsapps", companyId));
    await emitToCompanyNamespace(companyId, `company-${companyId}-whatsapp`, {
      action: "update",
      whatsapp: sanitizeWhatsapp(whatsapp)
    });
  } catch (err: any) {
    logger.warn(
      `[EmbeddedSignup] Falha ao notificar conexão ${whatsapp.id}: ${err.message}`
    );
  }
};

export const embeddedSignup = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId } = req.user;
  if (!companyId) {
    return res.status(400).json({ error: "Usuário sem companyId." });
  }

  try {
    const { code, wabaId, phoneNumberId, name } = await bodySchema.validate(
      req.body,
      { abortEarly: false, stripUnknown: true }
    );

    const { appId, appSecret } = getEmbeddedSignupCredentials();

    // Troca o code do FB.login pelo token (redirect_uri não se aplica aqui)
    const accessToken = await exchangeEmbeddedSignupCode(code, appId, appSecret);

    // Nome amigável: campo informado > nome verificado > número exibido
    const profile = await getPhoneNumberProfile(phoneNumberId, accessToken);
    const connectionName =
      name ||
      profile?.verifiedName ||
      profile?.displayPhoneNumber ||
      `WhatsApp Oficial ${phoneNumberId}`;

    // Idempotência: re-cadastro do mesmo número atualiza a conexão em vez
    // de duplicar (o usuário pode refazer o signup para renovar o token)
    const existing = await Whatsapp.findOne({
      where: { companyId, channelType: "official", wabaPhoneNumberId: phoneNumberId }
    });

    let whatsapp: Whatsapp;
    let action: "created" | "updated";

    if (existing) {
      whatsapp = await existing.update({
        name: name || existing.name,
        wabaBusinessAccountId: wabaId,
        wabaAccessToken: accessToken
      });
      action = "updated";
    } else {
      const created = await CreateWhatsAppService({
        name: connectionName,
        channel: "whatsapp",
        channelType: "official",
        companyId,
        status: "OPENING",
        wabaPhoneNumberId: phoneNumberId,
        wabaBusinessAccountId: wabaId,
        wabaAccessToken: accessToken
      });
      whatsapp = created.whatsapp;
      action = "created";
    }

    logger.info(
      `[EmbeddedSignup] companyId=${companyId} whatsappId=${whatsapp.id} ` +
        `${action} wabaId=${wabaId} phoneNumberId=${phoneNumberId}`
    );

    // Assina o app na WABA (melhor esforço — o adapter repete na init)
    await subscribeWabaToApp(wabaId, accessToken);

    // Inicializa a sessão oficial (valida credenciais e marca CONNECTED).
    // Sem await: falhas de sessão não devem reprovar o cadastro — o adapter
    // já atualiza o status e emite evento de erro.
    StartWhatsAppSessionUnified(whatsapp, companyId).catch((err: any) =>
      logger.warn(
        `[EmbeddedSignup] start session whatsappId=${whatsapp.id}: ${err.message}`
      )
    );

    await notifyConnectionChange(companyId, whatsapp);

    // Resposta sanitizada — wabaAccessToken nunca sai do servidor
    return res.json({ status: action, whatsapp: sanitizeWhatsapp(whatsapp) });
  } catch (err: any) {
    if (err instanceof Yup.ValidationError) {
      return res.status(400).json({ error: err.errors.join("; ") });
    }
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    logger.error(`[EmbeddedSignup] Erro inesperado: ${err.message}`);
    return res.status(500).json({
      error: "Falha ao concluir o cadastro do número. Tente novamente."
    });
  }
};
