import axios from "axios";
import AppError from "../../errors/AppError";
import logger from "../../utils/logger";
import { officialApiVersion } from "../../libs/whatsapp/officialApiVersion";
import { throwMetaError } from "./metaApiClient";

/**
 * Serviço do WhatsApp Embedded Signup (cadastro embutido da Meta).
 *
 * Fluxo: o frontend chama FB.login com `config_id` + `response_type=code`;
 * a Meta devolve um `code` (authResponse) e, via evento de mensagem
 * WA_EMBEDDED_SIGNUP, o `waba_id` e o `phone_number_id` escolhidos.
 * Aqui trocamos o `code` por um access token e assinamos o app na WABA.
 *
 * Segurança: tokens e o `code` NUNCA são logados — apenas IDs públicos.
 */

const graphUrl = (path: string): string =>
  `https://graph.facebook.com/${officialApiVersion()}${path}`;

/**
 * Resolve as credenciais do app Meta para o Embedded Signup.
 * O config_id é vinculado a um único app, então usamos só as credenciais
 * globais do servidor (não aceitamos appId/secret do cliente).
 */
export const getEmbeddedSignupCredentials = (): {
  appId: string;
  appSecret: string;
} => {
  const appId = process.env.META_APP_ID || process.env.FACEBOOK_APP_ID || "";
  const appSecret =
    process.env.META_APP_SECRET || process.env.FACEBOOK_APP_SECRET || "";

  if (!appId || !appSecret) {
    throw new AppError(
      "Credenciais do App Meta não configuradas (META_APP_ID/META_APP_SECRET).",
      503
    );
  }

  return { appId, appSecret };
};

/**
 * Troca o `code` retornado pelo Embedded Signup por um access token.
 * Diferente do OAuth de páginas (exchangeCodeForPages), o code do
 * FB.login embutido NÃO leva redirect_uri na troca.
 */
export const exchangeEmbeddedSignupCode = async (
  code: string,
  appId: string,
  appSecret: string
): Promise<string> => {
  try {
    const { data } = await axios.get(graphUrl("/oauth/access_token"), {
      params: {
        client_id: appId,
        client_secret: appSecret,
        code
      },
      timeout: 30000
    });

    if (!data?.access_token) {
      throw new AppError("A Meta não retornou um access token válido.", 502);
    }

    return data.access_token as string;
  } catch (err: any) {
    throwMetaError("EmbeddedSignup.exchangeCode", err);
  }
};

/**
 * Assina o app na WABA (POST /{waba-id}/subscribed_apps) para que os
 * webhooks de mensagens passem a chegar. Melhor esforço: falha aqui não
 * impede o cadastro — o OfficialAPIAdapter repete a assinatura ao iniciar
 * a sessão.
 */
export const subscribeWabaToApp = async (
  wabaId: string,
  accessToken: string
): Promise<void> => {
  try {
    await axios.post(graphUrl(`/${wabaId}/subscribed_apps`), null, {
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout: 30000
    });
    logger.info(`[EmbeddedSignup] WABA ${wabaId} assinada no app`);
  } catch (err: any) {
    const metaErr = err?.response?.data?.error;
    // 400 geralmente indica que a WABA já está assinada — não é crítico
    logger.warn(
      `[EmbeddedSignup] subscribe_waba falhou para wabaId=${wabaId}: ` +
        `${metaErr?.message || err.message} (code=${metaErr?.code ?? "n/a"})`
    );
  }
};

/**
 * Busca dados públicos do número (nome verificado e número exibido) para
 * sugerir um nome amigável à conexão. Melhor esforço: retorna null em
 * qualquer falha.
 */
export const getPhoneNumberProfile = async (
  phoneNumberId: string,
  accessToken: string
): Promise<{ displayPhoneNumber?: string; verifiedName?: string } | null> => {
  try {
    const { data } = await axios.get(graphUrl(`/${phoneNumberId}`), {
      params: { fields: "display_phone_number,verified_name" },
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout: 30000
    });
    return {
      displayPhoneNumber: data?.display_phone_number,
      verifiedName: data?.verified_name
    };
  } catch (err: any) {
    logger.warn(
      `[EmbeddedSignup] perfil do número ${phoneNumberId} indisponível: ${err.message}`
    );
    return null;
  }
};
