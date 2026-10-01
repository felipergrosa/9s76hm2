import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : NOBRE Busca Pedidos Olist SQLServer
// Nodes   : 29  |  Connections: 30
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// TokenOlist                         googleSheets               [creds]
// RefreshTokenOlist                  httpRequest
// LeUltimaExecucao                   googleSheets               [creds]
// BuscaPedidosOlist                  httpRequest
// PreparaFiltroSql                   code
// BuscaDetalheOlist                  httpRequest
// NormalizaPedidoOlist               code
// BuscaCodMunicipioOlist             microsoftSql               [onError→regular] [creds]
// SqlCadastraClienteOlist            microsoftSql               [creds] [alwaysOutput] [continueOnFail]
// SqlCadastraVendaOlist              microsoftSql               [creds] [alwaysOutput] [continueOnFail]
// SqlCadastraItensOlist              microsoftSql               [creds] [alwaysOutput] [continueOnFail]
// AdicionaMarcadorOlist              httpRequest                [onError→regular]
// Autenticacao1                      stickyNote
// Processamento1                     stickyNote
// PedidoFull                         if
// IfTemPedidos                       if
// SqlVerificaImportados              microsoftSql               [creds] [alwaysOutput]
// MarcaPedidosImportados             code
// FiltraNovosPedidos                 code
// IfNovosPedidos                     if
// MunicipioEncontrado                if
// MontaVendaSql                      code
// LoopPedidos                        splitInBatches
// MontaClienteSql                    code
// MontaItensSql                      code
// SalvaUltimaExecucao                googleSheets               [creds]
// ScheduleTrigger                    scheduleTrigger
// SalvaNovoToken                     googleSheets               [creds]
// BuscaPedidos                       stickyNote
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// ScheduleTrigger
//    → TokenOlist
//      → RefreshTokenOlist
//        → SalvaNovoToken
//          → LeUltimaExecucao
//            → BuscaPedidosOlist
//              → PreparaFiltroSql
//                → IfTemPedidos
//                  → SqlVerificaImportados
//                    → MarcaPedidosImportados
//                      → FiltraNovosPedidos
//                        → IfNovosPedidos
//                          → LoopPedidos
//                            → SalvaUltimaExecucao
//                           .out(1) → BuscaDetalheOlist
//                              → NormalizaPedidoOlist
//                                → BuscaCodMunicipioOlist
//                                  → MunicipioEncontrado
//                                    → MontaClienteSql
//                                      → SqlCadastraClienteOlist
//                                        → MontaVendaSql
//                                          → SqlCadastraVendaOlist
//                                            → MontaItensSql
//                                              → SqlCadastraItensOlist
//                                                → PedidoFull
//                                                  → LoopPedidos (↩ loop)
//                                                 .out(1) → AdicionaMarcadorOlist
//                                                    → LoopPedidos (↩ loop)
//                                   .out(1) → MontaClienteSql (↩ loop)
//                         .out(1) → SalvaUltimaExecucao (↩ loop)
//                 .out(1) → SalvaUltimaExecucao (↩ loop)
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: '190oc7uwtrLMiQxN',
    name: 'NOBRE Busca Pedidos Olist SQLServer',
    active: true,
    isArchived: false,
    projectId: 'wFXnwjlGyuHoHb3z',
    tags: ['NOBRE'],
    settings: { executionOrder: 'v1', callerPolicy: 'workflowsFromSameOwner', availableInMCP: false },
})
export class NobreBuscaPedidosOlistSqlserverWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: '7ab260a1-f654-4890-8c0d-883175596f83',
        name: 'Token Olist',
        type: 'n8n-nodes-base.googleSheets',
        version: 4.6,
        position: [992, -16],
        credentials: { googleSheetsOAuth2Api: { id: 'TiPhH1FEnU2CjOmH', name: 'V2 n8n' } },
    })
    TokenOlist = {
        documentId: {
            __rl: true,
            value: '1zNT5vaP3_fkq9nlJ7SfYXISicejLCllB44mTf4y8h0M',
            mode: 'list',
            cachedResultName: 'n8n tiny key | auto-refresh ',
        },
        sheetName: {
            __rl: true,
            value: 'gid=0',
            mode: 'list',
            cachedResultName: 'Página1',
        },
        filtersUI: {
            values: [
                {
                    lookupColumn: 'linha',
                    lookupValue: '2',
                },
            ],
        },
        options: {},
    };

    @node({
        id: '82b8f7e1-eaa5-4ef3-a61a-8feb1eede590',
        name: 'Refresh Token Olist',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [1232, -16],
    })
    RefreshTokenOlist = {
        method: 'POST',
        url: 'https://accounts.tiny.com.br/realms/tiny/protocol/openid-connect/token',
        sendHeaders: true,
        headerParameters: {
            parameters: [
                {
                    name: 'Authorization',
                    value: 'Basic dGlueS1hcGktNTMxOTZmMTBhYTVlNjFlMWQzNTc3NjE4ZWEyYjhhYzRmMjQxMzZhOC0xNzQ4OTEzNDA3OjhnSU9KczNmeE5FZVVmcjBkVVl0M2VzajlESm5VQjRK',
                },
            ],
        },
        sendBody: true,
        contentType: 'form-urlencoded',
        bodyParameters: {
            parameters: [
                {
                    name: 'grant_type',
                    value: 'refresh_token',
                },
                {
                    name: 'refresh_token',
                    value: '={{ $json.refresh_token }}',
                },
            ],
        },
        options: {},
    };

    @node({
        id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
        name: 'Lê última execução',
        type: 'n8n-nodes-base.googleSheets',
        version: 4.6,
        position: [1776, -16],
        credentials: { googleSheetsOAuth2Api: { id: 'TiPhH1FEnU2CjOmH', name: 'V2 n8n' } },
    })
    LeUltimaExecucao = {
        documentId: {
            __rl: true,
            value: '1zNT5vaP3_fkq9nlJ7SfYXISicejLCllB44mTf4y8h0M',
            mode: 'list',
            cachedResultName: 'n8n tiny key | auto-refresh ',
        },
        sheetName: {
            __rl: true,
            value: 1425205966,
            mode: 'list',
            cachedResultName: 'Página2',
            cachedResultUrl:
                'https://docs.google.com/spreadsheets/d/1zNT5vaP3_fkq9nlJ7SfYXISicejLCllB44mTf4y8h0M/edit#gid=1425205966',
        },
        filtersUI: {
            values: [
                {
                    lookupColumn: 'linha',
                    lookupValue: '2',
                },
            ],
        },
        options: {},
    };

    @node({
        id: 'f8dd969d-3a4d-4b95-8b28-ffa45760d242',
        name: 'Busca pedidos Olist',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [624, 240],
    })
    BuscaPedidosOlist = {
        url: 'https://api.tiny.com.br/public-api/v3/pedidos',
        sendQuery: true,
        queryParameters: {
            parameters: [
                {
                    name: 'dataCriacaoInicial',
                    value: "={{ ($('Lê última execução').first().json.data ?? '2024-01-01').toString().substring(0,10) }}",
                },
            ],
        },
        sendHeaders: true,
        headerParameters: {
            parameters: [
                {
                    name: 'Authorization',
                    value: "=Bearer {{ $('Refresh Token Olist').first().json.access_token }}",
                },
            ],
        },
        options: {
            batching: {
                batch: {
                    batchSize: 1,
                    batchInterval: 500,
                },
            },
        },
    };

    @node({
        id: '7fa849ab-e504-45b4-93a3-c09784842b12',
        name: 'Prepara Filtro SQL',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [848, 240],
    })
    PreparaFiltroSql = {
        jsCode: `const payload = items[0]?.json ?? {};
const lista = payload.itens ?? payload.items ?? payload.data ?? payload.pedidos ?? [];

if (!Array.isArray(lista) || lista.length === 0) {
  return [{ json: { temPedidos: false, idsStr: "''", lista: [] } }];
}

const listaFiltrada = lista.filter(pedido => {
  const p = pedido.pedido ?? pedido;
  const marcadores = p.marcadores ?? [];
  const hasBusinessOk = marcadores.some(m => String(m.descricao ?? '').toLowerCase().trim() === 'business-ok');
  return !hasBusinessOk;
});

const ids = listaFiltrada.map((pedido) => {
  const p = pedido.pedido ?? pedido;
  return p.numero ?? p.numeroPedido ?? p.id ?? p.idPedido;
}).filter(Boolean);

if (ids.length === 0) {
  return [{ json: { temPedidos: false, idsStr: "''", lista: [] } }];
}

const idsStr = ids.map(id => \`'\${id}'\`).join(',');
return [{ json: { temPedidos: true, idsStr, lista: listaFiltrada } }];`,
    };

    @node({
        id: 'afe26e6c-f767-40fa-978a-8283080ad0e6',
        name: 'Busca detalhe Olist',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [400, 512],
    })
    BuscaDetalheOlist = {
        url: '=https://api.tiny.com.br/public-api/v3/pedidos/{{ $json.id ?? $json.idPedido ?? $json.numero }}',
        sendHeaders: true,
        headerParameters: {
            parameters: [
                {
                    name: 'Authorization',
                    value: "=Bearer {{ $('Refresh Token Olist').first().json.access_token }}",
                },
            ],
        },
        options: {
            batching: {
                batch: {
                    batchSize: 1,
                    batchInterval: 300,
                },
            },
        },
    };

    @node({
        id: '789fe3f5-2576-4966-b7bc-44f86ee80308',
        name: 'Normaliza pedido Olist',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [608, 512],
    })
    NormalizaPedidoOlist = {
        jsCode: `function onlyDigits(value) { return String(value ?? '').replace(/\\D/g, ''); }
function removeAcentos(str) { return String(str ?? '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, ''); }
function upper(value) { return removeAcentos(String(value ?? '').trim()).toUpperCase(); }
function normalizaNumero(str) {
  const val = String(str ?? '').trim().toUpperCase();
  if (!val || val === 'SN' || val === 'S/N' || val === 'S.N' || /\\D/.test(val)) return '0';
  return val.replace(/\\D/g, '') || '0';
}
function first(...values) { return values.find((value) => value !== undefined && value !== null && String(value).trim() !== '') ?? ''; }
const raw = $json;
const contato = raw.contato ?? raw.cliente ?? raw.customer ?? {};
const endereco = raw.enderecoEntrega ?? raw.endereco ?? raw.transporte?.etiqueta ?? contato.endereco ?? {};
const documento = first(contato.numeroDocumento, contato.cpfCnpj, contato.cpf, contato.cnpj, raw.cpfCnpj);
const documentoNumeros = onlyDigits(documento);
const tipoPessoa = documentoNumeros.length > 11 ? 'J' : 'F';
const itens = raw.itens ?? raw.items ?? raw.produtos ?? [];
const dataPedido = first(raw.data, raw.dataPedido, raw.createdAt, raw.dataEmissao, new Date().toISOString().slice(0, 10));
const numeroPedido = first(raw.numero, raw.numeroPedido, raw.id, raw.idPedido);
const idTiny = first(raw.id, raw.idPedido);
const canal = first(raw.ecommerce?.nome, raw.marketplace?.nome, raw.canalVenda, raw.origem, raw.marcadores?.[0]?.descricao, 'TINY');
const canalVenda = raw.ecommerce?.canalVenda ?? '';
const formaEnvioNome = raw.transportador?.formaEnvio?.nome ?? '';
const formaFreteNome = raw.transportador?.formaFrete?.nome ?? '';
const marcadores = raw.marcadores ?? [];
const hasFulfillmentMarker = marcadores.some(m => String(m?.descricao ?? '').toLowerCase().includes('fulfillment'));
const isFull = canalVenda.toLowerCase().includes('full') || formaEnvioNome.toLowerCase().includes('full') || formaFreteNome.toLowerCase().includes('full') || canal.toLowerCase().includes('full') || hasFulfillmentMarker;
return [{ json: { raw, numeroPedido, idTiny, dataPedido, canal, canalVenda, formaEnvioNome, formaFreteNome, isFull, tipoPessoa, documento, documentoNumeros, nome: removeAcentos(first(contato.nome, contato.razaoSocial, raw.nomeCliente)).trim().toUpperCase(), fantasia: removeAcentos(first(contato.fantasia, contato.nomeFantasia, contato.nome, contato.razaoSocial, raw.nomeCliente)).trim().toUpperCase(), ieRg: first(contato.ie, contato.inscricaoEstadual, contato.rg), endereco: { cep: first(endereco.cep, contato.cep), bairro: upper(first(endereco.bairro, contato.bairro)), cidade: upper(first(endereco.municipio, endereco.cidade, contato.municipio, contato.cidade)), uf: upper(first(endereco.uf, endereco.estado, contato.uf, contato.estado)), numero: normalizaNumero(first(endereco.numero, contato.numero)), logradouro: upper(first(endereco.endereco, endereco.logradouro, contato.endereco, contato.logradouro)), complemento: upper(first(endereco.complemento, contato.complemento)) }, itens: Array.isArray(itens) ? itens : [] } }];`,
    };

    @node({
        id: '22eeb53a-005f-4314-92a5-2e865f42725c',
        name: 'Busca cod municipio Olist',
        type: 'n8n-nodes-base.microsoftSql',
        version: 1.1,
        position: [816, 512],
        credentials: { microsoftSql: { id: '347YbKVdQ6hSkPU6', name: 'Microsoft SQL account' } },
        onError: 'continueRegularOutput',
    })
    BuscaCodMunicipioOlist = {
        operation: 'executeQuery',
        query: `SELECT (
  SELECT TOP 1 CdMunicipio
  FROM BusinessCadMunicipio
  WHERE LOWER(LTRIM(RTRIM(DsMunicipio))) = LOWER(LTRIM(RTRIM('{{ $('Normaliza pedido Olist').item.json.endereco.cidade.replace(/'/g, "''") }}')))
  AND LOWER(LTRIM(RTRIM(Estado))) = LOWER(LTRIM(RTRIM('{{ $('Normaliza pedido Olist').item.json.endereco.uf.replace(/'/g, "''") }}')))
) AS CdMunicipio;`,
    };

    @node({
        id: '31b9c47f-69e4-4d52-b229-7a9425a4d3ae',
        name: 'SQL Cadastra Cliente Olist',
        type: 'n8n-nodes-base.microsoftSql',
        version: 1.1,
        position: [1424, 512],
        credentials: { microsoftSql: { id: '347YbKVdQ6hSkPU6', name: 'Microsoft SQL account' } },
        alwaysOutputData: true,
        continueOnFail: true,
    })
    SqlCadastraClienteOlist = {
        table: 'BusinessCadCliente',
        columns:
            'C_Cep,E_Cep,F_Cep,E_Cnpj,FlTipo,CdGrupo,DiaPgto,C_Bairro,C_Cidade,C_Estado,C_Numero,CdRegiao,E_Bairro,E_Cidade,E_Estado,E_Numero,F_Bairro,F_Cidade,F_Estado,F_Numero,Cnpj_Cnpf,FsCliente,RzCliente,C_Endereco,CdSegmento,DtAtivacao,E_Endereco,F_Endereco,PeDesconto,RestricaoSN,C_CdMunicipio,C_Complemento,CapitalSocial,E_CdMunicipio,E_Complemento,F_CdMunicipio,F_Complemento,FlEnvRecRepre,CdRepresentante,DescontaSuframa,FlEnvRecEmpresa,DtAlteracao,DtUltCompra,Ativo_Inativo_ExCliente',
    };

    @node({
        id: 'f53fa55f-827b-4c03-9fb4-9ee2e7ed1ea8',
        name: 'SQL Cadastra Venda Olist',
        type: 'n8n-nodes-base.microsoftSql',
        version: 1.1,
        position: [1840, 512],
        credentials: { microsoftSql: { id: '347YbKVdQ6hSkPU6', name: 'Microsoft SQL account' } },
        alwaysOutputData: true,
        continueOnFail: true,
    })
    SqlCadastraVendaOlist = {
        table: 'BusinessMovPedidoVenda',
        columns:
            'CdRepresentante,CdEmpresa,CdPedidoRepre,CdPedidoEmpre,Cnpj_Cnpf,CdTabela,CdCondPgto,CdTransportadora,RefRepresentante,RefCliente,PeDesconto,PeDesconto2,PeDesconto3,PeDesconto4,PeDesconto5,FlFrete,FlStatus,FlEnvRecEmpresa,FlEnvRecRepre,DtCancelamento,MotivoCancelamento,Observacao,PRIORIDADE,CdNatureza,XML,DtPedido,DtEntrega',
    };

    @node({
        id: '65c7e062-ee6e-4b96-ba19-3a78dfcefd3f',
        name: 'SQL Cadastra Itens Olist',
        type: 'n8n-nodes-base.microsoftSql',
        version: 1.1,
        position: [2288, 512],
        credentials: { microsoftSql: { id: '347YbKVdQ6hSkPU6', name: 'Microsoft SQL account' } },
        alwaysOutputData: true,
        continueOnFail: true,
    })
    SqlCadastraItensOlist = {
        table: 'BusinessMovPedidoVendaItem',
        columns:
            'CdRepresentante,CdEmpresa,CdPedidoRepre,CdPedidoEmpre,CdProduto,QtProduto,QtBaixado,Unitario,PeDesconto,PeDesconto2,PeDesconto3,PeDesconto4,PeDesconto5,Negociado,PeIpi,PeIcms,PeReducao,FlFalha,Gramatura,RefCliente',
    };

    @node({
        id: '88648b05-3cfc-4f56-8133-0646d6886d94',
        name: 'Adiciona marcador Olist',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [2256, 736],
        onError: 'continueRegularOutput',
    })
    AdicionaMarcadorOlist = {
        method: 'POST',
        url: "=https://api.tiny.com.br/public-api/v3/pedidos/{{ $('Normaliza pedido Olist').first().json.idTiny }}/marcadores",
        sendHeaders: true,
        headerParameters: {
            parameters: [
                {
                    name: 'Authorization',
                    value: "=Bearer {{ $('Refresh Token Olist').first().json.access_token }}",
                },
            ],
        },
        sendBody: true,
        contentType: 'raw',
        rawContentType: 'application/json',
        body: '[{"descricao":"Business-ok"}]',
        options: {},
    };

    @node({
        id: 'e0871f33-8c52-48e0-9fa0-307e9c3d800a',
        name: '🔑 Autenticação1',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [720, -64],
    })
    Autenticacao1 = {
        content: '## 🔑 Autenticação\\nLeitura do token, refresh automático e gravação de volta no Sheets.',
        height: 196,
        width: 1244,
        color: 4,
    };

    @node({
        id: '6709a793-a91c-4376-af4c-58bbf077402b',
        name: '⚙️ Processamento1',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [96, 448],
    })
    Processamento1 = {
        content:
            '##  Processamento por Pedido\\nBusca detalhe → Normaliza → Município → Cliente → Venda → Itens no SQL Server.⚙️',
        height: 232,
        width: 2376,
        color: 3,
    };

    @node({
        id: '12616a03-a434-4bca-a6c0-5dd7481f977a',
        name: 'Pedido Full?',
        type: 'n8n-nodes-base.if',
        version: 2,
        position: [1984, 720],
    })
    PedidoFull = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'strict',
                version: 1,
            },
            conditions: [
                {
                    id: '10000000-0000-4000-8000-000000000021',
                    leftValue: "={{ $('Normaliza pedido Olist').item.json.isFull }}",
                    rightValue: true,
                    operator: {
                        type: 'boolean',
                        operation: 'equal',
                        singleValue: true,
                    },
                },
            ],
            combinator: 'and',
        },
        options: {},
    };

    @node({
        id: '6d64c1b2-fa1b-4caa-8b62-8b71938c96f3',
        name: 'IF Tem Pedidos?',
        type: 'n8n-nodes-base.if',
        version: 2,
        position: [1088, 240],
    })
    IfTemPedidos = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'strict',
                version: 1,
            },
            conditions: [
                {
                    id: 'cond-1',
                    leftValue: '={{ String($json.temPedidos) }}',
                    rightValue: 'true',
                    operator: {
                        type: 'string',
                        operation: 'equals',
                        singleValue: true,
                    },
                },
            ],
            combinator: 'and',
        },
        options: {},
    };

    @node({
        id: '10000000-0000-4000-8000-000000000022',
        name: 'SQL Verifica Importados',
        type: 'n8n-nodes-base.microsoftSql',
        version: 1.1,
        position: [1328, 224],
        credentials: { microsoftSql: { id: '347YbKVdQ6hSkPU6', name: 'Microsoft SQL account' } },
        alwaysOutputData: true,
    })
    SqlVerificaImportados = {
        operation: 'executeQuery',
        query: "SELECT CdPedidoRepre, CdRepresentante, CdEmpresa FROM BusinessMovPedidoVenda WHERE CdEmpresa = '97' AND CdRepresentante = '1019' AND CdPedidoRepre IN ({{ $('Prepara Filtro SQL').item.json.idsStr }})",
    };

    @node({
        id: '10000000-0000-4000-8000-000000000041',
        name: 'Marca Pedidos Importados',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [1504, 224],
    })
    MarcaPedidosImportados = {
        jsCode: `const lista = $('Prepara Filtro SQL').item.json.lista;
const token = $('Refresh Token Olist').first().json.access_token;

const importados = items
  .map(i => String(i.json?.CdPedidoRepre ?? '').trim())
  .filter(id => id !== '' && id !== 'undefined' && id !== 'null');

for (const numPedido of importados) {
  const pedidoObj = lista.find(p => {
    const base = p.pedido ?? p;
    const id = String(base.numero ?? base.numeroPedido ?? base.id ?? base.idPedido ?? '').trim();
    return id === numPedido;
  });
  if (!pedidoObj) continue;
  const base = pedidoObj.pedido ?? pedidoObj;
  const idTiny = base.id ?? base.idPedido;
  if (!idTiny) continue;
  try {
    await $helpers.httpRequest({
      method: 'POST',
      url: \`https://api.tiny.com.br/public-api/v3/pedidos/\${idTiny}/marcadores\`,
      headers: { Authorization: \`Bearer \${token}\`, 'Content-Type': 'application/json' },
      body: JSON.stringify([{ descricao: 'Business-ok' }])
    });
  } catch (e) {
    console.log(\`Marcador falhou para pedido \${idTiny}: \${e.message}\`);
  }
}

return items;`,
    };

    @node({
        id: 'new-filtra-novos',
        name: 'Filtra Novos Pedidos',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [1696, 224],
    })
    FiltraNovosPedidos = {
        jsCode: `const lista = $('Prepara Filtro SQL').item.json.lista;

const importados = items
  .map(i => String(i.json?.CdPedidoRepre ?? '').trim())
  .filter(id => id !== '' && id !== 'undefined' && id !== 'null');

console.log('Total pedidos API:', lista.length);
console.log('Total importados SQL:', importados.length);
console.log('Importados:', importados);

const filtrados = lista.filter(pedido => {
  const p = pedido.pedido ?? pedido;
  if (String(p.situacao ?? '') === '2') return false;
  const id = String(p.numero ?? p.numeroPedido ?? p.id ?? p.idPedido).trim();
  if (importados.includes(id)) return false;
  return true;
});

console.log('Pedidos novos:', filtrados.length);

if (filtrados.length === 0) {
  return [{ json: { temNovos: false, debug: { totalApi: lista.length, totalImportados: importados.length, importados } } }];
}

return filtrados.map(p => ({ json: Object.assign({ temNovos: true }, p.pedido ?? p) }));`,
    };

    @node({
        id: 'new-if-novos',
        name: 'IF Novos Pedidos?',
        type: 'n8n-nodes-base.if',
        version: 2,
        position: [1888, 224],
    })
    IfNovosPedidos = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'strict',
                version: 1,
            },
            conditions: [
                {
                    id: 'cond-1',
                    leftValue: '={{ String($json.temNovos) }}',
                    rightValue: 'true',
                    operator: {
                        type: 'string',
                        operation: 'equals',
                        singleValue: true,
                    },
                },
            ],
            combinator: 'and',
        },
        options: {},
    };

    @node({
        id: '330f34c3-7560-4050-b902-35e11cecde97',
        name: 'Municipio encontrado?',
        type: 'n8n-nodes-base.if',
        version: 2,
        position: [1008, 512],
    })
    MunicipioEncontrado = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'strict',
                version: 1,
            },
            conditions: [
                {
                    id: '10000000-0000-4000-8000-000000000009',
                    leftValue: '={{ $json.CdMunicipio }}',
                    rightValue: '',
                    operator: {
                        type: 'string',
                        operation: 'notEmpty',
                        singleValue: true,
                    },
                },
            ],
            combinator: 'and',
        },
        options: {},
    };

    @node({
        id: '6554e1fe-cb1d-4991-9aeb-4d55092851e0',
        name: 'Monta venda SQL',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [1632, 512],
    })
    MontaVendaSql = {
        jsCode: `function t(str, len) { return String(str ?? '').trim().substring(0, len); }
const base = $('Monta cliente SQL').item.json;
const pedido = base.pedido;
return [{ json: { CdRepresentante: t(base.CdRepresentante, 6), CdEmpresa: '97', CdPedidoRepre: t(pedido.numeroPedido, 20), CdPedidoEmpre: 'XXXXXX', Cnpj_Cnpf: t(pedido.documento, 18), CdTabela: '10', CdCondPgto: '045', CdTransportadora: '0239', RefRepresentante: '', RefCliente: '', PeDesconto: 0, PeDesconto2: 0, PeDesconto3: 0, PeDesconto4: 0, PeDesconto5: 0, FlFrete: 'C', FlStatus: 'B', FlEnvRecEmpresa: 'S', FlEnvRecRepre: 'S', DtCancelamento: '', MotivoCancelamento: '', Observacao: '', PRIORIDADE: '1', CdNatureza: '006', XML: '', DtPedido: \`\${pedido.dataPedido} 00:00:00.000\`, DtEntrega: \`\${pedido.dataPedido} 00:00:00.000\`, pedido } } ];`,
    };

    @node({
        id: 'fae43777-d9fd-4ca2-986e-d56137e80f52',
        name: 'Loop pedidos',
        type: 'n8n-nodes-base.splitInBatches',
        version: 3,
        position: [176, 496],
    })
    LoopPedidos = {
        options: {},
    };

    @node({
        id: 'e601f720-6391-426b-937b-29aeef7bff36',
        name: 'Monta cliente SQL',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [1232, 512],
    })
    MontaClienteSql = {
        jsCode: `function t(str, len) { return String(str ?? '').trim().substring(0, len); }
const pedido = $('Normaliza pedido Olist').item.json;
const municipio = t($json.CdMunicipio, 6) || '9841';
const representante = '1019';
const nome = String(pedido.nome || 'CLIENTE TINY').trim();
const end = pedido.endereco || {};
return [{ json: { C_Cep: t(end.cep, 9), E_Cep: t(end.cep, 9), F_Cep: t(end.cep, 9), E_Cnpj: t(pedido.documento, 18), FlTipo: t(pedido.tipoPessoa, 1), CdGrupo: '001', DiaPgto: 'Indefinido', C_Bairro: t(end.bairro, 30), C_Cidade: t(end.cidade, 30), C_Estado: t(end.uf, 2), C_Numero: t(end.numero, 10), CdRegiao: '', E_Bairro: t(end.bairro, 30), E_Cidade: t(end.cidade, 30), E_Estado: t(end.uf, 2), E_Numero: t(end.numero, 10), F_Bairro: t(end.bairro, 30), F_Cidade: t(end.cidade, 30), F_Estado: t(end.uf, 2), F_Numero: t(end.numero, 10), Cnpj_Cnpf: t(pedido.documento, 18), FsCliente: t(nome.split(/\\s+/)[0], 15).toUpperCase(), RzCliente: t(nome, 40).toUpperCase(), C_Endereco: t(end.logradouro, 50), CdSegmento: '60', DtAtivacao: \`\${pedido.dataPedido} 00:00:00.000\`, E_Endereco: t(end.logradouro, 50), F_Endereco: t(end.logradouro, 50), PeDesconto: '0', RestricaoSN: 'N', C_CdMunicipio: municipio, C_Complemento: t(end.complemento, 20), CapitalSocial: '0', E_CdMunicipio: municipio, E_Complemento: t(end.complemento, 20), F_CdMunicipio: municipio, F_Complemento: t(end.complemento, 20), FlEnvRecRepre: 'S', CdRepresentante: representante, DescontaSuframa: 'N', FlEnvRecEmpresa: 'S', DtAlteracao: \`\${pedido.dataPedido} 00:00:00.000\`, DtUltCompra: pedido.dataPedido, Ativo_Inativo_ExCliente: 'Ativo', pedido } } ];`,
    };

    @node({
        id: 'b52bbb6d-a17a-44c7-8359-9388d1b0b3d4',
        name: 'Monta itens SQL',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [2064, 512],
    })
    MontaItensSql = {
        jsCode: `function t(str, len) { return String(str ?? '').trim().substring(0, len); }
const venda = $('Monta venda SQL').item.json;
const itens = venda.pedido.itens || [];
return itens.map((item) => {
  const produto = item.produto ?? item;
  return { json: { CdRepresentante: t(venda.CdRepresentante, 6), CdEmpresa: '97', CdPedidoRepre: t(venda.CdPedidoRepre, 20), CdPedidoEmpre: 'XXXXXX', CdProduto: t(produto.codigo ?? produto.sku ?? produto.id ?? produto.descricao ?? '', 20), QtProduto: Number(item.quantidade ?? item.qtd ?? produto.quantidade ?? 1), QtBaixado: Number(item.quantidade ?? item.qtd ?? produto.quantidade ?? 1), Unitario: Number(item.valorUnitario ?? item.precoUnitario ?? item.preco ?? item.valor ?? produto.valorUnitario ?? produto.preco ?? 0), PeDesconto: 0, PeDesconto2: 0, PeDesconto3: 0, PeDesconto4: 0, PeDesconto5: 0, Negociado: Number(item.valorUnitario ?? item.precoUnitario ?? item.preco ?? item.valor ?? produto.valorUnitario ?? produto.preco ?? 0), PeIpi: 0, PeIcms: 0, PeReducao: 0, FlFalha: 'S', Gramatura: '0', RefCliente: '' } };
});`,
    };

    @node({
        id: '10000000-0000-4000-8000-000000000031',
        name: 'Salva última execução',
        type: 'n8n-nodes-base.googleSheets',
        version: 4.6,
        position: [208, 720],
        credentials: { googleSheetsOAuth2Api: { id: 'TiPhH1FEnU2CjOmH', name: 'V2 n8n' } },
    })
    SalvaUltimaExecucao = {
        operation: 'appendOrUpdate',
        documentId: {
            __rl: true,
            value: '1zNT5vaP3_fkq9nlJ7SfYXISicejLCllB44mTf4y8h0M',
            mode: 'list',
            cachedResultName: 'n8n tiny key | auto-refresh ',
        },
        sheetName: {
            __rl: true,
            value: 1425205966,
            mode: 'list',
            cachedResultName: 'Página2',
            cachedResultUrl:
                'https://docs.google.com/spreadsheets/d/1zNT5vaP3_fkq9nlJ7SfYXISicejLCllB44mTf4y8h0M/edit#gid=1425205966',
        },
        columns: {
            mappingMode: 'defineBelow',
            value: {
                linha: '2',
                data: "={{ $now.format('yyyy-MM-dd HH:mm:ss') }}",
            },
            matchingColumns: ['linha'],
            schema: [
                {
                    id: 'linha',
                    displayName: 'linha',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'data',
                    displayName: 'data',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
            ],
            attemptToConvertTypes: false,
            convertFieldsToString: false,
        },
        options: {},
    };

    @node({
        id: '643f1bda-376f-43bc-9c54-d8f1db8dbf0a',
        name: 'Schedule Trigger',
        type: 'n8n-nodes-base.scheduleTrigger',
        version: 1.3,
        position: [784, -16],
    })
    ScheduleTrigger = {
        rule: {
            interval: [
                {
                    field: 'minutes',
                    minutesInterval: 2,
                },
            ],
        },
    };

    @node({
        id: '82b33417-2298-4d9b-93c1-2fda44510a48',
        name: 'Salva novo token',
        type: 'n8n-nodes-base.googleSheets',
        version: 4.6,
        position: [1504, -16],
        credentials: { googleSheetsOAuth2Api: { id: 'TiPhH1FEnU2CjOmH', name: 'V2 n8n' } },
    })
    SalvaNovoToken = {
        operation: 'appendOrUpdate',
        documentId: {
            __rl: true,
            value: '1zNT5vaP3_fkq9nlJ7SfYXISicejLCllB44mTf4y8h0M',
            mode: 'list',
            cachedResultName: 'n8n tiny key | auto-refresh ',
        },
        sheetName: {
            __rl: true,
            value: 'gid=0',
            mode: 'list',
            cachedResultName: 'Página1',
        },
        columns: {
            mappingMode: 'defineBelow',
            value: {
                linha: '2',
                access_token: '={{ $json.access_token }}',
                refresh_token: '={{ $json.refresh_token }}',
            },
            matchingColumns: ['linha'],
            schema: [
                {
                    id: 'linha',
                    displayName: 'linha',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'access_token',
                    displayName: 'access_token',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'expires_in',
                    displayName: 'expires_in',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                    removed: false,
                },
                {
                    id: 'refresh_expires_in',
                    displayName: 'refresh_expires_in',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                    removed: false,
                },
                {
                    id: 'refresh_token',
                    displayName: 'refresh_token',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'token_type',
                    displayName: 'token_type',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                    removed: false,
                },
                {
                    id: 'id_token',
                    displayName: 'id_token',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                    removed: false,
                },
                {
                    id: 'not-before-policy',
                    displayName: 'not-before-policy',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                    removed: false,
                },
                {
                    id: 'session_state',
                    displayName: 'session_state',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                    removed: false,
                },
                {
                    id: 'scope',
                    displayName: 'scope',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                    removed: false,
                },
            ],
            attemptToConvertTypes: false,
            convertFieldsToString: false,
        },
        options: {},
    };

    @node({
        id: '49d9284f-bb6b-4061-8e13-b9daadb2bba9',
        name: '��� Busca Pedidos',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [544, 192],
    })
    BuscaPedidos = {
        content: '## 📋 Busca Pedidos\\nConsulta a API Olist e expande a lista de pedidos.',
        height: 188,
        width: 1520,
        color: 5,
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.TokenOlist.out(0).to(this.RefreshTokenOlist.in(0));
        this.RefreshTokenOlist.out(0).to(this.SalvaNovoToken.in(0));
        this.LeUltimaExecucao.out(0).to(this.BuscaPedidosOlist.in(0));
        this.BuscaPedidosOlist.out(0).to(this.PreparaFiltroSql.in(0));
        this.BuscaDetalheOlist.out(0).to(this.NormalizaPedidoOlist.in(0));
        this.NormalizaPedidoOlist.out(0).to(this.BuscaCodMunicipioOlist.in(0));
        this.BuscaCodMunicipioOlist.out(0).to(this.MunicipioEncontrado.in(0));
        this.SqlCadastraClienteOlist.out(0).to(this.MontaVendaSql.in(0));
        this.SqlCadastraVendaOlist.out(0).to(this.MontaItensSql.in(0));
        this.SqlCadastraItensOlist.out(0).to(this.PedidoFull.in(0));
        this.AdicionaMarcadorOlist.out(0).to(this.LoopPedidos.in(0));
        this.PedidoFull.out(0).to(this.LoopPedidos.in(0));
        this.PedidoFull.out(1).to(this.AdicionaMarcadorOlist.in(0));
        this.MunicipioEncontrado.out(0).to(this.MontaClienteSql.in(0));
        this.MunicipioEncontrado.out(1).to(this.MontaClienteSql.in(0));
        this.MontaVendaSql.out(0).to(this.SqlCadastraVendaOlist.in(0));
        this.LoopPedidos.out(0).to(this.SalvaUltimaExecucao.in(0));
        this.LoopPedidos.out(1).to(this.BuscaDetalheOlist.in(0));
        this.MontaClienteSql.out(0).to(this.SqlCadastraClienteOlist.in(0));
        this.MontaItensSql.out(0).to(this.SqlCadastraItensOlist.in(0));
        this.ScheduleTrigger.out(0).to(this.TokenOlist.in(0));
        this.SalvaNovoToken.out(0).to(this.LeUltimaExecucao.in(0));
        this.PreparaFiltroSql.out(0).to(this.IfTemPedidos.in(0));
        this.IfTemPedidos.out(0).to(this.SqlVerificaImportados.in(0));
        this.IfTemPedidos.out(1).to(this.SalvaUltimaExecucao.in(0));
        this.SqlVerificaImportados.out(0).to(this.MarcaPedidosImportados.in(0));
        this.MarcaPedidosImportados.out(0).to(this.FiltraNovosPedidos.in(0));
        this.FiltraNovosPedidos.out(0).to(this.IfNovosPedidos.in(0));
        this.IfNovosPedidos.out(0).to(this.LoopPedidos.in(0));
        this.IfNovosPedidos.out(1).to(this.SalvaUltimaExecucao.in(0));
    }
}
