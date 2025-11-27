const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'components', 'QueueModal', 'index.js');

console.log('📖 Lendo arquivo...');
let content = fs.readFileSync(filePath, 'utf8');

console.log('\n🔧 Aplicando correções...\n');

// 1. Trocar o nome do campo de fileListId para folderId na seção de Pastas
console.log('1️⃣  Trocando name="fileListId" para name="folderId" no campo de pastas...');

// Encontrar a seção específica e trocar
content = content.replace(
    /(📁 Envio Inteligente de Arquivos[\s\S]*?<Field[\s\S]*?)name="fileListId"/,
    '$1name="folderId"'
);

// 2. Trocar file.map para folders.map
console.log('2️⃣  Trocando {file.map para {folders.map...');
content = content.replace(
    /(\{file\.map\(f\s*=>)/g,
    '{folders.map(folder =>'
);

// Trocar a variável f por folder nas referências
content = content.replace(
    /(folders\.map\(folder.*?value=\{)f\.id/g,
    '$1folder.id'
);

content = content.replace(
    /(folders\.map\(folder.*?📁\s*\{)f\.name/g,
    '$1folder.name'
);

// 3. Adicionar a opção "Tudo" de volta com value="-1" (número)
console.log('3️⃣  Adicionando opção "Tudo" com value corretovalor numérico...');

// Encontrar onde adicionar (depois de <MenuItem value="">Nenhuma</MenuItem>)
content = content.replace(
    /(<InputLabel>Pasta de Arquivos<\/InputLabel>[\s\S]*?<MenuItem value="">Nenhuma<\/MenuItem>)/,
    '$1\n                                                    <MenuItem value={-1}>📁 Tudo (Todas as Pastas)</MenuItem>'
);

console.log('💾 Salvando alterações...');
fs.writeFileSync(filePath, content, 'utf8');

console.log('\n✅ Correções aplicadas com sucesso!');
console.log('\nMudanças feitas:');
console.log('  ✅ Campo usa name="folderId" agora');
console.log('  ✅ Mapeia {folders} em vez de {file}');
console.log('  ✅ Opção "Tudo" adicionada com value={-1}');
console.log('\n🎯 Agora deve funcionar perfeitamente!');
