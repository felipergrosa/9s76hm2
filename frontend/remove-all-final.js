const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'components', 'QueueModal', 'index.js');

console.log('📖 Lendo arquivo...');
let content = fs.readFileSync(filePath, 'utf8');

// Remover APENAS a linha com value="all"
console.log('✏️  Removendo opção "all"...');
content = content.replace(
    /\s*<MenuItem value="all">📁 Tudo \(Todas as Pastas\)<\/MenuItem>\r?\n/g,
    ''
);

console.log('💾 Salvando alterações...');
fs.writeFileSync(filePath, content, 'utf8');

console.log('✅ Opção "all" removida com sucesso!');
console.log('\nAgora deve salvar sem erro!');
