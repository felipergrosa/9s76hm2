// Script para testar exclusão de contato
// Execute: node test-delete-contact.js

const axios = require('axios');

async function testDelete() {
  try {
    // Primeiro, buscar um contato da empresa 1
    const listResponse = await axios.get('http://localhost:8080/api/contacts?companyId=1', {
      headers: {
        'Authorization': 'Bearer qsFj2s8e2XY85oHcNMAvEw'
      }
    });
    
    console.log('Contatos encontrados:', listResponse.data.length);
    
    if (listResponse.data.length > 0) {
      const firstContact = listResponse.data[0];
      console.log('Primeiro contato:', {
        id: firstContact.id,
        name: firstContact.name,
        companyId: firstContact.companyId
      });
      
      // Tentar excluir este contato
      try {
        const deleteResponse = await axios.delete(`http://localhost:8080/api/contacts/${firstContact.id}?companyId=1`, {
          headers: {
            'Authorization': 'Bearer qsFj2s8e2XY85oHcNMAvEw'
          }
        });
        
        console.log('✅ Contato excluído com sucesso:', deleteResponse.data);
      } catch (deleteError) {
        console.error('❌ Erro ao excluir contato:', deleteError.response?.data || deleteError.message);
      }
    } else {
      console.log('❌ Nenhum contato encontrado para empresa 1');
    }
    
  } catch (error) {
    console.error('❌ Erro geral:', error.response?.data || error.message);
  }
}

testDelete();
