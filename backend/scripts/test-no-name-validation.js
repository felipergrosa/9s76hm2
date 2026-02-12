const { Sequelize, Op, literal } = require('sequelize');
const Contact = require('../src/models').Contact;
require('dotenv').config();

async function testNoNameValidation() {
  const sequelize = new Sequelize(process.env.DB_DIALECT, null, null, {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    username: process.env.DB_USER,
    password: process.env.DB_PASS,
    dialect: process.env.DB_DIALECT,
    logging: console.log
  });

  try {
    await sequelize.authenticate();
    console.log('✅ Conectado ao banco de dados');

    const companyId = 1; // Ajuste conforme necessário

    // Testar contatos onde name = number
    console.log('\n🔍 Testando busca de contatos onde name = number...');
    
    const whereClause = {
      companyId,
      isGroup: false,
      number: { [Op.not]: null, [Op.ne]: "" },
      isWhatsappValid: { [Op.is]: null }
    };

    // Para PostgreSQL
    if (process.env.DB_DIALECT === 'postgres') {
      whereClause[Op.or] = [
        { name: { [Op.eq]: null } },
        { name: { [Op.eq]: '' } },
        literal('name = number')
      ];
    } else {
      whereClause[Op.or] = [
        { name: { [Op.eq]: null } },
        { name: { [Op.eq]: '' } }
      ];
    }
    
    // Manter apenas números BR
    whereClause.number = {
      ...whereClause.number,
      [Op.regexp]: '^55[0-9]{10,11}$'
    };

    const contacts = await Contact.findAll({
      where: whereClause,
      attributes: ['id', 'name', 'number'],
      limit: 10,
      order: [['name', 'ASC']]
    });

    console.log(`\n📊 Encontrados ${contacts.length} contatos (antes do filtro em memória)`);

    // Se não for PostgreSQL, aplicar filtro em memória
    let filteredContacts = contacts;
    if (process.env.DB_DIALECT !== 'postgres') {
      filteredContacts = contacts.filter(contact => {
        const name = (contact.name || '').trim();
        const number = (contact.number || '').trim();
        const match = name === '' || name === null || name === number;
        if (match) {
          console.log(`✅ Contato encontrado: ID=${contact.id}, Name="${contact.name}", Number="${contact.number}"`);
        }
        return match;
      });
    }

    console.log(`\n🎯 Total de contatos "sem nome": ${filteredContacts.length}`);

    // Mostrar exemplos
    if (filteredContacts.length > 0) {
      console.log('\n📋 Exemplos de contatos encontrados:');
      filteredContacts.slice(0, 5).forEach(contact => {
        console.log(`  - ID: ${contact.id} | Nome: "${contact.name}" | Número: ${contact.number}`);
      });
    } else {
      console.log('\n⚠️ Nenhum contato encontrado com nome = número ou nulo/vazio');
      
      // Buscar alguns contatos para debug
      const sampleContacts = await Contact.findAll({
        where: { companyId, isGroup: false },
        attributes: ['id', 'name', 'number'],
        limit: 5,
        order: [['id', 'ASC']]
      });
      
      console.log('\n📋 Amostra de contatos existentes:');
      sampleContacts.forEach(contact => {
        const nameEqNumber = contact.name === contact.number;
        console.log(`  - ID: ${contact.id} | Nome: "${contact.name}" | Número: ${contact.number} | Igual? ${nameEqNumber}`);
      });
    }

  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await sequelize.close();
  }
}

testNoNameValidation();
