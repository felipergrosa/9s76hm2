# Rotina de sincronização de etiquetas (LabelSyncService)

Este documento descreve o fluxo atual de sincronização de etiquetas e contatos utilizados pelo modal de importação via WhatsApp Web.

## Visão geral

1. **LabelSyncService** centraliza a obtenção das etiquetas.
   - Força `resyncAppState` no Baileys (quando possível) para garantir que os patches `labels.*` sejam emitidos.
   - Limpa e repovoa o cache em memória (`labelCache`) com dados do Baileys persistido (`Baileys.chats`).
   - Quando ainda houver lacunas, utiliza o cliente `whatsapp-web.js` apenas para ler o `LabelStore` (via puppeteer) e persistir as associações.
   - Atualiza `Baileys.chats` via `createOrUpdateBaileysService`, evitando perda de dados em reinicializações.

2. **WhatsAppWebLabelsService.getDeviceLabels**
   - Invoca `LabelSyncService.sync` (TTL de 3 minutos para evitar chamadas redundantes).
   - Lê as etiquetas consolidadas por meio do `GetDeviceLabelsService` (que hoje consome `labelCache` + fallback Baileys).
   - Enriquecer com labels sintéticas:
     - `__all__`: total de contatos 1:1 salvos no aparelho (via snapshot Baileys);
     - `__unlabeled__`: contatos sem etiquetas (cache em memória com TTL de 5 min);
     - `__broadcast__`: quantidade de listas de transmissão encontradas no snapshot;
     - `__group_participants__`: participantes únicos de chats em grupo.

3. **WhatsAppWebLabelsService.getContactsByLabel**
   - Reutiliza `LabelSyncService.sync` para garantir cache atualizado.
   - Lê contatos/associações do snapshot persistido e do `labelCache`.
   - Mantém cache de "Sem etiqueta" para acelerar múltiplas chamadas.
   - Para `__broadcast__`, retorna vazio (WhatsApp não expõe membros).

## Logs relevantes

- `[LabelSyncService] Iniciando sync` / `Sync concluído` — indicam execução da sincronização e fonte (Baileys vs Web).
- `[WhatsAppWebLabels] Sync concluído` — retorna estatísticas (labels persistidos, associações, etc.).
- `[WhatsAppWebLabels] Falha ao computar ...` — logs "best effort" para labels sintéticas (não bloqueiam a sincronização principal).
- `[getUnlabeledJids] ...` — logs do fluxo que calcula contatos sem etiquetas.

## Execução manual / testes

1. Garantir sessão Baileys conectada (`Whatsapp.status = CONNECTED`).
2. Acessar endpoint `/whatsapp-web/labels` (ou iniciar importação no frontend).
3. Acompanhar logs para verificar se houve `Sync concluído` com source `baileys` ou `web`.
4. Validar resposta contendo labels reais + sintéticas.
5. Testar `/whatsapp-web/labels/{id}/contacts` para:
   - Label real (ex.: ID nativo do WhatsApp);
   - `__all__`, `__unlabeled__`, `__broadcast__`, `__group_participants__`.

## Observações / TTLs

- `LabelSyncService` aplica TTL de 3 minutos por `whatsappId` (pode forçar nova sync com `force: true`).
- Cache de "Sem etiqueta" (`unlabeledCache`) expira em 5 minutos.
- Se o Baileys retornar `chats` ou `contacts` vazios, o sistema ainda tenta reconstruir a partir do `LabelStore` via cliente web.

## Pontos de atenção futuros

- Implementar testes automatizados de integração para validar a consistência do cache na importação.
- Expor endpoint administrativo para forçar `LabelSyncService.sync` com `force=true`/`useWebClient=true` sem depender do frontend.
- Monitorar crescimento do cache (limpezas periódicas podem ser necessárias para sessões inativas).
