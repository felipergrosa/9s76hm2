require("dotenv").config();
const { Sequelize } = require("sequelize");
const { Op } = require("sequelize");

// Configuração do banco
const sequelize = new Sequelize(
  process.env.DB_NAME || "whaticket",
  process.env.DB_USER || "postgres",
  process.env.DB_PASS || "postgres",
  {
    host: process.env.DB_HOST || "localhost",
    port: process.env.DB_PORT || 5432,
    dialect: "postgres",
    logging: false,
  }
);

async function checkButtonMessages() {
  try {
    await sequelize.authenticate();
    console.log("✅ Conectado ao banco de dados");

    // Buscar mensagens recentes do CLIENTE (fromMe = false) com texto curto
    const [messages] = await sequelize.query(`
      SELECT 
        id, 
        body, 
        "fromMe", 
        "mediaType",
        "dataJson",
        "createdAt",
        "ticketId"
      FROM "Messages" 
      WHERE "fromMe" = false
        AND "createdAt" > NOW() - INTERVAL '2 days'
        AND LENGTH(body) < 50
        AND body NOT LIKE '%http%'
        AND "mediaType" IN ('conversation', 'extendedTextMessage')
      ORDER BY "createdAt" DESC
      LIMIT 15;
    `);

    console.log(`\n📊 Encontradas ${messages.length} mensagens curtas recentes do cliente:\n`);

    messages.forEach((msg, index) => {
      console.log(`\n--- Mensagem ${index + 1} ---`);
      console.log(`ID: ${msg.id}`);
      console.log(`Body: ${msg.body}`);
      console.log(`FromMe: ${msg.fromMe}`);
      console.log(`MediaType: ${msg.mediaType}`);
      console.log(`CreatedAt: ${msg.createdAt}`);
      
      if (msg.dataJson) {
        try {
          const data = JSON.parse(msg.dataJson);
          console.log(`\nDataJson (tipo de mensagem):`);
          
          // Verificar tipo de mensagem
          if (data.message) {
            const msgTypes = Object.keys(data.message);
            console.log(`Tipos: ${msgTypes.join(', ')}`);
            
            // Verificar se é resposta de botão
            if (data.message.buttonsResponseMessage) {
              console.log(`\n🔘 RESPOSTA DE BOTÃO DETECTADA:`);
              console.log(`Selected Button ID: ${data.message.buttonsResponseMessage.selectedButtonId}`);
              console.log(`Selected Display Text: ${data.message.buttonsResponseMessage.selectedDisplayText}`);
            }
            
            if (data.message.listResponseMessage) {
              console.log(`\n📋 RESPOSTA DE LISTA DETECTADA:`);
              console.log(`Title: ${data.message.listResponseMessage.title}`);
              if (data.message.listResponseMessage.singleSelectReply) {
                console.log(`Selected Row ID: ${data.message.listResponseMessage.singleSelectReply.selectedRowId}`);
              }
            }
            
            if (data.message.templateButtonReplyMessage) {
              console.log(`\n🎯 RESPOSTA DE TEMPLATE BUTTON:`);
              console.log(`Selected ID: ${data.message.templateButtonReplyMessage.selectedId}`);
            }
          }
        } catch (e) {
          console.log(`Erro ao parsear dataJson: ${e.message}`);
        }
      }
    });

    await sequelize.close();
    console.log("\n✅ Análise concluída");
  } catch (error) {
    console.error("❌ Erro:", error);
    process.exit(1);
  }
}

checkButtonMessages();
