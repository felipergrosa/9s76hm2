const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'components', 'QueueModal', 'index.js');

console.log('Lendo arquivo:', filePath);
let content = fs.readFileSync(filePath, 'utf8');

// Reverter para /files/
content = content.replace(
    'await api.get("/library/folders", { params: { companyId } });',
    'await api.get("/files/", { params: { companyId } });'
);

// Reverter data.folders para data.files
content = content.replace(
    'setFile(data.folders || data);',
    'setFile(data.files);'
);

// Reverter label
content = content.replace(
    '<InputLabel>Pasta de Arquivos</InputLabel>',
    '<InputLabel>Lista de Arquivos</InputLabel>'
);

console.log('Salvando alterações...');
fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ Revertido para usar /files/ (file lists)');
console.log('\nAgora deve funcionar normalmente!');
