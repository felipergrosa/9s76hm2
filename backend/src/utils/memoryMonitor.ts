/**
 * Monitor de memória otimizado para detectar memory leaks
 * Executar a cada 60 segundos (reduzido overhead)
 */

// Contador para forçar GC a cada X ciclos
let gcCounter = 0;
const GC_FORCE_INTERVAL = 10; // Forçar GC a cada 10 ciclos (10 minutos)
const MONITOR_INTERVAL = 60000; // 60 segundos (reduzido de 30s)

function monitorMemory() {
  const used = process.memoryUsage();
  const heapUsedMB = Math.round(used.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(used.heapTotal / 1024 / 1024);
  const externalMB = Math.round(used.external / 1024 / 1024);
  const rssMB = Math.round(used.rss / 1024 / 1024);
  
  const usage = Math.round((heapUsedMB / heapTotalMB) * 100);
  
  // Só logar se uso estiver alto (> 70%) para reduzir ruído
  if (usage > 70) {
    console.log(`[MEMORY] Heap: ${heapUsedMB}MB / ${heapTotalMB}MB (${usage}%) | RSS: ${rssMB}MB | External: ${externalMB}MB`);
  }
  
  // Alertar se uso está alto
  if (usage > 80) {
    console.warn(`[MEMORY] ⚠️ USO ALTO DE MEMÓRIA: ${usage}%`);
  }
  
  if (usage > 90) {
    console.error(`[MEMORY] 🚨 CRÍTICO: Memória quase esgotada! ${usage}%`);
    
    // Forçar garbage collection se disponível
    if (global.gc) {
      console.log('[MEMORY] Executando garbage collection forçado...');
      global.gc();
      
      // Verificar resultado
      const afterGC = process.memoryUsage();
      const afterHeapUsedMB = Math.round(afterGC.heapUsed / 1024 / 1024);
      const afterHeapTotalMB = Math.round(afterGC.heapTotal / 1024 / 1024);
      const afterUsage = Math.round((afterHeapUsedMB / afterHeapTotalMB) * 100);
      console.log(`[MEMORY] Pós-GC: ${afterHeapUsedMB}MB / ${afterHeapTotalMB}MB (${afterUsage}%)`);
    } else {
      console.warn('[MEMORY] GC não disponível. Execute com --expose-gc para habilitar.');
    }
  }
  
  // Forçar GC periódico mesmo com uso normal (prevenção)
  gcCounter++;
  if (gcCounter >= GC_FORCE_INTERVAL && global.gc && usage > 60) {
    console.log('[MEMORY] GC preventivo executado');
    global.gc();
    gcCounter = 0;
  }
  
  return { heapUsedMB, heapTotalMB, usage };
}

// Executar monitoramento a cada 60 segundos (otimizado)
const monitorInterval = setInterval(monitorMemory, MONITOR_INTERVAL);

// Limpar interval ao desligar
process.on('SIGTERM', () => {
  clearInterval(monitorInterval);
});

process.on('SIGINT', () => {
  clearInterval(monitorInterval);
});

// Exportar para uso manual
export default monitorMemory;
