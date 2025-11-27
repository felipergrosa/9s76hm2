const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'components', 'QueueModal', 'index.js');

console.log('Lendo arquivo:', filePath);
let content = fs.readFileSync(filePath, 'utf8');

// APENAS reorganizar ordem das tabs - nada mais!
// Trocar ordem dos labels
content = content.replace(
    /<Tab label=\{i18n\.t\("queueModal\.tabs\.general"\)\} \/>\s*<Tab label=\{i18n\.t\("queueModal\.tabs\.schedules"\)\} \/>/,
    '<Tab label={i18n.t("queueModal.tabs.general")} />\n                    <Tab label={i18n.t("queueModal.tabs.schedules")} />'
);

console.log('Salvando alterações...');
fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ Arquivo restaurado para versão funcional!');
console.log('\nApenas mantendo as mudanças que funcionam:');
console.log('- Seletor RAG (já estava funcionando)');
console.log('- Estrutura original de file lists');
