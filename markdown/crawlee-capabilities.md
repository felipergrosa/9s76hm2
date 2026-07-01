# Análise de Recursos Avançados do Crawlee para o Whaticket

Este documento detalha todos os recursos e funções nativas do **Crawlee** que podemos utilizar para realizar engenharia reversa, análise de layouts, validação de regras de negócio, dados e captura de lógica de aplicações alvo (como Sellflux, CRM ou painéis de atendimento).

---

## 🗺️ Mapa de Recursos do Crawlee (Feature Map)

O diagrama abaixo mapeia como as diferentes APIs e funções do Crawlee se aplicam à captura de Layout, Estrutura e Lógica:

```mermaid
flowchart TD
    Start([Início da Investigação]) --> CrawleeTools[Recursos e APIs do Crawlee]
    
    CrawleeTools --> LayoutCapture[1. Captura de Layout & UI]
    LayoutCapture --> FullPageScreenshot[Screenshots de Elemento ou Página Inteira]
    LayoutCapture --> VideoRecord[Gravação de Vídeo de Interações]
    LayoutCapture --> CSSAnalysis[Extração de Estilos CSS e Tailwind]
    
    CrawleeTools --> StructCapture[2. Captura de Estrutura & APIs]
    StructCapture --> APIIntercept[Interceptação de Rede (Request/Response)]
    StructCapture --> DatasetStore[Datasets Estruturados (JSON, CSV)]
    StructCapture --> WSIntercept[Monitoramento de WebSockets & Eventos]
    
    CrawleeTools --> LogicCapture[3. Captura de Lógica & Sessão]
    LogicCapture --> SessionPool[SessionPool (Reuso de Cookies e Login)]
    LogicCapture --> LocalStorage[Key-Value Store (Persistir tokens JWT)]
    
    CrawleeTools --> BypassTools[4. Contorno de Bloqueios & CAPTCHAs]
    BypassTools --> Fingerprinting[Geração de Fingerprints Reais]
    BypassTools --> HumanEmulation[Simulação de Movimento de Mouse e Cliques]
```

---

## 1. Funções de Captura de Layout e Interface (UI)

Para recriar telas modernas no frontend do Whaticket, precisamos saber como as interfaces se comportam visualmente:

### A. Screenshots de Elementos Específicos
Em vez de capturar a tela inteira, o Crawlee (via Playwright/Puppeteer) permite isolar componentes específicos do DOM (como o modal de campanhas, a barra lateral de chats ou o card de contatos) e tirar prints focados.
* **Uso no código:**
  ```typescript
  const element = page.locator('.chat-sidebar-container');
  await element.screenshot({ path: 'storage/datasets/sellflux_capture/sidebar.png' });
  ```

### B. Gravação de Vídeo de Interação (Videos / Screencasts)
Muito útil para analisar animações, transições de gavetas laterais, carregamentos (loaders) e micro-interações do painel de chat.
* **Uso no código (Playwright):**
  Ao configurar o contexto, ativa-se o registro de vídeo:
  ```typescript
  const context = await browser.newContext({
    recordVideo: { dir: 'storage/datasets/sellflux_capture/videos/' }
  });
  ```

### C. Extração e Mineração de Classes CSS / Tailwind
Podemos fazer o Crawlee varrer o DOM, ler os atributos `class` das tags HTML e salvar quais classes de estilos (como Tailwind) ou variáveis CSS de cores eles usam para estilizar a aplicação.
* **Uso no código:**
  ```typescript
  const classes = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('*'))
      .map(el => el.className)
      .filter(name => typeof name === 'string' && name.length > 0);
  });
  ```

---

## 2. Funções de Captura de Estrutura (Dados e Requisições)

Para saber qual o formato de dados que o Whaticket precisa enviar ou receber para implementar novos recursos:

### A. Interceptação de API Rest (HTTP Request/Response Listener)
Diferente de baixar o código HTML estático, o Crawlee intercepta e lê o conteúdo de todas as requisições AJAX assíncronas que ocorrem em segundo plano (como as rotas `/leads`, `/campaigns`, `/pipelines`). Já implementamos esta função no script `playwhat.ts`.

### B. Interceptação e Escuta de WebSockets (Tempo Real)
Aplicações de chat em tempo real dependem de conexões WebSocket. O Playwright (dentro do Crawlee) permite escutar a abertura de canais WebSocket e logar todas as mensagens enviadas e recebidas no chat em tempo real para estudarmos a lógica de mensagens.
* **Uso no código:**
  ```typescript
  page.on('websocket', ws => {
    console.log(`Conexão WebSocket aberta: ${ws.url()}`);
    ws.on('framereceived', frame => console.log(`[WS Recebido] -> ${frame.payload}`));
    ws.on('framesent', frame => console.log(`[WS Enviado] -> ${frame.payload}`));
  });
  ```

### C. Geração Nativa de Datasets (JSON, CSV, XLSX)
O Crawlee possui a classe `Dataset` que automatiza a conversão de payloads raspados em tabelas Excel, arquivos CSV ou arquivos JSON estruturados sem a necessidade de escrever scripts de gravação complexos.
* **Uso no código:**
  ```typescript
  import { Dataset } from 'crawlee';
  await Dataset.pushData({ rota: '/campanha', dados: payload });
  ```

---

## 3. Funções de Gestão de Estado e Lógica de Negócio

Para navegar de forma automatizada sem ter que digitar login ou resolver CAPTCHAs a cada execução:

### A. Persistência de Sessão e Cookies (`SessionPool`)
O Crawlee cria um pool de sessões (`SessionPool`) que gerencia cookies, tokens e cabeçalhos automaticamente. Podemos exportar os cookies de login bem-sucedido e importá-los na próxima execução do script. Assim, o navegador já inicia logado no painel direto, sem passar pela tela de login (pulando o CAPTCHA).
* **Uso no código:**
  ```typescript
  // Salva o estado de autenticação (cookies, localStorage, sessionStorage)
  await context.storageState({ path: 'storage/state.json' });

  // Na próxima inicialização, carrega o estado salvo:
  const context = await browser.newContext({ storageState: 'storage/state.json' });
  ```

### B. Armazenamento Chave-Valor (`KeyValueStore`)
O Crawlee dispõe do `KeyValueStore` para armazenar estados lógicos, listas de parâmetros, tokens JWT capturados do cabeçalho `Authorization` de requisições, ou configurações personalizadas.

---

## 4. Emulação Humana e Contorno de Bloqueios

Para que a aplicação de destino não bloqueie a raspagem ou ative CAPTCHAs repetidamente:

### A. Emulação de Browser Real (`Browser Fingerprints`)
O Crawlee inclui um emulador de impressões digitais de navegadores reais (`fingerprint-generator`). Ele simula resoluções de tela, placas de vídeo, suporte a fontes e propriedades do navegador idênticas a um usuário comum navegando no Chrome, Safari ou Firefox de forma orgânica.
* **Uso no código:**
  O Crawlee aplica isso por padrão ao utilizar `PlaywrightCrawler` ou `PuppeteerCrawler`, tornando a automação muito mais silenciosa e indetectável.

### B. Simulação de Ações Humanas (Movimentação e Digitação Real)
O Playwright permite simular a movimentação do mouse até os elementos (com delay), simular cliques aleatórios, rolagem suave de página (`page.mouse.wheel`) e digitação com atrasos realistas entre as teclas (`delay: 100`).
* **Uso no código:**
  ```typescript
  await page.type('#email', 'mail@feliperosa.net', { delay: 150 });
  ```
