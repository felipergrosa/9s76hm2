# Interface de Automação de Tags - Guia de Uso

## Visão Geral

A interface de automação de tags permite configurar regras para aplicar tags automaticamente em contatos baseado em seus dados (região, segmento, código representante, etc).

## Como Usar

### 1. Criar ou Editar Tag de Permissão

1. Acesse **Tags** no menu
2. Clique em **NOVA TAG** ou edite uma tag existente
3. **Importante:** O nome da tag deve começar com `#` (ex: `#NOME-USUARIO`)
4. Escolha uma cor
5. Clique em **SALVAR**

### 2. Configurar Regras de Automação

Após salvar a tag, a seção **🤖 Automação de Tags** aparecerá automaticamente no modal.

#### Adicionar Nova Regra

1. Clique em **Nova Regra**
2. Configure os 3 campos:

   **Campo:** Selecione qual dado do contato verificar
   - Código Representante
   - Região
   - Segmento
   - Cidade
   - Estado
   - Empresa
   - Nome
   - Email

   **Operador:** Como comparar o valor
   - **Igual a:** Valor exato (ex: região = "Sul")
   - **Contém:** Texto parcial (ex: nome contém "Silva")
   - **Está em (lista):** Múltiplos valores (ex: região em Sul, Sudeste)
   - **Não é vazio:** Campo tem algum valor

   **Valor:** O que procurar
   - Para "Está em (lista)": separe por vírgula (ex: `Sul, Sudeste, Centro-Oeste`)
   - Para "Não é vazio": deixe em branco

3. Clique em **Salvar Regras**

#### Exemplo Prático

**Objetivo:** Aplicar tag `#NOME-USUARIO` em contatos da carteira dela

**Regras:**

| Campo | Operador | Valor |
|-------|----------|-------|
| Código Representante | Igual a | `123` |
| Região | Está em (lista) | `Sul, Sudeste` |
| Segmento | Igual a | `Varejo` |

**Resultado:** Contatos que atendem **TODAS** as 3 regras recebem a tag automaticamente.

### 3. Aplicar Regras

Há duas formas de aplicar as regras:

#### Aplicação Manual

1. No modal da tag, clique em **Aplicar Agora**
2. Sistema processa todos os contatos
3. Mostra quantos contatos foram afetados

#### Aplicação Automática (Cron)

Configure um cron job no backend para executar periodicamente:

```javascript
// Executa a cada hora
cron.schedule('0 * * * *', async () => {
  await api.post('/tag-rules/apply');
});
```

### 4. Gerenciar Regras

#### Editar Regra

1. Altere os campos da regra
2. Clique em **Salvar Regras**

#### Remover Regra

1. Clique no ícone **🗑️** (lixeira) ao lado da regra
2. Confirme a remoção

## Operadores Detalhados

### Igual a (`equals`)

Compara valor exato.

**Exemplo:**
- Campo: `Código Representante`
- Operador: `Igual a`
- Valor: `123`
- **Resultado:** Apenas contatos com código exatamente `123`

### Contém (`contains`)

Verifica se o campo contém o texto.

**Exemplo:**
- Campo: `Cidade`
- Operador: `Contém`
- Valor: `Paulo`
- **Resultado:** São Paulo, Paulo Afonso, etc.

### Está em (lista) (`in`)

Verifica se o campo está em uma lista de valores.

**Exemplo:**
- Campo: `Região`
- Operador: `Está em (lista)`
- Valor: `Sul, Sudeste, Centro-Oeste`
- **Resultado:** Contatos de qualquer uma dessas regiões

**Dica:** Separe os valores por vírgula. Espaços são removidos automaticamente.

### Não é vazio (`not_null`)

Verifica se o campo tem algum valor.

**Exemplo:**
- Campo: `Email`
- Operador: `Não é vazio`
- Valor: *(deixe em branco)*
- **Resultado:** Contatos que têm email cadastrado

## Lógica AND (E)

**Importante:** O contato deve atender **TODAS** as regras para receber a tag.

### Exemplo

Tag `#FERNANDA-FREITAS` com 3 regras:

1. Código Representante = `123`
2. Região em `Sul, Sudeste`
3. Email não é vazio

**Contatos que receberão a tag:**
- ✅ Código 123 + Região Sul + Email preenchido
- ✅ Código 123 + Região Sudeste + Email preenchido

**Contatos que NÃO receberão:**
- ❌ Código 123 + Região Sul + Sem email (falta email)
- ❌ Código 456 + Região Sul + Email preenchido (código errado)
- ❌ Código 123 + Região Norte + Email preenchido (região errada)

