const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'components', 'QueueModal', 'index.js');

console.log('📖 Lendo arquivo...');
let content = fs.readFileSync(filePath, 'utf8');

console.log('\n🔧 Aplicando correções COMPLETAS...\n');

// 1. Adicionar estado folders (se não existir)
if (!content.includes('const [folders, setFolders]')) {
    console.log('1️⃣  Adicionando estado folders...');
    content = content.replace(
        /(const \[file, setFile\] = useState\(\[\]\);)/,
        '$1\n    const [folders, setFolders] = useState([]);  // Pastas do File Manager'
    );
} else {
    console.log('1️⃣  Estado folders já existe ✓');
}

// 2. Adicionar useEffect para buscar pastas (se não existir)
if (!content.includes('api.get("/library/folders"')) {
    console.log('2️⃣  Adicionando useEffect para buscar pastas...');

    const foldersUseEffect = `
    // Buscar pastas do File Manager
    useEffect(() => {
        (async () => {
            try {
                const { data } = await api.get("/library/folders", { params: { companyId } });
                setFolders(data.folders || data);
            } catch (err) {
                toastError(err);
            }
        })();
    }, []);
`;

    // Inserir após o useEffect de /files/
    content = content.replace(
        /(useEffect\(\(\) => \{[\s\S]*?api\.get\("\/files\/"[\s\S]*?\}\);[\s\S]*?\}, \[\]\);)/,
        '$1' + foldersUseEffect
    );
} else {
    console.log('2️⃣  useEffect de pastas já existe ✓');
}

// 3. Corrigir TODAS as referências `f` para `folder` onde usa folders.map
console.log('3️⃣  Corrigindo referências de variáveis...');

// Substituir folders.map(f => por folders.map(folder =>
content = content.replace(
    /\{folders\.map\(f\s*=>/g,
    '{folders.map(folder =>'
);

// Substituir f.id por folder.id dentro de folders.map
content = content.replace(
    /(folders\.map\(folder[^)]*\)[\s\S]*?value=\{)f\.id(\})/g,
    '$1folder.id$2'
);

// Substituir f.name por folder.name dentro de folders.map  
content = content.replace(
    /(folders\.map\(folder[^)]*\)[\s\S]*?)f\.name/g,
    '$1folder.name'
);

console.log('💾 Salvando alterações...');
fs.writeFileSync(filePath, content, 'utf8');

console.log('\n✅ TODAS as correções aplicadas!');
console.log('\nMudanças:');
console.log('  ✅ Estado folders definido');
console.log('  ✅ useEffect busca pastas');
console.log('  ✅ Variáveis corrigidas (f → folder)');
console.log('\n🎯 Compile novamente!');
