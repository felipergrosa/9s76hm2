const { Sequelize } = require('sequelize');
const config = require('./dist/config/database');

const sequelize = new Sequelize(config);

async function fixChatColumns() {
  try {
    console.log('Conectando ao banco de dados...');
    await sequelize.authenticate();
    console.log('Conexão estabelecida com sucesso.');

    console.log('\n1. Adicionando coluna "type"...');
    await sequelize.query(`
      ALTER TABLE "Chats" 
      ADD COLUMN IF NOT EXISTS "type" VARCHAR(255) NOT NULL DEFAULT 'group'
    `);
    console.log('✓ Coluna "type" adicionada.');

    console.log('\n2. Adicionando coluna "directKey"...');
    await sequelize.query(`
      ALTER TABLE "Chats" 
      ADD COLUMN IF NOT EXISTS "directKey" VARCHAR(255) DEFAULT NULL
    `);
    console.log('✓ Coluna "directKey" adicionada.');

    console.log('\n3. Atualizando chats existentes...');
    await sequelize.query(`
      UPDATE "Chats" 
      SET "type" = 'group' 
      WHERE "type" IS NULL OR "type" = ''
    `);
    console.log('✓ Chats existentes atualizados.');

    console.log('\n4. Criando índice único...');
    await sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS chats_company_directkey_unique 
      ON "Chats" ("companyId", "directKey")
    `);
    console.log('✓ Índice criado.');

    console.log('\n✅ Migração concluída com sucesso!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Erro ao executar migração:', error.message);
    console.error(error);
    process.exit(1);
  }
}

fixChatColumns();
