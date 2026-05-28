/**
 * Script para verificar e corrigir avatares corrompidos
 * Executa: node scripts/verify-avatars.js
 * 
 * O que faz:
 * 1. Lista todos os contatos com urlPicture preenchido
 * 2. Verifica se o arquivo físico existe e tem tamanho válido (>100 bytes)
 * 3. Se arquivo não existir ou for muito pequeno, limpa urlPicture para forçar re-download
 * 4. Limpa profilePicUrl que seja placeholder (nopicture.png)
 * 5. Verifica se o caminho no banco está no formato correto
 */

require("dotenv").config();

const path = require("path");
const fs = require("fs");
const { Op } = require("sequelize");

// Inicializar models
const Contact = require("../dist/models/Contact").default;

const publicFolder = path.resolve(__dirname, "..", "public");

const MIN_AVATAR_SIZE = 100; // bytes

async function main() {
  console.log("[VerifyAvatars] Iniciando verificação de avatares...");
  console.log(`[VerifyAvatars] Pasta pública: ${publicFolder}`);

  const contacts = await Contact.findAll({
    where: {
      urlPicture: { [Op.ne]: null }
    },
    attributes: ["id", "name", "number", "companyId", "urlPicture", "profilePicUrl", "uuid"]
  });

  console.log(`[VerifyAvatars] ${contacts.length} contatos com urlPicture no banco`);

  let fixed = 0;
  let valid = 0;
  let missing = 0;

  for (const contact of contacts) {
    const rawUrlPicture = contact.getDataValue("urlPicture");
    const companyId = contact.companyId;
    const contactId = contact.id;

    // Se urlPicture é o próprio placeholder, limpar
    if (rawUrlPicture === "nopicture.png" || rawUrlPicture.includes("nopicture")) {
      console.log(`[VerifyAvatars] contactId=${contactId} - urlPicture é placeholder, limpando`);
      await contact.update({ urlPicture: null, pictureUpdated: false });
      fixed++;
      continue;
    }

    // Montar caminho físico esperado
    let relativePath = rawUrlPicture;
    // Se vier com subpastas, usar como relativo
    if (!relativePath.includes("/")) {
      relativePath = `contacts/${relativePath}`;
    }
    const expectedPath = path.resolve(publicFolder, `company${companyId}`, relativePath);

    // Verificar existência e tamanho
    let exists = false;
    let size = 0;
    try {
      const stats = fs.statSync(expectedPath);
      exists = true;
      size = stats.size;
    } catch (e) {
      exists = false;
    }

    if (!exists) {
      console.log(`[VerifyAvatars] contactId=${contactId} - arquivo NÃO EXISTE: ${expectedPath}`);
      // Limpar urlPicture para forçar re-download
      await contact.update({ urlPicture: null, pictureUpdated: false });
      missing++;
      fixed++;
      continue;
    }

    if (size < MIN_AVATAR_SIZE) {
      console.log(`[VerifyAvatars] contactId=${contactId} - arquivo MUITO PEQUENO (${size} bytes): ${expectedPath}`);
      // Remover arquivo corrompido e limpar banco
      try { fs.unlinkSync(expectedPath); } catch (e) {}
      await contact.update({ urlPicture: null, pictureUpdated: false });
      fixed++;
      continue;
    }

    // Verificar se profilePicUrl é placeholder
    const profilePic = contact.getDataValue("profilePicUrl") || "";
    if (profilePic.includes("nopicture.png")) {
      console.log(`[VerifyAvatars] contactId=${contactId} - profilePicUrl é placeholder, limpando`);
      await contact.update({ profilePicUrl: null });
      fixed++;
      continue;
    }

    valid++;
  }

  console.log("\n[VerifyAvatars] Resumo:");
  console.log(`  - Total contatos verificados: ${contacts.length}`);
  console.log(`  - Arquivos válidos: ${valid}`);
  console.log(`  - Arquivos corrigidos/limpos: ${fixed}`);
  console.log(`  - Arquivos ausentes: ${missing}`);
  console.log("\n[VerifyAvatars] Próximo passo: reinicie o backend para que o RefreshContactAvatarService baixe os avatares novamente.");

  process.exit(0);
}

main().catch(err => {
  console.error("[VerifyAvatars] Erro fatal:", err);
  process.exit(1);
});
