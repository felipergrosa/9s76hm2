const { spawn } = require("child_process");

function runMigrations() {
  return new Promise((resolve) => {
    const child = spawn("npx", ["sequelize", "db:migrate"], {
      stdio: "inherit",
      shell: true,
    });

    child.on("exit", (code) => {
      if (code === 0) {
        console.log("[migrate-safe] Migrações aplicadas com sucesso.");
        resolve(0);
        return;
      }

      console.warn(
        `[migrate-safe] Migrações falharam (código ${code ?? "desconhecido"}). Prosseguindo para iniciar o servidor mesmo assim.`
      );
      resolve(code ?? 1);
    });

    child.on("error", (error) => {
      console.warn(`[migrate-safe] Erro ao executar sequelize db:migrate: ${error.message}`);
      resolve(1);
    });
  });
}

runMigrations().finally(() => process.exit(0));

