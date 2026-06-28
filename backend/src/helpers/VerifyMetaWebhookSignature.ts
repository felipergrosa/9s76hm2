import crypto from "crypto";

export function computeMetaSignature(rawBody: Buffer, appSecret: string): string {
  return `sha256=${crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex")}`;
}

export function isValidMetaSignature(
  rawBody: Buffer | undefined,
  signatureHeader: string | undefined,
  appSecret: string | undefined | null
): boolean {
  if (!rawBody || !signatureHeader || !appSecret) return false;

  const expected = computeMetaSignature(rawBody, appSecret);
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(signatureHeader);

  if (expectedBuffer.length !== receivedBuffer.length) return false;

  return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
}
