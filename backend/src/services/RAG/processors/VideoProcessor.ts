import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import OpenAI from 'openai';

const execAsync = promisify(exec);
const FFMPEG_PATH = (() => {
  try {
    const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
    if (ffmpegInstaller && ffmpegInstaller.path) {
      return ffmpegInstaller.path as string;
    }
  } catch (error) {}
  return 'ffmpeg';
})();

export interface VideoProcessResult {
  text: string;
  duration: number;
  metadata: {
    format: string;
    resolution?: string;
    fps?: number;
    audioChannels?: number;
    hasAudio: boolean;
  };
}

export default class VideoProcessor {
  /**
   * Verifica se o arquivo é um vídeo suportado
   */
  static isValidVideo(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    const supportedFormats = ['.mp4', '.avi', '.mov', '.mkv', '.webm', '.flv', '.wmv', '.m4v'];
    return supportedFormats.includes(ext) && fs.existsSync(filePath);
  }

  /**
   * Extrai áudio do vídeo e transcreve usando Whisper
   */
  static async extractText(filePath: string, openaiApiKey?: string): Promise<VideoProcessResult> {
    if (!this.isValidVideo(filePath)) {
      throw new Error('Arquivo de vídeo inválido ou não encontrado');
    }

    const tempDir = path.join(path.dirname(filePath), 'temp');
    const audioPath = path.join(tempDir, `${path.basename(filePath, path.extname(filePath))}.wav`);
    
    try {
      // Criar diretório temporário
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      // Extrair informações do vídeo
      const metadata = await this.getVideoMetadata(filePath);
      
      // Extrair áudio usando ffmpeg
      await this.extractAudio(filePath, audioPath);
      
      // Transcrever áudio
      let transcription = '';
      if (openaiApiKey && metadata.hasAudio) {
        transcription = await this.transcribeAudio(audioPath, openaiApiKey);
      }
      
      // Limpar arquivo temporário
      if (fs.existsSync(audioPath)) {
        fs.unlinkSync(audioPath);
      }
      
      return {
        text: transcription,
        duration: metadata.duration,
        metadata: {
          format: path.extname(filePath).substring(1),
          resolution: metadata.resolution,
          fps: metadata.fps,
          audioChannels: metadata.audioChannels,
          hasAudio: metadata.hasAudio
        }
      };
      
    } catch (error: any) {
      // Limpar arquivo temporário em caso de erro
      if (fs.existsSync(audioPath)) {
        fs.unlinkSync(audioPath);
      }
      throw new Error(`Erro ao processar vídeo: ${error.message}`);
    }
  }

  /**
   * Obtém metadados do vídeo usando ffprobe
   */
  private static async getVideoMetadata(filePath: string): Promise<{
    duration: number;
    resolution?: string;
    fps?: number;
    audioChannels?: number;
    hasAudio: boolean;
  }> {
    try {
      const { stdout } = await execAsync(
        `ffprobe -v quiet -print_format json -show_format -show_streams "${filePath}"`
      );
      
      const info = JSON.parse(stdout);
      const videoStream = info.streams?.find((s: any) => s.codec_type === 'video');
      const audioStream = info.streams?.find((s: any) => s.codec_type === 'audio');
      
      return {
        duration: parseFloat(info.format?.duration || '0'),
        resolution: videoStream ? `${videoStream.width}x${videoStream.height}` : undefined,
        fps: videoStream ? parseFloat(videoStream.r_frame_rate?.split('/')[0] || '0') : undefined,
        audioChannels: audioStream?.channels || 0,
        hasAudio: !!audioStream
      };
    } catch (error) {
      console.warn('[VideoProcessor] Falha ao obter metadados, usando valores padrão');
      return {
        duration: 0,
        hasAudio: true // Assumir que tem áudio por segurança
      };
    }
  }

  /**
   * Extrai áudio do vídeo usando ffmpeg
   */
  private static async extractAudio(videoPath: string, audioPath: string): Promise<void> {
    const command = `"${FFMPEG_PATH}" -i "${videoPath}" -vn -acodec pcm_s16le -ar 16000 -ac 1 "${audioPath}" -y`;
    
    try {
      await execAsync(command);
      
      if (!fs.existsSync(audioPath)) {
        throw new Error('Falha ao extrair áudio do vídeo');
      }
    } catch (error: any) {
      throw new Error(`Erro no ffmpeg: ${error.message}`);
    }
  }

  /**
   * Transcreve áudio usando OpenAI Whisper
   */
  private static async transcribeAudio(audioPath: string, apiKey: string): Promise<string> {
    try {
      const openai = new OpenAI({ apiKey });
      
      const audioFile = fs.createReadStream(audioPath);
      
      const transcription = await openai.audio.transcriptions.create({
        file: audioFile,
        model: 'whisper-1',
        language: 'pt',
        response_format: 'text'
      });
      
      return typeof transcription === 'string' ? transcription : (transcription as any)?.text || '';
      
    } catch (error: any) {
      console.warn(`[VideoProcessor] Falha na transcrição: ${error.message}`);
      return `[Vídeo processado - transcrição não disponível: ${error.message}]`;
    }
  }
}
