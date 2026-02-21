// 🛠️ SCRIPT PARA RESETAR SESSÃO WHATSAPP CORROMPIDA
// Execute: node reset-whatsapp-session.js

const fs = require('fs');
const path = require('path');

console.log('🔧 INICIANDO RESET DE SESSÃO WHATSAPP...');

// 1. Limpar arquivos de sessão local
const sessionPath = path.join(__dirname, 'backend/private/sessions');
if (fs.existsSync(sessionPath)) {
  console.log('📁 Limpando arquivos de sessão local...');
  try {
    fs.rmSync(sessionPath, { recursive: true, force: true });
    console.log('✅ Arquivos de sessão local removidos');
  } catch (error) {
    console.log('⚠️  Erro ao remover arquivos locais:', error.message);
  }
}

// 2. Limpar cache Redis (se disponível)
console.log('🗄️  Limpar cache Redis...');
try {
  const redis = require('redis');
  const client = redis.createClient({
    url: 'redis://127.0.0.1:6379/0'
  });
  
  client.on('error', (err) => {
    console.log('⚠️  Redis não disponível:', err.message);
  });
  
  client.connect().then(() => {
    return client.flushAll();
  }).then(() => {
    console.log('✅ Cache Redis limpo');
    client.disconnect();
  }).catch(() => {
    console.log('⚠️  Redis não conectado');
  });
} catch (error) {
  console.log('⚠️  Redis não disponível');
}

console.log('');
console.log('🎯 PRÓXIMOS PASSOS:');
console.log('1. Reinicie o backend: npm run dev');
console.log('2. Desconecte e reconecte o WhatsApp no frontend');
console.log('3. Escaneie o QR code novamente');
console.log('');
console.log('✅ Reset concluído!');
