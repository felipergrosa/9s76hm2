# Documentação Técnica: Enriquecimento de Contatos Baileys

## Visão Geral
Este sistema permite ao Whaticket capturar metadados profundos fornecidos pelo Baileys/WhatsApp que normalmente são ignorados durante o fluxo padrão de mensagens.

## Mapa de Fluxo
```mermaid
graph TD
    A[Contato Existente] --> B[ContactEnrichmentService]
    B --> C[Baileys Discovery Logic]
    C --> D[WhatsApp Connection]
    D --> E[Baileys Metadata: Notify, verifiedName, Business Info, Status]
    E --> F[Update Contact Model]
    F --> G[Banco de Dados Atualizado]
```

## Benefícios
- Recuperação de nomes (pushnames) retroativos.
- Identificação precisa de contas comerciais.
- Captura de fotos de perfil em alta definição.
- Monitoramento de status (About) e presença online.
