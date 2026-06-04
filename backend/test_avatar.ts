import { getWbot } from "./src/libs/wbot";
import Whatsapp from "./src/models/Whatsapp";

async function testAvatar() {
  try {
    const whatsapps = await Whatsapp.findAll({ where: { status: "CONNECTED" } });
    if (whatsapps.length === 0) {
      console.log("Nenhum whatsapp conectado");
      process.exit(0);
    }

    // Usar o primeiro conectado
    const whatsappId = whatsapps[0].id;
    console.log("Usando whatsappId", whatsappId);
    
    const wbot = getWbot(whatsappId);
    const jids = ["5519999918415@s.whatsapp.net", "5511913719902@s.whatsapp.net"];

    for (const jid of jids) {
      console.log(`Buscando avatar para ${jid}...`);
      try {
        const start = Date.now();
        const urlImage = await Promise.race([
          wbot.profilePictureUrl(jid, "image"),
          new Promise((_, rej) => setTimeout(() => rej(new Error("Timeout image")), 15000))
        ]);
        console.log(`[${Date.now() - start}ms] URL (image):`, urlImage);
      } catch (e) {
        console.log(`Erro image para ${jid}:`, e.message);
      }

      try {
        const start = Date.now();
        const urlPreview = await Promise.race([
          wbot.profilePictureUrl(jid, "preview"),
          new Promise((_, rej) => setTimeout(() => rej(new Error("Timeout preview")), 15000))
        ]);
        console.log(`[${Date.now() - start}ms] URL (preview):`, urlPreview);
      } catch (e) {
        console.log(`Erro preview para ${jid}:`, e.message);
      }
    }
  } catch (e) {
    console.error("Erro fatal:", e);
  }
  process.exit(0);
}

testAvatar();
