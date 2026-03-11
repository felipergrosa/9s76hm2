const { Sequelize, QueryTypes } = require('sequelize');
const sequelize = new Sequelize('whaticket', 'postgres', 'efe487b6a861100fb704ad9f5c160cb8', { host: 'localhost', dialect: 'postgres', logging: false });
async function run() {
const totalInv = await sequelize.query(`SELECT COUNT(*) as cnt FROM "Contacts" WHERE "isGroup" = true AND "number" NOT LIKE '%@g.us' AND "number" NOT LIKE '%-%'`, { type: QueryTypes.SELECT });
const totalValid = await sequelize.query(`SELECT COUNT(*) as cnt FROM "Contacts" WHERE "isGroup" = true AND ("number" LIKE '%@g.us' OR "number" LIKE '%-%')`, { type: QueryTypes.SELECT });
console.log('INVALIDOS:', totalInv[0].cnt);
console.log('VALIDOS:', totalValid[0].cnt);
await sequelize.close();
}
run();
