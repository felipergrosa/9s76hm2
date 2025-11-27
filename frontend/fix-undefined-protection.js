const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'components', 'QueueModal', 'index.js');

console.log('📖 Lendo arquivo...');
let content = fs.readFileSync(filePath, 'utf8');

console.log('\n🔧 Adicionando proteções contra undefined...\n');

// 1. Corrigir useEffect que busca pastas para ter verificação
console.log('1️⃣  Adicionando verificações de segurança no useEffect de pastas...');

// Encontrar e substituir o useEffect de pastas
content = content.replace(
    /(\/\/ Buscar pastas do File Manager[\s\S]*?useEffect\(\(\) => \{[\s\S]*?)const \{ data \} = await api\.get\("\/library\/folders".*?\);[\s\S]*?setFolders\(data\.folders \|\| data\);/,
    `$1const { data } = await api.get("/library/folders", { params: { companyId } });
                // Proteção contra undefined
                const foldersList = data?.folders || data || [];
                setFolders(Array.isArray(foldersList) ? foldersList : []);`
);

// 2. Adicionar verificação no map de folders
console.log('2️⃣  Adicionando verificação no map de folders...');

content = content.replace(
    /\{folders\.map\(/g,
    '{(folders || []).map('
);

console.log('💾 Salvando alterações...');
fs.writeFileSync(filePath, content, 'utf8');

console.log('\n✅ Proteções adicionadas!');
console.log('\nMudanças:');
console.log('  ✅ useEffect com verificação de undefined');
console.log('  ✅ folders.map com fallback para array vazio');
console.log('\n🎯 Recarregue a página!');
