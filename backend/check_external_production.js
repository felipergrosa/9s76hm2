const { Sequelize } = require('sequelize');

// Configuração para banco de produção EXTERNO (ajustar conforme necessário)
const sequelize = new Sequelize('whaticket', 'postgres', 'efe487b6a861100fb704ad9f5c160cb8', {
  host: 'chatsapi.nobreluminarias.com.br', // URL do seu banco externo
  dialect: 'postgres',
  port: 5432,
  ssl: {
    rejectUnauthorized: false // Necessário para muitos provedores cloud
  }
});

async function checkExternalProductionToken() {
  try {
    await sequelize.authenticate();
    console.log('✅ Conectado ao banco EXTERNO de PRODUÇÃO!');
    
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
      
      // Verificar token específico do n8n
      const specificToken = allTokens.find(w => w.token === 'qsFj2s8e2XY850HcNMAvEw');
      if (specificToken) {
        console.log('\n✅ Token qsFj2s8e2XY850HcNMAvEw encontrado em PRODUÇÃO!');
        console.log(`ID: ${specificToken.id} | Nome: ${specificToken.name} | Status: ${specificToken.status}`);
      } else {
        console.log('\n❌ Token qsFj2s8e2XY850HcNMAvEw NÃO encontrado em PRODUÇÃO!');
        console.log('Use um dos tokens listados acima no seu n8n.');
      }
    } else {
      console.log('⚠️ Nenhuma conexão WhatsApp encontrada em PRODUÇÃO!');
    }
    
  } catch (error) {
    console.error('❌ Erro ao conectar ao banco EXTERNO:', error.message);
    console.log('\n💡 Verifique:');
    console.log('1. Se o host está correto');
    console.log('2. Se a porta está aberta');
    console.log('3. Se as credenciais estão corretas');
    console.log('4. Se o banco permite conexões externas');
  } finally {
    await sequelize.close();
    process.exit(0);
  }
}

checkExternalProductionToken();
