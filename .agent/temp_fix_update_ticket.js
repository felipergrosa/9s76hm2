const fs = require("fs");
const path = "c:\\Users\\feliperosa\\whaticket\\backend\\src\\services\\TicketServices\\UpdateTicketService.ts";

const content = fs.readFileSync(path, "utf8");
const lines = content.split(/\r?\n/);
const startIndex = lines.findIndex(line => line.includes('Grupos NUNCA devem ser fechados automaticamente'));

if (startIndex === -1) {
  throw new Error("Bloco alvo não encontrado");
}

const endIndex = startIndex + 5;
const updatedLines = [...lines.slice(0, startIndex), ...lines.slice(endIndex + 1)];
fs.writeFileSync(path, updatedLines.join("\n"), "utf8");
