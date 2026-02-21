// 🕐 CRON JOB AUTOMÁTICO PARA PRODUÇÃO
// Verifica e corrige sessões corrompidas a cada 10 minutos

const cron = require('node-cron');
const SessionAutoFix = require('./auto-fix-sessions');

class ProductionMonitor {
  constructor() {
    this.autoFix = new SessionAutoFix();
    this.isRunning = false;
  }

  async startMonitoring() {
    console.log('🕐 Iniciando monitoramento automático de sessões...');

    // Executar a cada 10 minutos
    cron.schedule('*/10 * * * *', async () => {
      if (this.isRunning) {
        console.log('⏭️ Auto-fix já em execução, pulando...');
        return;
      }

      this.isRunning = true;
      
      try {
        console.log('🔍 Executando verificação automática...');
        await this.autoFix.run('all');
      } catch (error) {
        console.error('❌ Erro na verificação automática:', error);
      } finally {
        this.isRunning = false;
      }
    });

    // Executar verificação inicial
    setTimeout(() => {
      this.autoFix.run('all').catch(console.error);
    }, 5000);

    console.log('✅ Monitoramento automático iniciado (verificação a cada 10 minutos)');
  }

  // Verificação manual
  async runManualCheck(whatsappId = 'all') {
    console.log('🔧 Executando verificação manual...');
    await this.autoFix.run(whatsappId);
  }
}

// Iniciar monitoramento se chamado diretamente
if (require.main === module) {
  const monitor = new ProductionMonitor();
  monitor.startMonitoring();
  
  // Manter o processo rodando
  process.on('SIGINT', () => {
    console.log('\n🛑 Parando monitoramento...');
    process.exit(0);
  });
}

module.exports = ProductionMonitor;
