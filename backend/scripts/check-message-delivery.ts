import { Sequelize, DataTypes, Op } from "sequelize";
import Whatsapp from "../src/models/Whatsapp";
import Message from "../src/models/Message";
import Contact from "../src/models/Contact";
import Ticket from "../src/models/Ticket";
import Company from "../src/models/Company";
import { getWbot } from "../src/libs/wbot";
import logger from "../src/utils/logger";

const sequelize = new Sequelize(
  process.env.DB_NAME || "whaticket",
  process.env.DB_USER || "postgres", 
  process.env.DB_PASS || "",
  {
    host: process.env.DB_HOST || "localhost",
    dialect: "postgres" as any,
    port: parseInt(process.env.DB_PORT || "5432"),
    logging: false
  }
);

interface DeliveryIssue {
  messageId: number;
  ticketId: number;
  contactName: string;
  contactNumber: string;
  messageBody: string;
  ack: number;
  createdAt: Date;
  fromMe: boolean;
  issue: string;
}

async function checkMessageDelivery() {
  const companyId = 1; // Ajustar conforme necessário
  const hoursToCheck = 24; // Verificar últimas 24 horas
  
  try {
    // Conectar ao banco existente (não inicializar modelos)
    await sequelize.authenticate();

    // Buscar mensagens enviadas nas últimas X horas com ACK baixo
    const messages = await Message.findAll({
      where: {
        companyId,
        fromMe: true,
        ack: {
          [Op.lt]: 3 // ACK menor que 3 (não foi lido)
        },
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

    const issues: DeliveryIssue[] = [];

    for (const message of messages) {
      const ticket = message.ticket as any;
      const contact = ticket?.contact as any;
      
      if (!contact) continue;

      let issue = "";
      
      // Classificar o problema baseado no ACK
      if (message.ack === 0) {
        issue = "🔴 NÃO ENTREGUE - Falha ao enviar para servidor WhatsApp";
      } else if (message.ack === 1) {
        issue = "🟡 ENTREGUE MAS NÃO LIDO - Mensagem entregue ao dispositivo";
      } else if (message.ack === 2) {
        issue = "🟠 LIDO MAS POSSÍVEL BLOQUEIO - Contato pode ter bloqueado o número";
      }

      issues.push({
        messageId: message.id,
        ticketId: ticket.id,
        contactName: contact.name || "Sem nome",
        contactNumber: contact.number,
        messageBody: message.body || (message.mediaType === "document" ? `📄 ${message.mediaUrl}` : "Mídia"),
        ack: message.ack,
        createdAt: message.createdAt,
        fromMe: message.fromMe,
        issue
      });
    }

    // Relatório detalhado
    console.log("\n" + "=".repeat(80));
    console.log(`📊 RELATÓRIO DE ENTREGA DE MENSAGENS - Últimas ${hoursToCheck} horas`);
    console.log("=".repeat(80));

    if (issues.length === 0) {
      console.log("✅ Nenhuma problema de entrega encontrado!");
      return;
    }

    // Agrupar por tipo de problema
    const byAck = issues.reduce((acc, issue) => {
      acc[issue.ack] = (acc[issue.ack] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    console.log("\n📈 ESTATÍSTICAS POR ACK:");
    Object.entries(byAck).forEach(([ack, count]) => {
      const status = ack === "0" ? "🔴 Não Entregue" : ack === "1" ? "🟡 Entregue" : "🟠 Lido";
      console.log(`  ${status} (ACK=${ack}): ${count} mensagens`);
    });

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

    // Verificar conexões WhatsApp
    console.log("\n🔍 VERIFICANDO CONEXÕES WHATSAPP:");
    console.log("-".repeat(40));
    
    const connections = await Whatsapp.findAll({
      where: { companyId }
    });

    for (const whatsapp of connections) {
      try {
        const wbot = getWbot(whatsapp.id);
        const status = wbot?.user ? "🟢 Conectado" : "🔴 Desconectado";
        console.log(`  WhatsApp ID ${whatsapp.id}: ${status}`);
        
        if (wbot?.user?.id) {
          console.log(`    Número: ${wbot.user.id.split("@")[0]}`);
        }
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

  } catch (error) {
    console.error("Erro ao verificar entrega:", error);
  } finally {
    await sequelize.close();
  }
}

// Executar verificação
if (require.main === module) {
  checkMessageDelivery()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export default checkMessageDelivery;
