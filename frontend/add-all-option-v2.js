const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'components', 'QueueModal', 'index.js');

console.log('Lendo arquivo:', filePath);
let content = fs.readFileSync(filePath, 'utf8');

// Adicionar opção "Tudo" com value="-1"
content = content.replace(
    '<MenuItem value="">Nenhuma</MenuItem>',
    '<MenuItem value="">Nenhuma</MenuItem>\n                          <MenuItem value="-1">📁 Tudo (Todas as Pastas)</MenuItem>'
);

console.log('Salvando alterações...');
fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ Opção "Tudo" adicionada com value=-1');
console.log('\nPróximo passo: Ajustar backend para aceitar fileListId: -1');
