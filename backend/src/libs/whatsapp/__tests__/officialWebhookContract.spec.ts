import { computeMetaSignature } from "../../../helpers/VerifyMetaWebhookSignature";
import { checkOfficialWebhookSignature } from "../../../services/WebhookService/CheckMetaWebhookSignature";
import Whatsapp from "../../../models/Whatsapp";
import { officialApiVersion } from "../officialApiVersion";

jest.mock("../../../models/Whatsapp", () => ({
  __esModule: true,
  default: { findAll: jest.fn() }
}));

describe("official WhatsApp webhook contract", () => {
  const body = Buffer.from('{"object":"whatsapp_business_account"}');

  beforeEach(() => {
    delete process.env.META_APP_SECRET;
    delete process.env.WABA_API_VERSION;
  });

  it("accepts only the App Secret belonging to the claimed phone number", async () => {
    (Whatsapp.findAll as jest.Mock).mockResolvedValue([
      { id: 1, wabaPhoneNumberId: "111", metaAppSecret: "company-one" }
    ]);

    expect(await checkOfficialWebhookSignature(
      body, computeMetaSignature(body, "company-one"), ["111"]
    )).toBe(true);
    expect(await checkOfficialWebhookSignature(
      body, computeMetaSignature(body, "company-two"), ["111"]
    )).toBe(false);
  });

  it("rejects payloads claiming a phone outside the signed tenant", async () => {
    (Whatsapp.findAll as jest.Mock).mockResolvedValue([
      { id: 1, wabaPhoneNumberId: "111", metaAppSecret: "company-one" },
      { id: 2, wabaPhoneNumberId: "222", metaAppSecret: "company-two" }
    ]);

    expect(await checkOfficialWebhookSignature(
      body, computeMetaSignature(body, "company-one"), ["111", "222"]
    )).toBe(false);
  });

  it("uses configured Graph version and rejects malformed values", () => {
    process.env.WABA_API_VERSION = "v25.0";
    expect(officialApiVersion()).toBe("v25.0");
    process.env.WABA_API_VERSION = "../../admin";
    expect(() => officialApiVersion()).toThrow();
  });
});
