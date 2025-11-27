const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'components', 'QueueModal', 'index.js');

console.log('Lendo arquivo:', filePath);
let content = fs.readFileSync(filePath, 'utf8');

// Remover a opção "Tudo" que causa erro no backend
content = content.replace(
    '<MenuItem value="">Nenhuma</MenuItem>\n                          <MenuItem value="all">📁 Tudo (Todas as Pastas)</MenuItem>',
    '<MenuItem value="">Nenhuma</MenuItem>'
);

console.log('Salvando alterações...');
fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ Opção "Tudo" removida temporariamente');
console.log('\nMotivo: Backend espera fileListId como número ou null');
console.log('A opção "Tudo" requer implementação no backend');
