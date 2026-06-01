import "./src/database";
import User from "./src/models/User";

const run = async () => {
  setTimeout(async () => {
    const user = await User.findByPk(3);
    if (user) {
      await user.update({ password: "123456" });
      console.log("Senha do user 3 (felipe) atualizada para 123456");
    }
    process.exit(0);
  }, 2000);
}
run();
