/**
 * Helper para extrair timestamp numérico de mensagens do Baileys.
 * A partir da rc.10, o WAProto pode retornar objetos Long {low, high, unsigned}
 * em vez de números simples para messageTimestamp.
 */
export const getBaileysTimestamp = (msgTimestamp: any): number => {
  if (!msgTimestamp) return Math.floor(Date.now() / 1000);
  if (typeof msgTimestamp === "object" && msgTimestamp !== null) {
    if (typeof msgTimestamp.low === "number") return msgTimestamp.low;
    if (typeof msgTimestamp.toNumber === "function") return msgTimestamp.toNumber();
  }
  return Number(msgTimestamp) || Math.floor(Date.now() / 1000);
};
