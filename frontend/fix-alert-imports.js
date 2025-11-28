const fs = require('fs');
const path = require('path');

const helpsDir = path.join(__dirname, 'src', 'pages', 'Helps');

// Lista de arquivos que precisam ser corrigidos
const files = [
    'AgendamentosTutorial.js',
    'APITutorial.js',
    'ArquivosChatbotTutorial.js',
    'AtendimentosTutorial.js',
    'BotTutorial.js',
    'CampanhasTutorial.js',
    'ChatInternoTutorial.js',
    'ConexoesWhatsAppTutorial.js',
    'ConfiguracoesTutorial.js',
    'ContatosTutorial.js',
    'DashboardTutorial.js',
    'FilaChatbotTutorial.js',
    'FinanceiroTutorial.js',
    'FlowBuilderTutorial.js',
    'IntegracoesTutorial.js',
    'KanbanTutorial.js',
    'ListasContatosTutorial.js',
    'PromptsIATutorial.js',
    'RelatoriosTutorial.js',
    'RespostasRapidasTutorial.js',
    'TagsTutorial.js',
    'UsuariosTutorial.js'
];

files.forEach(fileName => {
    const filePath = path.join(helpsDir, fileName);

    if (!fs.existsSync(filePath)) {
        console.log(`Arquivo não encontrado: ${fileName}`);
        return;
    }

    let content = fs.readFileSync(filePath, 'utf8');

    // Procura por linhas que importam Alert de @material-ui/core
    const lines = content.split('\n');
    let modified = false;
    let newLines = [];
    let alertImportAdded = false;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Se encontrar import de @material-ui/core com Alert
        if (line.includes('from "@material-ui/core"') || line.includes("from '@material-ui/core'")) {
            // Remove Alert da linha
            const newLine = line.replace(/,?\s*Alert,?/, '').replace(/,\s*,/, ',').replace(/,\s*}/, ' }');
            newLines.push(newLine);
            modified = true;

            // Adiciona import do Alert de @material-ui/lab logo após
            if (!alertImportAdded) {
                newLines.push('import { Alert } from "@material-ui/lab";');
                alertImportAdded = true;
            }
        } else {
            newLines.push(line);
        }
    }

    if (modified) {
        fs.writeFileSync(filePath, newLines.join('\n'), 'utf8');
        console.log(`✅ Corrigido: ${fileName}`);
    } else {
        console.log(`⏭️  Sem mudanças: ${fileName}`);
    }
});

console.log('\n✅ Processo concluído!');
