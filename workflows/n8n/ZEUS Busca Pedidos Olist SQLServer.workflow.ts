import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : ZEUS Busca Pedidos Olist SQLServer
// Nodes   : 29  |  Connections: 30
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// TokenOlist                         googleSheets               [creds]
// LeUltimaExecucao                   googleSheets               [creds]
// RefreshTokenOlist                  httpRequest
// SalvaNovoToken                     googleSheets               [creds]
// BuscaPedidosOlist                  httpRequest
// PreparaFiltroSql                   code
// LoopPedidos                        splitInBatches
// BuscaDetalheOlist                  httpRequest
// NormalizaPedidoOlist               code
// BuscaCodMunicipioOlist             microsoftSql               [onError→regular] [creds]
// MunicipioEncontrado                if
// MontaClienteSql                    code
// SqlCadastraClienteOlist            microsoftSql               [creds] [alwaysOutput] [continueOnFail]
// MontaVendaSql                      code
// SqlCadastraVendaOlist              microsoftSql               [creds] [alwaysOutput] [continueOnFail]
// MontaItensSql                      code
// SalvaUltimaExecucao                googleSheets               [creds]
// SqlCadastraItensOlist              microsoftSql               [creds] [alwaysOutput] [continueOnFail]
// PedidoFull                         if
// AdicionaMarcadorOlist              httpRequest                [onError→regular]
// Autenticacao                       stickyNote
// BuscaPedidos                       stickyNote
// Processamento                      stickyNote
// IfTemPedidos                       if
// SqlVerificaImportados              microsoftSql               [creds] [alwaysOutput]
// MarcaPedidosImportados             code
// FiltraNovosPedidos                 code
// IfNovosPedidos                     if
// ScheduleTrigger                    scheduleTrigger
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
    id: 'MgEvR607KndViqxV',
    name: 'ZEUS Busca Pedidos Olist SQLServer',
    active: true,
    isArchived: false,
    projectId: 'wFXnwjlGyuHoHb3z',
    tags: ['ZEUS'],
    settings: { executionOrder: 'v1', callerPolicy: 'workflowsFromSameOwner', availableInMCP: false },
})
export class ZeusBuscaPedidosOlistSqlserverWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: '10000000-0000-4000-8000-000000000002',
        name: 'Token Olist',
        type: 'n8n-nodes-base.googleSheets',
        version: 4.6,
        position: [224, -272],
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
                    lookupValue: '1',
                },
            ],
        },
        options: {},
    };

    @node({
        id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        name: 'Lê última execução',
        type: 'n8n-nodes-base.googleSheets',
        version: 4.6,
        position: [1040, -272],
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
                    lookupValue: '1',
                },
            ],
        },
        options: {},
    };

    @node({
        id: '10000000-0000-4000-8000-000000000018',
        name: 'Refresh Token Olist',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [480, -272],
    })
    RefreshTokenOlist = {
        method: 'POST',
        url: 'https://accounts.tiny.com.br/realms/tiny/protocol/openid-connect/token',
        sendHeaders: true,
        headerParameters: {
            parameters: [
                {
                    name: 'Authorization',
                    value: 'Basic dGlueS1hcGktN2VkYTY0NWMzNDZkMWVmNTA2MDcxMjI3NGI3YWNjMTQ0ZWQ2ZGMwNC0xNzQ4NTY3NTc0OkY3MUxHeTJoOU1YdHdHNnRqM2ZHVklIOFAwTDNSMEJD',
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
        id: '10000000-0000-4000-8000-000000000019',
        name: 'Salva novo token',
        type: 'n8n-nodes-base.googleSheets',
        version: 4.6,
        position: [752, -272],
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
                linha: '1',
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
        id: '10000000-0000-4000-8000-000000000003',
        name: 'Busca pedidos Olist',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [-144, 0],
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
        options: {},
    };

    @node({
        id: '10000000-0000-4000-8000-000000000004',
        name: 'Prepara Filtro SQL',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [80, 0],
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
        id: '10000000-0000-4000-8000-000000000005',
        name: 'Loop pedidos',
        type: 'n8n-nodes-base.splitInBatches',
        version: 3,
        position: [-640, 272],
    })
    LoopPedidos = {
        options: {},
    };

    @node({
        id: '10000000-0000-4000-8000-000000000006',
        name: 'Busca detalhe Olist',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [-416, 288],
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
        id: '10000000-0000-4000-8000-000000000007',
        name: 'Normaliza pedido Olist',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [-192, 288],
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
        id: '10000000-0000-4000-8000-000000000008',
        name: 'Busca cod municipio Olist',
        type: 'n8n-nodes-base.microsoftSql',
        version: 1.1,
        position: [32, 288],
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
        id: '10000000-0000-4000-8000-000000000010',
        name: 'Municipio encontrado?',
        type: 'n8n-nodes-base.if',
        version: 2,
        position: [240, 288],
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
        id: '10000000-0000-4000-8000-000000000011',
        name: 'Monta cliente SQL',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [512, 288],
    })
    MontaClienteSql = {
        jsCode: `function t(str, len) { return String(str ?? '').trim().substring(0, len); }
const pedido = $('Normaliza pedido Olist').item.json;
const municipio = t($json.CdMunicipio, 6) || '9841';
const representante = '1010';
const nome = String(pedido.nome || 'CLIENTE TINY').trim();
const end = pedido.endereco || {};
return [{ json: { C_Cep: t(end.cep, 9), E_Cep: t(end.cep, 9), F_Cep: t(end.cep, 9), E_Cnpj: t(pedido.documento, 18), FlTipo: t(pedido.tipoPessoa, 1), CdGrupo: '001', DiaPgto: 'Indefinido', C_Bairro: t(end.bairro, 30), C_Cidade: t(end.cidade, 30), C_Estado: t(end.uf, 2), C_Numero: t(end.numero, 10), CdRegiao: '', E_Bairro: t(end.bairro, 30), E_Cidade: t(end.cidade, 30), E_Estado: t(end.uf, 2), E_Numero: t(end.numero, 10), F_Bairro: t(end.bairro, 30), F_Cidade: t(end.cidade, 30), F_Estado: t(end.uf, 2), F_Numero: t(end.numero, 10), Cnpj_Cnpf: t(pedido.documento, 18), FsCliente: t(nome.split(/\\s+/)[0], 15).toUpperCase(), RzCliente: t(nome, 40).toUpperCase(), C_Endereco: t(end.logradouro, 50), CdSegmento: '60', DtAtivacao: \`\${pedido.dataPedido} 00:00:00.000\`, E_Endereco: t(end.logradouro, 50), F_Endereco: t(end.logradouro, 50), PeDesconto: '0', RestricaoSN: 'N', C_CdMunicipio: municipio, C_Complemento: t(end.complemento, 20), CapitalSocial: '0', E_CdMunicipio: municipio, E_Complemento: t(end.complemento, 20), F_CdMunicipio: municipio, F_Complemento: t(end.complemento, 20), FlEnvRecRepre: 'S', CdRepresentante: representante, DescontaSuframa: 'N', FlEnvRecEmpresa: 'S', DtAlteracao: \`\${pedido.dataPedido} 00:00:00.000\`, DtUltCompra: pedido.dataPedido, Ativo_Inativo_ExCliente: 'Ativo', pedido } } ];`,
    };

    @node({
        id: '10000000-0000-4000-8000-000000000012',
        name: 'SQL Cadastra Cliente Olist',
        type: 'n8n-nodes-base.microsoftSql',
        version: 1.1,
        position: [752, 288],
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
        id: '10000000-0000-4000-8000-000000000013',
        name: 'Monta venda SQL',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [976, 288],
    })
    MontaVendaSql = {
        jsCode: `function t(str, len) { return String(str ?? '').trim().substring(0, len); }
const base = $('Monta cliente SQL').item.json;
const pedido = base.pedido;
return [{ json: { CdRepresentante: t(base.CdRepresentante, 6), CdEmpresa: '86', CdPedidoRepre: t(pedido.numeroPedido, 20), CdPedidoEmpre: 'XXXXXX', Cnpj_Cnpf: t(pedido.documento, 18), CdTabela: '10', CdCondPgto: '045', CdTransportadora: '0239', RefRepresentante: '', RefCliente: '', PeDesconto: 0, PeDesconto2: 0, PeDesconto3: 0, PeDesconto4: 0, PeDesconto5: 0, FlFrete: 'C', FlStatus: 'B', FlEnvRecEmpresa: 'S', FlEnvRecRepre: 'S', DtCancelamento: '', MotivoCancelamento: '', Observacao: '', PRIORIDADE: '1', CdNatureza: '006', XML: '', DtPedido: \`\${pedido.dataPedido} 00:00:00.000\`, DtEntrega: \`\${pedido.dataPedido} 00:00:00.000\`, pedido } } ];`,
    };

    @node({
        id: '10000000-0000-4000-8000-000000000014',
        name: 'SQL Cadastra Venda Olist',
        type: 'n8n-nodes-base.microsoftSql',
        version: 1.1,
        position: [1200, 288],
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
        id: '10000000-0000-4000-8000-000000000015',
        name: 'Monta itens SQL',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [1424, 288],
    })
    MontaItensSql = {
        jsCode: `function t(str, len) { return String(str ?? '').trim().substring(0, len); }
const venda = $('Monta venda SQL').item.json;
const itens = venda.pedido.itens || [];
return itens.map((item) => {
  const produto = item.produto ?? item;
  return { json: { CdRepresentante: t(venda.CdRepresentante, 6), CdEmpresa: '86', CdPedidoRepre: t(venda.CdPedidoRepre, 20), CdPedidoEmpre: 'XXXXXX', CdProduto: t(produto.codigo ?? produto.sku ?? produto.id ?? produto.descricao ?? '', 20), QtProduto: Number(item.quantidade ?? item.qtd ?? produto.quantidade ?? 1), QtBaixado: Number(item.quantidade ?? item.qtd ?? produto.quantidade ?? 1), Unitario: Number(item.valorUnitario ?? item.precoUnitario ?? item.preco ?? item.valor ?? produto.valorUnitario ?? produto.preco ?? 0), PeDesconto: 0, PeDesconto2: 0, PeDesconto3: 0, PeDesconto4: 0, PeDesconto5: 0, Negociado: Number(item.valorUnitario ?? item.precoUnitario ?? item.preco ?? item.valor ?? produto.valorUnitario ?? produto.preco ?? 0), PeIpi: 0, PeIcms: 0, PeReducao: 0, FlFalha: 'S', Gramatura: '0', RefCliente: '' } };
});`,
    };

    @node({
        id: '10000000-0000-4000-8000-000000000031',
        name: 'Salva última execução',
        type: 'n8n-nodes-base.googleSheets',
        version: 4.6,
        position: [-624, 512],
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
                linha: '1',
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
        id: '10000000-0000-4000-8000-000000000016',
        name: 'SQL Cadastra Itens Olist',
        type: 'n8n-nodes-base.microsoftSql',
        version: 1.1,
        position: [1648, 288],
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
        id: '10000000-0000-4000-8000-000000000022',
        name: 'Pedido Full?',
        type: 'n8n-nodes-base.if',
        version: 2,
        position: [1376, 528],
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
        id: '10000000-0000-4000-8000-000000000020',
        name: 'Adiciona marcador Olist',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [1648, 544],
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
        id: 'sticky-001',
        name: '🔑 Autenticação',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, -320],
    })
    Autenticacao = {
        content: '## 🔑 Autenticação\\nLeitura do token, refresh automático e gravação de volta no Sheets.',
        height: 196,
        width: 1292,
        color: 4,
    };

    @node({
        id: 'sticky-002',
        name: '��� Busca Pedidos',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-240, -64],
    })
    BuscaPedidos = {
        content: '## 📋 Busca Pedidos\\nConsulta a API Olist e expande a lista de pedidos.',
        height: 220,
        width: 1664,
        color: 5,
    };

    @node({
        id: 'sticky-004',
        name: '⚙�� Processamento',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-736, 224],
    })
    Processamento = {
        content:
            '## ⚙️ Processamento por Pedido\\nBusca detalhe → Normaliza → Município → Cliente → Venda → Itens no SQL Server.',
        height: 248,
        width: 2568,
        color: 3,
    };

    @node({
        id: '10000000-0000-4000-8000-000000000021',
        name: 'IF Tem Pedidos?',
        type: 'n8n-nodes-base.if',
        version: 2,
        position: [304, 0],
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
        id: '10000000-0000-4000-8000-000000000017',
        name: 'SQL Verifica Importados',
        type: 'n8n-nodes-base.microsoftSql',
        version: 1.1,
        position: [560, 0],
        credentials: { microsoftSql: { id: '347YbKVdQ6hSkPU6', name: 'Microsoft SQL account' } },
        alwaysOutputData: true,
    })
    SqlVerificaImportados = {
        operation: 'executeQuery',
        query: "SELECT CdPedidoRepre, CdRepresentante, CdEmpresa FROM BusinessMovPedidoVenda WHERE CdEmpresa = '86' AND CdRepresentante = '1010' AND CdPedidoRepre IN ({{ $('Prepara Filtro SQL').item.json.idsStr }})",
    };

    @node({
        id: '10000000-0000-4000-8000-000000000040',
        name: 'Marca Pedidos Importados',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [784, 0],
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
        notice: 'Adiciona marcador Business-ok nos pedidos já importados que ainda não possuem o marcador',
    };

    @node({
        id: '10000000-0000-4000-8000-000000000032',
        name: 'Filtra Novos Pedidos',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [1024, 0],
    })
    FiltraNovosPedidos = {
        jsCode: `const lista = $('Prepara Filtro SQL').item.json.lista;

const importados = items
  .map(i => String(i.json?.CdPedidoRepre ?? '').trim())
  .filter(id => id !== '' && id !== 'undefined' && id !== 'null');

const filtrados = lista.filter(pedido => {
  const p = pedido.pedido ?? pedido;
  if (String(p.situacao ?? '') === '2') return false;
  const id = String(p.numero ?? p.numeroPedido ?? p.id ?? p.idPedido).trim();
  if (importados.includes(id)) return false;
  return true;
});

if (filtrados.length === 0) {
  return [{ json: { temNovos: false } }];
}

return filtrados.map(p => ({ json: Object.assign({ temNovos: true }, p.pedido ?? p) }));`,
    };

    @node({
        id: '10000000-0000-4000-8000-000000000033',
        name: 'IF Novos Pedidos?',
        type: 'n8n-nodes-base.if',
        version: 2,
        position: [1232, 0],
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
        id: '31506970-c05e-4baa-84e7-152d0888dd17',
        name: 'Schedule Trigger',
        type: 'n8n-nodes-base.scheduleTrigger',
        version: 1.3,
        position: [-16, -272],
    })
    ScheduleTrigger = {
        rule: {
            interval: [
                {
                    field: 'minutes',
                    minutesInterval: 1,
                },
            ],
        },
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.TokenOlist.out(0).to(this.RefreshTokenOlist.in(0));
        this.RefreshTokenOlist.out(0).to(this.SalvaNovoToken.in(0));
        this.SalvaNovoToken.out(0).to(this.LeUltimaExecucao.in(0));
        this.LeUltimaExecucao.out(0).to(this.BuscaPedidosOlist.in(0));
        this.BuscaPedidosOlist.out(0).to(this.PreparaFiltroSql.in(0));
        this.PreparaFiltroSql.out(0).to(this.IfTemPedidos.in(0));
        this.IfTemPedidos.out(0).to(this.SqlVerificaImportados.in(0));
        this.IfTemPedidos.out(1).to(this.SalvaUltimaExecucao.in(0));
        this.SqlVerificaImportados.out(0).to(this.MarcaPedidosImportados.in(0));
        this.MarcaPedidosImportados.out(0).to(this.FiltraNovosPedidos.in(0));
        this.FiltraNovosPedidos.out(0).to(this.IfNovosPedidos.in(0));
        this.IfNovosPedidos.out(0).to(this.LoopPedidos.in(0));
        this.IfNovosPedidos.out(1).to(this.SalvaUltimaExecucao.in(0));
        this.LoopPedidos.out(0).to(this.SalvaUltimaExecucao.in(0));
        this.LoopPedidos.out(1).to(this.BuscaDetalheOlist.in(0));
        this.BuscaDetalheOlist.out(0).to(this.NormalizaPedidoOlist.in(0));
        this.NormalizaPedidoOlist.out(0).to(this.BuscaCodMunicipioOlist.in(0));
        this.BuscaCodMunicipioOlist.out(0).to(this.MunicipioEncontrado.in(0));
        this.MunicipioEncontrado.out(0).to(this.MontaClienteSql.in(0));
        this.MunicipioEncontrado.out(1).to(this.MontaClienteSql.in(0));
        this.MontaClienteSql.out(0).to(this.SqlCadastraClienteOlist.in(0));
        this.SqlCadastraClienteOlist.out(0).to(this.MontaVendaSql.in(0));
        this.MontaVendaSql.out(0).to(this.SqlCadastraVendaOlist.in(0));
        this.SqlCadastraVendaOlist.out(0).to(this.MontaItensSql.in(0));
        this.MontaItensSql.out(0).to(this.SqlCadastraItensOlist.in(0));
        this.SqlCadastraItensOlist.out(0).to(this.PedidoFull.in(0));
        this.PedidoFull.out(0).to(this.LoopPedidos.in(0));
        this.PedidoFull.out(1).to(this.AdicionaMarcadorOlist.in(0));
        this.AdicionaMarcadorOlist.out(0).to(this.LoopPedidos.in(0));
        this.ScheduleTrigger.out(0).to(this.TokenOlist.in(0));
    }
}
