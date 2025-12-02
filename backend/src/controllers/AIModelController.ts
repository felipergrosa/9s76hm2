import { Request, Response } from "express";
import OpenAI from "openai";
import AppError from "../errors/AppError";
import Setting from "../models/Setting";
import QueueIntegrations from "../models/QueueIntegrations";
import fetch from "node-fetch";

interface AIModel {
    id: string;
    name: string;
    description?: string;
    contextWindow?: number;
}

export const listModels = async (req: Request, res: Response): Promise<Response> => {
    const { provider, apiKey, integrationId } = req.query as { provider: "openai" | "gemini", apiKey?: string, integrationId?: string };
    const { companyId } = req.user;

    if (!provider || !["openai", "gemini"].includes(provider)) {
        throw new AppError("Provider must be 'openai' or 'gemini'", 400);
    }

    try {
        let models: AIModel[] = [];

        if (provider === "openai") {
            let apiKeyValue = apiKey;

            if (!apiKeyValue && integrationId) {
                const integration = await QueueIntegrations.findOne({
                    where: { id: integrationId, companyId }
                });
                if (integration && integration.jsonContent) {
                    try {
                        const json = JSON.parse(integration.jsonContent);
                        apiKeyValue = json.apiKey;
                    } catch (e) {
                        console.error("Error parsing integration jsonContent", e);
                    }
                }
            }

            if (!apiKeyValue) {
                // Buscar API key da empresa se não fornecida na query
                const setting = await Setting.findOne({
                    where: {
                        companyId,
                        key: "openaiApiKey"
                    }
                });
                apiKeyValue = setting?.value;
            }

            if (!apiKeyValue) {
                // Fallback: modelos conhecidos
                return res.json({
                    models: [
                        { id: "gpt-4o", name: "GPT-4 Omni", contextWindow: 128000 },
                        { id: "gpt-4o-mini", name: "GPT-4 Omni Mini", contextWindow: 128000 },
                        { id: "gpt-4-turbo", name: "GPT-4 Turbo", contextWindow: 128000 },
                        { id: "gpt-4", name: "GPT-4", contextWindow: 8192 },
                        { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo", contextWindow: 16385 },
                        { id: "gpt-3.5-turbo-1106", name: "GPT-3.5 Turbo 1106", contextWindow: 16385 }
                    ],
                    cached: false,
                    source: "fallback"
                });
            }

            // Chamar API OpenAI
            try {
                const openai = new OpenAI({ apiKey: apiKeyValue });
                const response = await openai.models.list();

                // Filtrar apenas modelos GPT de chat
                models = response.data
                    .filter(m =>
                        m.id.startsWith("gpt-") &&
                        !m.id.includes("instruct") &&
                        !m.id.includes("whisper") &&
                        !m.id.includes("dall-e") &&
                        !m.id.includes("tts") &&
                        !m.id.includes("embedding")
                    )
                    .map(m => ({
                        id: m.id,
                        name: formatModelName(m.id),
                        description: `Model: ${m.id}`,
                        contextWindow: getContextWindow(m.id)
                    }))
                    .sort((a, b) => {
                        // Ordenar: 4 antes de 3.5
                        if (a.id.includes("gpt-4")) return -1;
                        if (b.id.includes("gpt-4")) return 1;
                        return a.id.localeCompare(b.id);
                    });
            } catch (apiError) {
                console.error("[AI Models] OpenAI API error:", apiError);
                // Fallback em erro
                return res.json({
                    models: [
                        { id: "gpt-4o", name: "GPT-4 Omni", contextWindow: 128000 },
                        { id: "gpt-4o-mini", name: "GPT-4 Omni Mini", contextWindow: 128000 },
                        { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo", contextWindow: 16385 }
                    ],
                    cached: false,
                    source: "fallback-api-error"
                });
            }

        } else if (provider === "gemini") {
            let apiKeyValue = apiKey;

            if (!apiKeyValue && integrationId) {
                const integration = await QueueIntegrations.findOne({
                    where: { id: integrationId, companyId }
                });
                if (integration && integration.jsonContent) {
                    try {
                        const json = JSON.parse(integration.jsonContent);
                        apiKeyValue = json.apiKey;
                    } catch (e) {
                        console.error("Error parsing integration jsonContent", e);
                    }
                }
            }

            if (!apiKeyValue) {
                // Buscar API key da empresa
                const setting = await Setting.findOne({
                    where: {
                        companyId,
                        key: "geminiApiKey"
                    }
                });
                apiKeyValue = setting?.value;
            }

            if (!apiKeyValue) {
                // Fallback: modelos conhecidos
                return res.json({
                    models: [
                        { id: "gemini-2.0-flash-exp", name: "Gemini 2.0 Flash (Experimental)", contextWindow: 1000000 },
                        { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro", contextWindow: 2000000 },
                        { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash", contextWindow: 1000000 },
                        { id: "gemini-pro", name: "Gemini Pro", contextWindow: 32000 }
                    ],
                    cached: false,
                    source: "fallback"
                });
            }

            // Chamar API Gemini
            try {
                const modelsResponse = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKeyValue}`
                );
                const data = await modelsResponse.json();

                if (!data.models) {
                    throw new Error("No models returned from Gemini API");
                }

                // Filtrar apenas modelos generativos
                models = data.models
                    .filter((m: any) =>
                        m.name.includes("gemini") &&
                        m.supportedGenerationMethods?.includes("generateContent")
                    )
                    .map((m: any) => ({
                        id: m.name.replace("models/", ""),
                        name: m.displayName || m.name.replace("models/", ""),
                        description: m.description,
                        contextWindow: m.inputTokenLimit
                    }));
            } catch (apiError) {
                console.error("[AI Models] Gemini API error:", apiError);
                // Fallback em erro
                return res.json({
                    models: [
                        { id: "gemini-2.0-flash-exp", name: "Gemini 2.0 Flash", contextWindow: 1000000 },
                        { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro", contextWindow: 2000000 },
                        { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash", contextWindow: 1000000 }
                    ],
                    cached: false,
                    source: "fallback-api-error"
                });
            }
        }

        return res.json({
            models,
            cached: false,
            source: "api"
        });

    } catch (error) {
        console.error(`[AI Models] Error fetching ${provider} models:`, error);

        // Em caso de erro fatal, retornar lista fallback
        const fallbackModels = provider === "openai"
            ? [
                { id: "gpt-4o", name: "GPT-4 Omni" },
                { id: "gpt-4o-mini", name: "GPT-4 Omni Mini" },
                { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo" }
            ]
            : [
                { id: "gemini-2.0-flash-exp", name: "Gemini 2.0 Flash" },
                { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro" },
                { id: "gemini-1.5-flash", name: "Gemini 1.5 Flash" }
            ];

        return res.json({
            models: fallbackModels,
            cached: false,
            source: "fallback-error",
            error: error.message
        });
    }
};

// Helper: Format model name
function formatModelName(modelId: string): string {
    return modelId
        .replace("gpt-", "GPT-")
        .replace("-turbo", " Turbo")
        .replace("mini", "Mini")
        .replace("gpt-4o", "GPT-4 Omni")
        .replace("GPT-4O", "GPT-4 Omni");
}

// Helper: Context window size
function getContextWindow(modelId: string): number {
    const windows: { [key: string]: number } = {
        "gpt-4o": 128000,
        "gpt-4o-mini": 128000,
        "gpt-4-turbo": 128000,
        "gpt-4": 8192,
        "gpt-3.5-turbo": 16385,
        "gpt-3.5-turbo-1106": 16385,
        "gpt-3.5-turbo-16k": 16385
    };
    return windows[modelId] || 8192;
}
