/**
 * Utilitário para tratamento padronizado de erros de IA
 */

export const getAIErrorMessage = (error) => {
  const responseError = error?.response?.data?.error;
  const status = error?.response?.status;
  
  // Erros de autenticação
  if (status === 401 || responseError?.includes('API key') || responseError?.includes('Incorrect API key')) {
    return {
      message: "🔑 API Key inválida ou expirada. Verifique as configurações de IA.",
      type: "error",
      action: "Acesse Configurações → IA → Provedores e verifique a API Key"
    };
  }
  
  // Erros de limite/quota
  if (status === 429 || responseError?.includes('quota') || responseError?.includes('limit') || responseError?.includes('rate')) {
    return {
      message: "💳 Limite de uso atingido. Verifique seus créditos na plataforma de IA.",
      type: "warning",
      action: "Verifique créditos em platform.openai.com ou console.cloud.google.com"
    };
  }
  
  // Erros de dados inválidos
  if (status === 400) {
    if (responseError?.includes('model')) {
      return {
        message: "🤖 Modelo de IA não disponível. Tente outro modelo nas configurações.",
        type: "warning",
        action: "Altere o modelo nas configurações de IA"
      };
    } else if (responseError?.includes('token') || responseError?.includes('maximum context length')) {
      return {
        message: "📝 Texto muito longo para o modelo. Tente com um texto menor.",
        type: "warning",
        action: "Reduza o tamanho do texto ou use um modelo com mais tokens"
      };
    } else if (responseError?.includes('required') || responseError?.includes('obrigatório')) {
      return {
        message: "📝 Campos obrigatórios não preenchidos. Verifique todos os dados.",
        type: "warning",
        action: "Preencha todos os campos obrigatórios"
      };
    } else {
      return {
        message: `⚠️ ${responseError || "Dados inválidos enviados para a IA."}`,
        type: "warning",
        action: "Verifique os dados e configurações"
      };
    }
  }
  
  // Erros de permissão
  if (status === 403) {
    return {
      message: "🚫 Sem permissão para usar este recurso de IA.",
      type: "error",
      action: "Verifique suas permissões ou contate o administrador"
    };
  }
  
  // Erros de recurso não encontrado
  if (status === 404) {
    if (responseError?.includes('integração') || responseError?.includes('configuração')) {
      return {
        message: "⚙️ Nenhuma configuração de IA encontrada. Configure OpenAI ou Gemini.",
        type: "info",
        action: "Acesse Configurações → IA → Provedores e configure uma API Key"
      };
    } else {
      return {
        message: "🔍 Recurso de IA não encontrado.",
        type: "warning",
        action: "Verifique se o recurso existe"
      };
    }
  }
  
  // Erros de conflito
  if (status === 409) {
    return {
      message: "🔄 Conflito detectado. O recurso já existe e será atualizado.",
      type: "info",
      action: "Operação continuará normalmente"
    };
  }
  
  // Erros de servidor
  if (status === 500) {
    return {
      message: "🔧 Erro interno do servidor. Tente novamente em alguns instantes.",
      type: "error",
      action: "Aguarde alguns minutos e tente novamente"
    };
  }
  
  // Serviço indisponível
  if (status === 503) {
    return {
      message: "⏳ Serviço de IA temporariamente indisponível. Tente novamente.",
      type: "warning",
      action: "Aguarde alguns minutos e tente novamente"
    };
  }
  
  // Timeout
  if (error?.code === 'ECONNABORTED' || responseError?.includes('timeout')) {
    return {
      message: "⏱️ Tempo limite esgotado. A IA pode estar sobrecarregada.",
      type: "warning",
      action: "Tente novamente com um texto menor ou aguarde alguns minutos"
    };
  }
  
  // Erro de rede
  if (error?.code === 'NETWORK_ERROR' || !status) {
    return {
      message: "🌐 Erro de conexão. Verifique sua internet.",
      type: "error",
      action: "Verifique sua conexão com a internet"
    };
  }
  
  // Erros específicos de configuração
  if (responseError?.includes('Nenhuma integração')) {
    return {
      message: "⚙️ Nenhuma configuração de IA encontrada. Configure OpenAI ou Gemini.",
      type: "info",
      action: "Acesse Configurações → IA → Provedores"
    };
  }
  
  // Erro genérico
  return {
    message: responseError ? `❌ ${responseError}` : "❌ Erro desconhecido na IA",
    type: "error",
    action: "Tente novamente ou contate o suporte"
  };
};

/**
 * Exibe toast com tratamento de erro de IA
 */
export const showAIErrorToast = (error, toast) => {
  const errorInfo = getAIErrorMessage(error);
  
  switch (errorInfo.type) {
    case "warning":
      toast.warning(errorInfo.message);
      break;
    case "info":
      toast.info(errorInfo.message);
      break;
    default:
      toast.error(errorInfo.message);
  }
  
  // Log adicional para debug
  console.error('[AI Error]', {
    message: errorInfo.message,
    type: errorInfo.type,
    action: errorInfo.action,
    originalError: error
  });
  
  return errorInfo;
};

/**
 * Valida configurações básicas de IA
 */
export const validateAIConfig = (config) => {
  const errors = [];
  
  if (!config) {
    errors.push("Configuração de IA não encontrada");
    return errors;
  }
  
  if (!config.apiKey) {
    errors.push("API Key não configurada");
  }
  
  if (!config.model) {
    errors.push("Modelo não selecionado");
  }
  
  if (config.temperature !== undefined && (config.temperature < 0 || config.temperature > 2)) {
    errors.push("Temperatura deve estar entre 0 e 2");
  }
  
  if (config.maxTokens !== undefined && (config.maxTokens < 1 || config.maxTokens > 4000)) {
    errors.push("Max Tokens deve estar entre 1 e 4000");
  }
  
  return errors;
};

const aiErrorHandler = {
  getAIErrorMessage,
  showAIErrorToast,
  validateAIConfig
};

export default aiErrorHandler;
