// Teste para forçar alocação de memória
console.log('=== TESTE DE ALOCAÇÃO ===');

const usage = process.memoryUsage();
console.log(`Heap inicial: ${Math.round(usage.heapTotal / 1024 / 1024)}MB`);

// Criar array grande para forçar alocação
const bigArray = [];
for (let i = 0; i < 1000000; i++) {
  bigArray.push(new Array(1000).fill('x')); // ~1MB por item
}

const usageAfter = process.memoryUsage();
console.log(`Heap após alocação: ${Math.round(usageAfter.heapTotal / 1024 / 1024)}MB`);
console.log(`Uso: ${Math.round((usageAfter.heapUsed / usageAfter.heapTotal) * 100)}%`);

// Limpar
bigArray.length = 0;
if (global.gc) global.gc();

const usageAfterGC = process.memoryUsage();
console.log(`Heap após GC: ${Math.round(usageAfterGC.heapTotal / 1024 / 1024)}MB`);
console.log(`Uso após GC: ${Math.round((usageAfterGC.heapUsed / usageAfterGC.heapTotal) * 100)}%`);
