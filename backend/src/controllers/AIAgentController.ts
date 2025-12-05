import { Request, Response } from "express";
import * as Yup from "yup";
import CreateAIAgentService from "../services/AIAgentServices/CreateAIAgentService";
import ListAIAgentsService from "../services/AIAgentServices/ListAIAgentsService";
import UpdateAIAgentService from "../services/AIAgentServices/UpdateAIAgentService";
import DeleteAIAgentService from "../services/AIAgentServices/DeleteAIAgentService";
import MigratePromptsToAgentsService from "../services/AIAgentServices/MigratePromptsToAgentsService";
import AIAgent from "../models/AIAgent";
import AppError from "../errors/AppError";

// Schema de validação para funnel stage
const funnelStageSchema = Yup.object().shape({
    id: Yup.number(),
    order: Yup.number().required(),
    name: Yup.string().required(),
    tone: Yup.string().required(),
    objective: Yup.string(),
    systemPrompt: Yup.string().required(),
    enabledFunctions: Yup.array().of(Yup.string()),
    autoAdvanceCondition: Yup.string().nullable(),
    sentimentThreshold: Yup.number().nullable().min(-1).max(1)
});

// Schema de validação para criar agente
const createSchema = Yup.object().shape({
    name: Yup.string().required("ERR_NAME_REQUIRED"),
    responseLength: Yup.string().nullable(),
    language: Yup.string().nullable(),
    brandVoice: Yup.string().nullable(),
    allowedVariables: Yup.string().nullable(),
    voiceType: Yup.string().nullable().oneOf(["text", "generated", "enabled", null]),
    voiceApiKey: Yup.string().nullable(),
    voiceRegion: Yup.string().nullable(),
    voiceTemperature: Yup.number().nullable().min(0).max(1),
    voiceName: Yup.string().nullable(),
    sttProvider: Yup.string().nullable().oneOf(["openai", "gemini", "disabled", null]),
    funnelStages: Yup.array().of(funnelStageSchema)
});

// Schema de validação para atualizar agente
const updateSchema = Yup.object().shape({
    name: Yup.string(),
    profile: Yup.string().oneOf(["sales", "support", "service", "hybrid"]),
    queueIds: Yup.array().of(Yup.number()),
    voiceEnabled: Yup.boolean(),
    imageRecognitionEnabled: Yup.boolean(),
    sentimentAnalysisEnabled: Yup.boolean(),
    autoSegmentationEnabled: Yup.boolean(),
    status: Yup.string().oneOf(["active", "inactive"]),
    aiProvider: Yup.string().nullable().oneOf(["openai", "gemini", null]),
    aiModel: Yup.string().nullable(),
    temperature: Yup.number().nullable().min(0).max(1),
    maxTokens: Yup.number().nullable().min(1),
    creativity: Yup.string().nullable(),
    toneStyle: Yup.string().nullable(),
    emojiUsage: Yup.string().nullable(),
    hashtagUsage: Yup.string().nullable(),
    responseLength: Yup.string().nullable(),
    language: Yup.string().nullable(),
    brandVoice: Yup.string().nullable(),
    allowedVariables: Yup.string().nullable(),
    voiceType: Yup.string().nullable().oneOf(["text", "generated", "enabled", null]),
    voiceApiKey: Yup.string().nullable(),
    voiceRegion: Yup.string().nullable(),
    voiceTemperature: Yup.number().nullable().min(0).max(1),
    voiceName: Yup.string().nullable(),
    sttProvider: Yup.string().nullable().oneOf(["openai", "gemini", "disabled", null]),
    funnelStages: Yup.array().of(funnelStageSchema)
});

export const store = async (req: Request, res: Response): Promise<Response> => {
    const { companyId } = req.user;

    const data = req.body;

    try {
        await createSchema.validate(data);
    } catch (err: any) {
        throw new AppError(err.message, 400);
    }

    const agent = await CreateAIAgentService({
        companyId,
        ...data
    });

    return res.status(200).json(agent);
};

export const index = async (req: Request, res: Response): Promise<Response> => {
    const { companyId } = req.user;

    const { agents, count } = await ListAIAgentsService({ companyId });

    return res.status(200).json({ agents, count });
};

export const show = async (req: Request, res: Response): Promise<Response> => {
    const { companyId } = req.user;
    const { id } = req.params;

    const agent = await AIAgent.findOne({
        where: { id, companyId },
        include: ["funnelStages"]
    });

    if (!agent) {
        throw new AppError("ERR_AGENT_NOT_FOUND", 404);
    }

    return res.status(200).json(agent);
};

export const update = async (req: Request, res: Response): Promise<Response> => {
    const { companyId } = req.user;
    const { id } = req.params;
    const data = req.body;

    try {
        await updateSchema.validate(data);
    } catch (err: any) {
        throw new AppError(err.message, 400);
    }

    const agent = await UpdateAIAgentService({
        id: parseInt(id),
        companyId,
        ...data
    });

    return res.status(200).json(agent);
};

export const remove = async (req: Request, res: Response): Promise<Response> => {
    const { companyId } = req.user;
    const { id } = req.params;

    await DeleteAIAgentService({
        id: parseInt(id),
        companyId
    });

    return res.status(200).json({ message: "Agent deleted successfully" });
};

export const migrate = async (req: Request, res: Response): Promise<Response> => {
    const { companyId, profile } = req.user;
    const { dryRun } = req.query;

    // Apenas admins podem migrar
    if (profile !== "admin" && profile !== "super") {
        throw new AppError("ERR_NO_PERMISSION", 403);
    }

    const result = await MigratePromptsToAgentsService({
        companyId,
        dryRun: dryRun === "true"
    });

    return res.status(200).json(result);
};
