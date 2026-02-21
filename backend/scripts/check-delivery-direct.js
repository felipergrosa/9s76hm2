// Carregar variáveis de ambiente do .env
require("dotenv").config();
const { Sequelize, DataTypes, Op } = require("sequelize");

// Configurar conexão com o banco
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

// Definir modelos manualmente
const Message = sequelize.define("Message", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  body: DataTypes.TEXT,
  fromMe: DataTypes.BOOLEAN,
  ack: DataTypes.INTEGER,
  companyId: DataTypes.INTEGER,
  ticketId: DataTypes.INTEGER,
  mediaType: DataTypes.STRING,
  mediaUrl: DataTypes.STRING,
  createdAt: DataTypes.DATE,
  updatedAt: DataTypes.DATE
}, {
  tableName: "Messages",
  timestamps: true
});

const Ticket = sequelize.define("Ticket", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  contactId: DataTypes.INTEGER,
  whatsappId: DataTypes.INTEGER,
  companyId: DataTypes.INTEGER,
  status: DataTypes.STRING,
  createdAt: DataTypes.DATE,
  updatedAt: DataTypes.DATE
}, {
  tableName: "Tickets",
  timestamps: true
});

const Contact = sequelize.define("Contact", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: DataTypes.STRING,
  number: DataTypes.STRING,
  companyId: DataTypes.INTEGER,
  createdAt: DataTypes.DATE,
  updatedAt: DataTypes.DATE
}, {
  tableName: "Contacts",
  timestamps: true
});

const Whatsapp = sequelize.define("Whatsapp", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  number: DataTypes.STRING,
  status: DataTypes.STRING,
  companyId: DataTypes.INTEGER,
  createdAt: DataTypes.DATE,
  updatedAt: DataTypes.DATE
}, {
  tableName: "Whatsapps",
  timestamps: true
});

// Associações
Message.belongsTo(Ticket, { foreignKey: "ticketId", as: "ticket" });
Ticket.hasMany(Message, { foreignKey: "ticketId", as: "messages" });

Ticket.belongsTo(Contact, { foreignKey: "contactId", as: "contact" });
Contact.hasMany(Ticket, { foreignKey: "contactId", as: "tickets" });

