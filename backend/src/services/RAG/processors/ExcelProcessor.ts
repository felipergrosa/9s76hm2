import fs from "fs";
import path from "path";

export interface ExcelProcessResult {
  text: string;
  sheets: number;
  metadata?: {
    sheetNames?: string[];
  };
}

export default class ExcelProcessor {
  static isValidExcel(filePath: string): boolean {
    if (!fs.existsSync(filePath)) return false;
    const ext = path.extname(filePath).toLowerCase();
    return ext === ".xls" || ext === ".xlsx";
  }

  static async extractText(filePath: string): Promise<ExcelProcessResult> {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Arquivo Excel não encontrado: ${filePath}`);
    }

    const ext = path.extname(filePath).toLowerCase();
    if (ext !== ".xls" && ext !== ".xlsx") {
      throw new Error(`Arquivo não é Excel: ${ext}`);
    }

    try {
      const XLSX = require("xlsx");
      const workbook = XLSX.readFile(filePath);
      const sheetNames: string[] = workbook.SheetNames || [];
      const parts: string[] = [];

      for (const sheetName of sheetNames) {
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) continue;

        const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });
        if (!rows || !rows.length) continue;

        parts.push(`Planilha: ${sheetName}`);

        for (const row of rows) {
          const cells = (row || []).map((cell: any) => {
            if (cell === null || cell === undefined) return "";
            if (typeof cell === "string") return cell.trim();
            return String(cell);
          });

          const line = cells.join(" | ").trim();
          if (line) {
            parts.push(line);
          }
        }

        parts.push("");
      }

      const text = parts.join("\n").trim();

      if (!text) {
        throw new Error("Não foi possível extrair texto do arquivo Excel");
      }

      return {
        text,
        sheets: sheetNames.length,
        metadata: { sheetNames }
      };
    } catch (error: any) {
      if (error.code === "MODULE_NOT_FOUND") {
        throw new Error("Biblioteca xlsx não instalada. Execute: npm install xlsx");
      }
      throw new Error(error.message || String(error));
    }
  }
}
