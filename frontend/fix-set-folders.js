const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'components', 'QueueModal', 'index.js');

console.log('📖 Lendo arquivo...');
let content = fs.readFileSync(filePath, 'utf8');

console.log('\n🔧 Corrigindo setFile para setFolders...\n');

// Corrigir setFile(data.folders || data) para setFolders(...)
content = content.replace(
    /setFile\(data\.folders \|\| data\);/,
    'setFolders(data.folders || data);'
);

// Remover logs excessivos de renderização (opcional, mas bom pra limpar)
console.log('🧹 Removendo logs de renderização...');
content = content.replace(
    /console\.log\("🎨 Renderizando QueueModal\. Folders:", folders\);\s*/,
    ''
);

// Restaurar map limpo (sem logs internos)
console.log('🧹 Restaurando map limpo...');
const mapWithLogsRegex = /\{console\.log\("🔄 Iniciando map de folders\.\.\.", folders\) \|\| \(folders \|\| \[\]\)\.map\(folder => \{[\s\S]*?return \([\s\S]*?\}\)\)\}/g;
const cleanMapBlock = `{(folders || []).map(folder => (
                                                    <MenuItem key={folder.id} value={folder.id}>
                                                        📁 {folder.name}
                                                    </MenuItem>
                                                ))}`;

content = content.replace(mapWithLogsRegex, cleanMapBlock);

console.log('💾 Salvando alterações...');
fs.writeFileSync(filePath, content, 'utf8');

console.log('\n✅ Correção aplicada: setFile -> setFolders');
