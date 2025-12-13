import request from "supertest";
import { hash } from "bcryptjs";
import User from "../../models/User";
import AIAgent from "../../models/AIAgent";
import FunnelStage from "../../models/FunnelStage";
import AIOrchestrator from "../../services/IA/AIOrchestrator";

let app: any;
let sequelize: any;

jest.mock("../../libs/wbot", () => ({}));

jest.mock("../../queues", () => ({
  __esModule: true,
  messageQueue: {},
  sendScheduledMessages: {},
  importContactsQueue: {},
  default: {}
}));

jest.mock("../../queues/ImportContactsQueue", () => ({
  __esModule: true,
  importContactsQueue: {}
}));

jest.mock("../../libs/queue", () => ({
  __esModule: true,
  default: {
    queues: []
  }
}));

jest.mock("../../services/WbotServices/wbotMessageListener", () => ({
  __esModule: true,
  default: {}
}));

jest.mock("../../services/WbotServices/wbotMonitor", () => ({
  __esModule: true,
  default: {}
}));

jest.mock("../../libs/socket", () => ({
  __esModule: true,
  getIO: () => ({
    of: () => ({
      emit: jest.fn()
    }),
    emit: jest.fn()
  })
}));

jest.mock("@whiskeysockets/baileys", () => {
  const handler: ProxyHandler<any> = {
    get: (_target, prop) => {
      if (prop === "__esModule") return true;
      return jest.fn();
    }
  };
  return new Proxy({}, handler);
});

jest.mock("jimp", () => ({
  __esModule: true,
  default: {}
}));

jest.mock("openai", () => ({
  __esModule: true,
  default: function MockOpenAI() {
    return {
      chat: {
        completions: {
          create: jest.fn()
        }
      }
    };
  }
}));

jest.mock("whatsapp-web.js", () => ({
  __esModule: true,
  Client: jest.fn(),
  LocalAuth: jest.fn(),
  MessageMedia: {
    fromFilePath: jest.fn(),
    fromUrl: jest.fn()
  }
}));

jest.mock("axios", () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn()
  }
}));

jest.mock("../../services/IA/AIOrchestrator", () => ({
  __esModule: true,
  default: {
    processRequest: jest.fn()
  }
}));

type LoginResponse = {
  token: string;
  user: {
    id: number;
    companyId: number;
  };
};

const login = async (email: string, password: string) => {
  const res = await request(app).post("/auth/login").send({ email, password });
  expect(res.status).toBe(200);
  const body = res.body as LoginResponse;
  expect(body.token).toBeTruthy();
  return body.token;
};

describe("AI Training Sandbox (E2E API)", () => {
  beforeAll(() => {
    app = require("../../app").default;
    sequelize = require("../../database").default;
    (AIOrchestrator as any).processRequest.mockResolvedValue({
      success: true,
      result: "Resposta mockada do agente",
      provider: "openai",
      model: "mock",
      processingTime: 1,
      ragUsed: false,
      requestId: "req_test",
      timestamp: new Date()
    });
  });

  afterAll(async () => {
    if (sequelize?.close) {
      await sequelize.close();
    }
  });

  it("deve bloquear usuário sem ai-training.view e permitir admin; criar sessão; enviar msg; aplicar prompt na etapa", async () => {
    const companyId = 1;

    const passwordHash = await hash("123456", 8);
    const userNoPerm = await User.create({
      name: "User No Perm",
      email: `noperm_${Date.now()}@test.com`,
      profile: "user",
      passwordHash,
      companyId,
      super: false,
      permissions: ["tickets.view"]
    } as any);

    const tokenNoPerm = await login(userNoPerm.email, "123456");

    const agent = await AIAgent.create({
      companyId,
      name: `Agent Test ${Date.now()}`,
      profile: "support",
      queueIds: [],
      status: "active",
      aiProvider: "openai",
      aiModel: "mock"
    } as any);

    const stage = await FunnelStage.create({
      agentId: agent.id,
      order: 1,
      name: "Stage 1",
      tone: "professional",
      objective: "Objetivo de teste",
      systemPrompt: "Prompt inicial",
      enabledFunctions: []
    } as any);

    const forbiddenRes = await request(app)
      .post("/ai/sandbox/sessions")
      .set("Authorization", `Bearer ${tokenNoPerm}`)
      .send({
        agentId: agent.id,
        stageId: stage.id,
        whatsappId: 1,
        groupId: "120363000000000000@g.us",
        promptOverride: "teste"
      });
    expect(forbiddenRes.status).toBe(403);

    const tokenAdmin = await login("admin@admin.com", "123456");

    const listStagesRes = await request(app)
      .get(`/ai-agents/${agent.id}/funnel-stages`)
      .set("Authorization", `Bearer ${tokenAdmin}`);
    expect(listStagesRes.status).toBe(200);
    expect(Array.isArray(listStagesRes.body?.stages)).toBe(true);

    const updatePromptRes = await request(app)
      .put(`/ai-agents/${agent.id}/funnel-stages/${stage.id}/system-prompt`)
      .set("Authorization", `Bearer ${tokenAdmin}`)
      .send({ systemPrompt: "Prompt atualizado" });
    expect(updatePromptRes.status).toBe(200);

    const stageAfter = await FunnelStage.findByPk(stage.id);
    expect(stageAfter?.systemPrompt).toBe("Prompt atualizado");

    const createSessionRes = await request(app)
      .post("/ai/sandbox/sessions")
      .set("Authorization", `Bearer ${tokenAdmin}`)
      .send({
        agentId: agent.id,
        stageId: stage.id,
        whatsappId: 1,
        groupId: "120363000000000000@g.us",
        promptOverride: "Override da sessão"
      });
    expect(createSessionRes.status).toBe(201);
    const sessionId = createSessionRes.body?.session?.id;
    expect(sessionId).toBeTruthy();

    const sendMessageRes = await request(app)
      .post(`/ai/sandbox/sessions/${sessionId}/messages`)
      .set("Authorization", `Bearer ${tokenAdmin}`)
      .send({ text: "Olá" });
    expect(sendMessageRes.status).toBe(200);
    expect(sendMessageRes.body?.message?.text).toBe("Resposta mockada do agente");

    expect((AIOrchestrator as any).processRequest).toHaveBeenCalled();
    const callArg = (AIOrchestrator as any).processRequest.mock.calls[0][0];
    expect(callArg?.systemPrompt).toContain("Prompt atualizado");
    expect(callArg?.systemPrompt).toContain("Override da sessão");
  });
});
