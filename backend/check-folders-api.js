// Script Node.js para ver IDs das pastas via API
const axios = require('axios');

const baseURL = 'http://localhost:8080';
const token = 'SEU_TOKEN_AQUI'; // Pegue do localStorage do browser

async function checkFolders() {
    try {
        console.log('🔍 Buscando pastas...\n');

        const response = await axios.get(`${baseURL}/library/folders`, {
            params: { companyId: 1 },
            headers: { Authorization: `Bearer ${token}` }
        });

        console.log('📁 PASTAS ENCONTRADAS:\n');
        const folders = response.data.folders || response.data;

        folders.forEach(folder => {
            console.log(`ID: ${folder.id} → Nome: "${folder.name}"`);
        });

        console.log(`\n✅ Total: ${folders.length} pastas`);

    } catch (error) {
        console.error('❌ Erro:', error.message);
    }
}

checkFolders();
