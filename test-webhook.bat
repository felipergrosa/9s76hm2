@echo off
echo ============================================
echo   TESTE DE WEBHOOK - WHATICKET
echo ============================================
echo.

echo [1/5] Testando backend principal...
curl -I https://chatsapi.nobreluminarias.com.br
echo.
echo.

echo [2/5] Testando endpoint webhook...
curl https://chatsapi.nobreluminarias.com.br/webhooks/whatsapp
echo.
echo.

echo [3/5] Testando verificacao do webhook (TESTE IMPORTANTE)...
curl "https://chatsapi.nobreluminarias.com.br/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=602536nblumi2025&hub.challenge=FUNCIONOU"
echo.
echo.

echo ============================================
echo   RESULTADOS:
echo ============================================
echo.
echo Se o Teste 3 retornou "FUNCIONOU", seu webhook esta OK!
echo.
echo Use esta URL na Meta:
echo https://chatsapi.nobreluminarias.com.br/webhooks/whatsapp
echo.
echo Token:
echo 602536nblumi2025
echo.
pause
