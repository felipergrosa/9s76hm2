// src/controllers/FlowImportController.ts
import { Request, Response } from "express";
import AdmZip from "adm-zip";
import path from "path";
import fs from "fs";
import { v4 as uuid } from "uuid";

// CORREÇÃO 1: Importando o modelo CORRETO com o NOME e CAMINHO corretos.
import { FlowBuilderModel } from "../models/FlowBuilder";

// Extensões de mídia permitidas dentro do .zip (bloqueia html/svg/js —
// stored XSS via arquivo servido em /public)
const ALLOWED_MEDIA_EXTENSIONS = new Set([
  "jpg", "jpeg", "png", "gif", "webp",
  "mp4", "mp3", "ogg", "pdf", "txt"
]);

// Interface para o conteúdo esperado do flow.json
interface FlowJson {
  name: string;
  description?: string;
  flow: {
    elements?: any[];
    [key: string]: any; // Permite outras propriedades como 'seq', 'nodes', etc.
  };
}

const FlowImportController = async (req: Request, res: Response) => {
  const { companyId, id: userId } = req.user;

  try {
    if (!req.file) {
      return res.status(400).json({ error: "Arquivo .zip não enviado." });
    }

    // 1. Descompacta o arquivo e lê o flow.json
    const zip = new AdmZip(req.file.buffer);
    const flowEntry = zip.getEntry("flow.json");
    if (!flowEntry) {
      return res.status(400).json({ error: "O arquivo flow.json está ausente no .zip." });
    }
    const flowJsonData: FlowJson = JSON.parse(flowEntry.getData().toString("utf8"));

    // 2. Cria o diretório para as mídias deste novo fluxo (usando um ID temporário)
    const tempFlowId = uuid(); // Usamos um ID temporário para o nome da pasta
    const mediaDirPublic = path.join("public", "flows", tempFlowId);
    fs.mkdirSync(mediaDirPublic, { recursive: true });

    // 3. Extrai as mídias e atualiza os caminhos dentro do JSON
    const mediaEntries = zip.getEntries().filter(entry => entry.entryName.startsWith("media/") && !entry.isDirectory);

    // Rejeita mídias com extensão não permitida (ex.: .html/.svg/.js)
    const invalidEntry = mediaEntries.find(entry => {
      const ext = path.extname(entry.entryName).replace(".", "").toLowerCase();
      return !ALLOWED_MEDIA_EXTENSIONS.has(ext);
    });
    if (invalidEntry) {
      return res.status(400).json({
        error: `Tipo de arquivo não permitido no pacote: ${invalidEntry.entryName}`
      });
    }

    mediaEntries.forEach(entry => {
      const originalPath = entry.entryName;
      // Gera um novo nome de arquivo para evitar conflitos
      const newFileName = `${uuid()}_${path.basename(originalPath)}`;
      const newDestPath = path.join(mediaDirPublic, newFileName);
      
      // Salva o arquivo de mídia no novo local
      fs.writeFileSync(newDestPath, entry.getData());

      // Calcula o caminho relativo para salvar no banco
      const relativeDbPath = path.join("flows", tempFlowId, newFileName).replace(/\\/g, "/");

      // Atualiza o caminho da mídia dentro do objeto JSON
      if (flowJsonData.flow && flowJsonData.flow.elements) {
        flowJsonData.flow.elements.forEach(block => {
          if (["img", "audio", "video"].includes(block.type) && block.value === originalPath.replace('media/', '')) {
            block.value = relativeDbPath;
          }
        });
      }
    });

    // 4. Cria o registro do fluxo no banco de dados com o JSON já atualizado
    const newFlow = await FlowBuilderModel.create({
      name: `(Importado) ${flowJsonData.name || `Fluxo ${Date.now()}`}`,
      company_id: companyId,
      user_id: userId,
      active: true,
      // Salva o objeto 'flow' inteiro (com os caminhos de mídia atualizados) na coluna JSON
      flow: flowJsonData.flow
    });
    
    // 5. Renomeia a pasta de mídia com o ID real do banco
    const finalMediaDir = path.join("public", "flows", String(newFlow.id));
    fs.renameSync(mediaDirPublic, finalMediaDir);

    // 6. Atualiza o registro no banco com os caminhos finais (opcional, mas recomendado)
    if (mediaEntries.length > 0) {
        const finalFlowJson = JSON.parse(JSON.stringify(newFlow.flow));
        finalFlowJson.elements.forEach(block => {
            if (block.value && typeof block.value === 'string' && block.value.includes(tempFlowId)) {
                block.value = block.value.replace(tempFlowId, String(newFlow.id));
            }
        });
        await newFlow.update({ flow: finalFlowJson });
    }
    
    return res.status(201).json({ 
        message: "Fluxo importado com sucesso!",
        flowId: newFlow.id 
    });

  } catch (err) {
    console.error("Erro na importação:", err);
    return res.status(500).json({ error: "Falha ao importar fluxo." });
  }
};

export default FlowImportController;