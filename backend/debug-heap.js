// Script para verificar heap size
console.log('=== VERIFICAÇÃO DE HEAP ===');
console.log('NODE_OPTIONS:', process.env.NODE_OPTIONS);
console.log('max-old-space-size:', process.execArgv.find(arg => arg.includes('max-old-space-size')));

const usage = process.memoryUsage();
console.log(`Heap Total: ${Math.round(usage.heapTotal / 1024 / 1024)}MB`);
console.log(`Heap Used: ${Math.round(usage.heapUsed / 1024 / 1024)}MB`);
console.log(`Uso: ${Math.round((usage.heapUsed / usage.heapTotal) * 100)}%`);

// Verificar se GC está disponível
if (global.gc) {
  console.log('✅ Garbage Collection disponível');
} else {
  console.log('❌ Garbage Collection NÃO disponível');
}
