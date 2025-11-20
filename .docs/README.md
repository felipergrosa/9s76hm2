# Documentação do Taktchat

Bem-vindo ao hub oficial de documentação do projeto **Taktchat**. Esta pasta centraliza guias, procedimentos operacionais e referências técnicas para desenvolvimento, implantação e suporte da plataforma.

## Como navegar

- `visao-geral/`: contexto do produto, arquitetura, fluxos críticos e roadmap.
  - **Roadmap centralizado:** `visao-geral/roadmap.md` - Melhorias futuras e funcionalidades pendentes do projeto
- `instalacao/`: requisitos, preparação de ambiente, passo a passo para rodar localmente e via Docker.
- `configuracao/`: variáveis de ambiente, parâmetros sensíveis e políticas de segurança.
- `operacao/`: rotinas diárias, monitoramento, backup/restore e troubleshooting.
- `infraestrutura/`: detalhes de banco de dados, cache/filas e integrações externas.
- `funcionalidades/`: guias funcionais por módulo (campanhas, permissões, tags, anti-ban, etc.).
- `diagnosticos/`: procedimentos de investigação e correção para cenários recorrentes.
- `anexos/`: checklists, templates, roteiros e notas complementares.
- `sql/`: coleção organizada de scripts SQL (diagnósticos, correções e migrações).
- `legacy/`: acervo histórico dos documentos anteriores à reestruturação (somente referência).
- `branchs/`: análises e decisões específicas de cada branch (não versionado).

## Convenções gerais

- Todos os arquivos utilizam Markdown (`.md`) em português e seguem convenções de título com `##`.
- Links internos devem ser relativos, ancorando em `.docs` para facilitar leitura no repositório e no portal.
- Scripts, comandos e env vars devem aparecer dentro de blocos de código e, quando possível, com sistemas operacionais indicados.
- Sempre que atualizar um processo, registre o racional e o histórico em `anexos/notas-de-versao.md`.

## Próximos passos sugeridos

- Mantenha o `README.md` da raiz alinhado a esta estrutura, destacando as entradas principais.
- Antes de implementar novas funcionalidades, atualize o arquivo de análise em `.docs/branchs/<branch>/`.
- Consulte `diagnosticos/` para reproduzir e solucionar incidentes reportados anteriormente.

