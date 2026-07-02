const fs = require('fs');
const path = require('path');

const srcDir = path.resolve(__dirname, '../src/database/migrations');
const destDir = path.resolve(__dirname, '../dist/database/migrations');

if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

try {
  const files = fs.readdirSync(srcDir);
  let copiedCount = 0;
  
  files.forEach(file => {
    if (file.endsWith('.js')) {
      const srcFile = path.join(srcDir, file);
      const destFile = path.join(destDir, file);
      fs.copyFileSync(srcFile, destFile);
      copiedCount++;
    }
  });
  
  console.log(`✅ Migrações JS copiadas para dist/database/migrations (${copiedCount} arquivos)`);
} catch (error) {
  console.error('❌ Erro ao copiar migrações JS:', error);
  process.exit(1);
}
