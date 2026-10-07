import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Sincroniza Whaticket para Nobre
// Nodes   : 14  |  Connections: 15
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// WebhookEntrada                     webhook
// NormalizaContato                   code
// VerificaClienteErp                 microsoftSql               [creds]
// DecideAcao                         code
// IfUpdate                           if
// IfInsert                           if
// AtualizaClienteErp                 microsoftSql               [creds]
// BuscaCodMunicipio                  microsoftSql               [creds]
// MunicipioEncontrado                if
// MontaClienteInsert                 code
// SqlInsereCliente                   microsoftSql               [creds] [alwaysOutput] [continueOnFail]
// SqlInsereLc                        microsoftSql               [creds] [alwaysOutput] [continueOnFail]
// LogReverso                         code
// LogPendente                        code
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// WebhookEntrada
//    → NormalizaContato
//      → VerificaClienteErp
//        → DecideAcao
//          → IfUpdate
//            → AtualizaClienteErp
//              → LogReverso
//           .out(1) → IfInsert
//              → BuscaCodMunicipio
//                → MunicipioEncontrado
//                  → MontaClienteInsert
//                    → SqlInsereCliente
//                      → SqlInsereLc
//                        → LogReverso (↩ loop)
//                 .out(1) → LogPendente
//             .out(1) → LogPendente (↩ loop)
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: 'XoCApUU4UOnmjYi4',
    name: 'Sincroniza Whaticket para Nobre',
    active: true,
    isArchived: false,
    settings: {
        executionOrder: 'v1',
        binaryMode: 'separate',
        timeSavedMode: 'fixed',
        callerPolicy: 'workflowsFromSameOwner',
        availableInMCP: false,
    },
})
export class SincronizaWhaticketParaNobreWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: 'a1b2c3d4-5555-4666-8777-eeff00112233',
        webhookId: 'd316cd84-ea9f-4eae-9165-483a6b92d980',
        name: 'Webhook Entrada',
        type: 'n8n-nodes-base.webhook',
        version: 2.1,
        position: [-880, -3040],
    })
    WebhookEntrada = {
        httpMethod: 'POST',
        path: 'whaticket-contato-sync',
        responseMode: 'onReceived',
    };

    @node({
        id: 'b2c3d4e5-6666-4777-8888-ff0011223344',
        name: 'Normaliza Contato',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [-640, -3040],
    })
    NormalizaContato = {
        jsCode: `// Run Once for All Items — normaliza payload do webhook Whaticket
const esc = v => String(v ?? '').replace(/'/g, "''").trim();

// UF derivada do DDD do WhatsApp (fallback quando city não traz UF)
const UF_POR_DDD = {
  '11':'SP','12':'SP','13':'SP','14':'SP','15':'SP','16':'SP','17':'SP','18':'SP','19':'SP',
  '21':'RJ','22':'RJ','24':'RJ','27':'ES','28':'ES',
  '31':'MG','32':'MG','33':'MG','34':'MG','35':'MG','37':'MG','38':'MG',
  '41':'PR','42':'PR','43':'PR','44':'PR','45':'PR','46':'PR',
  '47':'SC','48':'SC','49':'SC',
  '51':'RS','53':'RS','54':'RS','55':'RS',
  '61':'DF','62':'GO','64':'GO','63':'TO','65':'MT','66':'MT','67':'MS',
  '68':'AC','69':'RO',
  '71':'BA','73':'BA','74':'BA','75':'BA','77':'BA','79':'SE',
  '81':'PE','87':'PE','82':'AL','83':'PB','84':'RN','85':'CE','88':'CE',
  '86':'PI','89':'PI','91':'PA','93':'PA','94':'PA','92':'AM','97':'AM',
  '95':'RR','96':'AP','98':'MA','99':'MA',
};

// "Cascavel - PR" / "Cascavel/PR" → { cidade:'Cascavel', uf:'PR' }
function extraiCidadeUf(raw) {
  const s = String(raw ?? '').trim();
  const m = s.match(/^(.*?)[\\s\\-\\/]+([A-Za-z]{2})$/);
  if (m) return { cidade: m[1].trim(), uf: m[2].toUpperCase() };
  return { cidade: s, uf: '' };
}

// Dígitos verificadores — impede documento inválido de gravar no ERP
function dv(s, pesos) {
  const soma = pesos.reduce((acc, p, i) => acc + Number(s[i]) * p, 0);
  const r = soma % 11;
  return r < 2 ? 0 : 11 - r;
}
function cnpjValido(s) {
  if (s.length !== 14 || /^(\\d)\\1+$/.test(s)) return false;
  return dv(s, [5,4,3,2,9,8,7,6,5,4,3,2]) === Number(s[12])
      && dv(s, [6,5,4,3,2,9,8,7,6,5,4,3,2]) === Number(s[13]);
}
function cpfValido(s) {
  if (s.length !== 11 || /^(\\d)\\1+$/.test(s)) return false;
  return dv(s, [10,9,8,7,6,5,4,3,2]) === Number(s[9])
      && dv(s, [11,10,9,8,7,6,5,4,3,2]) === Number(s[10]);
}

const out = [];
for (const item of $input.all()) {
  const b = item.json?.body ?? item.json ?? {};

  // Só eventos de contato da empresa 1
  if (!['contact.created', 'contact.updated'].includes(b.event)) continue;
  if (Number(b.companyId) !== 1) continue;

  const c = b.contact ?? {};

  // Chaves de match no ERP — documento inválido não casa nem insere
  const cnpjInformado = esc(c.cpfCnpj).replace(/\\D/g, '');
  const cnpjOk = cnpjInformado.length === 14 ? cnpjValido(cnpjInformado)
              : cnpjInformado.length === 11 ? cpfValido(cnpjInformado) : false;
  const cnpj = cnpjOk ? cnpjInformado : '';
  const clientCode = esc(c.clientCode).replace(/\\D/g, '');

  // WhatsApp: ERP guarda formato local (sem DDI 55)
  let whatsapp = esc(c.number).replace(/\\D/g, '');
  if (whatsapp.startsWith('55') && whatsapp.length > 11) whatsapp = whatsapp.slice(2);

  const email = esc(c.email).toLowerCase();
  const contato = esc(c.contactName || c.name);
  const razao = esc(c.name);
  const fantasia = esc(c.fantasyName || c.name);
  // Rep: só dígitos, PRESERVANDO zeros à esquerda ('0001' continua '0001') —
  // remover padding gerava '1' e divergia do código gravado no ERP.
  // Tudo-zero ('0000') é tratado como vazio.
  const repDigits = esc(c.representativeCode).replace(/\\D/g, '');
  const rep = /^0+$/.test(repDigits) ? '' : repDigits;
  const segmentoCod = (esc(c.segment).match(/^\\d+/) || [''])[0];
  const empresa = esc(c.bzEmpresa).replace(/\\D/g, '') || '97';
  const { cidade, uf: ufCity } = extraiCidadeUf(c.city);
  const ddd = whatsapp.slice(0, 2);
  const uf = ufCity || UF_POR_DDD[ddd] || '';
  const endereco = esc(c.businessAddress);

  // Sem nenhuma chave nem dado útil → ignora
  if (!cnpj && !clientCode) continue;

  // INSERT exige cadastro completo: cnpj VÁLIDO + razão + representante + segmento + cidade + UF
  const cadastroCompleto =
    !!cnpjOk && !!razao && !!rep && !!segmentoCod && !!cidade && !!uf;

  out.push({
    json: {
      cnpj, cnpjInformado, clientCode, whatsapp, email, contato,
      razao, fantasia, rep, segmentoCod, empresa,
      cidade, uf, endereco, cadastroCompleto,
    },
  });
}
return out;`,
    };

    @node({
        id: 'e5f6a7b8-9999-4aaa-8111-223344556677',
        name: 'Verifica Cliente ERP',
        type: 'n8n-nodes-base.microsoftSql',
        version: 1,
        position: [-400, -3040],
        credentials: { microsoftSql: { id: '347YbKVdQ6hSkPU6', name: 'Microsoft SQL account' } },
    })
    VerificaClienteErp = {
        operation: 'executeQuery',
        query: `SELECT COUNT(*) AS existe
FROM nobregerencia.dbo.BusinessCadCliente
WHERE
  ('{{$json.cnpj}}' <> ''
    AND REPLACE(REPLACE(REPLACE(Cnpj_Cnpf, '.', ''), '-', ''), '/', '') = '{{$json.cnpj}}')
  OR
  ('{{$json.clientCode}}' <> ''
    AND CDCLIENTE = TRY_CAST('{{$json.clientCode}}' AS BIGINT))`,
    };

    @node({
        id: 'f6a7b8c9-0000-4bbb-9222-334455667788',
        name: 'Decide Acao',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [-160, -3040],
    })
    DecideAcao = {
        jsCode: `// Run Once for All Items — update | insert | pendente
const out = [];
for (const item of $input.all()) {
  const orig = $('Normaliza Contato').item.json;
  const existe = Number(item.json?.existe) > 0;
  const acao = existe ? 'update' : (orig.cadastroCompleto ? 'insert' : 'pendente');
  const motivo = existe || orig.cadastroCompleto ? ''
    : (orig.cnpjInformado && !orig.cnpj ? 'cnpj/cpf inválido (DV não confere)'
    : 'cadastro incompleto p/ ERP');
  out.push({ json: { ...orig, existe, acao, motivo } });
}
return out;`,
    };

    @node({
        id: '07b8c9d0-1111-4ccc-9333-445566778899',
        name: 'IF Update',
        type: 'n8n-nodes-base.if',
        version: 2.3,
        position: [80, -3040],
    })
    IfUpdate = {
        conditions: {
            options: {
                caseSensitive: true,
                typeValidation: 'strict',
                version: 2,
            },
            conditions: [
                {
                    id: 'cond-update',
                    leftValue: '={{ $json.acao }}',
                    rightValue: 'update',
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
        id: '18c9d0e1-2222-4ddd-8444-556677889900',
        name: 'IF Insert',
        type: 'n8n-nodes-base.if',
        version: 2.3,
        position: [80, -3280],
    })
    IfInsert = {
        conditions: {
            options: {
                caseSensitive: true,
                typeValidation: 'strict',
                version: 2,
            },
            conditions: [
                {
                    id: 'cond-insert',
                    leftValue: '={{ $json.acao }}',
                    rightValue: 'insert',
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
        id: 'c3d4e5f6-7777-4888-8999-001122334455',
        name: 'Atualiza Cliente ERP',
        type: 'n8n-nodes-base.microsoftSql',
        version: 1,
        position: [320, -3040],
        credentials: { microsoftSql: { id: '347YbKVdQ6hSkPU6', name: 'Microsoft SQL account' } },
    })
    AtualizaClienteErp = {
        operation: 'executeQuery',
        query: `UPDATE nobregerencia.dbo.BusinessCadCliente
SET
  F_WhatsApp1 = CASE WHEN '{{$json.whatsapp}}' <> '' THEN '{{$json.whatsapp}}' ELSE F_WhatsApp1 END,
  Email1      = CASE WHEN '{{$json.email}}'    <> '' THEN '{{$json.email}}'    ELSE Email1      END,
  Contato1    = CASE WHEN '{{$json.contato}}'  <> '' THEN '{{$json.contato}}'  ELSE Contato1    END,
  -- Representante/Segmento também voltam ao ERP quando alterados no Whaticket.
  -- O código é gravado como dígito puro ('1016'); a descrição vem das tabelas
  -- de domínio (BusinessCadRepresentante/SegMercado) no sync reverso.
  CdRepresentante = CASE WHEN '{{$json.rep}}'         <> '' THEN '{{$json.rep}}'         ELSE CdRepresentante END,
  CdSegmento      = CASE WHEN '{{$json.segmentoCod}}' <> '' THEN '{{$json.segmentoCod}}' ELSE CdSegmento      END,
  DtAlteracao = GETDATE(),
  -- Flags de sincronismo: sem elas o sistema local nunca puxa a alteração
  -- (o INSERT já grava ambas como 'S' — o UPDATE deve fazer o mesmo)
  FlEnvRecEmpresa = 'S',
  FlEnvRecRepre   = 'S'
WHERE
  (
    ('{{$json.cnpj}}' <> ''
      AND REPLACE(REPLACE(REPLACE(Cnpj_Cnpf, '.', ''), '-', ''), '/', '') = '{{$json.cnpj}}')
    OR
    ('{{$json.clientCode}}' <> ''
      AND CDCLIENTE = TRY_CAST('{{$json.clientCode}}' AS BIGINT))
  )
  AND
  (
    ('{{$json.whatsapp}}' <> '' AND ISNULL(REPLACE(REPLACE(REPLACE(REPLACE(F_WhatsApp1, '(', ''), ')', ''), '-', ''), ' ', ''), '') <> '{{$json.whatsapp}}')
    OR ('{{$json.email}}'    <> '' AND ISNULL(LOWER(LTRIM(RTRIM(Email1))), '')    <> '{{$json.email}}')
    OR ('{{$json.contato}}'  <> '' AND ISNULL(LTRIM(RTRIM(Contato1)), '')         <> '{{$json.contato}}')
    -- Comparação por TRY_CAST cobre coluna char ('0001') e int (1) sem falso positivo
    OR ('{{$json.rep}}' <> ''
        AND COALESCE(TRY_CAST(REPLACE(LTRIM(RTRIM(CAST(CdRepresentante AS VARCHAR(20)))), ' ', '') AS BIGINT), -1)
            <> COALESCE(TRY_CAST('{{$json.rep}}' AS BIGINT), -2))
    OR ('{{$json.segmentoCod}}' <> ''
        AND COALESCE(TRY_CAST(REPLACE(LTRIM(RTRIM(CAST(CdSegmento AS VARCHAR(20)))), ' ', '') AS BIGINT), -1)
            <> COALESCE(TRY_CAST('{{$json.segmentoCod}}' AS BIGINT), -2))
  )`,
    };

    @node({
        id: '29d0e1f2-3333-4eee-8555-667788990011',
        name: 'Busca Cod Municipio',
        type: 'n8n-nodes-base.microsoftSql',
        version: 1,
        position: [320, -3280],
        credentials: { microsoftSql: { id: '347YbKVdQ6hSkPU6', name: 'Microsoft SQL account' } },
    })
    BuscaCodMunicipio = {
        operation: 'executeQuery',
        query: `SELECT (
  SELECT TOP 1 CdMunicipio
  FROM nobregerencia.dbo.BusinessCadMunicipio
  WHERE LOWER(LTRIM(RTRIM(DsMunicipio))) = LOWER(LTRIM(RTRIM('{{$('Decide Acao').item.json.cidade}}')))
    AND LOWER(LTRIM(RTRIM(Estado))) = LOWER(LTRIM(RTRIM('{{$('Decide Acao').item.json.uf}}')))
) AS CdMunicipio;`,
    };

    @node({
        id: '30e1f2a3-4444-4fff-8666-778899001122',
        name: 'Municipio Encontrado',
        type: 'n8n-nodes-base.if',
        version: 2.3,
        position: [560, -3280],
    })
    MunicipioEncontrado = {
        conditions: {
            options: {
                caseSensitive: true,
                typeValidation: 'strict',
                version: 2,
            },
            conditions: [
                {
                    id: 'cond-mun',
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
        id: '41f2a3b4-5555-4aaa-8777-889900112233',
        name: 'Monta Cliente Insert',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [800, -3280],
    })
    MontaClienteInsert = {
        jsCode: `// Run Once for All Items
const t = (str, len) => String(str ?? '').trim().substring(0, len);
const c = $('Decide Acao').item.json;
const d = new Date();
const pad = n => String(n).padStart(2, '0');
const hoje = \`\${d.getFullYear()}-\${pad(d.getMonth() + 1)}-\${pad(d.getDate())} 00:00:00.000\`;
const municipio = t($json.CdMunicipio, 6);
const cid = t(c.cidade, 30).toUpperCase();
const uf = t(c.uf, 2).toUpperCase();
const end = t(c.endereco, 50).toUpperCase();

return [{
  json: {
    C_Cep: '', E_Cep: '', F_Cep: '',
    E_Cnpj: t(c.cnpj, 18),
    FlTipo: c.cnpj.length === 11 ? 'F' : 'J',
    CdGrupo: '001', DiaPgto: 'Indefinido',
    C_Bairro: '', E_Bairro: '', F_Bairro: '',
    C_Cidade: cid, E_Cidade: cid, F_Cidade: cid,
    C_Estado: uf, E_Estado: uf, F_Estado: uf,
    C_Numero: '', E_Numero: '', F_Numero: '',
    CdRegiao: '',
    Cnpj_Cnpf: t(c.cnpj, 18),
    FsCliente: t(c.fantasia || String(c.razao).split(/\\s+/)[0], 15).toUpperCase(),
    RzCliente: t(c.razao, 40).toUpperCase(),
    C_Endereco: end, E_Endereco: end, F_Endereco: end,
    CdSegmento: t(c.segmentoCod, 4),
    DtAtivacao: hoje, DtAlteracao: hoje, DtUltCompra: '',
    PeDesconto: '0', RestricaoSN: 'N', CapitalSocial: '0',
    C_CdMunicipio: municipio, E_CdMunicipio: municipio, F_CdMunicipio: municipio,
    C_Complemento: '', E_Complemento: '', F_Complemento: '',
    FlEnvRecRepre: 'S', FlEnvRecEmpresa: 'S', DescontaSuframa: 'N',
    CdRepresentante: t(c.rep, 6),
    Ativo_Inativo_ExCliente: 'Futuro',
    F_WhatsApp1: t(c.whatsapp, 20),
    Email1: t(c.email, 60),
    Contato1: t(c.contato, 50),
    empresaLc: t(c.empresa, 3),
  },
}];`,
    };

    @node({
        id: '52a3b4c5-6666-4bbb-8888-990011223344',
        name: 'SQL Insere Cliente',
        type: 'n8n-nodes-base.microsoftSql',
        version: 1.1,
        position: [1040, -3280],
        credentials: { microsoftSql: { id: '347YbKVdQ6hSkPU6', name: 'Microsoft SQL account' } },
        alwaysOutputData: true,
        continueOnFail: true,
    })
    SqlInsereCliente = {
        table: 'BusinessCadCliente',
        columns:
            'C_Cep,E_Cep,F_Cep,E_Cnpj,FlTipo,CdGrupo,DiaPgto,C_Bairro,C_Cidade,C_Estado,C_Numero,CdRegiao,E_Bairro,E_Cidade,E_Estado,E_Numero,F_Bairro,F_Cidade,F_Estado,F_Numero,Cnpj_Cnpf,FsCliente,RzCliente,C_Endereco,CdSegmento,DtAtivacao,E_Endereco,F_Endereco,PeDesconto,RestricaoSN,C_CdMunicipio,C_Complemento,CapitalSocial,E_CdMunicipio,E_Complemento,F_CdMunicipio,F_Complemento,FlEnvRecRepre,CdRepresentante,DescontaSuframa,FlEnvRecEmpresa,DtAlteracao,DtUltCompra,Ativo_Inativo_ExCliente,F_WhatsApp1,Email1,Contato1',
    };

    @node({
        id: '63b4c5d6-7777-4ccc-8999-001122334455',
        name: 'SQL Insere LC',
        type: 'n8n-nodes-base.microsoftSql',
        version: 1,
        position: [1280, -3280],
        credentials: { microsoftSql: { id: '347YbKVdQ6hSkPU6', name: 'Microsoft SQL account' } },
        alwaysOutputData: true,
        continueOnFail: true,
    })
    SqlInsereLc = {
        operation: 'executeQuery',
        query: `IF NOT EXISTS (
  SELECT 1 FROM nobregerencia.dbo.BusinessCadClienteLC
  WHERE Cnpj_Cnpf = '{{$('Decide Acao').item.json.cnpj}}'
    AND CdEmpresa = '{{$('Decide Acao').item.json.empresa}}'
)
INSERT INTO nobregerencia.dbo.BusinessCadClienteLC (Cnpj_Cnpf, CdEmpresa, LimiteCredito)
VALUES ('{{$('Decide Acao').item.json.cnpj}}', '{{$('Decide Acao').item.json.empresa}}', 0);`,
    };

    @node({
        id: 'd4e5f6a7-8888-4999-8000-112233445566',
        name: 'Log Reverso',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [560, -3040],
    })
    LogReverso = {
        jsCode: `// Run Once for All Items — loga resultado do UPDATE/INSERT
const itens = $input.all();
console.log(JSON.stringify({
  dataExecucao: new Date().toISOString(),
  processados: itens.length,
}, null, 2));
return itens;`,
    };

    @node({
        id: '74c5d6e7-8888-4ddd-8000-223344556677',
        name: 'Log Pendente',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [560, -3520],
    })
    LogPendente = {
        jsCode: `// Run Once for All Items — registra por que o contato não foi pro ERP
const itens = $input.all();
for (const i of itens) {
  console.log('Pendente:', JSON.stringify({
    cnpj: i.json.cnpj, clientCode: i.json.clientCode,
    acao: i.json.acao, motivo: i.json.motivo || 'CdMunicipio não encontrado',
    cidade: i.json.cidade, uf: i.json.uf,
  }));
}
return itens;`,
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.WebhookEntrada.out(0).to(this.NormalizaContato.in(0));
        this.NormalizaContato.out(0).to(this.VerificaClienteErp.in(0));
        this.VerificaClienteErp.out(0).to(this.DecideAcao.in(0));
        this.DecideAcao.out(0).to(this.IfUpdate.in(0));
        this.IfUpdate.out(0).to(this.AtualizaClienteErp.in(0));
        this.IfUpdate.out(1).to(this.IfInsert.in(0));
        this.IfInsert.out(0).to(this.BuscaCodMunicipio.in(0));
        this.IfInsert.out(1).to(this.LogPendente.in(0));
        this.BuscaCodMunicipio.out(0).to(this.MunicipioEncontrado.in(0));
        this.MunicipioEncontrado.out(0).to(this.MontaClienteInsert.in(0));
        this.MunicipioEncontrado.out(1).to(this.LogPendente.in(0));
        this.MontaClienteInsert.out(0).to(this.SqlInsereCliente.in(0));
        this.SqlInsereCliente.out(0).to(this.SqlInsereLc.in(0));
        this.AtualizaClienteErp.out(0).to(this.LogReverso.in(0));
        this.SqlInsereLc.out(0).to(this.LogReverso.in(0));
    }
}
