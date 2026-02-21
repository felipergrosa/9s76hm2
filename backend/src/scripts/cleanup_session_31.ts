import "dotenv/config";
import "../database";
import ClearContactSessionService from "../services/WbotServices/ClearContactSessionService";
import logger from "../utils/logger";

const run = async () => {
    console.log("Starting session cleanup for whatsappId=31, contact=192126906318972@lid");

    // Wait for DB connection (simple delay as sequelize init is async side-effect of import)
    await new Promise(resolve => setTimeout(resolve, 3000));

    try {
        const result = await ClearContactSessionService({
            whatsappId: 31,
            contactJid: "192126906318972@lid"
        });

        console.log("Result:", result);
    } catch (err) {
        console.error("Error executing cleanup:", err);
    }

    process.exit(0);
};

run();
