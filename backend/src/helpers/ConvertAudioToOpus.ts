import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "@ffmpeg-installer/ffmpeg";
import path from "path";
import fs from "fs";
import logger from "../utils/logger";

ffmpeg.setFfmpegPath(ffmpegPath.path);

/**
 * Converte um arquivo de áudio (mp3, m4a, wav, webm...) para OGG com codec
 * OPUS — formato exigido pela Meta Cloud API para mensagens de voz
 * (`audio: { voice: true }`) e também o formato ideal de PTT no Baileys.
 *
 * Retorna o caminho do arquivo .ogg gerado ao lado do original.
 * O arquivo original NÃO é removido (responsabilidade do chamador).
 */
const ConvertAudioToOpus = async (inputPath: string): Promise<string> => {
  const parsed = path.parse(inputPath);
  const outputPath = path.join(parsed.dir, `${parsed.name}.ogg`);

  await new Promise<void>((resolve, reject) => {
    ffmpeg(inputPath)
      .noVideo()
      .audioCodec("libopus")
      .audioBitrate("64k")
      .format("ogg")
      .on("end", () => resolve())
      .on("error", (err: Error) => reject(err))
      .save(outputPath);
  });

  if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size === 0) {
    throw new Error("Conversão para OGG/OPUS gerou arquivo vazio");
  }

  logger.info(`[ConvertAudioToOpus] ${inputPath} -> ${outputPath}`);
  return outputPath;
};

export default ConvertAudioToOpus;
