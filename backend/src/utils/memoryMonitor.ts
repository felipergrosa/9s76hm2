/**
 * Monitor de memória com garbage collection proativo e diagnóstico de Maps
 * Executar a cada 60 segundos
 */

// Contador para forçar GC a cada X ciclos
let gcCounter = 0;
const GC_FORCE_INTERVAL = 5; // Forçar GC a cada 5 ciclos (5 minutos) quando memória alta
const MONITOR_INTERVAL = 60000; // 60 segundos

function monitorMemory() {
  const used = process.memoryUsage();
  const heapUsedMB = Math.round(used.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(used.heapTotal / 1024 / 1024);
  const rssMB = Math.round(used.rss / 1024 / 1024);
  
  const usage = Math.round((heapUsedMB / heapTotalMB) * 100);
  
  // Logar apenas se uso estiver ALTO (> 90%)
  if (usage > 90) {
    console.warn(`[MEMORY] ⚠️ USO ALTO: ${heapUsedMB}MB / ${heapTotalMB}MB (${usage}%) | RSS: ${rssMB}MB`);
  }
  
  // Forçar GC proativamente quando > 93% — antes de atingir limite crítico
  gcCounter++;
  if (global.gc && usage > 93 && gcCounter >= GC_FORCE_INTERVAL) {
    global.gc();
    gcCounter = 0;
    const afterGC = process.memoryUsage();
    const afterUsedMB = Math.round(afterGC.heapUsed / 1024 / 1024);
    const afterTotalMB = Math.round(afterGC.heapTotal / 1024 / 1024);
    const afterUsage = Math.round((afterUsedMB / afterTotalMB) * 100);
    console.log(`[MEMORY] GC executado: ${heapUsedMB}MB → ${afterUsedMB}MB / ${afterTotalMB}MB (${afterUsage}%)`);
  } else if (gcCounter >= GC_FORCE_INTERVAL) {
    gcCounter = 0;
  }

  // Crítico: > 98%
  if (usage > 98) {
    console.error(`[MEMORY] 🚨 CRÍTICO: ${usage}% | Heap: ${heapUsedMB}/${heapTotalMB}MB | RSS: ${rssMB}MB`);
    // GC de emergência mesmo fora do intervalo
    if (global.gc) global.gc();
  }
  
  return { heapUsedMB, heapTotalMB, usage };
}

// Executar monitoramento a cada 60 segundos
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
