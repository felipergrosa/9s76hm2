const { exec } = require("child_process");

const port = Number(process.env.PORT || 3000);

async function killProcessOnPort(inPort, maxAttempts = 5) {
  console.log(`[check-port] Liberando porta ${inPort} (até ${maxAttempts} tentativas)...`);

  if (process.platform === "win32") {
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const pids = await new Promise(resolve => {
        exec(`netstat -ano | findstr :${inPort}`, (err, stdout) => {
          if (err || !stdout) {
            resolve([]);
            return;
          }
          const matches = stdout
            .split("\n")
            .map(line => line.match(/\s(LISTENING|ESTABLISHED)\s+(\d+)/))
            .filter(Boolean)
            .map(match => match[2]);
          resolve([...new Set(matches)]);
        });
      });

      if (!pids.length) {
        console.log(`[check-port] Porta ${inPort} já está livre.`);
        return;
      }

      console.log(`[check-port] Encontrados PIDs ${pids.join(", ")} na porta ${inPort} (tentativa ${attempt}).`);

      await Promise.all(
        pids.map(pid =>
          new Promise(resolve => {
            exec(`taskkill /PID ${pid} /F`, err => {
              if (err) {
                console.warn(`[check-port] Falha ao encerrar PID ${pid}: ${err.message}`);
              } else {
                console.log(`[check-port] PID ${pid} encerrado.`);
              }
              resolve(null);
            });
          })
        )
      );

      // espera pequena antes de nova checagem
      await new Promise(resolve => setTimeout(resolve, 800));
    }

    console.warn(`[check-port] Tentativas esgotadas; pode haver processos persistentes na porta ${inPort}.`);
  } else {
    await new Promise(resolve => {
      exec(`lsof -t -i :${inPort}`, (err, stdout) => {
        if (err || !stdout) {
          console.log(`[check-port] Porta ${inPort} já está livre.`);
          resolve(null);
          return;
        }

        const pids = stdout
          .split("\n")
          .map(line => line.trim())
          .filter(Boolean);

        Promise.all(
          pids.map(pid =>
            new Promise(res => {
              exec(`kill -9 ${pid}`, killErr => {
                if (killErr) {
                  console.warn(`[check-port] Falha ao encerrar PID ${pid}: ${killErr.message}`);
                } else {
                  console.log(`[check-port] PID ${pid} encerrado.`);
                }
                res(null);
              });
            })
          )
        ).finally(() => resolve(null));
      });
    });
  }
}

(async () => {
  try {
    await killProcessOnPort(port);
  } catch (err) {
    console.error(`[check-port] Erro ao liberar porta ${port}: ${err.message}`);
  }
})();
