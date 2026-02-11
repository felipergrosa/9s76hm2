// Script para verificar e corrigir status da conexão WhatsApp
require("dotenv").config();
const { Sequelize, DataTypes } = require("sequelize");

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

// Definir modelo Whatsapp
const Whatsapp = sequelize.define("Whatsapp", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  number: DataTypes.STRING,
  status: DataTypes.STRING,
  companyId: DataTypes.INTEGER,
  session: DataTypes.TEXT,
  qrcode: DataTypes.TEXT,
  createdAt: DataTypes.DATE,
  updatedAt: DataTypes.DATE
}, {
  tableName: "Whatsapps",
  timestamps: true
});

async function fixConnectionStatus() {
  const companyId = 1;
  
  try {
    await sequelize.authenticate();
    console.log("✅ Conectado ao banco de dados");

    // Buscar todas as conexões WhatsApp
    const connections = await Whatsapp.findAll({
      where: { companyId }
    });

    console.log("\n🔍 VERIFICANDO CONEXÕES WHATSAPP:");
    console.log("-".repeat(50));

    for (const whatsapp of connections) {
      console.log(`\n📱 WhatsApp ID: ${whatsapp.id}`);
      console.log(`   Número: ${whatsapp.number || "Não configurado"}`);
      console.log(`   Status: ${whatsapp.status || "Sem status"}`);
      console.log(`   Tem QR Code: ${whatsapp.qrcode ? "Sim" : "Não"}`);
      console.log(`   Tem Sessão: ${whatsapp.session ? "Sim" : "Não"}`);
      
      // Verificar se precisa de reconexão
      if (whatsapp.status === "DISCONNECTED" || !whatsapp.status) {
        console.log(`   ⚠️  PRECISA DE RECONEXÃO`);
        
        // Atualizar status para indicar que precisa reconectar
        await whatsapp.update({
          status: "DISCONNECTED",
          qrcode: null // Limpar QR code antigo
        });
        
        console.log(`   ✅ Status atualizado para DISCONNECTED`);
      } else if (whatsapp.status === "CONNECTED") {
        console.log(`   ✅ Conexão ativa`);
      } else {
        console.log(`   ❓ Status desconhecido: ${whatsapp.status}`);
      }
    }

    console.log("\n💡 RECOMENDAÇÕES:");
    console.log("-".repeat(50));
    console.log("1. Se houver conexões DISCONNECTED:");
    console.log("   - Vá em WhatsApp > Conexões");
    console.log("   - Clique em 'Conectar' para gerar novo QR Code");
    console.log("   - Escaneie o QR Code com o WhatsApp");
    console.log("\n2. Após reconectar:");
    console.log("   - Teste envio de mensagem");
    console.log("   - Verifique se ACK muda para 3 ou 4");
    console.log("\n3. Se problemas persistirem:");
    console.log("   - Verifique se o número não foi bloqueado");
    console.log("   - Considere usar API Oficial do WhatsApp");
    console.log("   - Entre em contato com suporte técnico");

  } catch (error) {
    console.error("Erro ao verificar conexões:", error);
  } finally {
    await sequelize.close();
  }
}

// Executar verificação
fixConnectionStatus()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
