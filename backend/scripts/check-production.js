// Script para verificar CONEXÕES EM PRODUÇÃO
require("dotenv").config({ path: ".env.production" }); // Usar .env.production
const { Sequelize, DataTypes, Op } = require("sequelize");

// Configurar conexão com o banco de PRODUÇÃO
const sequelize = new Sequelize(
  process.env.DB_NAME || "whaticket",
  process.env.DB_USER || "postgres", 
  process.env.DB_PASS || "",
  {
    host: process.env.DB_HOST || "localhost",
    dialect: "postgres",
    port: parseInt(process.env.DB_PORT || "5432"),
    logging: false
  }
);

// Definir modelos
const Message = sequelize.define("Message", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  body: DataTypes.TEXT,
  fromMe: DataTypes.BOOLEAN,
  ack: DataTypes.INTEGER,
  companyId: DataTypes.INTEGER,
  ticketId: DataTypes.INTEGER,
  mediaType: DataTypes.STRING,
  mediaUrl: DataTypes.STRING,
  createdAt: DataTypes.DATE,
  updatedAt: DataTypes.DATE
}, { tableName: "Messages", timestamps: true });

const Ticket = sequelize.define("Ticket", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  contactId: DataTypes.INTEGER,
  whatsappId: DataTypes.INTEGER,
  companyId: DataTypes.INTEGER,
  status: DataTypes.STRING,
  createdAt: DataTypes.DATE,
  updatedAt: DataTypes.DATE
}, { tableName: "Tickets", timestamps: true });

const Contact = sequelize.define("Contact", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: DataTypes.STRING,
  number: DataTypes.STRING,
  companyId: DataTypes.INTEGER,
  createdAt: DataTypes.DATE,
  updatedAt: DataTypes.DATE
}, { tableName: "Contacts", timestamps: true });

const Whatsapp = sequelize.define("Whatsapp", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  number: DataTypes.STRING,
  status: DataTypes.STRING,
  companyId: DataTypes.INTEGER,
  session: DataTypes.TEXT,
  qrcode: DataTypes.TEXT,
  createdAt: DataTypes.DATE,
  updatedAt: DataTypes.DATE
}, { tableName: "Whatsapps", timestamps: true });

// Associações
Message.belongsTo(Ticket, { foreignKey: "ticketId", as: "ticket" });
Ticket.hasMany(Message, { foreignKey: "ticketId", as: "messages" });
Ticket.belongsTo(Contact, { foreignKey: "contactId", as: "contact" });
Contact.hasMany(Ticket, { foreignKey: "contactId", as: "tickets" });

