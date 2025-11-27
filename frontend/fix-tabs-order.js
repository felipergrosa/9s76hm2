const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'components', 'QueueModal', 'index.js');

console.log('Lendo arquivo:', filePath);
let content = fs.readFileSync(filePath, 'utf8');

// 1. Trocar ordem dos labels das tabs
content = content.replace(
    '<Tab label="🤖 Bot Inteligente" />\n                    <Tab label="📋 Dados + Chatbot" />',
    '<Tab label="📋 Dados + Chatbot" />\n                    <Tab label="🤖 Bot Inteligente" />'
);

// 2. Trocar índice da Tab Bot Inteligente de 0 para 1
content = content.replace(
    '{/* TAB 1: BOT INTELIGENTE (RAG + ARQUIVOS) */}\n                <TabPanel value={tab} index={0}>',
    '{/* TAB 1: BOT INTELIGENTE (RAG + ARQUIVOS) */}\n                <TabPanel value={tab} index={1}>'
);

// 3. Trocar índice da Tab Dados + Chatbot de 1 para 0
content = content.replace(
    '{/* TAB 2: DADOS + CHATBOT */}\n                <TabPanel value={tab} index={1}>',
    '{/* TAB 0: DADOS + CHATBOT */}\n                <TabPanel value={tab} index={0}>'
);

console.log('Salvando alterações...');
fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ Ordem das tabs corrigida!');
console.log('\nNova ordem:');
console.log('Tab 0: 📋 Dados + Chatbot');
console.log('Tab 1: 🤖 Bot Inteligente');
console.log('Tab 2: 🕐 Horários');
console.log('Tab 3: 💡 Dicas');
