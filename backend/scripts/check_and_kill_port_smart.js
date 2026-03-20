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
          resolve({ isDocker: false, isWhaticket: false });
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
          let whaticketFound = false;
          let checked = 0;
          
          pids.forEach(pid => {
            exec(`tasklist | findstr ${pid}`, (err, stdout, stderr) => {
              checked++;
              if (stdout && (stdout.includes('Docker') || stdout.includes('com.docker'))) {
                dockerFound = true;
                // Verificar se é o container whaticket-backend pelo nome do processo
                if (stdout.toLowerCase().includes('whaticket') || 
                    stdout.toLowerCase().includes('backend')) {
                  whaticketFound = true;
                }
              }
              
              if (checked === pids.length) {
                resolve({ isDocker: dockerFound, isWhaticket: whaticketFound });
              }
            });
          });
        } else {
          resolve({ isDocker: false, isWhaticket: false });
        }
      });
    } else {
      // Linux/macOS - verificar se é Docker
      exec(`lsof -i :${port}`, (err, stdout, stderr) => {
        if (err) {
          resolve({ isDocker: false, isWhaticket: false });
          return;
        }
        const isDocker = stdout.includes('docker');
        const isWhaticket = stdout.toLowerCase().includes('whaticket') || 
                           stdout.toLowerCase().includes('backend');
        resolve({ isDocker, isWhaticket });
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
      const { isDocker, isWhaticket } = await checkIfDockerProcess(port);
      
      if (isDocker && isWhaticket) {
        // É o whaticket-backend - para automaticamente (comportamento original)
        console.log(`Porta ${port} está em uso pelo container whaticket-backend.`);
        console.log(`🛑 Parando container para liberar porta...`);
        
        await new Promise((resolve) => {
          exec('docker stop whaticket-backend', (err, stdout, stderr) => {
            if (err) {
              console.error(`❌ Erro ao parar container: ${stderr}`);
              // Se falhar, tenta matar o processo na porta diretamente
              console.log(`⚠️ Tentando liberar porta diretamente...`);
            } else {
              console.log(`✅ Container parado.`);
            }
            resolve();
          });
        });
        
        // Aguardar porta ser liberada
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } else if (isDocker) {
        // É outro container Docker (não whaticket) - tenta parar também
        console.log(`Porta ${port} está em uso por outro processo Docker.`);
        console.log(`🛑 Tentando liberar porta...`);
        await killProcessOnPort(port);
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } else {
        // Não é Docker - tenta liberar a porta (comportamento original)
        console.log(`Porta ${port} está em uso. Tentando liberar...`);
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
