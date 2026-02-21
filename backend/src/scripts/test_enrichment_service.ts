import Contact from "../models/Contact";
import ContactEnrichmentService from "../services/ContactServices/ContactEnrichmentService";
import "../bootstrap";

async function testEnrichment() {
    const phoneNumber = process.argv[2];
    const whatsappId = Number(process.argv[3] || "13");

    if (!phoneNumber) {
        console.error("Uso: npx ts-node src/scripts/test_enrichment_service.ts <numero>");
        process.exit(1);
    }

    try {
        console.log(`🚀 Buscando contato ${phoneNumber} no banco...`);
        let contact = await Contact.findOne({ where: { number: phoneNumber } });

        if (!contact) {
            console.log("⚠️ Contato não existe no banco. Criando temporário...");
            contact = await Contact.create({
                number: phoneNumber,
                name: phoneNumber,
                companyId: 1,
                whatsappId: whatsappId
            });
        }

        console.log("🛠️ Chamando ContactEnrichmentService...");
        await ContactEnrichmentService.enrichContact(contact.id, whatsappId);

        const updatedContact = await Contact.findByPk(contact.id);
        console.log("\n✅ Contato atualizado com sucesso!");
        console.log("============================================================");
        console.log("DADOS SALVOS:");
        console.log(`- Nome Sugerido (Notify): ${updatedContact.notify}`);
        console.log(`- Nome Verificado: ${updatedContact.verifiedName}`);
        console.log(`- Categoria Business: ${updatedContact.businessCategory}`);
        console.log(`- Status (About): ${updatedContact.about}`);
        console.log(`- Foto HD: ${updatedContact.profilePicUrlHD ? "Sim" : "Não"}`);
        console.log(`- Descoberta em: ${updatedContact.lastDiscoveryAt}`);
        console.log("============================================================");

    } catch (error) {
        console.error("❌ Erro no teste:", error);
    } finally {
        process.exit(0);
    }
}

testEnrichment();
