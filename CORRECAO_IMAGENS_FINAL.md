# 🎯 PROBLEMA DAS IMAGENS - ANÁLISE E CORREÇÃO

## 🔍 PROBLEMA IDENTIFICADO

### Baileys funciona ✅
```
mediaUrl: contact1676/1763229458745.jpeg
         ↓
Getter Message.ts: http://localhost:8080/public/company1/contact1676/1763229458745.jpeg
         ↓
ModalImageCors: api.get(cleanUrl)
         ↓
axios baseURL: http://localhost:8080
+ cleanUrl: /public/company1/contact1676/1763229458745.jpeg
         ↓
URL final: http://localhost:8080/public/company1/contact1676/1763229458745.jpeg
         ↓
✅ FUNCIONA! Baixa blob → exibe
```

### API Oficial NÃO funciona ❌
```
mediaUrl: contact1676/1703441966659_image.png
         ↓
Getter Message.ts: https://chatsapi.nobreluminarias.com.br/public/company1/contact1676/1703441966659_image.png
         ↓
ModalImageCors: api.get(cleanUrl)
         ↓
axios baseURL: https://chats.nobreluminarias.com.br (FRONTEND)
+ cleanUrl: https://chatsapi.nobreluminarias.com.br/public/company1/contact1676/... (URL ABSOLUTA!)
         ↓
URL final: https://chats.nobreluminarias.com.br/https://chatsapi.nobreluminarias.com.br/...
         ↓
❌ URL INVÁLIDA! Não carrega!
```

---

## ⚠️ CAUSA RAIZ

### Getter do Message.ts

```typescript
// backend/src/models/Message.ts linha 50-66
get mediaUrl(): string | null {
  if (this.getDataValue("mediaUrl")) {
    const fileRel = this.getDataValue("mediaUrl");  // "contact1676/arquivo.jpg"
    const be = (process.env.BACKEND_URL || '').trim();
    const origin = be || ...;
    
    const base = origin
      ? `${origin}/public/company${this.companyId}/${fileRel}`  // ← URL COMPLETA
      : `/public/company${this.companyId}/${fileRel}`;           // ← URL RELATIVA
    
    return base;
  }
  return null;
}
```

**Problema:**
- Se `BACKEND_URL` está definido → retorna URL **absoluta** (com domínio)
- Se não está → retorna URL **relativa**

**Baileys funciona porque:**
- Seu `.env` não tem `BACKEND_URL` definido corretamente
- OU `BACKEND_URL` aponta para o mesmo domínio do frontend
- Então retorna URL relativa → axios funciona

**API Oficial não funciona porque:**
- `BACKEND_URL=https://chatsapi.nobreluminarias.com.br` (domínio diferente!)
- Getter retorna URL absoluta
- axios tenta concatenar com baseURL → URL inválida

---

## 🔧 SOLUÇÕES

### Opção 1: Corrigir ModalImageCors (RECOMENDADO ✅)

Detectar se URL é absoluta e usar `fetch` direto:

```javascript
// frontend/src/components/ModalImageCors/index.js
const fetchImage = async () => {
  let cleanUrl = imageUrl;
  
  // Limpar duplicação
  if (cleanUrl.includes('/public/company') && 
      cleanUrl.match(/\/public\/company\d+\/public\/company\d+\//)) {
    cleanUrl = cleanUrl.replace(/^\/public\/company\d+\//, '/');
  }
  
  // Verificar se URL é absoluta (começa com http:// ou https://)
  const isAbsoluteUrl = /^https?:\/\//i.test(cleanUrl);
  
  let data, headers;
  if (isAbsoluteUrl) {
    // URL absoluta: usar fetch direto (bypass axios)
    const response = await fetch(cleanUrl, {
      credentials: 'include'  // Enviar cookies
    });
    data = await response.blob();
    headers = {
      "content-type": response.headers.get("content-type")
    };
  } else {
    // URL relativa: usar api.get normal
    const res = await api.get(cleanUrl, {
      responseType: "blob",
    });
    data = res.data;
    headers = res.headers;
  }
  
  const contentType = headers["content-type"] || "";
  // ... resto do código
};
```

**Vantagens:**
- ✅ Funciona com URLs absolutas E relativas
- ✅ Não precisa mudar backend
- ✅ Mantém compatibilidade
- ✅ Solução no frontend (mais fácil testar)

---

### Opção 2: Sempre retornar URL relativa no Getter

```typescript
// backend/src/models/Message.ts
get mediaUrl(): string | null {
  if (this.getDataValue("mediaUrl")) {
    const fileRel = this.getDataValue("mediaUrl");
    const companyId = this.companyId;
    
    // SEMPRE retornar caminho relativo
    return `/public/company${companyId}/${fileRel}`;
  }
  return null;
}
```

**Desvantagens:**
- ❌ Frontend e backend devem estar no mesmo domínio
- ❌ Não funciona com CORS
- ❌ Não funciona com múltiplos servidores

---

### Opção 3: Extrair caminho no ModalImageCors

```javascript
const fetchImage = async () => {
  let cleanUrl = imageUrl;
  
  // Se URL é absoluta, extrair apenas o caminho
  if (/^https?:\/\//i.test(cleanUrl)) {
    try {
      const url = new URL(cleanUrl);
      cleanUrl = url.pathname;  // Extrai apenas /public/company1/...
    } catch (e) {
      // URL inválida, usa direto
    }
  }
  
  const { data, headers } = await api.get(cleanUrl, {
    responseType: "blob",
  });
  // ... resto
};
```

**Desvantagens:**
- ❌ Se backend está em domínio diferente, não vai funcionar (CORS)
- ❌ Perde o domínio original

---

## ✅ SOLUÇÃO RECOMENDADA: Opção 1

**Modificar `ModalImageCors` para detectar URL absoluta e usar fetch direto!**

**Por quê?**
- ✅ Funciona com backend em domínio diferente
- ✅ Funciona com URLs relativas (Baileys)
- ✅ Funciona com URLs absolutas (API Oficial)
- ✅ Mantém compatibilidade
- ✅ Não precisa mudar backend
- ✅ Não precisa mudar banco de dados

---

## 📝 IMPLEMENTAÇÃO

Vou modificar o `ModalImageCors/index.js` agora.
