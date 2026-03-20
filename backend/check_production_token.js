const { Sequelize } = require('sequelize');

// Configuração para banco de produção (baseado no stack.portainer.yml)
const sequelize = new Sequelize('whaticket', 'postgres', 'efe487b6a861100fb704ad9f5c160cb8', {
  host: 'postgres', // Nome do serviço no Docker
  dialect: 'postgres',
  port: 5432,
  // Se precisar de SSL para produção externa:
  // ssl: process.env.DB_SSL === 'true' ? {
  //   rejectUnauthorized: false
  // } : false
});

async function checkProductionToken() {
  try {
    await sequelize.authenticate();
    console.log('✅ Conectado ao banco de PRODUÇÃO com sucesso!');
    
    // Verificar token específico do n8n
    const results = await sequelize.query(
      'SELECT id, name, token, status FROM "Whatsapps" WHERE token = :token',
      {
        replacements: { token: 'qsFj2s8e2XY850HcNMAvEw' },
        type: Sequelize.QueryTypes.SELECT
      }
    );
    
    console.log('\n🔍 Verificando token qsFj2s8e2XY850HcNMAvEw:');
    console.log('Resultado:', results);
    
    if (!results || results.length === 0) {
      console.log('❌ Token qsFj2s8e2XY850HcNMAvEw não encontrado em PRODUÇÃO!');
      
      // Listar todos os tokens de produção
      const allTokens = await sequelize.query(
        'SELECT id, name, token, status FROM "Whatsapps" ORDER BY id',
        { type: Sequelize.QueryTypes.SELECT }
      );
      
      console.log('\n📋 Tokens disponíveis em PRODUÇÃO:');
      if (allTokens && allTokens.length > 0) {
        console.log('ID | Nome | Token | Status');
        console.log('---|------|-------|-------');
        allTokens.forEach(w => {
          const tokenShort = w.token ? w.token.substring(0, 20) + '...' : 'N/A';
          console.log(`${w.id} | ${w.name || 'N/A'} | ${tokenShort} | ${w.status || 'N/A'}`);
          console.log(`   Token completo: ${w.token}`);
        });
      } else {
        console.log('⚠️ Nenhuma conexão WhatsApp encontrada em PRODUÇÃO!');
      }
    } else {
      console.log('✅ Token encontrado em PRODUÇÃO!');
      results.forEach(w => {
        console.log(`ID: ${w.id} | Nome: ${w.name} | Status: ${w.status}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Erro ao conectar ao banco de PRODUÇÃO:', error.message);
    console.log('\n💡 Possíveis soluções:');
    console.log('1. Executar este script DENTRO do container backend em produção');
    console.log('2. Ajustar configuração de conexão (host/porta/senha)');
    console.log('3. Verificar se o banco está acessível');
  } finally {
    await sequelize.close();
    process.exit(0);
  }
}

checkProductionToken();
