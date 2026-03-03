/**
 * Script para limpar sessão corrompida após migração Baileys v7
 * Uso: node scripts/fix-session-13.js
 */

const { Sequelize } = require('sequelize');
const path = require('path');
const fs = require('fs');

// Configurar conexão com banco (ajuste conforme seu .env)
const sequelize = new Sequelize(
  process.env.DB_NAME || 'whaticket',
  process.env.DB_USER || 'postgres',
  process.env.DB_PASS || 'postgres',
  {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: false
  }
);

async function fixSession() {
  try {
    console.log('🔧 Iniciando limpeza da sessão WhatsApp ID=13...\n');

    // 1. Atualizar status no banco
    console.log('1️⃣ Atualizando status no banco de dados...');
    await sequelize.query(`
      UPDATE "Whatsapps" 
      SET 
        status = 'PENDING',
        qrcode = '',
        "retries" = 0,
        session = '',
        number = ''
      WHERE id = 13
    `);
    console.log('✅ Status atualizado para PENDING\n');

    // 2. Limpar dados Baileys
    console.log('2️⃣ Limpando dados Baileys do banco...');
    await sequelize.query(`DELETE FROM "BaileysKeys" WHERE "whatsappId" = 13`);
    await sequelize.query(`DELETE FROM "BaileysChats" WHERE "whatsappId" = 13`);
    await sequelize.query(`DELETE FROM "BaileysContacts" WHERE "whatsappId" = 13`);
    console.log('✅ Dados Baileys limpos\n');

    // 3. Limpar arquivos de sessão
    console.log('3️⃣ Limpando arquivos de sessão...');
    const sessionPath = path.resolve(
      __dirname,
      '..',
      'private',
      'sessions',
      '1',  // companyId
      '13'  // whatsappId
    );

    if (fs.existsSync(sessionPath)) {
      fs.rmSync(sessionPath, { recursive: true, force: true });
      console.log(`✅ Sessão removida: ${sessionPath}\n`);
    } else {
      console.log(`⚠️  Pasta não encontrada: ${sessionPath}\n`);
    }

    // 4. Limpar cache Redis (se existir)
    console.log('4️⃣ Limpando cache (se Redis estiver configurado)...');
    try {
      const redis = require('ioredis');
      const redisClient = new redis(process.env.REDIS_URI || 'redis://localhost:6379');
      
      const keys = await redisClient.keys('sessions:13:*');
      if (keys.length > 0) {
        await redisClient.del(...keys);
        console.log(`✅ ${keys.length} chaves Redis removidas\n`);
      } else {
        console.log('✅ Nenhuma chave Redis encontrada\n');
      }
      
      await redisClient.quit();
    } catch (e) {
      console.log('⚠️  Redis não configurado ou não disponível (ok)\n');
    }

    console.log('✅ LIMPEZA CONCLUÍDA COM SUCESSO!\n');
    console.log('📋 Próximos passos:');
    console.log('   1. Reinicie o backend: npm run dev');
    console.log('   2. Acesse o frontend e clique em "Conectar"');
    console.log('   3. Escaneie o novo QR Code\n');

  } catch (error) {
    console.error('❌ Erro ao limpar sessão:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

fixSession();
