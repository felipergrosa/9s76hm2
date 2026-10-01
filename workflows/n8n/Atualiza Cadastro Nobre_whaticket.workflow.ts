import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Atualiza Cadastro Nobre/whaticket
// Nodes   : 14  |  Connections: 13
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// ScheduleTrigger                    scheduleTrigger
// SincronizarContatoWhaticket        httpRequest                [onError→regular]
// LeCache                            dataTable
// CalculaCutoff                      code
// MapeiaCampos                       set
// BuscaClientesSql                   microsoftSql               [creds]
// Code                               code
// FiltraMudanca                      if
// PreparaCache                       code
// UpsertCache                        dataTable
// AtualizaDataSincronizacao          code
// AtualizaGlobal                     code
// Log                                code
// StickyNote                         stickyNote
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// ScheduleTrigger
//    → CalculaCutoff
//      → BuscaClientesSql
//        → Log
//          → MapeiaCampos
//            → Code
//              → FiltraMudanca
//                → SincronizarContatoWhaticket
//                  → PreparaCache
//                    → UpsertCache
//                      → AtualizaDataSincronizacao
//               .out(1) → AtualizaDataSincronizacao (↩ loop)
//    → LeCache
//      → Code (↩ loop)
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: '8VjNDtjUtwgeE6qA',
    name: 'Atualiza Cadastro Nobre/whaticket',
    active: true,
    isArchived: false,
    settings: {
        executionOrder: 'v1',
        callerPolicy: 'workflowsFromSameOwner',
        binaryMode: 'separate',
        timeSavedMode: 'fixed',
        availableInMCP: false,
    },
})
export class AtualizaCadastroNobreWhaticketWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: 'a683814d-0722-40e7-b4ac-e6ab58ef6413',
        name: 'Schedule Trigger',
        type: 'n8n-nodes-base.scheduleTrigger',
        version: 1.2,
        position: [-5856, -3056],
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
        misfirePolicy: 'skip',
    };

    @node({
        id: '9dc2886d-8f29-4704-b79a-878126ab0f37',
        name: 'Sincronizar Contato Whaticket',
        type: 'n8n-nodes-base.httpRequest',
        version: 2,
        position: [-4448, -3056],
        onError: 'continueRegularOutput',
    })
    SincronizarContatoWhaticket = {
        requestMethod: 'POST',
        url: 'https://chatsapi.nobreluminarias.com.br/api/contacts/sync',
        options: {
            timeout: 120000,
        },
        bodyParametersUi: {
            parameter: [
                {
                    name: 'companyId',
                    value: '=1',
                },
                {
                    name: 'name',
                    value: '={{ $json.name }}',
                },
                {
                    name: 'number',
                    value: '={{ $json.number }}',
                },
                {
                    name: 'email',
                    value: '={{ $json.email }}',
                },
                {
                    name: 'representativeCode',
                    value: '={{ $json.representativeCode }}',
                },
                {
                    name: 'city',
                    value: '={{ $json.city }}',
                },
                {
                    name: 'situation',
                    value: '={{ $json.situation }}',
                },
                {
                    name: 'fantasyName',
                    value: '={{ $json.fantasyName }}',
                },
                {
                    name: 'foundationDate',
                    value: '={{ $json.foundationDate }}',
                },
                {
                    name: 'creditLimit',
                    value: '={{ $json.creditLimit }}',
                },
                {
                    name: 'segment',
                    value: '={{ $json.segmento }}',
                },
                {
                    name: 'tags',
                    value: '={{ $json.tags }}',
                },
                {
                    name: 'bzEmpresa',
                    value: '={{ $json.empresa }}',
                },
                {
                    name: 'region',
                    value: '={{ $json.regiao }}',
                },
                {
                    name: 'silentMode',
                    value: '=true',
                },
                {
                    name: 'dtUltCompra',
                    value: '={{ $json.dtUltCompra }}',
                },
                {
                    name: 'vlUltCompra',
                    value: '={{ $json.vlUltCompra }}',
                },
                {
                    name: 'cpfCnpj',
                    value: '={{ $json.cpfCnpj }}',
                },
                {
                    name: 'clientCode',
                    value: '={{ $json.clientCode }}',
                },
                {
                    name: 'contactName',
                    value: '={{ $json.contactName }}',
                },
            ],
        },
        headerParametersUi: {
            parameter: [
                {
                    name: 'Authorization',
                    value: 'Bearer qsFj2s8e2XY85oHcNMAvEw',
                },
                {
                    name: 'Content-Type',
                    value: 'application/json',
                },
            ],
        },
    };

    @node({
        id: 'b1a2c3d4-1111-4222-8333-aabbccddeef0',
        name: 'Le Cache',
        type: 'n8n-nodes-base.dataTable',
        version: 1.1,
        position: [-5856, -3312],
    })
    LeCache = {
        resource: 'row',
        operation: 'get',
        dataTableId: {
            __rl: true,
            value: 'cPceOKKsUXnZuvIC',
            mode: 'id',
        },
        returnAll: true,
    };

    @node({
        id: '3a53aa87-6ffb-4fb0-a285-2d485c746540',
        name: 'CALCULA CUTOFF',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [-5616, -3056],
    })
    CalculaCutoff = {
        jsCode: `const sd = $getWorkflowStaticData('global');

const MARGEM_MS = 30_000;
const OFFSET_HORAS = -3;

let cutoffSql = '';

if (sd.lastSyncDate) {
  const t = new Date(
    new Date(sd.lastSyncDate).getTime()
    - MARGEM_MS
    + (OFFSET_HORAS * 60 * 60 * 1000)
  );

  const pad2 = n => String(n).padStart(2, '0');
  const pad3 = n => String(n).padStart(3, '0');

  cutoffSql =
    \`\${t.getUTCFullYear()}-\${pad2(t.getUTCMonth()+1)}-\${pad2(t.getUTCDate())} \` +
    \`\${pad2(t.getUTCHours())}:\${pad2(t.getUTCMinutes())}:\${pad2(t.getUTCSeconds())}.\` +
    \`\${pad3(t.getUTCMilliseconds())}\`;
}

const whereIncremental = cutoffSql
  ? \`AND C.DtAlteracao >= CAST('\${cutoffSql}' AS DATETIME)\`
  : '';

const query = \`
SELECT
  C.Cnpj_Cnpf,
  C.FsCliente,
  C.RzCliente,
  C.FlTipo,
  C.Ie_Rg,
  C.CDCLIENTE AS CDCLIENTE,
  C.Contato1 AS Contato1,

  COALESCE(
    NULLIF(LOWER(C.Email1), ''),
    NULLIF(LOWER(C.Email2), ''),
    NULLIF(LOWER(C.Email3), ''),
    NULLIF(LOWER(C.F_Email1), ''),
    NULLIF(LOWER(C.C_Email1), ''),
    NULLIF(LOWER(C.E_Email1), '')
  ) AS EmailValido,

  COALESCE(
    NULLIF(REPLACE(REPLACE(REPLACE(REPLACE(C.F_WhatsApp1, '(', ''), ')', ''), '-', ''), ' ', ''), ''),
    NULLIF(REPLACE(REPLACE(REPLACE(REPLACE(CONCAT(C.F_Ddd1, C.F_Telefone1), '(', ''), ')', ''), '-', ''), ' ', ''), ''),
    NULLIF(REPLACE(REPLACE(REPLACE(REPLACE(CONCAT(C.C_Ddd1, C.C_Telefone1), '(', ''), ')', ''), '-', ''), ' ', ''), ''),
    NULLIF(REPLACE(REPLACE(REPLACE(REPLACE(CONCAT(C.E_Ddd1, C.E_Telefone1), '(', ''), ')', ''), '-', ''), ' ', ''), '')
  ) AS WhatsAppValido,

  REPLACE(REPLACE(REPLACE(REPLACE(CONCAT(C.F_Ddd1, C.F_Telefone1), '(', ''), ')', ''), '-', ''), ' ', '') AS Telefone1,
  REPLACE(REPLACE(REPLACE(REPLACE(CONCAT(C.C_Ddd1, C.C_Telefone1), '(', ''), ')', ''), '-', ''), ' ', '') AS Telefone2,
  REPLACE(REPLACE(REPLACE(REPLACE(CONCAT(C.E_Ddd1, C.E_Telefone1), '(', ''), ')', ''), '-', ''), ' ', '') AS Telefone3,

  UPPER(LTRIM(RTRIM(REPLACE(COALESCE(NULLIF(C.F_Endereco, ''), NULLIF(C.C_Endereco, ''), NULLIF(C.E_Endereco, '')), '  ', ' ')))) AS EnderecoValido,
  UPPER(LTRIM(RTRIM(REPLACE(COALESCE(NULLIF(C.F_Bairro, ''), NULLIF(C.C_Bairro, ''), NULLIF(C.E_Bairro, '')), '  ', ' ')))) AS BairroValido,
  UPPER(LTRIM(RTRIM(REPLACE(COALESCE(NULLIF(C.F_Cidade, ''), NULLIF(C.C_Cidade, ''), NULLIF(C.E_Cidade, '')), '  ', ' ')))) AS CidadeValido,
  UPPER(LTRIM(RTRIM(COALESCE(NULLIF(C.F_Estado, ''), NULLIF(C.C_Estado, ''), NULLIF(C.E_Estado, ''))))) AS EstadoValido,
  UPPER(LTRIM(RTRIM(COALESCE(NULLIF(C.F_Estado, ''), NULLIF(C.C_Estado, ''), NULLIF(C.E_Estado, ''))))) AS UFValido,

  C.Ativo_Inativo_ExCliente,
  C.CdRepresentante,
  CAST(C.CdRepresentante AS VARCHAR(50)) AS CdRepresentante_Nome,
  C.CdSegmento,
  CAST(C.CdSegmento AS VARCHAR(50)) AS DsSegmento,
  CAST('' AS VARCHAR(100)) AS FsEmpresa,
  CAST('' AS VARCHAR(100)) AS DsRegiao,
  C.DtFundacao,
  C.DtAlteracao,
  ISNULL(LC.LimiteCredito, 0) AS CreditLimit,
  LC.DtUltCompra AS DtUltCompra_LC,
  LC.VlUltCompra AS VlUltCompra_LC

FROM BusinessCadCliente AS C
LEFT JOIN BusinessCadClienteLC AS LC
  ON LC.Cnpj_Cnpf = C.Cnpj_Cnpf

WHERE
      LC.CdEmpresa = 97
  AND C.Cnpj_Cnpf IS NOT NULL
  AND C.Cnpj_Cnpf <> ''
  AND C.Ativo_Inativo_ExCliente IN ('Ativo','Inativo','Excluido','Ex-Cliente','Baixado','Futuro','Excluído')
  AND C.CdSegmento IN (17, 19, 27, 28, 61, 68, 72, 74, 77, 54, 67, 60)
  AND (
    NULLIF(REPLACE(REPLACE(REPLACE(REPLACE(C.F_WhatsApp1, '(', ''), ')', ''), '-', ''), ' ', ''), '') IS NOT NULL
    OR NULLIF(REPLACE(REPLACE(REPLACE(REPLACE(CONCAT(C.F_Ddd1, C.F_Telefone1), '(', ''), ')', ''), '-', ''), ' ', ''), '') IS NOT NULL
    OR NULLIF(REPLACE(REPLACE(REPLACE(REPLACE(CONCAT(C.C_Ddd1, C.C_Telefone1), '(', ''), ')', ''), '-', ''), ' ', ''), '') IS NOT NULL
    OR NULLIF(REPLACE(REPLACE(REPLACE(REPLACE(CONCAT(C.E_Ddd1, C.E_Telefone1), '(', ''), ')', ''), '-', ''), ' ', ''), '') IS NOT NULL
  )
  \${whereIncremental}
\`;

return [{ json: { cutoffSql, query } }];`,
    };

    @node({
        id: 'acd5ccfc-6cc4-4f39-b5f0-5b23033facaa',
        name: 'Mapeia Campos',
        type: 'n8n-nodes-base.set',
        version: 2,
        position: [-4896, -3056],
    })
    MapeiaCampos = {
        values: {
            string: [
                {
                    name: 'Cnpj_Cnpf',
                    value: '={{$json.Cnpj_Cnpf}}',
                },
                {
                    name: 'email',
                    value: '={{ $json.EmailValido }}',
                },
                {
                    name: 'FsCliente',
                    value: '={{ $json.FsCliente }}',
                },
                {
                    name: 'RzCliente',
                    value: '={{$json.RzCliente}}',
                },
                {
                    name: 'DtAlteracao',
                    value: '={{$json.DtAlteracao}}',
                },
                {
                    name: 'segmento',
                    value: '={{ $json.DsSegmento }}',
                },
                {
                    name: 'empresa',
                    value: '={{ $json.FsEmpresa }}',
                },
                {
                    name: 'regiao',
                    value: '={{ $json.DsRegiao }}',
                },
                {
                    name: 'CDCLIENTE',
                    value: '={{ $json.CDCLIENTE }}',
                },
                {
                    name: 'Contato1',
                    value: '={{ $json.Contato1 }}',
                },
            ],
            number: [
                {
                    name: 'F_WhatsApp1',
                    value: '={{ $json.WhatsAppValido }}',
                },
            ],
            boolean: [],
        },
        options: {
            dotNotation: true,
        },
    };

    @node({
        id: '9555c5aa-c04f-4729-a791-cc06c1a775f2',
        name: 'Busca Clientes SQL',
        type: 'n8n-nodes-base.microsoftSql',
        version: 1,
        position: [-5344, -3056],
        credentials: { microsoftSql: { id: '347YbKVdQ6hSkPU6', name: 'Microsoft SQL account' } },
    })
    BuscaClientesSql = {
        operation: 'executeQuery',
        query: `/* INCREMENTAL por lastSyncDate (compatível com versões antigas) */

SELECT
  -- Identificação principal
  C.Cnpj_Cnpf,
  C.FsCliente,
  C.RzCliente,
  C.FlTipo,
  C.Ie_Rg,
  C.CDCLIENTE AS CDCLIENTE,
  C.Contato1 AS Contato1,

  -- Contatos principais
  COALESCE(
    NULLIF(LOWER(C.Email1), ''),
    NULLIF(LOWER(C.Email2), ''),
    NULLIF(LOWER(C.Email3), ''),
    NULLIF(LOWER(C.F_Email1), ''),
    NULLIF(LOWER(C.C_Email1), ''),
    NULLIF(LOWER(C.E_Email1), '')
  ) AS EmailValido,

  -- Whatsapp mais provável
  COALESCE(
    NULLIF(REPLACE(REPLACE(REPLACE(REPLACE(C.F_WhatsApp1, '(', ''), ')', ''), '-', ''), ' ', ''), ''),
    NULLIF(REPLACE(REPLACE(REPLACE(REPLACE(CONCAT(C.F_Ddd1, C.F_Telefone1), '(', ''), ')', ''), '-', ''), ' ', ''), ''),
    NULLIF(REPLACE(REPLACE(REPLACE(REPLACE(CONCAT(C.C_Ddd1, C.C_Telefone1), '(', ''), ')', ''), '-', ''), ' ', ''), ''),
    NULLIF(REPLACE(REPLACE(REPLACE(REPLACE(CONCAT(C.E_Ddd1, C.E_Telefone1), '(', ''), ')', ''), '-', ''), ' ', ''), '')
  ) AS WhatsAppValido,

  -- Telefones tratados
  REPLACE(REPLACE(REPLACE(REPLACE(CONCAT(C.F_Ddd1, C.F_Telefone1), '(', ''), ')', ''), '-', ''), ' ', '') AS Telefone1,
  REPLACE(REPLACE(REPLACE(REPLACE(CONCAT(C.C_Ddd1, C.C_Telefone1), '(', ''), ')', ''), '-', ''), ' ', '') AS Telefone2,
  REPLACE(REPLACE(REPLACE(REPLACE(CONCAT(C.E_Ddd1, C.E_Telefone1), '(', ''), ')', ''), '-', ''), ' ', '') AS Telefone3,

  -- Endereço/Bairro/Cidade/UF
  UPPER(LTRIM(RTRIM(REPLACE(COALESCE(NULLIF(C.F_Endereco, ''), NULLIF(C.C_Endereco, ''), NULLIF(C.E_Endereco, '')), '  ', ' ')))) AS EnderecoValido,
  UPPER(LTRIM(RTRIM(REPLACE(COALESCE(NULLIF(C.F_Bairro,   ''), NULLIF(C.C_Bairro,   ''), NULLIF(C.E_Bairro,   '')), '  ', ' ')))) AS BairroValido,
  UPPER(LTRIM(RTRIM(REPLACE(COALESCE(NULLIF(C.F_Cidade,   ''), NULLIF(C.C_Cidade,   ''), NULLIF(C.E_Cidade,   '')), '  ', ' ')))) AS CidadeValido,
  UPPER(LTRIM(RTRIM(COALESCE(NULLIF(C.F_Estado, ''), NULLIF(C.C_Estado, ''), NULLIF(C.E_Estado, ''))))) AS EstadoValido,

  -- CEP / Município
  REPLACE(COALESCE(NULLIF(C.F_Cep, ''), NULLIF(C.C_Cep, ''), NULLIF(C.E_Cep, '')), ' ', '') AS CepValido,
  REPLACE(COALESCE(NULLIF(C.F_CdMunicipio, ''), NULLIF(C.C_CdMunicipio, ''), NULLIF(C.E_CdMunicipio, '')), ' ', '') AS CodMunicipioValido,

  -- Segmento
  C.CdSegmento,
  CONCAT(RTRIM(C.CdSegmento), ' - ', LTRIM(RTRIM(SM.DsSegmento))) AS DsSegmento,

  -- Região
  LTRIM(RTRIM(RG.DsRegiao)) AS DsRegiao,

  -- Representante
  C.CdRepresentante,
  CONCAT(RTRIM(C.CdRepresentante), ' - ', COALESCE(RTRIM(R.Fsrepresentante), '')) AS CdRepresentante_Nome,

  -- Status / datas
  C.Ativo_Inativo_ExCliente,
  C.DtFundacao,
  C.DtAlteracao,

  -- Empresa / Financeiro
  E.FsEmpresa,
  CAST(ISNULL(LC.LimiteCredito, 0) AS DECIMAL(18,2)) AS CreditLimit,

  -- Última compra pela LC
  CONVERT(VARCHAR(10), LC.DtUltCompra, 23) AS DtUltCompra_LC,
  CAST(ISNULL(LC.VlUltCompra, 0) AS DECIMAL(18,2)) AS VlUltCompra_LC

FROM nobregerencia.dbo.BusinessCadCliente AS C
LEFT JOIN nobregerencia.dbo.BusinessCadClienteLC AS LC
  ON LC.Cnpj_Cnpf = C.Cnpj_Cnpf
LEFT JOIN nobregerencia.dbo.BusinessCadSegMercado AS SM
  ON C.CdSegmento = SM.CdSegmento
LEFT JOIN nobregerencia.dbo.BusinessCadEmpresa AS E
  ON LC.CdEmpresa = E.CdEmpresa
LEFT JOIN nobregerencia.dbo.BusinessCadRepresentante AS R
  ON R.CdRepresentante = C.CdRepresentante
LEFT JOIN nobregerencia.dbo.BusinessCadRegiao AS RG
  ON RG.CdRegiao = C.CdRegiao

WHERE
      LC.CdEmpresa = 97
  AND C.Cnpj_Cnpf IS NOT NULL 
  AND C.Cnpj_Cnpf <> ''
  AND C.Ativo_Inativo_ExCliente IN ('Ativo','Inativo','Excluido','Ex-Cliente','Baixado','Futuro','Excluído')
  AND C.CdSegmento IN (17, 19, 27, 28, 61, 68, 72, 74, 77, 54, 67, 60)
  AND (
    NULLIF(REPLACE(REPLACE(REPLACE(REPLACE(C.F_WhatsApp1, '(', ''), ')', ''), '-', ''), ' ', ''), '') IS NOT NULL
    OR NULLIF(REPLACE(REPLACE(REPLACE(REPLACE(CONCAT(C.F_Ddd1, C.F_Telefone1), '(', ''), ')', ''), '-', ''), ' ', ''), '') IS NOT NULL
    OR NULLIF(REPLACE(REPLACE(REPLACE(REPLACE(CONCAT(C.C_Ddd1, C.C_Telefone1), '(', ''), ')', ''), '-', ''), ' ', ''), '') IS NOT NULL
    OR NULLIF(REPLACE(REPLACE(REPLACE(REPLACE(CONCAT(C.E_Ddd1, C.E_Telefone1), '(', ''), ')', ''), '-', ''), ' ', ''), '') IS NOT NULL
  )
AND (
  '{{$json.cutoffSql}}' = ''
  OR C.DtAlteracao >= CAST('{{$json.cutoffSql}}' AS DATETIME)
)`,
    };

    @node({
        id: '4d579c26-a66b-4201-a7e5-83e63ed29fd7',
        name: 'Code',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [-4672, -3056],
    })
    Code = {
        jsCode: `// Code – Monta Body Whaticket  (COMPLETO)
// - Valida telefone (DDI 55) e e-mail
// - Tag por segmento (somente: 17,19,27,28,61,68,72,74,77,67,60) e por representante
// - Normaliza situação
// - Inclui dtUltCompra e vlUltCompra (normalizados p/ API)
// - Remove campos undefined
// - Filtra itens sem número (evita 400 na API)

  
// Segmentos que são CLIENTES
const clientSegments = new Set([17, 19, 27, 28, 61, 68, 72, 74, 77, 67, 60]);

// Normalizador de telefone para WhatsApp (E.164 BR)
function normalizeWhatsAppBR(raw) {
  let s = String(raw || '').replace(/\\D/g, '');
  if (!s) return '';
  s = s.replace(/^0+/, '');
  if (!s.startsWith('55')) s = '55' + s;
  // aceita apenas 55 + DDD(2) + 9 + 8 dígitos
  return /^55\\d{2}9\\d{8}$/.test(s) ? s : '';
}

// Formata data como YYYY-MM-DD
function toYMD(d) {
  const pad2 = n => String(n).padStart(2, '0');
  return \`\${d.getFullYear()}-\${pad2(d.getMonth() + 1)}-\${pad2(d.getDate())}\`;
}

// Converte valor monetário de forma segura
function moneyToNumber(v) {
  if (v === null || v === undefined || v === '') return undefined;

  // Se já vier como número do SQL/n8n, usa direto
  if (typeof v === 'number') {
    return Number.isFinite(v) ? v : undefined;
  }

  let s = String(v).trim();
  if (!s) return undefined;

  // 1) Inteiro simples: 30000 / 0 / 15000
  if (/^\\d+$/.test(s)) {
    const n = Number(s);
    return Number.isFinite(n) ? n : undefined;
  }

  // 2) Decimal com ponto: 930.58 / 2059.66
  if (/^\\d+\\.\\d+$/.test(s)) {
    const n = Number(s);
    return Number.isFinite(n) ? n : undefined;
  }

  // 3) Formato BR: 13.056,31 / 930,58
  if (/^\\d{1,3}(\\.\\d{3})*,\\d+$/.test(s) || /^\\d+,\\d+$/.test(s)) {
    s = s.replace(/\\./g, '').replace(',', '.');
    const n = Number(s);
    return Number.isFinite(n) ? n : undefined;
  }

  return undefined;
}

// 🔁 Separa linhas do cache (vêm do node "Le Cache" no mesmo input) dos clientes
const cache = new Map();
const clientes = [];
for (const it of items) {
  const j = it.json ?? {};
  if (j.cnpj !== undefined && j.content !== undefined && j.Cnpj_Cnpf === undefined) {
    cache.set(String(j.cnpj), String(j.content));
  } else {
    clientes.push(it);
  }
}

return clientes
  .map(item => {
    const j = item.json ?? {};

    // 📞 Número tratado (apenas WhatsApp válido)
    const number = normalizeWhatsAppBR(j.WhatsAppValido);

    // 📧 E-mail válido
    const rawEmail = String(j.EmailValido ?? '').trim().toLowerCase();
    const isValidEmail =
      !!rawEmail &&
      !['null', 'undefined', '', '[empty]', 'xxx'].includes(rawEmail) &&
      /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(rawEmail);

    // 🏷️ Tag base por segmento
const seg = Number(j.CdSegmento);
let baseTags = [];

if (seg === 54) {
  baseTags.push('##REPRESENTANTES');
} else if (clientSegments.has(seg)) {
  baseTags.push('##CLIENTES');
}

// 🏷️ Tags por representante
// Você pode colocar 1 ou várias tags por representante
const repCode = String(j.CdRepresentante ?? '')
  .replace(/\\D/g, '')
  .padStart(4, '0');

const repTagMap = {
  '1012': ['#LEONARDO-ROSA'],
  '1016': ['#BRUNA-ZANOBIO'],
  '1015': ['#FERNANDA-FREITAS'],

  // exemplos com múltiplas tags:
  // '0867': ['##PATRICIA-RO', '##NORTE'],
  // '2002': ['##REATIVAR', '##SUDESTE'],
};

// pega tags do representante ou lista vazia
const repTags = repTagMap[repCode] || [];

// junta tudo, remove vazios e duplicados
const tagsArray = [...new Set([...baseTags, ...repTags].filter(Boolean))];

// string final separada por vírgula
const tags = tagsArray.length ? tagsArray.join(',') : undefined;

    // 📌 Situação normalizada
    const rawSituation = String(j.Ativo_Inativo_ExCliente ?? '').trim();
    let situation = 'Ativo';
    const allowed = ['Ativo', 'Inativo', 'Excluido', 'Ex-Cliente', 'Baixado', 'Futuro'];
    if (allowed.includes(rawSituation)) {
      situation = rawSituation;
    } else if (rawSituation === 'Excluído') {
      situation = 'Excluido';
    }

    // 🔢 clientCode: somente dígitos
    const clientCodeDigits = String(j.CDCLIENTE ?? '').replace(/\\D/g, '');

    // 🧱 Body
    const body = {
      companyId: 1,
      name: String(j.RzCliente ?? '').trim(),
      number,
      fantasyName: String(j.FsCliente ?? '').trim(),
      situation,
      clientCode: clientCodeDigits || undefined,
      email: isValidEmail ? rawEmail : undefined,
      cpfCnpj: String(j.Cnpj_Cnpf ?? '').replace(/\\D/g, '') || undefined,
      city: String(j.CidadeValido ?? '').trim() || undefined,
      segmento: String(j.DsSegmento ?? '').trim() || undefined,
      creditLimit: String(j.CreditLimit ?? '').trim() || undefined,
      representativeCode: String(j.CdRepresentante_Nome ?? '').trim() || undefined,
      empresa: String(j.FsEmpresa ?? '').trim() || undefined,
      regiao: String(j.DsRegiao ?? '').trim() || undefined,
      tags,
      contactName: String(j.Contato1 ?? '').trim() || undefined,
    };

    // 📅 Data de fundação (ISO)
    if (j.DtFundacao) {
      const d = new Date(j.DtFundacao);
      if (!isNaN(d.getTime())) body.foundationDate = d.toISOString();
    }

    // 🛒 dtUltCompra: preferir YYYY-MM-DD
    if (j.DtUltCompra_LC !== undefined && j.DtUltCompra_LC !== null && String(j.DtUltCompra_LC).trim() !== '') {
      const dLc = new Date(j.DtUltCompra_LC);
      body.dtUltCompra = !isNaN(dLc.getTime())
        ? toYMD(dLc)
        : String(j.DtUltCompra_LC).trim();
    }

    // 🛒 vlUltCompra / vUltCompra
    const vNum = moneyToNumber(j.VlUltCompra_LC);
    if (vNum !== undefined) {
      body.vlUltCompra = vNum;
      body.vUltCompra = vNum;
    }

    // 🧹 Remove undefined
    Object.keys(body).forEach(k => body[k] === undefined && delete body[k]);

    return { json: body };
  })
  .map(item => {
    // 🧠 Dedup por conteúdo: só envia se o payload realmente mudou
    // (cobre DtAlteracao "sujo" no ERP e reprocessamento de janela após falha)
    const j = item.json;
    const key = String(j.cpfCnpj || j.clientCode || j.number || '');
    const content = JSON.stringify(j);
    const enviar = !!j.number && !!key && cache.get(key) !== content;
    return { json: { ...j, __key: key, __content: content, __enviar: enviar } };
  });`,
    };

    @node({
        id: 'c2b3d4e5-2222-4333-8444-bbccddee0011',
        name: 'Filtra Mudanca',
        type: 'n8n-nodes-base.if',
        version: 2.3,
        position: [-4672, -2864],
    })
    FiltraMudanca = {
        conditions: {
            options: {
                caseSensitive: true,
                typeValidation: 'strict',
                version: 2,
            },
            conditions: [
                {
                    id: 'f1-enviar',
                    leftValue: '={{ $json.__enviar }}',
                    rightValue: true,
                    operator: {
                        type: 'boolean',
                        operation: 'true',
                        singleValue: true,
                    },
                },
            ],
            combinator: 'and',
        },
        options: {},
    };

    @node({
        id: 'd3c4e5f6-3333-4444-9555-ccddeeff0012',
        name: 'Prepara Cache',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [-4000, -3056],
    })
    PreparaCache = {
        jsCode: `// Run Once for All Items — emite {cnpj, content, dtSync} só dos enviados OK
const porCnpj = new Map();
const porNumero = new Map();
for (const it of $('Code').all()) {
  const j = it.json ?? {};
  if (j.__content === undefined) continue;
  if (j.cpfCnpj) porCnpj.set(String(j.cpfCnpj), j.__content);
  if (j.number) porNumero.set(String(j.number), j.__content);
}

const agora = new Date().toISOString();
const out = [];
for (const item of $input.all()) {
  const r = item.json ?? {};
  if (r.error) continue; // falha no HTTP → não marca → retenta depois
  const cnpj = r.cpfCnpj != null ? String(r.cpfCnpj) : '';
  const numero = r.number != null ? String(r.number) : '';
  const content = (cnpj && porCnpj.get(cnpj)) || (numero && porNumero.get(numero));
  const key = (cnpj && porCnpj.get(cnpj)) ? cnpj : numero;
  if (content && key) out.push({ json: { cnpj: key, content, dtSync: agora } });
}
return out;`,
    };

    @node({
        id: 'e4f5a6b7-4444-4555-8666-ddeeff001233',
        name: 'Upsert Cache',
        type: 'n8n-nodes-base.dataTable',
        version: 1.1,
        position: [-4000, -2864],
    })
    UpsertCache = {
        resource: 'row',
        operation: 'upsert',
        dataTableId: {
            __rl: true,
            value: 'cPceOKKsUXnZuvIC',
            mode: 'id',
        },
        matchType: 'allConditions',
        filters: {
            conditions: [
                {
                    keyName: 'cnpj',
                    condition: 'eq',
                    keyValue: '={{ $json.cnpj }}',
                },
            ],
        },
        columns: {
            mappingMode: 'defineBelow',
            value: {
                cnpj: '={{ $json.cnpj }}',
                content: '={{ $json.content }}',
                dtSync: '={{ $json.dtSync }}',
            },
            matchingColumns: ['cnpj'],
            schema: [
                {
                    id: 'cnpj',
                    displayName: 'cnpj',
                    required: false,
                    defaultMatch: true,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'content',
                    displayName: 'content',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'dtSync',
                    displayName: 'dtSync',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'date',
                    canBeUsedToMatch: true,
                },
            ],
            attemptToConvertTypes: false,
            convertFieldsToString: false,
        },
    };

    @node({
        id: '984f926b-0c3b-4f09-a451-a27e55429662',
        name: 'Atualiza Data Sincronizacao',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [-4224, -3056],
    })
    AtualizaDataSincronizacao = {
        jsCode: `// Code node (Run Once for All Items)
const sd = $getWorkflowStaticData('global'); // <- correto no Code node
sd.lastSyncDate = new Date().toISOString();

// devolve os mesmos itens de entrada
return $input.all();
`,
    };

    @node({
        id: 'f00b4a0f-4c6f-4f21-abb1-f8dc8057a6bf',
        name: 'Atualiza Global',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [-5344, -3280],
    })
    AtualizaGlobal = {
        jsCode: `// RESET SYNC - Zera lastSyncDate E força cutoffSql vazio
const sd = $getWorkflowStaticData('global');
sd.lastSyncDate = null;

console.log('Reset realizado - carga total liberada');

// Passa cutoffSql vazio direto, pulando o CALCULA CUTOFF
return [{ json: { cutoffSql: '' } }];




// ### Como usar:

// Conectar temporariamente (recomendo)**

// 1. Conecta o nó **Reset Sync → sql ** (substituindo o Schedule Trigger)
// 2. Clica em **"Execute Workflow"** manualmente

// 3. **Desconecta** e volta o Schedule Trigger no lugar

// [Manual Trigger] ──┐
//                    ├──→ [SQL] → ... resto do fluxo`,
    };

    @node({
        id: 'e00001d0-6d5b-4989-9316-053948df2f23',
        name: 'LOG',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [-5120, -3056],
    })
    Log = {
        jsCode: `const log = {
  dataExecucao: new Date().toISOString(),
  quantidade: $input.all().length,
  registros: $input.all().map(i => i.json)
};

console.log(JSON.stringify(log, null, 2));

return $input.all();`,
    };

    @node({
        id: 'bd9380dc-bbf1-4804-af53-f5e24a77210f',
        name: 'Sticky Note',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-5376, -3312],
    })
    StickyNote = {
        content: `SYNC INCREMENTAL A CADA 1 MIN

- SQL filtra por DtAlteracao >= lastSyncDate - 30s
- Dedup por conteúdo (Data Table "whaticket_sync_cache"): só chama a API se o payload mudou
- Falha no HTTP não grava cache → o item retenta no próximo ciclo
- lastSyncDate só avança quando itens chegam ao fim do fluxo

PARA ATUALIZAR TUDO: node "Atualiza Global" (leia comentarios internos) + limpar a Data Table`,
        width: 480,
        color: 4,
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.ScheduleTrigger.out(0).to(this.CalculaCutoff.in(0));
        this.ScheduleTrigger.out(0).to(this.LeCache.in(0));
        this.CalculaCutoff.out(0).to(this.BuscaClientesSql.in(0));
        this.BuscaClientesSql.out(0).to(this.Log.in(0));
        this.Log.out(0).to(this.MapeiaCampos.in(0));
        this.MapeiaCampos.out(0).to(this.Code.in(0));
        this.LeCache.out(0).to(this.Code.in(0));
        this.Code.out(0).to(this.FiltraMudanca.in(0));
        this.FiltraMudanca.out(0).to(this.SincronizarContatoWhaticket.in(0));
        this.FiltraMudanca.out(1).to(this.AtualizaDataSincronizacao.in(0));
        this.SincronizarContatoWhaticket.out(0).to(this.PreparaCache.in(0));
        this.PreparaCache.out(0).to(this.UpsertCache.in(0));
        this.UpsertCache.out(0).to(this.AtualizaDataSincronizacao.in(0));
    }
}
