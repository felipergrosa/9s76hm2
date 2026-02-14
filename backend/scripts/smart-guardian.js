// 🤖 SISTEMA INTELIGENTE E AUTÔNOMO - DETECÇÃO E CORREÇÃO AUTOMÁTICA
// Roda automaticamente apenas quando necessário, sem intervenção manual

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

class SmartSessionGuardian {
  constructor() {
    this.backendUrl = process.env.BACKEND_URL || 'http://localhost:8080';
    this.logFile = path.join(__dirname, '../logs/smart-guardian.log');
    this.redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379/0';
    this.isRunning = false;
    this.lastCheck = new Date();
    this.problematicSessions = new Map();
    this.healthCheckInterval = 30000;
    this.errorThreshold = 3;
    this.timeWindow = 5 * 60 * 1000;
  }

  log(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level}] ${message}`;
    console.log(logMessage);
    
    try {
      fs.appendFileSync(this.logFile, logMessage + '\n');
    } catch (error) {
      console.error('Erro ao salvar log:', error.message);
    }
  }

  async checkBackendHealth() {
    try {
      const response = await axios.get(`${this.backendUrl}/health`, { 
        timeout: 5000,
        validateStatus: (status) => status < 500
      });
      return response.status === 200;
    } catch (error) {
      this.log(`Backend indisponível: ${error.message}`, 'WARN');
      return false;
    }
  }

  async detectErrorPatterns(whatsappId) {
    const now = Date.now();
    const timeWindowStart = now - this.timeWindow;
    
    try {
      const { stdout } = await execAsync(
        `docker logs whaticket-backend --since=$((${timeWindowStart}/1000)) --until=$((${now/1000)) --timestamps 2>&1 | grep -i "whatsappId=${whatsappId}" | grep -i "Invalid PreKey ID\\|Bad MAC\\|PreKeyError\\|failed to decrypt message\\|stream errored" | wc -l`
      );
      
      const errorCount = parseInt(stdout.trim()) || 0;
      
      const { stdout: patternStdout } = await execAsync(
        `docker logs whaticket-backend --since=$((${timeWindowStart}/1000)) --until=$((${now/1000)) --timestamps 2>&1 | grep -i "whatsappId=${whatsappId}" | grep -i "Invalid PreKey ID" | head -5`
      );
      
      const hasPreKeyError = patternStdout.includes('Invalid PreKey ID');
      const hasStreamError = patternStdout.includes('stream errored');
      const hasDecryptError = patternStdout.includes('failed to decrypt');
      
      return {
        errorCount,
        hasPreKeyError,
        hasStreamError,
        hasDecryptError,
        isCritical: errorCount >= this.errorThreshold && (hasPreKeyError || hasStreamError)
      };
    } catch (error) {
      this.log(`Erro na detecção de padrões: ${error.message}`, 'ERROR');
      return { errorCount: 0, isCritical: false };
    }
  }

  async analyzeSession(whatsappId) {
    const patterns = await this.detectErrorPatterns(whatsappId);
    const cachedProblem = this.problematicSessions.get(whatsappId);
    const now = Date.now();
    
    if (patterns.isCritical) {
      this.log(`PROBLEMA CRÍTICO detectado na sessão ${whatsappId}: ${patterns.errorCount} erros`, 'ERROR');
      
      if (!cachedProblem || now - cachedProblem.firstDetected > 60000) {
        this.problematicSessions.set(whatsappId, {
          firstDetected: now,
          lastChecked: now,
          errorCount: patterns.errorCount,
          attempts: 0
        });
        
        return { needsFix: true, reason: 'critical_errors', patterns };
      }
    }
    
    if (cachedProblem && patterns.errorCount === 0) {
      this.problematicSessions.delete(whatsappId);
      this.log(`Sessão ${whatsappId} recuperada automaticamente`, 'INFO');
    }
    
    return { needsFix: false, reason: 'no_action_needed', patterns };
  }

  async smartSessionReset(whatsappId, reason) {
    this.log(`INICIANDO RESET INTELIGENTE da sessão ${whatsappId} - Motivo: ${reason}`);
    
    const cachedProblem = this.problematicSessions.get(whatsappId);
    if (cachedProblem) {
      cachedProblem.attempts++;
      
      if (cachedProblem.attempts > 3) {
        this.log(`LIMIT DE TENTATIVAS ATINGIDO para sessão ${whatsappId}`, 'ERROR');
        return { success: false, message: 'max_attempts_reached' };
      }
    }

    try {
      this.log(`Tentando reconexão suave para sessão ${whatsappId}...`);
      
      await axios.put(
        `${this.backendUrl}/whatsapp/${whatsappId}/disconnect`,
        {},
        { timeout: 10000 }
      );
      
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      await axios.put(
        `${this.backendUrl}/whatsapp/${whatsappId}/start-session`,
        {},
        { timeout: 15000 }
      );
      
      this.log(`Reconexão suave concluída para sessão ${whatsappId}`);
      
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const healthCheck = await this.checkSessionHealth(whatsappId);
      if (!healthCheck.isHealthy) {
        this.log(`Reconexão suave falhou, fazendo reset completo...`);
        await this.fullSessionReset(whatsappId);
      }
      
      return { success: true, message: 'session_reset_success' };
      
    } catch (error) {
      this.log(`Erro no reset da sessão ${whatsappId}: ${error.message}`, 'ERROR');
      return { success: false, message: error.message };
    }
  }

  async fullSessionReset(whatsappId) {
    this.log(`EXECUTANDO RESET COMPLETO da sessão ${whatsappId}`);
    
    try {
      await axios.put(
        `${this.backendUrl}/whatsapp/${whatsappId}/disconnect`,
        {},
        { timeout: 10000 }
      );
      
      const sessionPath = path.join(__dirname, `../private/sessions/1/${whatsappId}`);
      if (fs.existsSync(sessionPath)) {
        fs.rmSync(sessionPath, { recursive: true, force: true });
        this.log('Arquivos de sessão removidos');
      }
      
      try {
        const redis = require('redis');
        const client = redis.createClient({ url: this.redisUrl });
        await client.connect();
        await client.flushAll();
        await client.disconnect();
        this.log('Cache Redis limpo');
      } catch (error) {
        this.log(`Redis não disponível: ${error.message}`);
      }
      
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      await axios.put(
        `${this.backendUrl}/whatsapp/${whatsappId}/start-session`,
        {},
        { timeout: 15000 }
      );
      
      this.log(`Reset completo concluído para sessão ${whatsappId}`);
      
    } catch (error) {
      this.log(`Erro no reset completo: ${error.message}`, 'ERROR');
      throw error;
    }
  }

  async checkSessionHealth(whatsappId) {
    try {
      const response = await axios.get(`${this.backendUrl}/whatsapp/${whatsappId}`, { timeout: 5000 });
      const session = response.data;
      
      return {
        isHealthy: session.status === 'OPENED',
        status: session.status,
        lastUpdate: session.updatedAt
      };
    } catch (error) {
      return { isHealthy: false, status: 'unknown', error: error.message };
    }
  }

  async getActiveSessions() {
    try {
      const response = await axios.get(`${this.backendUrl}/whatsapp`, { timeout: 10000 });
      return response.data.filter(w => w.status === 'OPENED').map(w => w.id);
    } catch (error) {
      this.log(`Erro ao obter sessões: ${error.message}`, 'WARN');
      return [];
    }
  }

  async performIntelligentCheck() {
    if (this.isRunning) {
      this.log('Verificação já em andamento, pulando...', 'DEBUG');
      return;
    }

    this.isRunning = true;
    this.lastCheck = new Date();
    
    try {
      this.log('INICIANDO VERIFICAÇÃO INTELIGENTE...');
      
      const isBackendHealthy = await this.checkBackendHealth();
      if (!isBackendHealthy) {
        this.log('Backend não está saudável, pulando verificação', 'WARN');
        return;
      }
      
      const sessions = await this.getActiveSessions();
      if (sessions.length === 0) {
        this.log('Nenhuma sessão ativa encontrada', 'INFO');
        return;
      }
      
      this.log(`Analisando ${sessions.length} sessões ativas...`);
      
      const sessionsNeedingFix = [];
      
      for (const sessionId of sessions) {
        const analysis = await this.analyzeSession(sessionId);
        
        if (analysis.needsFix) {
          sessionsNeedingFix.push({
            sessionId,
            reason: analysis.reason,
            patterns: analysis.patterns
          });
        }
      }
      
      if (sessionsNeedingFix.length > 0) {
        this.log(`${sessionsNeedingFix.length} sessões precisam de correção`);
        
        for (const session of sessionsNeedingFix) {
          this.log(`Corrigindo sessão ${session.sessionId} - ${session.reason}`);
          await this.smartSessionReset(session.sessionId, session.reason);
        }
      } else {
        this.log('Todas as sessões estão saudáveis');
      }
      
      this.cleanupOldProblems();
      
    } catch (error) {
      this.log(`Erro na verificação inteligente: ${error.message}`, 'ERROR');
    } finally {
      this.isRunning = false;
    }
  }

  cleanupOldProblems() {
    const now = Date.now();
    const maxAge = 10 * 60 * 1000;
    
    for (const [sessionId, problem] of this.problematicSessions.entries()) {
      if (now - problem.lastChecked > maxAge) {
        this.problematicSessions.delete(sessionId);
        this.log(`Limpando cache de problema antigo: ${sessionId}`);
      }
    }
  }

  async startIntelligentGuardian() {
    this.log('INICIANDO GUARDIÃO INTELIGENTE DE SESSÕES');
    
    setTimeout(() => {
      this.performIntelligentCheck();
    }, 5000);
    
    setInterval(() => {
      this.performIntelligentCheck();
    }, this.healthCheckInterval);
    
    setInterval(() => {
      if (this.problematicSessions.size > 0) {
        this.log('Problemas detectados, verificando com mais frequência');
        this.performIntelligentCheck();
      }
    }, this.healthCheckInterval / 2);
    
    this.log('Guardião inteligente iniciado - verificação automática ativa');
  }

  stop() {
    this.log('PARANDO GUARDIÃO INTELIGENTE');
    process.exit(0);
  }
}

if (require.main === module) {
  const guardian = new SmartSessionGuardian();
  
  process.on('SIGINT', () => guardian.stop());
  process.on('SIGTERM', () => guardian.stop());
  
  guardian.startIntelligentGuardian();
}

module.exports = SmartSessionGuardian;