## Casos de Uso

### Caso 1: Carteira por Representante

**Objetivo:** Cada vendedor vê apenas seus clientes

**Solução:**
- Tag: `#FERNANDA-FREITAS`
- Regra: Código Representante = `123`

### Caso 2: Carteira por Região

**Objetivo:** Vendedor atende múltiplas regiões

**Solução:**
- Tag: `#VENDEDOR-SUL`
- Regra: Região em `Sul, Sudeste`

### Caso 3: Carteira Segmentada

**Objetivo:** Vendedor especializado em segmento específico

**Solução:**
- Tag: `#ESPECIALISTA-VAREJO`
- Regra 1: Segmento = `Varejo`
- Regra 2: Região em `São Paulo, Rio de Janeiro`

### Caso 4: Carteira Complexa

**Objetivo:** Vendedor com múltiplos critérios

**Solução:**
- Tag: `#FERNANDA-FREITAS`
- Regra 1: Código Representante = `123`
- Regra 2: Região em `Sul, Sudeste`
- Regra 3: Segmento = `Varejo`
- Regra 4: Email não é vazio

## Dicas e Boas Práticas

### ✅ Boas Práticas

1. **Teste com poucos contatos primeiro**
   - Crie regras
   - Aplique manualmente
   - Verifique se os contatos corretos receberam a tag

2. **Use nomes descritivos nas tags**
   - ✅ `#FERNANDA-FREITAS`
   - ✅ `#REPRESENTANTES`
   - ❌ `#TAG1`

3. **Combine regras para precisão**
   - Mais regras = mais específico
   - Menos regras = mais abrangente

4. **Documente suas regras**
   - Anote quais campos você usa
   - Facilita manutenção futura

### ⚠️ Cuidados

1. **Tags transacionais não afetam visibilidade**
   - Tags sem `#` são apenas para organização
   - Não influenciam quem vê os contatos

2. **Regras são cumulativas (AND)**
   - Contato precisa atender TODAS
   - Não é possível fazer OR (OU) entre regras

3. **Valores são case-sensitive**
   - `Sul` ≠ `sul`
   - Use exatamente como está no banco

4. **Operador "in" requer vírgulas**
   - ✅ `Sul, Sudeste, Centro-Oeste`
   - ❌ `Sul Sudeste Centro-Oeste`

## Troubleshooting

### Problema: Seção de automação não aparece

**Causa:** Tag não começa com `#` ou tag não foi salva ainda

**Solução:**
1. Certifique-se que o nome começa com `#`
2. Salve a tag primeiro
3. Edite novamente para ver a seção

---

### Problema: Regras não estão sendo aplicadas

**Causa:** Valores não correspondem aos dados do banco

**Solução:**
1. Verifique os valores exatos no banco de dados
2. Teste com operador "Contém" primeiro
3. Use "Aplicar Agora" para testar manualmente

---

### Problema: Muitos contatos recebendo a tag

**Causa:** Regras muito abrangentes

**Solução:**
1. Adicione mais regras para refinar
2. Use operador "Igual a" em vez de "Contém"
3. Verifique se os valores estão corretos

---

### Problema: Nenhum contato recebendo a tag

**Causa:** Regras muito restritivas ou valores incorretos

**Solução:**
1. Remova regras uma por uma para identificar o problema
2. Verifique se os valores correspondem ao banco
3. Use operador "Contém" para testar

## Campos Disponíveis

Os campos disponíveis dependem do modelo Contact do seu sistema. Campos comuns:

- `name` - Nome do contato
- `number` - Número do WhatsApp
- `email` - Email
- `representativeCode` - Código do representante
- `region` - Região
- `segment` - Segmento de mercado
- `city` - Cidade
- `state` - Estado
- `company` - Empresa

**Dica:** Consulte o administrador do sistema para saber quais campos estão disponíveis.

## Fluxo Completo

```
1. Criar Tag (#NOME)
   ↓
2. Salvar Tag
   ↓
3. Editar Tag
   ↓
4. Adicionar Regras
   ↓
5. Salvar Regras
   ↓
6. Aplicar Agora (teste)
   ↓
7. Verificar Contatos
   ↓
8. Ajustar Regras (se necessário)
   ↓
9. Configurar Cron (automação)
```

## Suporte

Para dúvidas ou problemas:
1. Verifique este guia
2. Teste manualmente com "Aplicar Agora"
3. Consulte os logs do backend
4. Entre em contato com o suporte técnico
