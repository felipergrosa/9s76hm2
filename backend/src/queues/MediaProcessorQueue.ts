import Queue from "bull";
import * as Sentry from "@sentry/node";
import path from "path";
import fs from "fs";
import { promisify } from "util";
import sharp from "sharp";

const writeFileAsync = promisify(fs.writeFile);
const unlinkAsync = promisify(fs.unlink);

interface MediaJob {
  messageId: number;
  mediaPath: string;
  mediaType: string;
  companyId: number;
}

const mediaQueue = new Queue("MediaProcessor", {
  redis: {
    host: process.env.IO_REDIS_SERVER || "localhost",
    port: parseInt(process.env.IO_REDIS_PORT || "6379"),
    password: process.env.IO_REDIS_PASSWORD || undefined,
    db: parseInt(process.env.IO_REDIS_DB_BULL || "3")
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000
    },
    removeOnComplete: true,
    removeOnFail: false
  }
});

/**
 * Processa mídias em background
 * - Gera thumbnails
 * - Comprime imagens
 * - Valida arquivos
 */
mediaQueue.process(5, async (job) => {
  const { messageId, mediaPath, mediaType, companyId } = job.data as MediaJob;

  try {
    console.log(`[MediaProcessor] Processing ${mediaType} for message ${messageId}`);

    // Processa apenas imagens
    if (mediaType === "image") {
      await processImage(mediaPath, companyId);
    }

    // Processa vídeos (thumbnail)
    if (mediaType === "video") {
      await processVideo(mediaPath, companyId);
    }

    console.log(`[MediaProcessor] Completed ${mediaType} for message ${messageId}`);
    return { success: true, messageId };
  } catch (error) {
    console.error(`[MediaProcessor] Error processing message ${messageId}:`, error);
    Sentry.captureException(error);
    throw error;
  }
});

/**
 * Processa imagem: gera thumbnail e comprime
 */
async function processImage(mediaPath: string, companyId: number): Promise<void> {
  if (!fs.existsSync(mediaPath)) {
    throw new Error(`File not found: ${mediaPath}`);
  }

  const dir = path.dirname(mediaPath);
  const ext = path.extname(mediaPath);
  const basename = path.basename(mediaPath, ext);
  const thumbnailPath = path.join(dir, `${basename}_thumb${ext}`);

  // Gera thumbnail (200x200)
  await sharp(mediaPath)
    .resize(200, 200, { fit: "inside" })
    .jpeg({ quality: 80 })
    .toFile(thumbnailPath);

  // Comprime imagem original se for muito grande
  const stats = fs.statSync(mediaPath);
  const fileSizeMB = stats.size / (1024 * 1024);

  if (fileSizeMB > 2) {
    const compressedPath = path.join(dir, `${basename}_compressed${ext}`);
    await sharp(mediaPath)
      .jpeg({ quality: 85 })
      .toFile(compressedPath);

    // Substitui original pela comprimida
    await unlinkAsync(mediaPath);
    fs.renameSync(compressedPath, mediaPath);
    console.log(`[MediaProcessor] Compressed image from ${fileSizeMB.toFixed(2)}MB`);
  }
}

/**
 * Processa vídeo: gera thumbnail do primeiro frame
 */
async function processVideo(mediaPath: string, companyId: number): Promise<void> {
  // Implementação simplificada - em produção usar ffmpeg
  console.log(`[MediaProcessor] Video processing not implemented yet: ${mediaPath}`);
}

/**
 * Adiciona mídia para processamento
 */
export async function addMediaToQueue(data: MediaJob): Promise<void> {
  await mediaQueue.add(data, {
    priority: data.mediaType === "image" ? 1 : 2
  });
}

/**
 * Limpa jobs completados
 */
export async function cleanMediaQueue(): Promise<void> {
  await mediaQueue.clean(5000, "completed");
  await mediaQueue.clean(86400000, "failed"); // 24h
}

// Limpa fila a cada 5 minutos
setInterval(cleanMediaQueue, 300000);

export default mediaQueue;
