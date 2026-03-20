const { exec } = require('child_process');
const net = require('net');
const path = require('path');

// Carregar variáveis do .env
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const port = process.env.PORT || 8080; // Use a porta do .env ou 8080 como padrão

function checkPort(port) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        resolve(true); // Porta em uso
      } else {
        reject(err);
      }
    });
    server.once('listening', () => {
      server.close();
      resolve(false); // Porta livre
    });
    server.listen(port);
  });
}

async function checkIfDockerProcess(port) {
  return new Promise((resolve) => {
    if (process.platform === 'win32') {
      exec(`netstat -ano | findstr :${port}`, (err, stdout, stderr) => {
        if (err) {
          resolve(false);
          return;
        }
        
        const lines = stdout.split('\n');
        const pids = [];
        lines.forEach(line => {
          const match = line.match(/\sLISTENING\s+(\d+)/);
          if (match) {
            pids.push(match[1]);
          }
        });

        if (pids.length > 0) {
          // Verificar se algum PID é um processo Docker
          let dockerFound = false;
          let checked = 0;
          
          pids.forEach(pid => {
            exec(`tasklist | findstr ${pid}`, (err, stdout, stderr) => {
              checked++;
              if (stdout && (stdout.includes('Docker') || stdout.includes('com.docker'))) {
                dockerFound = true;
              }
              
              if (checked === pids.length) {
                resolve(dockerFound);
              }
            });
          });
        } else {
          resolve(false);
        }
      });
    } else {
      // Linux/macOS - verificar se é Docker
      exec(`lsof -i :${port}`, (err, stdout, stderr) => {
        if (err) {
          resolve(false);
          return;
        }
        resolve(stdout.includes('docker'));
      });
    }
  });
}

async function killProcessOnPort(port, maxAttempts = 5) {
  console.log(`Tentando liberar a porta ${port}...`);
  if (process.platform === 'win32') {
    // Windows
    let attempt = 0;
    let found = true;
    while (found && attempt < maxAttempts) {
      found = false;
      await new Promise((resolve) => {
        exec(`netstat -ano | findstr :${port}`, (err, stdout, stderr) => {
          if (err) {
            console.error(`Erro ao executar netstat: ${stderr}`);
            resolve();
            return;
          }
          const lines = stdout.split('\n');
          const pids = [];
          lines.forEach(line => {
            const match = line.match(/\sLISTENING\s+(\d+)/);
            if (match) {
              pids.push(match[1]);
            }
          });

          if (pids.length > 0) {
            found = true;
            let killed = 0;
            pids.forEach(pid => {
              exec(`taskkill /PID ${pid} /F`, (err, stdout, stderr) => {
                if (err) {
                  console.error(`Erro ao matar processo ${pid}: ${stderr}`);
                } else {
                  console.log(`Processo ${pid} na porta ${port} finalizado.`);
                }
                killed++;
                if (killed === pids.length) resolve();
              });
            });
          } else {
            resolve();
          }
        });
      });
      attempt++;
      if (found) await new Promise(r => setTimeout(r, 1000));
    }
    if (attempt === maxAttempts) {
      console.warn(`Ainda restam processos na porta ${port} após ${maxAttempts} tentativas.`);
    }
  } else {
    // Linux/macOS
    exec(`lsof -t -i :${port} | xargs kill -9`, (err, stdout, stderr) => {
      if (err) {
        console.error(`Erro ao liberar a porta ${port}: ${stderr}`);
      } else {
        console.log(`Porta ${port} liberada.`);
      }
    });
  }
}

(async () => {
  console.log(`Verificando se a porta ${port} está em uso...`);
  try {
    const inUse = await checkPort(port);
    if (inUse) {
      // Verificar se é um processo Docker
      const isDocker = await checkIfDockerProcess(port);
      
      if (isDocker) {
        console.log(`Porta ${port} está em uso por um processo Docker.`);
        console.log(`⚠️  Para desenvolvimento local, pare o container whaticket-backend:`);
        console.log(`   docker stop whaticket-backend`);
        console.log(`   Ou use uma porta diferente alterando PORT no .env`);
        console.log(`   Ex: PORT=8081 pnpm run dev`);
        process.exit(1);
      } else {
        console.log(`Porta ${port} está em uso por outro processo. Tentando liberar...`);
        await killProcessOnPort(port);
        // Dar um pequeno tempo para o processo ser finalizado
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } else {
      console.log(`Porta ${port} não está em uso.`);
    }
  } catch (error) {
    console.error(`Erro ao verificar a porta: ${error.message}`);
  }
})();
