import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Atualiza Cadastro Nobre/whaticket
// Nodes   : 16  |  Connections: 15
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
// LimitaLote                         code
// PreparaCache                       code
// UpsertCache                        dataTable
// AtualizaDataSincronizacao          code
// GravaCursor                        dataTable
// AtualizaGlobal                     code
// Log                                code
// StickyNote                         stickyNote
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// ScheduleTrigger
//    → LeCache
//      → CalculaCutoff
//        → BuscaClientesSql
//          → Log
//            → MapeiaCampos
//              → Code
//                → FiltraMudanca
//                  → LimitaLote
//                    → SincronizarContatoWhaticket
//                      → PreparaCache
//                        → UpsertCache
//                          → AtualizaDataSincronizacao
//                            → GravaCursor
//                 .out(1) → AtualizaDataSincronizacao (↩ loop)
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
        jsCode: `// Cursor de sincronização mora na Data Table (linha cnpj='__CURSOR__'):
// dtSync = DtAlteracao, content = chave numerica de CDCLIENTE. Paginacao
// keyset (DtAlteracao, CDCLIENTE) com ">" estrito — SEM margem e SEM offset:
// a chave resolve empates de timestamp e impede congelamento em clusters
// densos (o antigo ">= cursor-30s-3h" re-lia uma janela de ~3h que travava
// quando ela continha mais de 400 linhas).
// $getWorkflowStaticData NAO e confiavel neste deploy (queue mode).
// A wiring Le Cache -> CALCULA CUTOFF garante que o cache ja foi lido.
const DRAIN_INICIO = '2020-01-01T00:00:00.000Z';

let cursorIso = null;
let cursorKey = -1;
for (const it of $input.all()) {
  const j = it.json ?? {};
  if (String(j.cnpj) === '__CURSOR__' && j.dtSync) {
    cursorIso = j.dtSync;
    const k = Number(j.content);
    if (Number.isFinite(k)) cursorKey = k;
    break;
  }
}

// DtAlteracao chega naive-serializado-como-UTC; manter a MESMA moldura.
const t = new Date(cursorIso || DRAIN_INICIO);
const pad2 = n => String(n).padStart(2, '0');
const pad3 = n => String(n).padStart(3, '0');
const cutoffDt =
  \`\${t.getUTCFullYear()}-\${pad2(t.getUTCMonth()+1)}-\${pad2(t.getUTCDate())} \` +
  \`\${pad2(t.getUTCHours())}:\${pad2(t.getUTCMinutes())}:\${pad2(t.getUTCSeconds())}.\` +
  \`\${pad3(t.getUTCMilliseconds())}\`;

return [{ json: { cutoffDt, cutoffKey: String(cursorKey) } }];`,
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
        query: `/* INCREMENTAL por lastSyncDate + drenagem de backlog (TOP N mais antigos) */

SELECT TOP 400
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

  -- Segmento: "codigo - descricao" quando a descricao existe; "codigo" puro
  -- quando o segmento nao tem linha em BusinessCadSegMercado (evita "19 - ").
  C.CdSegmento,
  CASE
    WHEN NULLIF(LTRIM(RTRIM(SM.DsSegmento)), '') IS NOT NULL
      THEN CONCAT(RTRIM(CAST(C.CdSegmento AS VARCHAR(20))), ' - ', LTRIM(RTRIM(SM.DsSegmento)))
    ELSE RTRIM(CAST(C.CdSegmento AS VARCHAR(20)))
  END AS DsSegmento,

  -- Região
  LTRIM(RTRIM(RG.DsRegiao)) AS DsRegiao,

  -- Representante: "codigo - fantasia" quando o rep existe no cadastro;
  -- "codigo" puro quando nao ha linha/nome (evita "0001 - ").
  C.CdRepresentante,
  CASE
    WHEN NULLIF(RTRIM(R.Fsrepresentante), '') IS NOT NULL
      THEN CONCAT(RTRIM(CAST(C.CdRepresentante AS VARCHAR(20))), ' - ', RTRIM(R.Fsrepresentante))
    ELSE RTRIM(CAST(C.CdRepresentante AS VARCHAR(20)))
  END AS CdRepresentante_Nome,

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
  -- filtro de telefone removido do WHERE (não-sargável: REPLACE por linha estourava o timeout);
  -- quem não tem WhatsApp válido é descartado no node "Code" antes de chamar a API
-- Paginacao keyset: (DtAlteracao, CDCLIENTE) estritamente maior que o cursor.
-- ">" puro nao re-le a borda: empates de timestamp avancam pela chave e
-- clusters densos nao congelam o TOP 400. ISNULL/TRY_CAST: CDCLIENTE nao
-- numerico ordena como -1 (sempre no inicio do bloco do mesmo DtAlteracao).
AND (
  '{{$json.cutoffDt}}' = ''
  OR C.DtAlteracao > CAST(NULLIF('{{$json.cutoffDt}}', '') AS DATETIME)
  OR (
    C.DtAlteracao = CAST(NULLIF('{{$json.cutoffDt}}', '') AS DATETIME)
    AND ISNULL(TRY_CAST(C.CDCLIENTE AS BIGINT), -1) > CAST('{{$json.cutoffKey}}' AS BIGINT)
  )
)
ORDER BY
  C.DtAlteracao ASC,
  ISNULL(TRY_CAST(C.CDCLIENTE AS BIGINT), -1) ASC`,
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

