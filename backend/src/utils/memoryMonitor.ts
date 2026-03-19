/**
 * Monitor de memória para detectar memory leaks
 * Executar a cada 30 segundos para acompanhar uso
 */

function monitorMemory() {
  const used = process.memoryUsage();
  const heapUsedMB = Math.round(used.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(used.heapTotal / 1024 / 1024);
  const externalMB = Math.round(used.external / 1024 / 1024);
  const rssMB = Math.round(used.rss / 1024 / 1024);
  
  const usage = Math.round((heapUsedMB / heapTotalMB) * 100);
  
  console.log(`[MEMORY] Heap: ${heapUsedMB}MB / ${heapTotalMB}MB (${usage}%) | RSS: ${rssMB}MB | External: ${externalMB}MB`);
  
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
    }
  }
  
  return { heapUsedMB, heapTotalMB, usage };
}

// Executar monitoramento a cada 30 segundos
setInterval(monitorMemory, 30000);

// Exportar para uso manual
export default monitorMemory;
