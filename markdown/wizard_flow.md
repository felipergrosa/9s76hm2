# Mapeamento do Fluxo de Criação de Campanha (Wizard)

O novo fluxo de criação de campanhas segue um processo de 4 etapas para melhorar a usabilidade e garantir que todas as configurações críticas sejam revisadas.

```mermaid
graph TD
    A[Início: Nova Campanha] --> B{Passo 1: Configuração}
    B --> B1[Nome da Campanha]
    B --> B2[Lista de Contatos]
    B --> B3[Conexão WhatsApp]
    B --> B4[Filtro por Tags]
    
    B1 & B2 & B3 & B4 --> C{Tipo de Conexão?}
    C -- Oficial (Meta) --> C1[Seletor de Templates Meta]
    C1 --> C2[Mapeamento de Variáveis]
    C -- Baileys/Livre --> D{Passo 2: Regras}
    C2 --> D
    
    D --> D1[Fila de Atendimento]
    D --> D2[Distribuição por Usuários/Tags]
    D --> D3[Estratégia de Envio: Single/Round Robin]
    D3 -- Custom --> D3A[Seletor de Pool de Conexões]
    
    D1 & D2 & D3A --> E{Passo 3: Agendamento}
    E --> E1[Envio Imediato]
    E --> E2[Agendamento Programado]
    
    E1 & E2 --> F{Passo 4: Mensagem}
    F --> F1[Configurar 1-5 Mensagens]
    F --> F2[Anexos da Biblioteca/Local]
    F --> F3[Preview no Celular em Tempo Real]
    F --> F4[Assistente de IA]
    
    F1 & F2 & F3 & F4 --> G[Lançar Campanha]
    G --> H[Finalizado]
```

## Detalhes Técnicos do Wizard
- **Componente:** `CampaignForm.js`
- **Validação:** Formik + Yup (Validação por etapa).
- **Paridade:** 100% dos recursos do `CampaignModal` original foram portados para o novo layout de página.
