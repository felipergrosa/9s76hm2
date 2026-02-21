#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔧 Aplicando patch no schema-utils...');

// Encontrar todos os schema-utils que precisam de patch
const nodeModulesPath = path.join(__dirname, '../node_modules');
const schemaUtilsPaths = [];

function findSchemaUtils(dir) {
  try {
    const items = fs.readdirSync(dir);
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        if (item === 'schema-utils') {
          schemaUtilsPaths.push(fullPath);
        } else if (item !== 'node_modules' && !item.startsWith('.')) {
          findSchemaUtils(fullPath);
        }
      }
    }
  } catch (e) {
    // Ignorar erros de permissão
  }
}

findSchemaUtils(nodeModulesPath);

console.log(`📁 Encontrados ${schemaUtilsPaths.length} schema-utils`);

// Aplicar patch em cada um
for (const schemaUtilsPath of schemaUtilsPaths) {
  const validatePath = path.join(schemaUtilsPath, 'dist', 'validate.js');
  
  if (fs.existsSync(validatePath)) {
    console.log(`🔧 Patching: ${validatePath}`);
    
    let content = fs.readFileSync(validatePath, 'utf8');
    
    // Substituir a chamada problemática do ajv-keywords
    if (content.includes('ajvKeywords(')) {
      content = content.replace(
        /ajvKeywords\(/g,
        '// ajvKeywords('
      );
      
      fs.writeFileSync(validatePath, content);
      console.log('✅ Patch aplicado');
    }
  }
}

console.log('🎉 Patch concluído!');