async function checkMessageDelivery() {
  const companyId = 1; // Ajustar conforme necessário
  const hoursToCheck = 168; // Verificar últimos 7 dias
  
  try {
    await sequelize.authenticate();
    console.log("✅ Conectado ao banco de dados");

    // Buscar TODAS as mensagens enviadas nas últimas X horas
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
      order: [["createdAt", "DESC"]]
    });

    const allMessages = [];
    const issues = [];

    for (const message of messages) {
      const ticket = message.ticket;
      const contact = ticket?.contact;
      
      if (!contact) continue;

      let issue = "";
      let status = "";
      
      // Classificar o problema baseado no ACK
      if (message.ack === 0) {
        issue = "🔴 NÃO ENTREGUE - Falha ao enviar para servidor WhatsApp";
        status = "PROBLEMA";
      } else if (message.ack === 1) {
        issue = "🟡 ENTREGUE MAS NÃO LIDO - Mensagem entregue ao dispositivo";
        status = "ATENÇÃO";
      } else if (message.ack === 2) {
        issue = "🟠 LIDO MAS POSSÍVEL BLOQUEIO - Contato pode ter bloqueado o número";
        status = "PROBLEMA";
      } else if (message.ack === 3) {
        issue = "🟢 LIDO E RECEBIDO - Mensagem lida com sucesso";
        status = "OK";
      } else if (message.ack === 4) {
        issue = "🟵 LIDO EM OUTRO DISPOSITIVO - Mensagem lida em outro dispositivo";
        status = "OK";
      } else {
        issue = `❓ ACK DESCONHECIDO (${message.ack})`;
        status = "DESCONHECIDO";
      }

      const messageInfo = {
        messageId: message.id,
        ticketId: ticket.id,
        contactName: contact.name || "Sem nome",
        contactNumber: contact.number,
        messageBody: message.body || (message.mediaType === "document" ? `📄 ${message.mediaUrl}` : "Mídia"),
        ack: message.ack,
        createdAt: message.createdAt,
        fromMe: message.fromMe,
        issue,
        status
      };

      allMessages.push(messageInfo);
      
      if (status === "PROBLEMA" || status === "ATENÇÃO") {
        issues.push(messageInfo);
      }
    }

    // Relatório detalhado
    console.log("\n" + "=".repeat(80));
    console.log(`📊 RELATÓRIO DE ENTREGA DE MENSAGENS - Últimas ${Math.floor(hoursToCheck/24)} dias`);
    console.log("=".repeat(80));
    console.log(`📈 Total de mensagens enviadas: ${allMessages.length}`);
    console.log(`⚠️  Mensagens com problemas: ${issues.length}`);

    if (allMessages.length === 0) {
      console.log("✅ Nenhuma mensagem encontrada no período!");
      return;
    }

    // Agrupar por tipo de ACK
    const byAck = allMessages.reduce((acc, msg) => {
      acc[msg.ack] = (acc[msg.ack] || 0) + 1;
      return acc;
    }, {});

    console.log("\n📈 ESTATÍSTICAS POR ACK:");
    Object.entries(byAck).forEach(([ack, count]) => {
      const status = ack === "0" ? "🔴 Não Entregue" : 
                    ack === "1" ? "🟡 Entregue" : 
                    ack === "2" ? "🟠 Lido" :
                    ack === "3" ? "🟢 Lido+Recebido" :
                    ack === "4" ? "🟵 Outro dispositivo" : 
                    `❓ ACK=${ack}`;
      const percentage = ((count / allMessages.length) * 100).toFixed(1);
      console.log(`  ${status}: ${count} mensagens (${percentage}%)`);
    });

    // Mostrar apenas problemas se houver
    if (issues.length > 0) {
      console.log("\n📋 DETALHES DOS PROBLEMAS:");
      console.log("-".repeat(80));
      
      issues.slice(0, 20).forEach((issue, index) => {
        console.log(`\n${index + 1}. ${issue.issue}`);
        console.log(`   Contato: ${issue.contactName} (${issue.contactNumber})`);
        console.log(`   Mensagem: ${issue.messageBody.substring(0, 50)}${issue.messageBody.length > 50 ? "..." : ""}`);
        console.log(`   Ticket: #${issue.ticketId} | Message ID: ${issue.messageId}`);
        console.log(`   Data: ${issue.createdAt.toLocaleString("pt-BR")}`);
      });

      if (issues.length > 20) {
        console.log(`\n... e mais ${issues.length - 20} mensagens com problemas`);
      }
    }

    // Verificar conexões WhatsApp
    console.log("\n🔍 VERIFICANDO CONEXÕES WHATSAPP:");
    console.log("-".repeat(40));
    
    const connections = await Whatsapp.findAll({
      where: { companyId }
    });

    for (const whatsapp of connections) {
      try {
        console.log(`  WhatsApp ID ${whatsapp.id}: 🟢 Configurado`);
        console.log(`    Número: ${whatsapp.number || "Não identificado"}`);
        console.log(`    Status: ${whatsapp.status || "Desconhecido"}`);
      } catch (error) {
        console.log(`  WhatsApp ID ${whatsapp.id}: 🔴 Erro ao verificar status`);
      }
    }

    // Recomendações
    console.log("\n💡 RECOMENDAÇÕES:");
    console.log("-".repeat(40));
    
    if (byAck[2] > 0) {
      console.log("⚠️  Muitas mensagens com ACK=2 podem indicar:");
      console.log("   - Contatos bloquearam seu número");
      console.log("   - Problemas com contatos @lid");
      console.log("   - Número marcado como spam");
    }
    
    if (byAck[0] > 0) {
      console.log("🚨 Mensagens com ACK=0 indicam problemas de conexão:");
      console.log("   - Verifique status da conexão WhatsApp");
      console.log("   - Reconecte o dispositivo se necessário");
    }
    
    if (byAck[1] > 5) {
      console.log("📱 Muitas mensagens não lidas (ACK=1):");
      console.log("   - Normal para contatos que não abriram a conversa");
      console.log("   - Se persistir, pode ser sinal de bloqueio");
    }

    // Verificar especificamente o problema do usuário
    console.log("\n🎯 ANÁLISE ESPECÍFICA DO PROBLEMA:");
    console.log("-".repeat(50));
    
    const ticket4790 = issues.filter(i => i.ticketId === 4790);
    if (ticket4790.length > 0) {
      console.log("📌 Ticket #4790 (Patricia):");
      ticket4790.forEach(issue => {
        console.log(`   ${issue.issue}`);
        console.log(`   ACK: ${issue.ack} | Data: ${issue.createdAt.toLocaleString("pt-BR")}`);
      });
      
      if (ticket4790.some(i => i.ack === 2)) {
        console.log("\n⚠️  DIAGNÓSTICO: Mensagens com ACK=2 foram lidas pelo WhatsApp");
        console.log("   mas podem não ter sido entregues ao contato.");
        console.log("\n🔧 AÇÕES RECOMENDADAS:");
        console.log("   1. Verificar se o contato bloqueou seu número");
        console.log("   2. Enviar mensagem de teste de outro número");
        console.log("   3. Verificar se há problemas com contatos @lid");
        console.log("   4. Considerar usar API Oficial do WhatsApp");
      }
    }

  } catch (error) {
    console.error("Erro ao verificar entrega:", error);
  } finally {
    await sequelize.close();
  }
}

// Executar verificação
checkMessageDelivery()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
