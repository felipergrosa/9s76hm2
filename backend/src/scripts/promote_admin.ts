import sequelize from "../database";
import User from "../models/User";

const run = async () => {
    try {
        console.log("Connecting...");
        await sequelize.authenticate();
        console.log("Connected.");

        const email = "comercial@nobreluminarias.com.br";
        const user = await User.findOne({ where: { email } });

        if (user) {
            await user.update({ super: true });
            console.log(`✅ SUCCESS: User ${email} (ID: ${user.id}) is now SUPER ADMIN.`);
        } else {
            console.log(`❌ ERROR: User ${email} not found.`);
        }
    } catch (e) {
        console.error("FATAL:", e);
    }
    process.exit(0);
};

run();