async function checkProduction() {
  const companyId = 1; // Ajustar se necessário
  const hoursToCheck = 24; // Últimas 24 horas
  
  try {
    console.log("🔍 CONECTANDO AO BANCO DE PRODUÇÃO...");
    await sequelize.authenticate();
    console.log("✅ Conectado ao banco de PRODUÇÃO");

    // 1. VERIFICAR CONEXÕES WHATSAPP EM PRODUÇÃO
    console.log("\n" + "=".repeat(80));
    console.log("📱 CONEXÕES WHATSAPP EM PRODUÇÃO");
    console.log("=".repeat(80));
    
    const connections = await Whatsapp.findAll({
      where: { companyId }
    });

    for (const whatsapp of connections) {
      console.log(`\n📌 WhatsApp ID: ${whatsapp.id}`);
      console.log(`   Número: ${whatsapp.number || "Não configurado"}`);
      console.log(`   Status: ${whatsapp.status || "Sem status"}`);
      console.log(`   Tem QR Code: ${whatsapp.qrcode ? "Sim" : "Não"}`);
      console.log(`   Tem Sessão: ${whatsapp.session ? "Sim" : "Não"}`);
      console.log(`   Última atualização: ${whatsapp.updatedAt?.toLocaleString("pt-BR")}`);
      
      if (whatsapp.status === "DISCONNECTED") {
        console.log(`   ⚠️  PROBLEMA: Conexão desconectada!`);
      } else if (whatsapp.status === "CONNECTED") {
        console.log(`   ✅ Conexão ativa`);
      } else {
        console.log(`   ❓ Status: ${whatsapp.status}`);
      }
    }

    // 2. VERIFICAR MENSAGENS DAS ÚLTIMAS 24H
    console.log("\n" + "=".repeat(80));
    console.log("📊 MENSAGENS DAS ÚLTIMAS 24 HORAS");
    console.log("=".repeat(80));

    const messages = await Message.findAll({
      where: {
        companyId,
        fromMe: true,
        createdAt: {
          [Op.gte]: new Date(Date.now() - hoursToCheck * 60 * 60 * 1000)
        }
      },
      include: [
        {
          model: Ticket,
          as: "ticket",
          include: [
            {
              model: Contact,
              as: "contact"
            }
          ]
        }
      ],
      order: [["createdAt", "DESC"]],
      limit: 50
    });

    if (messages.length === 0) {
      console.log("📭 Nenhuma mensagem enviada nas últimas 24 horas");
    } else {
      console.log(`📈 Total de mensagens: ${messages.length}`);
      
      // Agrupar por ACK
      const byAck = messages.reduce((acc, msg) => {
        acc[msg.ack] = (acc[msg.ack] || 0) + 1;
        return acc;
      }, {});

      console.log("\n📊 ESTATÍSTICAS POR ACK:");
      Object.entries(byAck).forEach(([ack, count]) => {
        const status = ack === "0" ? "🔴 Não Entregue" : 
                      ack === "1" ? "🟡 Entregue" : 
                      ack === "2" ? "🟠 Lido (possível bloqueio)" :
                      ack === "3" ? "🟢 Lido+Recebido" :
                      ack === "4" ? "🟵 Outro dispositivo" : 
                      `❓ ACK=${ack}`;
        const percentage = ((count / messages.length) * 100).toFixed(1);
        console.log(`  ${status}: ${count} mensagens (${percentage}%)`);
      });

      // 3. VERIFICAR ESPECIFICAMENTE O PROBLEMA DO USUÁRIO
      console.log("\n" + "=".repeat(80));
      console.log("🎯 ANÁLISE DO PROBLEMA ESPECÍFICO");
      console.log("=".repeat(80));

      // Buscar mensagens do ticket 4790 (Patricia)
      const patriciaMessages = messages.filter(m => 
        m.ticket?.id === 4790 || 
        m.ticket?.contact?.name?.toLowerCase().includes("patricia")
      );

      if (patriciaMessages.length > 0) {
        console.log("📌 Mensagens para Patricia (Ticket #4790):");
        patriciaMessages.forEach((msg, index) => {
          const contact = msg.ticket?.contact;
          const ackStatus = msg.ack === 0 ? "🔴 Não Entregue" : 
                           msg.ack === 1 ? "🟡 Entregue" : 
                           msg.ack === 2 ? "🟠 Lido (possível bloqueio)" :
                           msg.ack === 3 ? "🟢 OK" :
                           msg.ack === 4 ? "🟵 OK" : `❓ ${msg.ack}`;
          
          console.log(`\n${index + 1}. ${ackStatus}`);
          console.log(`   Contato: ${contact?.name || "Sem nome"} (${contact?.number || "Sem número"})`);
          console.log(`   Mensagem: ${msg.body || msg.mediaType || "Mídia"}`);
          console.log(`   ACK: ${msg.ack} | Data: ${msg.createdAt.toLocaleString("pt-BR")}`);
        });

        // Diagnóstico específico
        const problematicMessages = patriciaMessages.filter(m => m.ack < 3);
        if (problematicMessages.length > 0) {
          console.log("\n⚠️  DIAGNÓSTICO: Mensagens com ACK < 3 indicam problema!");
          console.log("   - ACK=0: Falha no envio ao servidor");
          console.log("   - ACK=1: Entregue ao dispositivo mas não lido");
          console.log("   - ACK=2: Lido mas pode estar bloqueado");
          
          console.log("\n🔧 SOLUÇÕES:");
          console.log("   1. Verificar status da conexão WhatsApp acima");
          console.log("   2. Se DISCONNECTED: reconectar no painel");
          console.log("   3. Se CONNECTED: possível bloqueio do contato");
          console.log("   4. Testar com outro número de telefone");
        }
      } else {
        console.log("📭 Nenhuma mensagem encontrada para Patricia nas últimas 24h");
        console.log("   Buscando mensagens mais antigas...");
        
        // Buscar mensagens mais antigas do ticket 4790
        const oldMessages = await Message.findAll({
          where: {
            companyId,
            fromMe: true,
            ticketId: 4790
          },
          include: [
            {
              model: Ticket,
              as: "ticket",
              include: [
                {
                  model: Contact,
                  as: "contact"
                }
              ]
            }
          ],
          order: [["createdAt", "DESC"]],
          limit: 10
        });

        if (oldMessages.length > 0) {
          console.log(`\n📌 Últimas ${oldMessages.length} mensagens do Ticket #4790:`);
          oldMessages.forEach((msg, index) => {
            const contact = msg.ticket?.contact;
            const ackStatus = msg.ack === 0 ? "🔴 Não Entregue" : 
                             msg.ack === 1 ? "🟡 Entregue" : 
                             msg.ack === 2 ? "🟠 Lido (possível bloqueio)" :
                             msg.ack === 3 ? "🟢 OK" :
                             msg.ack === 4 ? "🟵 OK" : `❓ ${msg.ack}`;
            
            console.log(`\n${index + 1}. ${ackStatus}`);
            console.log(`   Contato: ${contact?.name || "Sem nome"} (${contact?.number || "Sem número"})`);
            console.log(`   Mensagem: ${msg.body || msg.mediaType || "Mídia"}`);
            console.log(`   ACK: ${msg.ack} | Data: ${msg.createdAt.toLocaleString("pt-BR")}`);
          });
        }
      }
    }

    // 4. RECOMENDAÇÕES FINAIS
    console.log("\n" + "=".repeat(80));
    console.log("💡 RECOMENDAÇÕES PARA PRODUÇÃO");
    console.log("=".repeat(80));
    
    const disconnectedConnections = connections.filter(c => c.status === "DISCONNECTED");
    
    if (disconnectedConnections.length > 0) {
      console.log("🚨 AÇÕES IMEDIATAS NECESSÁRIAS:");
      console.log("   1. Acessar painel do Whaticket em PRODUÇÃO");
      console.log("   2. Ir em WhatsApp > Conexões");
      console.log("   3. Reconectar as seguintes conexões:");
      disconnectedConnections.forEach(c => {
        console.log(`      - ID ${c.id} (${c.number || 'Sem número'})`);
      });
      console.log("   4. Escanear QR Code com WhatsApp");
      console.log("   5. Testar envio de mensagem");
    } else {
      console.log("✅ Todas as conexões estão ativas");
      console.log("   Se mensagens ainda não chegam, possível causa:");
      console.log("   - Contato bloqueou o número");
      console.log("   - Problemas com números @lid");
      console.log("   - Rate limit do WhatsApp");
    }

  } catch (error) {
    console.error("❌ Erro ao verificar produção:", error.message);
    console.log("\n💡 Verifique:");
    console.log("   - Se o arquivo .env.production existe");
    console.log("   - Se as credenciais do banco estão corretas");
    console.log("   - Se há conectividade com o banco de produção");
  } finally {
    await sequelize.close();
  }
}

// Executar verificação
checkProduction()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
