# Script para forçar novo QR Code - WhatsApp ID=15
# Execute: .\forcar-novo-qr.ps1

Write-Host "🔧 Forçando novo QR Code para sessão ID=15..." -ForegroundColor Yellow

# 1. Parar backend se estiver rodando
Write-Host "`n1️⃣ Verificando se backend está rodando..." -ForegroundColor Cyan
$backendProcess = Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -like "*backend*" -or $_.CommandLine -like "*backend*" }
if ($backendProcess) {
    Write-Host "   Backend encontrado. Você precisa parar manualmente (Ctrl+C no terminal do backend)" -ForegroundColor Yellow
    Write-Host "   Pressione ENTER após parar o backend..." -ForegroundColor Yellow
    Read-Host
}

# 2. Limpar pasta de sessão
Write-Host "`n2️⃣ Limpando pasta de sessão..." -ForegroundColor Cyan
$sessionPath = ".\backend\private\sessions\1\15"
if (Test-Path $sessionPath) {
    Remove-Item -Path $sessionPath -Recurse -Force
    Write-Host "   ✅ Pasta removida: $sessionPath" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  Pasta não encontrada: $sessionPath" -ForegroundColor Yellow
}

# 3. Instruções SQL
Write-Host "`n3️⃣ Execute o SQL abaixo no seu banco de dados:" -ForegroundColor Cyan
Write-Host @"

-- Copie e execute no pgAdmin/DBeaver:
UPDATE "Whatsapps" SET status = 'PENDING', qrcode = '', "retries" = 0 WHERE id = 15;
DELETE FROM "BaileysKeys" WHERE "whatsappId" = 15;
DELETE FROM "BaileysChats" WHERE "whatsappId" = 15;
DELETE FROM "BaileysContacts" WHERE "whatsappId" = 15;

"@ -ForegroundColor White

Write-Host "   Pressione ENTER após executar o SQL..." -ForegroundColor Yellow
Read-Host

# 4. Reiniciar backend
Write-Host "`n4️⃣ Reiniciando backend..." -ForegroundColor Cyan
Write-Host "   Execute manualmente: cd backend && npm run dev" -ForegroundColor Yellow
Write-Host "   OU pressione ENTER para tentar iniciar automaticamente..." -ForegroundColor Yellow
Read-Host

Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; npm run dev"
Write-Host "   ✅ Backend iniciado em nova janela" -ForegroundColor Green

Write-Host "`n✅ CONCLUÍDO!" -ForegroundColor Green
Write-Host "   Acesse o frontend e clique em 'Conectar' para gerar novo QR Code" -ForegroundColor Cyan
