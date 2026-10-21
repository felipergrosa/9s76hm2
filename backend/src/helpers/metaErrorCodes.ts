// Diagnóstico de erros da Meta (Cloud API / Graph API) em pt-BR —
// usado no relatório de campanha (CampaignShipping.lastError) e em
// qualquer ponto que precise explicar o motivo de uma falha de envio.

// Traduz os códigos de falha mais comuns para pt-BR. Retorna null quando
// o código não é conhecido — o chamador deve manter o payload bruto.
export const describeMetaErrorCode = (code: any): string | null => {
  const n = Number(code);
  const map: Record<number, string> = {
    131026:
      "Mensagem não entregue — número sem WhatsApp, aparelho incompatível ou limite de marketing da Meta por usuário",
    131030: "Número não está no WhatsApp ou fora da lista permitida",
    131047: "Janela de 24h expirada — precisa de template de re-engajamento",
    131048: "Limite de taxa de spam excedido",
    131049: "Meta bloqueou o envio para preservar a qualidade do número",
    131051: "Restrição de entrega — tipo de mensagem não suportado neste canal",
    131052: "Mídia indisponível — URL expirada ou inacessível para a Meta",
    131053: "Tipo de mídia não suportado",
    131056: "Limite de taxa excedido — envie mais devagar",
    132000: "Número de parâmetros do template não confere",
    132001: "Template não existe neste idioma",
    132005: "Template pausado pela Meta",
    132007: "Parâmetro do template com formato inválido",
    132012: "Formato de parâmetro inválido no template",
    132015: "Template desabilitado",
    132068: "Flow bloqueado/estado inválido",
    133000: "Falha genérica do provedor"
  };
  if (map[n]) return map[n];
  // Família 132xxx: erros de parâmetro/componente de template
  if (n >= 132000 && n < 133000) return "Erro de template/parâmetro na Meta";
  return null;
};

// Extrai o motivo completo de um erro Meta a partir de um erro lançado
// pelo adapter (WhatsAppAdapterError guarda o erro axios original em
// `originalError`) ou de um objeto `errors[]` de webhook de status.
// Formato: "<hint pt-BR> — [<code>] <message> <details>" (máx 500 chars).
export const extractMetaErrorDetail = (
  err: any,
  fallbackMessage?: string
): string => {
  const metaErr =
    err?.originalError?.response?.data?.error ||
    err?.response?.data?.error ||
    err;
  const code = metaErr?.code ?? err?.code;
  const details = metaErr?.error_data?.details;
  const title = metaErr?.title;
  const message = metaErr?.message || err?.message || fallbackMessage;

  const hint = describeMetaErrorCode(code);
  const raw = [
    code != null ? `[${code}]` : null,
    message || null,
    title && title !== message ? title : null,
    details || null
  ]
    .filter(Boolean)
    .join(" ");

  return [hint, raw || "Erro desconhecido"]
    .filter(Boolean)
    .join(" — ")
    .substring(0, 500);
};
