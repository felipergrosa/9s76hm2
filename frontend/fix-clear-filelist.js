const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'components', 'QueueModal', 'index.js');

console.log('📖 Lendo arquivo...');
let content = fs.readFileSync(filePath, 'utf8');

console.log('\n🔧 Adicionando onChange para limpar fileListId...\n');

// Encontrar o Field do folderId e adicionar onChange
const fieldRegex = /(<Field\s+as=\{Select\}\s+label="Arquivos"\s+name="folderId"\s+value=\{values\.folderId \|\| ""\})/;
const replacement = `$1
                          onChange={(e) => {
                            setFieldValue("folderId", e.target.value);
                            setFieldValue("fileListId", null); // Limpa fileListId ao selecionar pasta
                          }}`;

content = content.replace(fieldRegex, replacement);

console.log('💾 Salvando alterações...');
fs.writeFileSync(filePath, content, 'utf8');

console.log('\n✅ Lógica de limpeza adicionada!');
