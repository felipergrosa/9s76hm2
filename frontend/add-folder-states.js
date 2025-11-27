const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'components', 'QueueModal', 'index.js');

console.log('📖 Lendo arquivo...');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Adicionar folderId ao initialState (após fileListId)
console.log('✏️  Adicionando folderId ao initialState...');
content = content.replace(
    /fileListId: "",/,
    'fileListId: "",\n        folderId: "",  // ID da pasta do File Manager'
);

// 2. Adicionar estado folders (após setFile)
console.log('✏️  Adicionando estado folders...');
content = content.replace(
    /const \[file, setFile\] = useState\(\[\]\);/,
    'const [file, setFile] = useState([]);\n    const [folders, setFolders] = useState([]);  // Pastas do File Manager'
);

// 3. Adicionar useEffect para buscar pastas (após busca de files)
console.log('✏️  Adicionando useEffect para buscar pastas...');
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

// Encontrar onde inserir (após o useEffect de /files/)
content = content.replace(
    /(useEffect\(\(\) => \{[\s\S]*?api\.get\("\/files\/"[\s\S]*?\}\);[\s\S]*?\}, \[\]\);)/,
    '$1' + foldersUseEffect
);

// 4. Adicionar folderId ao setQueue quando carregar dados
console.log('✏️  Adicionando folderId ao setQueue...');
content = content.replace(
    /(ragCollection: data\.ragCollection \|\| "")/,
    '$1,\n                    folderId: data.folderId || ""'
);

console.log('💾 Salvando alterações...');
fs.writeFileSync(filePath, content, 'utf8');

console.log('✅ Estados adicionados com sucesso!');
console.log('\nModificações feitas:');
console.log('  1. ✅ folderId no initialState');
console.log('  2. ✅ Estado folders criado');
console.log('  3. ✅ useEffect para buscar pastas');
console.log('  4. ✅ folderId no setQueue');
console.log('\nPróximo passo: Adicionar campo na Tab Bot Inteligente');
