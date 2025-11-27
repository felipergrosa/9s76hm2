const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'components', 'QueueModal', 'index.js');

console.log('📖 Lendo arquivo...');
let content = fs.readFileSync(filePath, 'utf8');

console.log('\n🔧 Adicionando logs de debug...\n');

// Adicionar logs no useEffect de pastas
content = content.replace(
    /const \{ data \} = await api\.get\("\/library\/folders".*?\);/,
    `const { data } = await api.get("/library/folders", { params: { companyId } });
                console.log("📊 Pastas carregadas:", data);`
);

console.log('💾 Salvando alterações...');
fs.writeFileSync(filePath, content, 'utf8');

console.log('\n✅ Logs adicionados! Abra o console do navegador (F12) para ver.');
