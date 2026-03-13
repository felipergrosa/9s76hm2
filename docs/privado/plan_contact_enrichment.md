# Plano de Implementação: Enriquecimento de Contatos Baileys

## Objetivos
Expandir a capacidade de identificação de contatos do sistema através da captura de metadados avançados do Baileys.

## Mudanças Estruturais
1. **Modelo `Contact`**: Adição de ~20 novos campos para cobrir Business, Privacidade e Metadados.
2. **Migração**: SQL para atualizar a tabela existente.
3. **Descoberta**: Script `baileys_full_discovery` para auditoria manual.
4. **Enriquecimento**: `ContactEnrichmentService` para integração automática.

## Fluxo de Dados
```mermaid
graph LR
    ID[JID/Número] --> SC[Script Discovery]
    SC --> B[Baileys WASocket]
    B --> MD[Metadata Extraction]
    MD --> DB[(Database Update)]
```

## Próximos Passos
1. Aguardar aprovação do usuário.
2. Aplicar alterações no modelo TypeScript.
3. Gerar e rodar migração Sequelize.
4. Implementar scripts e serviços.
