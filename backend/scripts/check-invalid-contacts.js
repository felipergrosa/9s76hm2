// Script para identificar contatos com números inválidos
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

// Definir modelo Contact
const Contact = sequelize.define("Contact", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: DataTypes.STRING,
  number: DataTypes.STRING,
  canonicalNumber: DataTypes.STRING,
  companyId: DataTypes.INTEGER,
  isGroup: DataTypes.BOOLEAN,
  remoteJid: DataTypes.STRING,
  createdAt: DataTypes.DATE,
  updatedAt: DataTypes.DATE
}, { tableName: "Contacts", timestamps: true });

async function checkInvalidContacts() {
  const companyId = 1;
  
  try {
    await sequelize.authenticate();
    console.log("✅ Conectado ao banco de dados");

    console.log("\n" + "=".repeat(80));
    console.log("🔍 ANÁLISE DE CONTATOS COM NÚMEROS INVÁLIDOS");
    console.log("=".repeat(80));

    // 1. Buscar todos os contatos que não são grupos
    const allContacts = await Contact.findAll({
      where: {
        companyId,
        isGroup: false
      },
      order: [["createdAt", "DESC"]]
    });

    console.log(`\n📊 Total de contatos (não grupos): ${allContacts.length}`);

    // 2. Analisar cada contato
    const invalidContacts = [];
    const validContacts = [];
    const suspiciousContacts = [];

    for (const contact of allContacts) {
      const number = contact.number || "";
      const canonicalNumber = contact.canonicalNumber || "";
      const remoteJid = contact.remoteJid || "";
      
      // Remover caracteres não numéricos para análise
      const digitsOnly = number.replace(/\D/g, "");
      const canonicalDigits = canonicalNumber.replace(/\D/g, "");
      
      // Critérios de validação
      const isValidLength = digitsOnly.length >= 10 && digitsOnly.length <= 13;
      const isValidCanonical = canonicalDigits.length >= 12 && canonicalDigits.length <= 13;
      const isLinkedDevice = remoteJid.includes("@lid");
      const hasValidFormat = canonicalNumber.startsWith("55") && canonicalDigits.length >= 12;
      
      // Classificação
      if (isLinkedDevice) {
        // Contatos @lid são tratados diferente
        if (digitsOnly.length < 10 || digitsOnly.length > 13) {
          invalidContacts.push({
            ...contact.dataValues,
            reason: "LID com tamanho inválido",
            type: "LID_INVALID"
          });
        } else {
          validContacts.push({
            ...contact.dataValues,
            type: "LID_VALID"
          });
        }
      } else {
        // Contatos normais
        if (!isValidLength || !hasValidFormat) {
          invalidContacts.push({
            ...contact.dataValues,
            reason: `Número inválido: ${digitsOnly.length} dígitos (esperado: 10-13)`,
            type: "INVALID_FORMAT"
          });
        } else if (!canonicalNumber || !isValidCanonical) {
          suspiciousContacts.push({
            ...contact.dataValues,
            reason: `CanonicalNumber ausente ou inválido: ${canonicalNumber}`,
            type: "SUSPICIOUS"
          });
        } else {
          validContacts.push({
            ...contact.dataValues,
            type: "VALID"
          });
        }
      }
    }

    // 3. Relatório detalhado
    console.log(`\n📈 ESTATÍSTICAS:`);
    console.log(`   ✅ Válidos: ${validContacts.length} (${((validContacts.length/allContacts.length)*100).toFixed(1)}%)`);
    console.log(`   ⚠️  Suspeitos: ${suspiciousContacts.length} (${((suspiciousContacts.length/allContacts.length)*100).toFixed(1)}%)`);
    console.log(`   ❌ Inválidos: ${invalidContacts.length} (${((invalidContacts.length/allContacts.length)*100).toFixed(1)}%)`);

    // 4. Mostrar inválidos
    if (invalidContacts.length > 0) {
      console.log("\n" + "=".repeat(80));
      console.log("❌ CONTATOS INVÁLIDOS ENCONTRADOS");
      console.log("=".repeat(80));

      // Agrupar por tipo de problema
      const byType = {};
      invalidContacts.forEach(contact => {
        if (!byType[contact.type]) {
          byType[contact.type] = [];
        }
        byType[contact.type].push(contact);
      });

      Object.entries(byType).forEach(([type, contacts]) => {
        console.log(`\n🔸 ${type}: ${contacts.length} contatos`);
        console.log("-".repeat(40));
        
        contacts.slice(0, 10).forEach((contact, index) => {
          console.log(`${index + 1}. ${contact.name || "Sem nome"}`);
          console.log(`   ID: ${contact.id}`);
          console.log(`   Número: ${contact.number}`);
          console.log(`   Canonical: ${contact.canonicalNumber || "N/A"}`);
          console.log(`   RemoteJid: ${contact.remoteJid || "N/A"}`);
          console.log(`   Motivo: ${contact.reason}`);
          console.log(`   Criado em: ${contact.createdAt?.toLocaleString("pt-BR")}`);
          console.log("");
        });
        
        if (contacts.length > 10) {
          console.log(`   ... e mais ${contacts.length - 10} contatos`);
        }
      });
    }

    // 5. Mostrar suspeitos
    if (suspiciousContacts.length > 0) {
      console.log("\n" + "=".repeat(80));
      console.log("⚠️  CONTATOS SUSPEITOS (precisam verificação)");
      console.log("=".repeat(80));
      
      suspiciousContacts.slice(0, 10).forEach((contact, index) => {
        console.log(`${index + 1}. ${contact.name || "Sem nome"}`);
        console.log(`   ID: ${contact.id}`);
        console.log(`   Número: ${contact.number}`);
        console.log(`   Canonical: ${contact.canonicalNumber || "N/A"}`);
        console.log(`   Motivo: ${contact.reason}`);
        console.log("");
      });
      
      if (suspiciousContacts.length > 10) {
        console.log(`... e mais ${suspiciousContacts.length - 10} contatos suspeitos`);
      }
    }

    // 6. Análise específica dos números da imagem
    console.log("\n" + "=".repeat(80));
    console.log("🎯 ANÁLISE DOS NÚMEROS DA IMAGEM");
    console.log("=".repeat(80));

    const problematicNumbers = [
      "196804410925113",
      "89692187975731", 
      "+93 (54) 87499-0600"
    ];

    for (const badNumber of problematicNumbers) {
      const digits = badNumber.replace(/\D/g, "");
      console.log(`\n🔍 Analisando: "${badNumber}"`);
      console.log(`   Dígitos: ${digits} (${digits.length})`);
      
      // Buscar contatos com este número
      const matches = allContacts.filter(c => 
        c.number === badNumber || 
        c.number === digits || 
        c.canonicalNumber === digits
      );
      
      if (matches.length > 0) {
        console.log(`   ❌ ENCONTRADO ${matches.length} contato(s) com este número:`);
        matches.forEach(match => {
          console.log(`      - ID: ${match.id} | Nome: ${match.name || "Sem nome"} | Criado: ${match.createdAt?.toLocaleString("pt-BR")}`);
        });
      } else {
        console.log(`   ✅ Nenhum contato encontrado com este número exato`);
      }
    }

    // 7. Recomendações
    console.log("\n" + "=".repeat(80));
    console.log("💡 RECOMENDAÇÕES");
    console.log("=".repeat(80));
    
    if (invalidContacts.length > 0) {
      console.log("\n🚨 AÇÕES NECESSÁRIAS:");
      console.log("1. Para contatos inválidos:");
      console.log("   - Verificar se são contatos @lid que precisam de mapeamento");
      console.log("   - Excluir se não tiverem mensagens importantes");
      console.log("   - Corrigir manualmente se possível");
      
      console.log("\n2. Para contatos suspeitos:");
      console.log("   - Verificar canonicalNumber ausente");
      console.log("   - Executar normalização em lote");
      console.log("   - Revisar processo de criação");
      
      console.log("\n3. Para prevenir novos problemas:");
      console.log("   - Verificar validação no CreateContactService");
      console.log("   - Revisar verifyContact no wbotMessageListener");
      console.log("   - Adicionar validação mais rigorosa");
    } else {
      console.log("✅ Nenhum problema crítico encontrado!");
    }

    // 8. Gerar SQL para correção (opcional)
    if (invalidContacts.length > 0) {
      console.log("\n" + "=".repeat(80));
      console.log("🔧 SQL PARA CORREÇÃO (USE COM CUIDADO)");
      console.log("=".repeat(80));
      
      console.log("\n-- Backup dos contatos inválidos:");
      console.log("CREATE TABLE contacts_invalid_backup AS");
      console.log("SELECT * FROM Contacts WHERE id IN (");
      console.log(invalidContacts.map(c => c.id).join(","));
      console.log(");");
      
      console.log("\n-- Excluir contatos inválidos (sem mensagens):");
      console.log("-- ATENÇÃO: Verifique primeiro se não há mensagens importantes!");
      console.log("DELETE FROM Contacts WHERE id IN (");
      console.log(invalidContacts.map(c => c.id).join(","));
      console.log(") AND id NOT IN (SELECT DISTINCT contactId FROM Messages);");
    }

  } catch (error) {
    console.error("❌ Erro ao analisar contatos:", error);
  } finally {
    await sequelize.close();
  }
}

// Executar verificação
checkInvalidContacts()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
