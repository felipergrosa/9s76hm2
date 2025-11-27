const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'components', 'QueueModal', 'index.js');

console.log('📖 Lendo arquivo...');
let content = fs.readFileSync(filePath, 'utf8');

console.log('\n🔧 Corrigindo value prop e adicionando mais proteções...\n');

// 1. Corrigir value={values.fileListId || ""} para value={values.folderId || ""}
console.log('1️⃣  Corrigindo value prop do Select de pastas...');
content = content.replace(
    /name="folderId"\s+value=\{values\.fileListId \|\| ""\}/,
    'name="folderId"\n                                                    value={values.folderId || ""}'
);

// 2. Adicionar filtro e proteção no map de folders (primeira ocorrência)
console.log('2️⃣  Adicionando filtro de segurança no map de folders (Principal)...');
content = content.replace(
    /\{\(folders \|\| \[\]\)\.map\(folder => \(/,
    '{(folders || []).filter(f => f).map(folder => ('
);

// 3. Adicionar filtro e proteção no map de folders (segunda ocorrência - chatbots)
console.log('3️⃣  Adicionando filtro de segurança no map de folders (Chatbots)...');
// A regex precisa ser específica para a segunda ocorrência ou usar replace global com cuidado
// Como a string de substituição é a mesma, podemos usar replace global se o contexto for igual
content = content.replace(
    /\{\(folders \|\| \[\]\)\.map\(folder => \(/g,
    '{(folders || []).filter(f => f).map(folder => ('
);

console.log('💾 Salvando alterações...');
fs.writeFileSync(filePath, content, 'utf8');

console.log('\n✅ Correções aplicadas!');
console.log('\nMudanças:');
console.log('  ✅ value prop corrigido para values.folderId');
console.log('  ✅ folders.map agora filtra itens nulos/undefined');
console.log('\n🎯 Recarregue a página!');
