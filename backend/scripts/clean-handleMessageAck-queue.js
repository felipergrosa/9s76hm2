const BullQueue = require('bull');

const connection = process.env.REDIS_URI || "redis://localhost:6379";

const queue = new BullQueue("BaileysMessageQueue", connection);

async function cleanQueue() {
  console.log('[Cleaner] Limpando fila handleMessageAck...');
  
  // Limpar jobs pendentes
  const waiting = await queue.getWaiting();
  const delayed = await queue.getDelayed();
  const failed = await queue.getFailed();
  
  console.log(`[Cleaner] Encontrados: ${waiting.length} waiting, ${delayed.length} delayed, ${failed.length} failed`);
  
  // Remover todos os jobs
  for (const job of waiting) {
    if (job.name === 'handleMessageAck') {
      await job.remove();
      console.log(`[Cleaner] Removido job ${job.id}`);
    }
  }
  
  for (const job of delayed) {
    if (job.name === 'handleMessageAck') {
      await job.remove();
      console.log(`[Cleaner] Removido job delayed ${job.id}`);
    }
  }
  
  for (const job of failed) {
    if (job.name === 'handleMessageAck') {
      await job.remove();
      console.log(`[Cleaner] Removido job failed ${job.id}`);
    }
  }
  
  // Também limpar jobs ativos se houver
  const active = await queue.getActive();
  console.log(`[Cleaner] Jobs ativos: ${active.length}`);
  
  console.log('[Cleaner] Fila limpa!');
  process.exit(0);
}

cleanQueue().catch(err => {
  console.error('[Cleaner] Erro:', err);
  process.exit(1);
});
