const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'components', 'QueueModal', 'index.js');

console.log('📖 Lendo arquivo...');
let content = fs.readFileSync(filePath, 'utf8');

console.log('\n🔧 Adicionando logs de renderização e simplificando map...\n');

// 1. Adicionar log no início do render (antes do return)
if (!content.includes('console.log("🎨 Renderizando QueueModal. Folders:", folders);')) {
    console.log('1️⃣  Adicionando log de renderização...');
    content = content.replace(
        /(return \(\s*<div className=\{classes\.root\}>)/,
        'console.log("🎨 Renderizando QueueModal. Folders:", folders);\n    $1'
    );
}

// 2. Simplificar o map e adicionar log dentro dele
console.log('2️⃣  Simplificando map e adicionando log interno...');

// Substituir o bloco do map antigo por um com log e sem filter
const oldMapRegex = /\{\(folders \|\| \[\]\)\.filter\(f => f\)\.map\(folder => \([\s\S]*?\}\)\)\}/;
const newMapBlock = `{console.log("🔄 Iniciando map de folders...", folders) || (folders || []).map(folder => {
                                                        console.log("  ➡️ Renderizando item:", folder.name);
                                                        return (
                                                            <MenuItem key={folder.id} value={folder.id}>
                                                                📁 {folder.name}
                                                            </MenuItem>
                                                        );
                                                    })}`;

// Aplicar substituição na primeira ocorrência (Tab Bot Inteligente)
content = content.replace(oldMapRegex, newMapBlock);

// Aplicar na segunda ocorrência (Chatbots) se houver
content = content.replace(oldMapRegex, newMapBlock);

console.log('💾 Salvando alterações...');
fs.writeFileSync(filePath, content, 'utf8');

console.log('\n✅ Logs de renderização adicionados!');
