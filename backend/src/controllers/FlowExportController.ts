// backend/src/controllers/FlowBuilder/FlowExportController.ts

import { Request, Response } from "express";
import fs from "fs";
import path from "path";
import archiver from "archiver";
import { promisify } from "util";

// CORREÇÃO 1: Importamos apenas o seu modelo real, que se chama "FlowBuilderModel"
import { FlowBuilderModel } from "../models/FlowBuilder";

const writeFileAsync = promisify(fs.writeFile);

// Tipagem para a estrutura esperada dentro da coluna JSON 'flow'
interface FlowData {
  elements?: any[];
  // adicione outras propriedades que existam no seu JSON, como 'seq', 'nodes', etc.
}

const FlowExportController = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { companyId } = req.user;

  try {
    // Busca restrita ao tenant — evita exportar fluxo de outra empresa (IDOR)
    const flowInstance = await FlowBuilderModel.findOne({
      where: { id, company_id: companyId }
    });

    if (!flowInstance) {
      return res.status(404).json({ error: "Fluxo não encontrado." });
    }

    // CORREÇÃO 3: Os "blocos" (elements) estão dentro da coluna JSON 'flow'.
    const flowJsonContent: FlowData = flowInstance.flow || {};
    const blocks = flowJsonContent.elements || [];

    const exportData = {
      id: flowInstance.id,
      name: flowInstance.name,
      // Usamos o conteúdo da coluna 'flow' para a exportação
      flow: flowJsonContent
    };

    const tempDir = path.resolve(__dirname, "..", "..", "temp", `flow-${flowInstance.id}`);
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    fs.mkdirSync(tempDir, { recursive: true });

    const flowJsonPath = path.join(tempDir, "flow.json");
    await writeFileAsync(flowJsonPath, JSON.stringify(exportData, null, 2));

    const mediaDir = path.join(tempDir, "media");
    fs.mkdirSync(mediaDir, { recursive: true });

    // Copiar mídias associadas (lógica ajustada para usar a variável 'blocks')
    for (const block of blocks) {
      if (block.type === "img" || block.type === "audio" || block.type === "video") {
        const mediaPath = block.value;
        if (mediaPath) {
          const sourcePath = path.resolve("public", mediaPath);
          if (fs.existsSync(sourcePath)) {
            const fileName = path.basename(mediaPath);
            const destPath = path.join(mediaDir, fileName);
            fs.copyFileSync(sourcePath, destPath);
          }
        }
      }
    }

    const zipPath = path.join(tempDir, `flow-${flowInstance.id}.zip`);
    const output = fs.createWriteStream(zipPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    archive.pipe(output);
    archive.directory(tempDir, false);
    
    output.on("close", () => {
      res.download(zipPath, `flow-${flowInstance.id}.zip`, (err) => {
        if (err) {
            console.error("Erro ao enviar o arquivo de download:", err);
        }
        fs.rmSync(tempDir, { recursive: true, force: true });
      });
    });

    await archive.finalize();

  } catch (err) {
    console.error("Erro ao exportar fluxo:", err);
    // Limpa o diretório temporário em caso de erro
    const tempDir = path.resolve(__dirname, "..", "..", "temp", `flow-${id}`);
     if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    return res.status(500).json({ error: "Erro ao exportar fluxo." });
  }
};

export default FlowExportController;