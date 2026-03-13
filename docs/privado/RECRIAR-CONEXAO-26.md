# RECRIAR CONEXÃO #26

## 1. Via Interface (Recomendado)
- Acesse o 9s76hm2
- Vá em "Conexões WhatsApp"
- Clique em "Adicionar Conexão"
- Configure com:
  - Nome: Felipe Rosa (ou similar)
  - Número: +5519992461008
  - Tipo: WhatsApp (Baileys)
  - QR Code será gerado automaticamente

## 2. Via SQL (se preferir)
INSERT INTO "Whatsapps" (
    name, 
    "number", 
    status, 
    channelType, 
    channel, 
    "isDefault",
    companyId,
    "createdAt",
    "updatedAt"
) VALUES (
    'Felipe Rosa', 
    '+5519992461008', 
    'OPENING', 
    'baileys', 
    'whatsapp', 
    false,
    1,
    NOW(),
    NOW()
);

## 3. Após Criar
- Reinicie o backend: npm run dev
- Escaneie o QR Code
- Teste envio/recebimento de mensagens

## IMPORTANTE:
- Só conecte UM ambiente por vez
- Se conectar em prod, mantenha dev desconectado
- Se precisar testar em dev, desconecte prod primeiro
