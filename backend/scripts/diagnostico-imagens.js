/**
 * DIAGNÓSTICO DE IMAGENS
 * 
 * Este script verifica se as imagens estão sendo salvas e servidas corretamente
 */

const fs = require('fs');
const path = require('path');
const { Sequelize } = require('sequelize');

// Carregar variáveis de ambiente
require('dotenv').config();

// Conectar ao banco
const sequelize = new Sequelize({
  dialect: process.env.DB_DIALECT || 'postgres',
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  username: process.env.DB_USER,
  password: process.env.DB_PASS,
  logging: false
});

async function diagnosticar() {
  console.log('\n🔍 DIAGNÓSTICO DE IMAGENS\n');
  console.log('━'.repeat(60));
  
  try {
    // 1. Verificar conexão com banco
    console.log('\n1️⃣  Testando conexão com banco de dados...');
    await sequelize.authenticate();
    console.log('   ✅ Conectado ao banco');
    
    // 2. Buscar mensagens com mídia recentes
    console.log('\n2️⃣  Buscando mensagens com mídia...');
    const [messages] = await sequelize.query(`
      SELECT 
        m.id,
        m."ticketId",
        m."contactId",
        m."mediaUrl",
        m."mediaType",
        m."fromMe",
        m."companyId",
        m."createdAt",
        c.name as "contactName"
      FROM "Messages" m
      LEFT JOIN "Contacts" c ON c.id = m."contactId"
      WHERE m."mediaUrl" IS NOT NULL
        AND m."mediaType" IN ('image', 'audio', 'video', 'document')
      ORDER BY m.id DESC
      LIMIT 10
    `);
    
    console.log(`   📊 Encontradas ${messages.length} mensagens com mídia`);
    
    if (messages.length === 0) {
      console.log('\n   ⚠️  Nenhuma mensagem com mídia encontrada!');
      console.log('   💡 Envie uma imagem de teste pelo WhatsApp\n');
      return;
    }
    
    // 3. Verificar cada mensagem
    console.log('\n3️⃣  Verificando arquivos físicos...\n');
    
    const publicDir = path.resolve(__dirname, '..', 'public');
    console.log(`   📁 Diretório público: ${publicDir}\n`);
    
    let encontrados = 0;
    let naoEncontrados = 0;
    let problemas = [];
    
    for (const msg of messages) {
      const { id, mediaUrl, mediaType, fromMe, companyId, contactName, createdAt } = msg;
      
      console.log(`   ┌─ Mensagem #${id}`);
      console.log(`   │  Contato: ${contactName || 'N/A'}`);
      console.log(`   │  Tipo: ${mediaType}`);
      console.log(`   │  De mim: ${fromMe ? 'Sim' : 'Não'}`);
      console.log(`   │  Data: ${new Date(createdAt).toLocaleString('pt-BR')}`);
      console.log(`   │  mediaUrl no banco: ${mediaUrl}`);
      
      // Construir caminho esperado
      const filePath = path.join(publicDir, `company${companyId}`, mediaUrl);
      console.log(`   │  Caminho esperado: ${filePath}`);
      
      // Verificar se arquivo existe
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
        console.log(`   │  ✅ Arquivo existe! (${sizeMB} MB)`);
        
        // Verificar permissões
        try {
          fs.accessSync(filePath, fs.constants.R_OK);
          console.log(`   │  ✅ Permissões OK (leitura)`);
        } catch {
          console.log(`   │  ❌ Sem permissão de leitura!`);
          problemas.push({
            id,
            problema: 'Sem permissão de leitura',
            arquivo: filePath
          });
        }
        
        encontrados++;
      } else {
        console.log(`   │  ❌ Arquivo NÃO encontrado!`);
        naoEncontrados++;
        
        // Verificar se pasta existe
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
          console.log(`   │  ⚠️  Pasta não existe: ${dir}`);
          problemas.push({
            id,
            problema: 'Pasta não existe',
            pasta: dir
          });
        } else {
          console.log(`   │  ✓  Pasta existe, mas arquivo não`);
          
          // Listar arquivos na pasta
          const files = fs.readdirSync(dir);
          console.log(`   │  📂 Arquivos na pasta (${files.length}):`);
          files.slice(0, 3).forEach(f => {
            console.log(`   │     - ${f}`);
          });
          if (files.length > 3) {
            console.log(`   │     ... e mais ${files.length - 3} arquivos`);
          }
          
          problemas.push({
            id,
            problema: 'Arquivo não foi salvo',
            esperado: filePath
          });
        }
      }
      
      // Construir URL que deveria funcionar
      const backendUrl = process.env.BACKEND_URL || 'http://localhost:8080';
      const urlPublica = `${backendUrl}/public/company${companyId}/${mediaUrl}`;
      console.log(`   │  🌐 URL pública: ${urlPublica}`);
      console.log(`   └─`);
      console.log('');
    }
    
    // 4. Resumo
    console.log('\n4️⃣  RESUMO\n');
    console.log(`   Total de mensagens: ${messages.length}`);
    console.log(`   ✅ Arquivos encontrados: ${encontrados}`);
    console.log(`   ❌ Arquivos não encontrados: ${naoEncontrados}`);
    
    if (problemas.length > 0) {
      console.log(`\n   ⚠️  PROBLEMAS DETECTADOS (${problemas.length}):\n`);
      problemas.forEach((p, i) => {
        console.log(`   ${i + 1}. Mensagem #${p.id}: ${p.problema}`);
        if (p.arquivo) console.log(`      Arquivo: ${p.arquivo}`);
        if (p.pasta) console.log(`      Pasta: ${p.pasta}`);
        if (p.esperado) console.log(`      Esperado: ${p.esperado}`);
        console.log('');
      });
    }
    
    // 5. Verificar variáveis de ambiente
    console.log('\n5️⃣  VARIÁVEIS DE AMBIENTE\n');
    console.log(`   BACKEND_URL: ${process.env.BACKEND_URL || '❌ NÃO DEFINIDO'}`);
    console.log(`   FRONTEND_URL: ${process.env.FRONTEND_URL || '❌ NÃO DEFINIDO'}`);
    console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
    
    // 6. Verificar estrutura de pastas
    console.log('\n6️⃣  ESTRUTURA DE PASTAS\n');
    const companies = fs.readdirSync(publicDir)
      .filter(f => f.startsWith('company'))
      .sort();
    
    if (companies.length === 0) {
      console.log('   ⚠️  Nenhuma pasta company* encontrada!');
    } else {
      companies.forEach(company => {
        const companyPath = path.join(publicDir, company);
        const contacts = fs.readdirSync(companyPath)
          .filter(f => fs.statSync(path.join(companyPath, f)).isDirectory());
        
        console.log(`   📁 ${company}/`);
        console.log(`      └─ ${contacts.length} pastas de contatos`);
        
        // Contar arquivos
        let totalFiles = 0;
        contacts.forEach(contact => {
          const contactPath = path.join(companyPath, contact);
          const files = fs.readdirSync(contactPath);
          totalFiles += files.length;
        });
        console.log(`      └─ ${totalFiles} arquivos totais`);
      });
    }
    
    // 7. Recomendações
    console.log('\n7️⃣  RECOMENDAÇÕES\n');
    
    if (naoEncontrados > 0) {
      console.log('   ⚠️  Arquivos não estão sendo salvos corretamente!');
      console.log('   📝 Verificar:');
      console.log('      1. Logs do backend ao enviar/receber mídia');
      console.log('      2. Permissões da pasta public/ (deve ser 777)');
      console.log('      3. Serviço wbotMessageListener.ts');
      console.log('      4. Serviço DownloadOfficialMediaService.ts');
    }
    
    if (!process.env.BACKEND_URL) {
      console.log('   ⚠️  BACKEND_URL não definido no .env');
      console.log('   📝 Adicionar: BACKEND_URL=https://seu-dominio.com');
    }
    
    if (encontrados > 0) {
      console.log('   ✅ Arquivos estão sendo salvos corretamente!');
      console.log('   📝 Se imagens não aparecem no frontend:');
      console.log('      1. Verificar CORS');
      console.log('      2. Verificar se Express está servindo /public');
      console.log('      3. Verificar se há proxy/nginx na frente');
      console.log('      4. Testar acesso direto à URL da imagem');
    }
    
    console.log('\n' + '━'.repeat(60));
    console.log('✅ Diagnóstico completo!\n');
    
  } catch (error) {
    console.error('\n❌ Erro ao executar diagnóstico:', error.message);
    console.error(error);
  } finally {
    await sequelize.close();
  }
}

// Executar
diagnosticar()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Erro fatal:', err);
    process.exit(1);
  });
