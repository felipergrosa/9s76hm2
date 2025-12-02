import api from "./api";

// Cache em memória (5 minutos)
const cache = {
    openai: { data: null, timestamp: 0 },
    gemini: { data: null, timestamp: 0 }
};

export const getAvailableModels = async (provider, apiKey, integrationId) => {
    if (!provider) return [];

    // Se tiver apiKey ou integrationId, não usa cache global simples (pois pode variar por chave)
    // Poderíamos fazer um cache mais complexo, mas por segurança vamos buscar sempre se tiver chave específica.
    const useCache = !apiKey && !integrationId;

    if (useCache) {
        const cached = cache[provider];
        const now = Date.now();
        if (cached && cached.data && (now - cached.timestamp < 5 * 60 * 1000)) {
            return cached.data;
        }
    }

    try {
        const params = { provider };
        if (apiKey) params.apiKey = apiKey;
        if (integrationId) params.integrationId = integrationId;

        const { data } = await api.get("/ai-models", { params });

        if (useCache && data.models) {
            cache[provider] = {
                data: data.models,
                timestamp: Date.now()
            };
        }

        return data.models || [];
    } catch (error) {
        console.error(`Error fetching models for ${provider}:`, error);

        // Fallback hardcoded em caso de erro de rede/servidor
        const fallback = provider === "openai"
            ? [
                { id: "gpt-4o", name: "GPT-4 Omni", contextWindow: 128000 },
                { id: "gpt-4o-mini", name: "GPT-4 Omni Mini", contextWindow: 128000 },
                { id: "gpt-4-turbo", name: "GPT-4 Turbo", contextWindow: 128000 },
                { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo", contextWindow: 16385 }
            ]
            : [
                { id: "gemini-2.0-flash-exp", name: "Gemini 2.0 Flash", contextWindow: 1000000 },
                { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro", contextWindow: 2000000 },
                { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash", contextWindow: 1000000 }
            ];

        return fallback;
    }
};

export const clearModelsCache = () => {
    cache.openai = { data: null, timestamp: 0 };
    cache.gemini = { data: null, timestamp: 0 };
};
