// 🤖 SERVIÇO AUTOMÁTICO PARA PRODUÇÃO - DETECTAR E CORRIGIR SESSÕES CORROMPIDAS
// Uso: node auto-fix-sessions.js [whatsappId]

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

class SessionAutoFix {
  constructor() {
    this.backendUrl = process.env.BACKEND_URL || 'http://localhost:8080';
    this.logFile = path.join(__dirname, '../logs/auto-fix-sessions.log');
    this.redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379/0';
  }

  // Função de log
  log(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}`;
    console.log(logMessage);
    
    // Salvar no arquivo de log
    try {
      fs.appendFileSync(this.logFile, logMessage + '\n');
    } catch (error) {
      console.error('Erro ao salvar log:', error.message);
    }
  }

  // Verificar se backend está online
  async checkBackend() {
    try {
      const response = await axios.get(`${this.backendUrl}/health`, { timeout: 5000 });
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  // Detectar erros de sessão nos logs do Docker
  async detectSessionErrors(whatsappId) {
    try {
      // Usar docker logs para verificar erros
      const { stdout } = await execAsync(
        `docker logs whaticket-backend --tail=100 --since=5m 2>&1 | grep -i "Invalid PreKey ID\\|Bad MAC\\|PreKeyError\\|failed to decrypt message" | grep -c "whatsappId=${whatsappId}" || echo "0"`
      );
      
      const errorCount = parseInt(stdout.trim()) || 0;
      return errorCount;
    } catch (error) {
      this.log(`Erro ao detectar erros: ${error.message}`);
      return 0;
    }
  }

  // Resetar sessão específica
  async resetSession(whatsappId) {
    this.log(`🔧 Resetando sessão WhatsApp ID: ${whatsappId}`);

    try {
      // 1. Desconectar via API
      this.log(`📱 Desconectando WhatsApp ${whatsappId}...`);
      await axios.put(
        `${this.backendUrl}/whatsapp/${whatsappId}/disconnect`,
        {},
        { timeout: 10000 }
      );
      this.log('✅ Desconectado via API');
    } catch (error) {
      this.log(`⚠️ Falha ao desconectar via API: ${error.message}`);
    }

    // 2. Limpar arquivos de sessão
    this.log('📁 Limpando arquivos de sessão...');
    const sessionPath = path.join(__dirname, `../private/sessions/1/${whatsappId}`);
    if (fs.existsSync(sessionPath)) {
      try {
        fs.rmSync(sessionPath, { recursive: true, force: true });
        this.log('✅ Arquivos de sessão removidos');
      } catch (error) {
        this.log(`⚠️ Erro ao remover arquivos: ${error.message}`);
      }
    }

    // 3. Limpar cache Redis
    this.log('🗄️ Limpando cache Redis...');
    try {
      const redis = require('redis');
      const client = redis.createClient({ url: this.redisUrl });
      
      await client.connect();
      await client.flushAll();
      await client.disconnect();
      this.log('✅ Cache Redis limpo');
    } catch (error) {
      this.log(`⚠️ Redis não disponível: ${error.message}`);
    }

    // 4. Esperar um momento
    await new Promise(resolve => setTimeout(resolve, 5000));

    // 5. Reconectar
    this.log(`🔄 Reconectando WhatsApp ${whatsappId}...`);
    try {
      await axios.put(
        `${this.backendUrl}/whatsapp/${whatsappId}/start-session`,
        {},
        { timeout: 10000 }
      );
      this.log('✅ Reconectado via API');
    } catch (error) {
      this.log(`⚠️ Falha ao reconectar via API: ${error.message}`);
    }

    this.log(`✅ Sessão ${whatsappId} resetada com sucesso`);
  }

  // Obter todas as sessões ativas
  async getActiveSessions() {
    try {
      const response = await axios.get(`${this.backendUrl}/whatsapp`, { timeout: 10000 });
      return response.data.filter(w => w.status === 'OPENED').map(w => w.id);
    } catch (error) {
      this.log(`Erro ao obter sessões: ${error.message}`);
      return [];
    }
  }

  // Verificar todas as sessões
  async checkAllSessions() {
    this.log('🔍 Verificando todas as sessões ativas...');

    const sessions = await this.getActiveSessions();
    
    if (sessions.length === 0) {
      this.log('⚠️ Nenhuma sessão ativa encontrada');
      return;
    }

    for (const sessionId of sessions) {
      this.log(`📊 Verificando sessão ${sessionId}...`);

      const errorCount = await this.detectSessionErrors(sessionId);

      if (errorCount > 5) {
        this.log(`🚨 ERROS DETECTADOS na sessão ${sessionId}: ${errorCount} ocorrências`);
        await this.resetSession(sessionId);
      } else {
        this.log(`✅ Sessão ${sessionId} OK (${errorCount} erros)`);
      }
    }
  }

  // Executar o auto-fix
  async run(whatsappId = 'all') {
    this.log('🚀 INICIANDO AUTO-FIX DE SESSÕES WHATSAPP');

    // Verificar se backend está online
    const isBackendOnline = await this.checkBackend();
    if (!isBackendOnline) {
      this.log('❌ Backend não está online. Abortando.');
      process.exit(1);
    }

    this.log('✅ Backend online, continuando...');

    // Processar baseado no parâmetro
    if (whatsappId === 'all') {
      await this.checkAllSessions();
    } else {
      const errorCount = await this.detectSessionErrors(whatsappId);

      if (errorCount > 5) {
        this.log(`🚨 ERROS DETECTADOS na sessão ${whatsappId}: ${errorCount} ocorrências`);
        await this.resetSession(whatsappId);
      } else {
        this.log(`✅ Sessão ${whatsappId} OK (${errorCount} erros)`);
      }
    }

    this.log('🎯 AUTO-FIX CONCLUÍDO');
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  const whatsappId = process.argv[2] || 'all';
  const autoFix = new SessionAutoFix();
  autoFix.run(whatsappId).catch(error => {
    console.error('Erro fatal:', error);
    process.exit(1);
  });
}

module.exports = SessionAutoFix;