// 🔁 Cache lido direto do node "Le Cache": este Code executa uma vez por branch
// de entrada, então as linhas de cache NÃO chegam junto com os clientes em
// items — ler pelo $() garante o dedup em qualquer cenário.
const cache = new Map();
if ($('Le Cache').isExecuted) {
  for (const it of $('Le Cache').all()) {
    const j = it.json ?? {};
    if (j.cnpj !== undefined && j.content !== undefined) {
      cache.set(String(j.cnpj), String(j.content));
    }
  }
}
const clientes = [];
for (const it of items) {
  const j = it.json ?? {};
  // linha de cache (quando inputs vierem fundidos) vs cliente do SQL
  if (!(j.cnpj !== undefined && j.content !== undefined && j.Cnpj_Cnpf === undefined)) {
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

    // 🧠 Dedup por conteúdo: só envia se o payload realmente mudou
    // (cobre DtAlteracao "sujo" no ERP e reprocessamento de janela após falha)
    const key = String(body.cpfCnpj || body.clientCode || body.number || '');
    const content = JSON.stringify(body);
    const enviar = !!body.number && !!key && cache.get(key) !== content;
    // chave numerica do CDCLIENTE p/ paginacao keyset — mesma regra do SQL
    // (TRY_CAST AS BIGINT; nao-numerico = -1 e ordena primeiro no bloco do dt)
    const cdRaw = String(j.CDCLIENTE ?? '').trim();
    const cdNum = /^\\d{1,18}$/.test(cdRaw) ? Number(cdRaw) : -1;
    return { json: { ...body, __key: key, __content: content, __enviar: enviar, __dtAlteracao: j.DtAlteracao ?? null, __cdNum: cdNum } };
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
        id: 'b7c8d9e0-5555-4666-a777-ff0011223344',
        name: 'Limita Lote',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [-4448, -2864],
    })
    LimitaLote = {
        jsCode: `// Limita envios por execução: a execução foi cancelada aos ~3min com 1878 itens
// O que não for enviado não entra no cache → entra no próximo ciclo como "mudado"
// Converge sozinho: cada run drena ~300 pendentes até o cache cobrir a base
const LOTE_MAX = 150;
return $input.all().slice(0, LOTE_MAX);`,
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
// Chave = __key do item ORIGINAL via pairedItem: a resposta do backend pode trazer
// campos de outro contato quando dois clientes ERP dividem o mesmo número
// (match por number) — chavear pela resposta corrompia o dedup e travava o cursor.
const enviados = $('Limita Lote').all();

const idxDe = item => {
  const pi = item.pairedItem;
  if (pi == null) return null;
  if (Array.isArray(pi)) return pi[0] != null ? pi[0].item ?? pi[0] : null;
  return typeof pi === 'object' ? (pi.item ?? null) : pi;
};

const agora = new Date().toISOString();
const out = [];
for (const item of $input.all()) {
  const r = item.json ?? {};
  if (r.error) continue; // falha no HTTP → não marca → retenta depois
  const idx = idxDe(item);
  const src = idx != null ? enviados[idx]?.json : null;
  const key = src?.__key;
  const content = src?.__content;
  if (key && content) out.push({ json: { cnpj: String(key), content, dtSync: agora } });
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
        jsCode: `// Emite linhas de controle p/ a Data Table (upsert no "Grava Cursor"):
//  - cnpj='__CURSOR__'  -> dtSync = DtAlteracao, content = chave CDCLIENTE
//  - cnpj='__FAIL__<chave>' -> content = nº de falhas consecutivas
// Cursor = PAR keyset (DtAlteracao, CDCLIENTE): posição exata da última
// linha processável. Travado no par mais antigo de item marcado p/ envio
// que não concluiu (corte do Limita Lote ou falha HTTP).
// Estado lido via $() — determinístico mesmo com execução por branch;
// staticData não persiste entre runs neste deploy (queue mode).
const MAX_TENTATIVAS = 5;

const tudo = $('Code').all();
const enviadosOk = new Set(
  ($('Upsert Cache').isExecuted ? $('Upsert Cache').all() : [])
    .map(it => String(it.json?.cnpj ?? ''))
);
const tentados = $('Limita Lote').isExecuted
  ? new Set($('Limita Lote').all().map(it => String(it.json?.__key ?? '')))
  : new Set();

// contadores de falha gravados em runs anteriores
const falhasAtuais = {};
if ($('Le Cache').isExecuted) {
  for (const it of $('Le Cache').all()) {
    const j = it.json ?? {};
    const k = String(j.cnpj ?? '');
    if (k.startsWith('__FAIL__')) falhasAtuais[k.slice(8)] = Number(j.content) || 0;
  }
}

let maxDt = null, maxKey = -1;
let primeiroPendente = null, pendenteKey = -1;
const falhasNovas = {};
const cdNum = j => {
  const n = Number(j.__cdNum);
  return Number.isFinite(n) ? n : -1;
};
const considera = (d, k) => {
  if (!maxDt || d > maxDt || (d.getTime() === maxDt.getTime() && k > maxKey)) {
    maxDt = d; maxKey = k;
  }
};
const segura = (d, k) => {
  if (!primeiroPendente || d < primeiroPendente || (d.getTime() === primeiroPendente.getTime() && k < pendenteKey)) {
    primeiroPendente = d; pendenteKey = k;
  }
};

for (const it of tudo) {
  const j = it.json ?? {};
  const d = j.__dtAlteracao ? new Date(j.__dtAlteracao) : null;
  const valido = d && !isNaN(d.getTime());
  if (!valido) continue;
  const key = String(j.__key ?? '');
  const ck = cdNum(j);
  if (!j.__enviar || (key && enviadosOk.has(key))) {
    considera(d, ck); // inalterado ou enviado com sucesso
    continue;
  }
  if (!tentados.has(key)) {
    // cortado pelo lote — sempre segura o cursor
    segura(d, ck);
    continue;
  }
  const falhas = (falhasAtuais[key] || 0) + 1;
  falhasNovas[key] = falhas;
  if (falhas > MAX_TENTATIVAS) {
    considera(d, ck); // desiste: registro envenenado não pode paralisar o sync
    continue;
  }
  segura(d, ck);
}

const agora = new Date().toISOString();
const out = [];
if (primeiroPendente || maxDt) {
  const cDt = primeiroPendente || maxDt;
  const cKey = primeiroPendente ? pendenteKey : maxKey;
  out.push({ json: { cnpj: '__CURSOR__', content: String(cKey), dtSync: cDt.toISOString() } });
}
// Só a execução pós-cache conhece o resultado real dos envios:
// zera contadores dos tentados que concluíram e grava as falhas vivas
// (sucesso/desistido -> 0; falhou -> nº consecutivo).
if ($('Upsert Cache').isExecuted) {
  for (const k of tentados) {
    out.push({ json: { cnpj: '__FAIL__' + k, content: String(falhasNovas[k] ?? 0), dtSync: agora } });
  }
}
return out;`,
    };

    @node({
        id: 'a1b2c3d4-7777-4888-9999-eeff00112233',
        name: 'Grava Cursor',
        type: 'n8n-nodes-base.dataTable',
        version: 1.1,
        position: [-3920, -3056],
    })
    GravaCursor = {
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
        id: 'f00b4a0f-4c6f-4f21-abb1-f8dc8057a6bf',
        name: 'Atualiza Global',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [-5344, -3280],
    })
    AtualizaGlobal = {
        jsCode: `// RESET SYNC - forca drenagem total (keyset desde o inicio)
// OBS: cursor persistente mora na Data Table (linha __CURSOR__); para um
// reset REAL e preciso tambem apagar essa linha — staticData nao persiste
// neste deploy (queue mode). Este no esta desconectado do fluxo.

console.log('Reset realizado - carga total liberada');

// Passa cutoff keyset inicial direto, pulando o CALCULA CUTOFF
return [{ json: { cutoffDt: '2020-01-01 00:00:00.000', cutoffKey: '-1' } }];




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
        jsCode: `// só conta — serializar 14k registros consumia memória/tempo do worker e estourava a execução
console.log(\`[sync-erp] \${new Date().toISOString()} registros SQL: \${$input.all().length}\`);

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
- "Limita Lote" envia no máx. 300 contatos por execução (pendentes entram no ciclo seguinte)
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
        this.ScheduleTrigger.out(0).to(this.LeCache.in(0));
        this.LeCache.out(0).to(this.CalculaCutoff.in(0));
        this.LeCache.out(0).to(this.Code.in(0));
        this.CalculaCutoff.out(0).to(this.BuscaClientesSql.in(0));
        this.BuscaClientesSql.out(0).to(this.Log.in(0));
        this.Log.out(0).to(this.MapeiaCampos.in(0));
        this.MapeiaCampos.out(0).to(this.Code.in(0));
        this.Code.out(0).to(this.FiltraMudanca.in(0));
        this.FiltraMudanca.out(0).to(this.LimitaLote.in(0));
        this.FiltraMudanca.out(1).to(this.AtualizaDataSincronizacao.in(0));
        this.LimitaLote.out(0).to(this.SincronizarContatoWhaticket.in(0));
        this.SincronizarContatoWhaticket.out(0).to(this.PreparaCache.in(0));
        this.PreparaCache.out(0).to(this.UpsertCache.in(0));
        this.UpsertCache.out(0).to(this.AtualizaDataSincronizacao.in(0));
        this.AtualizaDataSincronizacao.out(0).to(this.GravaCursor.in(0));
    }
}
