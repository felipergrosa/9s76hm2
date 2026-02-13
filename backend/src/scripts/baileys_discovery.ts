/**
 * Script de Descoberta Baileys
 * Uso: npx ts-node src/scripts/baileys_discovery.ts <numero>
 */
import "../bootstrap";
import sequelize from "../database";
import Whatsapp from "../models/Whatsapp";
import GetBaileysContactDataService from "../services/WbotServices/GetBaileysContactDataService";
import { getWbot, initWASocket } from "../libs/wbot";
import logger from "../utils/logger";

// Desativar logs excessivos para o script (manter info para diagnóstico)
logger.level = "info";

async function main() {
    const number = process.argv[2];
    if (!number) {
        console.log("\n❌ Erro: Forneça o número para busca.");
        console.log("Exemplo: npx ts-node src/scripts/baileys_discovery.ts 5519999999999\n");
        process.exit(1);
    }

    console.log("\n🔍 Iniciando descoberta para o número:", number);

    try {
        // 1. Encontrar conexão ativa
        const whatsapp = await Whatsapp.findOne({
            where: { status: "CONNECTED", channel: "whatsapp" }
        });

        if (!whatsapp) {
            console.error("❌ Nenhuma conexão WhatsApp (QR Code) ativa encontrada no banco.");
            process.exit(1);
        }

        console.log(`✅ Usando conexão: ${whatsapp.name} (ID: ${whatsapp.id})`);

        // 2. Tentar obter wbot ou inicializar
        let wbot;
        try {
            wbot = getWbot(whatsapp.id);
        } catch (e) {
            console.log("📡 Servidor principal offline ou inacessível. Inicializando socket temporário...");
            wbot = await initWASocket(whatsapp);

            // Pequeno delay para garantir que o socket estabilizou
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        if (!wbot) {
            throw new Error("Não foi possível estabelecer conexão com o WhatsApp.");
        }

        // 3. Executar descoberta
        const data = await GetBaileysContactDataService(whatsapp.id, number);

        console.log("\n============================================================");
        console.log("📊 MAPEAMENTO BRUTO DE CAMPOS (BAILEYS)");
        console.log("============================================================\n");

        // Imprimir o JSON completo para o usuário
        console.log(JSON.stringify(data, null, 2));

        console.log("\n============================================================");
        console.log("✅ Descoberta concluída.");

    } catch (err: any) {
        console.error("\n❌ Erro durante a execução:");
        console.error(err.message);
    }

    process.exit(0);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
