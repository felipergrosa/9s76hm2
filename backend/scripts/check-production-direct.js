// Script para verificar PRODUÇÃO usando as mesmas credenciais do .env atual
require("dotenv").config(); // Usar .env atual (que aponta para produção)
const { Sequelize, DataTypes, Op } = require("sequelize");

// Configurar conexão com o banco (usando .env atual que deve ser produção)
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
  const companyId = 1;
  
  try {
    console.log("🔍 CONECTANDO AO BANCO DE DADOS...");
    console.log(`   Host: ${process.env.DB_HOST}`);
    console.log(`   Porta: ${process.env.DB_PORT}`);
    console.log(`   Banco: ${process.env.DB_NAME}`);
    
    await sequelize.authenticate();
    console.log("✅ Conectado com sucesso!");

    // 1. VERIFICAR CONEXÕES WHATSAPP
    console.log("\n" + "=".repeat(80));
    console.log("📱 STATUS DAS CONEXÕES WHATSAPP");
    console.log("=".repeat(80));
    
    const connections = await Whatsapp.findAll({
      where: { companyId }
    });

    if (connections.length === 0) {
      console.log("❌ Nenhuma conexão WhatsApp encontrada!");
      return;
    }

    let hasDisconnected = false;
    
    for (const whatsapp of connections) {
      console.log(`\n📌 WhatsApp ID: ${whatsapp.id}`);
      console.log(`   Número: ${whatsapp.number || "Não configurado"}`);
      console.log(`   Status: ${whatsapp.status || "Sem status"}`);
      console.log(`   Última atualização: ${whatsapp.updatedAt?.toLocaleString("pt-BR")}`);
      
      if (whatsapp.status === "DISCONNECTED") {
        console.log(`   ⚠️  PROBLEMA: Conexão desconectada!`);
        hasDisconnected = true;
      } else if (whatsapp.status === "CONNECTED") {
        console.log(`   ✅ Conexão ativa`);
      } else {
        console.log(`   ❓ Status desconhecido: ${whatsapp.status}`);
      }
    }

    // 2. VERIFICAR MENSAGENS RECENTES (últimas 2 horas)
    console.log("\n" + "=".repeat(80));
    console.log("📊 MENSAGENS DAS ÚLTIMAS 2 HORAS");
    console.log("=".repeat(80));

    const messages = await Message.findAll({
      where: {
        companyId,
        fromMe: true,
        createdAt: {
          [Op.gte]: new Date(Date.now() - 2 * 60 * 60 * 1000) // 2 horas
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
      order: [["createdAt", "DESC"]]
    });

    if (messages.length === 0) {
      console.log("📭 Nenhuma mensagem enviada nas últimas 2 horas");
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

      // 3. VERIFICAR PROBLEMAS ESPECÍFICOS
      const problematicMessages = messages.filter(m => m.ack < 3);
      
      if (problematicMessages.length > 0) {
        console.log("\n⚠️  MENSAGENS COM PROBLEMAS:");
        console.log("-".repeat(50));
        
        problematicMessages.slice(0, 10).forEach((msg, index) => {
          const contact = msg.ticket?.contact;
          const ackStatus = msg.ack === 0 ? "🔴 Não Entregue" : 
                           msg.ack === 1 ? "🟡 Entregue" : 
                           msg.ack === 2 ? "🟠 Possível bloqueio" : `❓ ${msg.ack}`;
          
          console.log(`\n${index + 1}. ${ackStatus}`);
          console.log(`   Contato: ${contact?.name || "Sem nome"} (${contact?.number || "Sem número"})`);
          console.log(`   Mensagem: ${(msg.body || msg.mediaType || "Mídia").substring(0, 50)}...`);
          console.log(`   Ticket: #${msg.ticketId} | Data: ${msg.createdAt.toLocaleString("pt-BR")}`);
        });
      }
    }

    // 4. DIAGNÓSTICO E RECOMENDAÇÕES
    console.log("\n" + "=".repeat(80));
    console.log("🎯 DIAGNÓSTICO E AÇÕES");
    console.log("=".repeat(80));
    
    if (hasDisconnected) {
      console.log("🚨 PROBLEMA IDENTIFICADO: Conexão(ões) WhatsApp desconectada(s)!");
      console.log("\n🔧 AÇÃO IMEDIATA:");
      console.log("   1. Acessar painel do Whaticket (PRODUÇÃO)");
      console.log("   2. Ir em WhatsApp > Conexões");
      console.log("   3. Localizar conexão(ões) com status DISCONNECTED");
      console.log("   4. Clicar em 'Conectar' para cada uma");
      console.log("   5. Escanear QR Code com celular");
      console.log("   6. Aguardar confirmação de conexão");
      console.log("   7. Testar envio de mensagem");
      
      console.log("\n⚠️  IMPORTANTE:");
      console.log("   - Mensagens enviadas enquanto desconectado não chegam");
      console.log("   - Elas ficam 'presas' no sistema com check falso");
      console.log("   - Apenas reconectando resolve o problema");
    } else {
      console.log("✅ Todas as conexões estão ativas");
      
      if (messages.some(m => m.ack === 2)) {
        console.log("\n⚠️  POSSÍVEL BLOQUEIO DETECTADO:");
        console.log("   - Mensagens com ACK=2 foram lidas pelo WhatsApp");
        console.log("   - Mas podem não ter sido entregues ao contato");
        console.log("   - Contato pode ter bloqueado seu número");
        console.log("\n🔧 AÇÕES:");
        console.log("   1. Entrar em contato com o cliente por outro meio");
        console.log("   2. Verificar se bloqueou seu número");
        console.log("   3. Testar envio de outro número");
      }
    }

  } catch (error) {
    console.error("❌ Erro ao verificar:", error.message);
    
    if (error.message.includes("password")) {
      console.log("\n💡 Verifique se as credenciais no .env estão corretas");
      console.log("   Este script deve ser executado no ambiente de produção");
    } else if (error.message.includes("connect")) {
      console.log("\n💡 Verifique conectividade com o banco de dados");
      console.log("   Host: " + process.env.DB_HOST);
      console.log("   Porta: " + process.env.DB_PORT);
    }
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
