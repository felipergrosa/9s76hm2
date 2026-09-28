import axios from "axios";
import { OfficialAPIAdapter } from "../OfficialAPIAdapter";

// axios é ESM puro — o automock do jest carrega o módulo real e quebra no
// parse. Factory mock evita tocar node_modules.
jest.mock("axios", () => {
  const create = jest.fn();
  return { __esModule: true, default: { create }, create };
});

describe("official media send contract", () => {
  const mockedAxios = axios as jest.Mocked<typeof axios>;
  const post = jest.fn();

  beforeEach(() => {
    process.env.BACKEND_URL = "https://backend.example";
    post.mockResolvedValue({ data: { messages: [{ id: "wamid.123" }] } });
    mockedAxios.create.mockReturnValue({
      post,
      interceptors: { response: { use: jest.fn() } }
    } as any);
  });

  it("sends a tenant-bound signed media URL and the configured Graph version", async () => {
    const adapter = new OfficialAPIAdapter(10, {
      companyId: 3,
      phoneNumberId: "phone-3",
      accessToken: "token",
      businessAccountId: "business-3",
      apiVersion: "v25.0"
    });

    await adapter.sendMessage({
      to: "5511999999999",
      mediaType: "image",
      mediaUrl: "https://backend.example/public/company3/contact9/photo.jpg"
    });

    expect(mockedAxios.create).toHaveBeenCalledWith(expect.objectContaining({
      baseURL: "https://graph.facebook.com/v25.0"
    }));
    const payload = post.mock.calls[0][1];
    const signed = new URL(payload.image.link);
    expect(signed.searchParams.get("mediaCompany")).toBe("3");
    expect(signed.searchParams.get("mediaSignature")).toMatch(/^[a-f0-9]{64}$/);
  });

  it("rejects a local media URL from another tenant before calling Meta", async () => {
    const adapter = new OfficialAPIAdapter(10, {
      companyId: 3,
      phoneNumberId: "phone-3",
      accessToken: "token",
      businessAccountId: "business-3"
    });
    await expect(adapter.sendMessage({
      to: "5511999999999",
      mediaType: "image",
      mediaUrl: "https://backend.example/public/company4/contact9/photo.jpg"
    })).rejects.toThrow();
    expect(post).not.toHaveBeenCalled();
  });
});
