const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'components', 'QueueModal', 'index.js');

console.log('Lendo arquivo:', filePath);
let content = fs.readFileSync(filePath, 'utf8');

// 1. Trocar endpoint de /files/ para /library/folders
content = content.replace(
    'await api.get("/files/", { params: { companyId } });',
    'await api.get("/library/folders", { params: { companyId } });'
);

// 2. Trocar data.files para data.folders || data
content = content.replace(
    'setFile(data.files);',
    'setFile(data.folders || data);'
);

// 3. Trocar label "Arquivos" para "Pasta de Arquivos"
content = content.replace(
    '<InputLabel>Arquivos</InputLabel>',
    '<InputLabel>Pasta de Arquivos</InputLabel>'
);

// 4. Trocar "Nenhuma Arquivos" para "Nenhuma"
content = content.replace(
    '<MenuItem value="">Nenhuma Arquivos</MenuItem>',
    '<MenuItem value="">Nenhuma</MenuItem>\n                          <MenuItem value="all">📁 Tudo (Todas as Pastas)</MenuItem>'
);

// 5. Adicionar ícone de pasta nos itens
content = content.replace(
    /{file.map\(f => \(\s*<MenuItem key={f.id} value={f.id}>\s*{f.name}/g,
    '{file.map(f => (\n                            <MenuItem key={f.id} value={f.id}>\n                              📁 {f.name}'
);

console.log('Salvando alterações...');
fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ Arquivo atualizado com sucesso!');
console.log('\nMudanças aplicadas:');
console.log('1. Endpoint alterado para /library/folders');
console.log('2. Dados alterados para data.folders');
console.log('3. Label alterado para "Pasta de Arquivos"');
console.log('4. Adicionada opção "Tudo (Todas as Pastas)"');
console.log('5. Adicionados ícones de pasta 📁');
