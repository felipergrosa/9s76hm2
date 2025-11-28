const fs = require('fs');
const path = require('path');

const helpsDir = path.join(__dirname, 'src', 'pages', 'Helps');

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

    // Remove qualquer import duplicado de Alert de @material-ui/lab
    content = content.replace(/import { Alert } from "@material-ui\/lab";\n/g, '');
    content = content.replace(/import { Alert } from '@material-ui\/lab';\n/g, '');

    // Remove Alert das importações de @material-ui/core
    content = content.replace(/,\s*Alert,/g, ',');
    content = content.replace(/Alert,\s*/g, '');
    content = content.replace(/,\s*Alert\s*}/g, ' }');
    content = content.replace(/{\s*Alert\s*,/g, '{');

    // Encontra a linha de import de @material-ui/core e adiciona Alert de @material-ui/lab logo depois
    const lines = content.split('\n');
    const newLines = [];
    let alertAdded = false;

    for (let i = 0; i < lines.length; i++) {
        newLines.push(lines[i]);

        // Se encontrar o fechamento do import de @material-ui/core e ainda não adicionou Alert
        if (!alertAdded && lines[i].includes('} from "@material-ui/core"')) {
            newLines.push('import { Alert } from "@material-ui/lab";');
            alertAdded = true;
        } else if (!alertAdded && lines[i].includes("} from '@material-ui/core'")) {
            newLines.push("import { Alert } from '@material-ui/lab';");
            alertAdded = true;
        }
    }

    fs.writeFileSync(filePath, newLines.join('\n'), 'utf8');
    console.log(`✅ Corrigido: ${fileName}`);
});

console.log('\n✅ Processo concluído!');
