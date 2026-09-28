interface MetaChannelInput {
  channel?: string;
  channelType?: string;
  facebookPageUserId?: string;
  facebookUserToken?: string;
  metaPageId?: string;
  metaPageAccessToken?: string;
  instagramAccountId?: string;
}

/**
 * O modal de conexão grava credenciais nos campos meta*, mas o webhook
 * inbound (WebHookController) e o WhatsAppFactory leem as colunas legadas
 * facebookPageUserId/facebookUserToken. Resolve a ponte entre os dois:
 * facebook → metaPageId; instagram → instagramAccountId (IG Business ID).
 */
export function resolveMetaChannelCredentials(data: MetaChannelInput): {
  facebookPageUserId?: string;
  facebookUserToken?: string;
  status?: string;
} {
  const channelType = data.channelType || data.channel;
  if (channelType !== "facebook" && channelType !== "instagram") {
    return {};
  }

  const facebookPageUserId = data.facebookPageUserId
    || (channelType === "instagram" ? data.instagramAccountId : data.metaPageId);
  const facebookUserToken = data.facebookUserToken || data.metaPageAccessToken;

  // Canal Meta não tem handshake de sessão: credenciais completas = CONNECTED
  const status = facebookPageUserId && facebookUserToken ? "CONNECTED" : undefined;

  return {
    facebookPageUserId,
    facebookUserToken,
    ...(status ? { status } : {})
  };
}
