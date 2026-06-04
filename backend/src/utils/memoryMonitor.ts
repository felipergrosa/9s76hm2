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
  
  const MAX_MEMORY_MB = 4096; // Limite definido no package.json (--max-old-space-size=4096)
  
  // A porcentagem real de uso contra o limite máximo, não contra o heap alocado atual (que começa pequeno)
  const usageReal = Math.round((heapUsedMB / MAX_MEMORY_MB) * 100);
  // Porcentagem do heap atual apenas para debug
  const usageHeap = Math.round((heapUsedMB / heapTotalMB) * 100);
  
  // Logar apenas se uso real estiver ALTO (> 60% de 4GB = ~2.4GB)
  if (usageReal > 60) {
    console.warn(`[MEMORY] ⚠️ USO ALTO: ${heapUsedMB}MB / ${MAX_MEMORY_MB}MB (${usageReal}%) | RSS: ${rssMB}MB`);
  }
  
  // Forçar GC proativamente quando > 70% do máximo (aprox 2.8GB)
  gcCounter++;
  if (global.gc && usageReal > 70 && gcCounter >= GC_FORCE_INTERVAL) {
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
  if (usageReal > 98) {
    console.error(`[MEMORY] 🚨 CRÍTICO: ${usageReal}% | Heap: ${heapUsedMB}/${MAX_MEMORY_MB}MB | RSS: ${rssMB}MB`);
    // GC de emergência mesmo fora do intervalo
    if (global.gc) global.gc();
  }
  
  return { heapUsedMB, heapTotalMB, usage: usageReal };
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
