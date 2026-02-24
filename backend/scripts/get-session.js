const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'whaticket',
  password: process.env.DB_PASS || 'whaticket',
  database: process.env.DB_NAME || 'whaticket_dev',
});

async function getActiveSession() {
  const client = await pool.connect();
  try {
    // Buscar um token de sessão ativa
    const result = await client.query(`
      SELECT "userId", "token", "expiresAt"
      FROM "UserSessions"
      WHERE "expiresAt" > NOW()
      ORDER BY "expiresAt" DESC
      LIMIT 1;
    `);
    
    if (result.rows.length > 0) {
      console.log('Token de sessão ativa encontrado:');
      console.log(result.rows[0].token);
      console.log('\nUser ID:', result.rows[0].userId);
      console.log('Expires:', result.rows[0].expiresAt);
    } else {
      console.log('Nenhuma sessão ativa encontrada.');
    }
    
    // Buscar usuários para tentar login
    const users = await client.query(`
      SELECT id, name, email, "companyId"
      FROM "Users"
      LIMIT 5;
    `);
    
    console.log('\n=== USUÁRIOS ===');
    users.rows.forEach(u => {
      console.log(`ID: ${u.id} | ${u.name} | ${u.email} | Company: ${u.companyId}`);
    });
    
  } catch (err) {
    console.error('Erro:', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

getActiveSession();
