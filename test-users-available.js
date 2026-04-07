// Script de teste para verificar endpoint /users/available
const axios = require('axios');

const API_URL = 'http://localhost:8080';

async function testUsersAvailable() {
  try {
    console.log('=== TESTE DO ENDPOINT /users/available ===\n');
    
    // Você precisa substituir este token por um token válido
    // Para obter um token, faça login na aplicação e copie do localStorage ou da requisição
    const token = 'SEU_TOKEN_AQUI';
    
    if (token === 'SEU_TOKEN_AQUI') {
      console.log('❌ ERRO: Você precisa substituir SEU_TOKEN_AQUI por um token válido');
      console.log('\nPara obter o token:');
      console.log('1. Abra o navegador e faça login na aplicação');
      console.log('2. Abra o DevTools (F12)');
      console.log('3. Vá em Application > Local Storage');
      console.log('4. Copie o valor de "token"');
      console.log('5. Cole aqui no script\n');
      return;
    }
    
    const response = await axios.get(`${API_URL}/users/available`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Requisição bem-sucedida!\n');
    console.log('Status:', response.status);
    console.log('Total de usuários:', response.data?.length || 0);
    console.log('\nUsuários retornados:');
    console.log(JSON.stringify(response.data, null, 2));
    
    if (response.data?.length === 0) {
      console.log('\n⚠️  ATENÇÃO: Nenhum usuário foi retornado!');
      console.log('Verifique:');
      console.log('- Se existem usuários cadastrados na empresa');
      console.log('- Se o companyId do token está correto');
      console.log('- Os logs do backend para mais detalhes');
    }
    
  } catch (error) {
    console.log('❌ Erro na requisição:\n');
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Mensagem:', error.response.data);
    } else {
      console.log('Erro:', error.message);
    }
  }
}

testUsersAvailable();
