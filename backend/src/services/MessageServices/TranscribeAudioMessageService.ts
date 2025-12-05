import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
import axios from 'axios';
import Setting from '../../models/Setting';
import CompaniesSettings from '../../models/CompaniesSettings';
import AIAgent from '../../models/AIAgent';
import Ticket from '../../models/Ticket';

interface Response {
  transcribedText: string;
}

class TranscribeAudioMessageService {
  public async execute(fileName: string, companyId: number, ticketId?: number): Promise<Response | { error: string }> {
    // Validação dos parâmetros de entrada
    if (!fileName || typeof fileName !== 'string') {
      return { error: 'fileName é obrigatório e deve ser uma string.' };
    }
    if (!companyId || typeof companyId !== 'number') {
      return { error: 'companyId é obrigatório e deve ser um número.' };
    }

    // Construção e verificação do caminho do arquivo
    const publicFolder = path.resolve(__dirname, '..', '..', '..', 'public');
    const filePath = `${publicFolder}/company${companyId}/${fileName}`;

    if (!fs.existsSync(filePath)) {
      console.error(`Arquivo não encontrado: ${filePath}`);
      return { error: 'Arquivo não encontrado' };
    }

    // Buscar provedor STT do AI Agent (se ticketId fornecido)
    let transcriptionProvider: string = 'disabled';
    let apiKey: string | undefined;

    if (ticketId) {
      const ticket = await Ticket.findByPk(ticketId);
      if (ticket && ticket.queueId) {
        // Buscar AI Agent pela fila
        const agent = await AIAgent.findOne({
          where: { companyId },
          // Verifica se a fila do ticket está no queueIds do agente
        });

        if (agent && agent.sttProvider && agent.sttProvider !== 'disabled') {
          transcriptionProvider = agent.sttProvider;
          console.log(`[STT] Usando provedor do AI Agent: ${transcriptionProvider}`);
        }
      }
    }

    // Fallback: buscar de Settings (legacy)
    if (transcriptionProvider === 'disabled') {
      console.log('[STT] AI Agent não configurado, tentando Settings (legacy)');
      const transcriptionSetting = await Setting.findOne({
        where: { key: 'apiTranscription', companyId },
      });
      apiKey = transcriptionSetting?.value;

      if (apiKey) {
        // Detectar provedor pela chave
        if (apiKey.startsWith('sk-')) {
          transcriptionProvider = 'openai';
        } else if (apiKey.startsWith('AIzaSy')) {
          transcriptionProvider = 'gemini';
        }
      }
    }

    // Buscar chave do provedor nas configurações globais
    if (transcriptionProvider === 'openai' || transcriptionProvider === 'gemini') {
      const providerSetting = await CompaniesSettings.findOne({
        where: { companyId },
      });
      
      if (providerSetting) {
        apiKey = transcriptionProvider === 'openai' 
          ? providerSetting.openaiApiKey 
          : undefined; // Gemini ainda não implementado em CompaniesSettings
      }
    }

    if (!apiKey) {
      console.error(`[STT] Chave da API não encontrada para provedor: ${transcriptionProvider}, companyId: ${companyId}`);
      return { error: 'Chave da API não configurada' };
    }

    console.log(`[STT] Transcrevendo com provedor: ${transcriptionProvider}`);

    try {
      const audioFile = fs.createReadStream(filePath);

      if (transcriptionProvider === 'openai') {
        // Configuração para a API da OpenAI
        const form = new FormData();
        form.append('file', audioFile);
        form.append('model', 'whisper-1');
        form.append('response_format', 'text');
        form.append('language', 'pt');

        const response = await axios.post('https://api.openai.com/v1/audio/transcriptions', form, {
          headers: {
            ...form.getHeaders(),
            Authorization: `Bearer ${apiKey}`,
          },
        });

        return { transcribedText: response.data };
      } else if (transcriptionProvider === 'gemini') {
        // Gemini não tem API dedicada de transcrição ainda
        // Como workaround, usar OpenAI Whisper se disponível
        console.warn('[STT] Gemini não suporta transcrição de áudio diretamente. Use OpenAI.');
        return { error: 'Gemini não suporta transcrição de áudio. Use OpenAI Whisper.' };
      } else {
        console.error(`Provedor de transcrição desconhecido: ${transcriptionProvider} para companyId: ${companyId}`);
        return { error: 'Provedor de transcrição inválido' };
      }
    } catch (error: any) {
      console.error(`[STT] Erro ao transcrever áudio para fileName: ${fileName}, companyId: ${companyId}`, error.message);
      return { error: `Conversão para texto falhou: ${error.message}` };
    }
  }
}

export default TranscribeAudioMessageService;