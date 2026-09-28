/** Shared Graph API version for official messaging and media. */
export function officialApiVersion(): string {
  const version = process.env.WABA_API_VERSION || "v25.0";
  if (!/^v\d+\.\d+$/.test(version)) {
    throw new Error("WABA_API_VERSION inválida");
  }
  return version;
}
