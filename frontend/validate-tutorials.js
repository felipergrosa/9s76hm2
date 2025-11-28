const fs = require('fs');
const path = require('path');

const helpsDir = path.join(__dirname, 'src', 'pages', 'Helps');

const tutorialFiles = [
    'AgendamentosTutorial.js',
    'AITutorial.js',
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

const issues = [];

tutorialFiles.forEach(fileName => {
    const filePath = path.join(helpsDir, fileName);

    if (!fs.existsSync(filePath)) {
        issues.push({ file: fileName, type: 'MISSING', detail: 'File not found' });
        return;
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    // Check for duplicate Alert imports
    const alertImports = lines.filter(line =>
        line.includes('import') && line.includes('Alert')
    );
    if (alertImports.length > 1) {
        issues.push({
            file: fileName,
            type: 'DUPLICATE_IMPORT',
            detail: `Alert imported ${alertImports.length} times`,
            lines: alertImports
        });
    }

    // Check for Alert from wrong package
    const wrongAlertImport = lines.find(line =>
        line.includes('import') &&
        line.includes('Alert') &&
        line.includes('@material-ui/core')
    );
    if (wrongAlertImport) {
        issues.push({
            file: fileName,
            type: 'WRONG_PACKAGE',
            detail: 'Alert imported from @material-ui/core instead of @material-ui/lab',
            line: wrongAlertImport.trim()
        });
    }

    // Check for scrambled content (lines that look out of place)
    const firstImportLine = lines.findIndex(line => line.includes('import'));
    if (firstImportLine < 0) {
        issues.push({
            file: fileName,
            type: 'NO_IMPORTS',
            detail: 'No import statements found'
        });
    }

    // Check for basic syntax issues
    const exportDefaultLine = lines.findIndex(line => line.includes('export default'));
    if (exportDefaultLine < 0) {
        issues.push({
            file: fileName,
            type: 'NO_EXPORT',
            detail: 'No export default found'
        });
    }

    // Check for unclosed tags (basic check)
    const openTags = (content.match(/<[A-Z]\w+/g) || []).length;
    const closeTags = (content.match(/<\/[A-Z]\w+>/g) || []).length;
    const selfClosingTags = (content.match(/<[A-Z]\w+[^>]*\/>/g) || []).length;

    if (openTags !== closeTags + selfClosingTags) {
        issues.push({
            file: fileName,
            type: 'TAG_MISMATCH',
            detail: `Possible unclosed tags: ${openTags} open, ${closeTags} close, ${selfClosingTags} self-closing`
        });
    }
});

console.log('\n=== VALIDATION RESULTS ===\n');

if (issues.length === 0) {
    console.log('✅ No issues found in any tutorial files!');
} else {
    console.log(`❌ Found ${issues.length} issue(s):\n`);

    issues.forEach((issue, i) => {
        console.log(`${i + 1}. ${issue.file}`);
        console.log(`   Type: ${issue.type}`);
        console.log(`   Detail: ${issue.detail}`);
        if (issue.line) console.log(`   Line: ${issue.line}`);
        if (issue.lines) {
            console.log(`   Lines:\n   ${issue.lines.join('\n   ')}`);
        }
        console.log('');
    });
}

console.log('\n=== END ===\n');
