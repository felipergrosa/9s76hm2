require("dotenv").config();
const { Sequelize } = require("sequelize");

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

async function findButtonResponses() {
  try {
    await sequelize.authenticate();
    console.log("✅ Conectado ao banco de dados\n");

    // Buscar mensagens que podem ser respostas de botões
    const [messages] = await sequelize.query(`
      SELECT 
        m.id, 
        m.body, 
        m."fromMe", 
        m."mediaType",
        m."dataJson",
        m."createdAt",
        m."ticketId",
        t."whatsappId",
        w.name as whatsapp_name,
        w."channelType"
      FROM "Messages" m
      JOIN "Tickets" t ON t.id = m."ticketId"
      JOIN "Whatsapps" w ON w.id = t."whatsappId"
      WHERE m."fromMe" = false
        AND m."createdAt" > NOW() - INTERVAL '7 days'
        AND (
          m."dataJson"::text LIKE '%buttonsResponse%'
          OR m."dataJson"::text LIKE '%listResponse%'
          OR m."dataJson"::text LIKE '%templateButton%'
          OR m.body = '[button]'
          OR m.body ILIKE '%button%'
        )
      ORDER BY m."createdAt" DESC
      LIMIT 10;
    `);

    if (messages.length === 0) {
      console.log("⚠️ Nenhuma mensagem de resposta de botão encontrada nos últimos 7 dias\n");
      console.log("Buscando mensagens de campanhas recentes...\n");
      
      // Buscar tickets de campanhas
      const [campaignMessages] = await sequelize.query(`
        SELECT 
          m.id, 
          m.body, 
          m."fromMe", 
          m."mediaType",
          m."dataJson",
          m."createdAt",
          m."ticketId",
          w."channelType"
        FROM "Messages" m
        JOIN "Tickets" t ON t.id = m."ticketId"
        JOIN "Whatsapps" w ON w.id = t."whatsappId"
        WHERE m."createdAt" > NOW() - INTERVAL '3 days'
          AND w."channelType" = 'official'
        ORDER BY m."createdAt" DESC
        LIMIT 20;
      `);
      
      console.log(`📊 Encontradas ${campaignMessages.length} mensagens da API Oficial:\n`);
      
      campaignMessages.forEach((msg, index) => {
        console.log(`\n--- Mensagem ${index + 1} ---`);
        console.log(`ID: ${msg.id}`);
        console.log(`Body: ${msg.body?.substring(0, 100) || '(vazio)'}`);
        console.log(`FromMe: ${msg.fromMe}`);
        console.log(`MediaType: ${msg.mediaType}`);
        console.log(`ChannelType: ${msg.channelType}`);
        
        if (msg.dataJson) {
          try {
            const data = JSON.parse(msg.dataJson);
            const msgTypes = data.message ? Object.keys(data.message) : [];
            console.log(`Tipos de mensagem: ${msgTypes.join(', ')}`);
            
            // Verificar se é resposta de botão
            if (data.message?.buttonsResponseMessage) {
              console.log(`\n🔘 RESPOSTA DE BOTÃO DETECTADA!`);
              console.log(JSON.stringify(data.message.buttonsResponseMessage, null, 2));
            }
            if (data.message?.listResponseMessage) {
              console.log(`\n📋 RESPOSTA DE LISTA DETECTADA!`);
              console.log(JSON.stringify(data.message.listResponseMessage, null, 2));
            }
          } catch (e) {
            console.log(`Erro ao parsear dataJson: ${e.message}`);
          }
        }
      });
      
      await sequelize.close();
      return;
    }

    console.log(`📊 Encontradas ${messages.length} possíveis respostas de botão:\n`);

    messages.forEach((msg, index) => {
      console.log(`\n${"=".repeat(80)}`);
      console.log(`--- Mensagem ${index + 1} ---`);
      console.log(`ID: ${msg.id}`);
      console.log(`Body: ${msg.body}`);
      console.log(`FromMe: ${msg.fromMe}`);
      console.log(`MediaType: ${msg.mediaType}`);
      console.log(`WhatsApp: ${msg.whatsapp_name} (${msg.channelType})`);
      console.log(`CreatedAt: ${msg.createdAt}`);
      
      if (msg.dataJson) {
        try {
          const data = JSON.parse(msg.dataJson);
          console.log(`\n📋 DataJson completo:`);
          
          if (data.message) {
            const msgTypes = Object.keys(data.message);
            console.log(`\nTipos de mensagem: ${msgTypes.join(', ')}`);
            
            // Verificar cada tipo de resposta de botão
            if (data.message.buttonsResponseMessage) {
              console.log(`\n🔘 RESPOSTA DE BOTÃO (buttonsResponseMessage):`);
              console.log(JSON.stringify(data.message.buttonsResponseMessage, null, 2));
            }
            
            if (data.message.listResponseMessage) {
              console.log(`\n📋 RESPOSTA DE LISTA (listResponseMessage):`);
              console.log(JSON.stringify(data.message.listResponseMessage, null, 2));
            }
            
            if (data.message.templateButtonReplyMessage) {
              console.log(`\n🎯 RESPOSTA DE TEMPLATE BUTTON (templateButtonReplyMessage):`);
              console.log(JSON.stringify(data.message.templateButtonReplyMessage, null, 2));
            }
            
            // Mostrar estrutura completa se não for nenhum dos tipos acima
            if (!data.message.buttonsResponseMessage && 
                !data.message.listResponseMessage && 
                !data.message.templateButtonReplyMessage) {
              console.log(`\n📦 Estrutura completa da mensagem:`);
              console.log(JSON.stringify(data.message, null, 2));
            }
          }
        } catch (e) {
          console.log(`❌ Erro ao parsear dataJson: ${e.message}`);
        }
      } else {
        console.log(`\n⚠️ Mensagem sem dataJson`);
      }
    });

    await sequelize.close();
    console.log(`\n${"=".repeat(80)}`);
    console.log("\n✅ Análise concluída");
  } catch (error) {
    console.error("❌ Erro:", error.message);
    process.exit(1);
  }
}

findButtonResponses();
