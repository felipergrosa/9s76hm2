import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : NOBRE Callback OAuth Olist
// Nodes   : 5  |  Connections: 4
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// WebhookOlistCallback               webhook
// ExtraiCode                         code
// TrocaCodePorToken                  httpRequest
// SalvaTokenPlanilha                 googleSheets               [creds]
// RespostaOk                         set
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// WebhookOlistCallback
//    → ExtraiCode
//      → TrocaCodePorToken
//        → SalvaTokenPlanilha
//          → RespostaOk
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: 'iLJgNhPn0oVcJdiq',
    name: 'NOBRE Callback OAuth Olist',
    active: true,
    isArchived: false,
    projectId: 'wFXnwjlGyuHoHb3z',
    tags: ['NOBRE'],
    settings: { executionOrder: 'v1', callerPolicy: 'workflowsFromSameOwner', availableInMCP: false },
})
export class NobreCallbackOauthOlistWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: 'f15c5529-4918-45dc-91dd-73bdad2fe3a0',
        webhookId: '4cafe9b7-2422-4dad-b909-79101ccdbfae',
        name: 'Webhook Olist Callback',
        type: 'n8n-nodes-base.webhook',
        version: 2,
        position: [0, 0],
    })
    WebhookOlistCallback = {
        path: 'olist-nobre-auth',
        responseMode: 'lastNode',
        options: {},
    };

    @node({
        id: '12d842ad-927c-49ec-a7eb-51230c0e7172',
        name: 'Extrai Code',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [224, 0],
    })
    ExtraiCode = {
        jsCode: `const code = $json.query?.code;
if (!code) {
  throw new Error('Code nao recebido. Verifique se a URL de autorizacao foi acessada corretamente.');
}
const CLIENT_ID = 'tiny-api-53196f10aa5e61e1d3577618ea2b8ac4f24136a8-1748913407';
const CLIENT_SECRET = '8gIOJs3fxNEeUfr0dUYt3esj9DJnUB4J';
const basicAuth = Buffer.from(\`\${CLIENT_ID}:\${CLIENT_SECRET}\`).toString('base64');
return [{ json: { code, basicAuth } }];`,
    };

    @node({
        id: 'e51314e0-b742-491b-9fb0-71fd4712ee40',
        name: 'Troca Code por Token',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [448, 0],
    })
    TrocaCodePorToken = {
        method: 'POST',
        url: 'https://accounts.tiny.com.br/realms/tiny/protocol/openid-connect/token',
        sendHeaders: true,
        headerParameters: {
            parameters: [
                {
                    name: 'Authorization',
                    value: '=Basic {{ $json.basicAuth }}',
                },
            ],
        },
        sendBody: true,
        contentType: 'form-urlencoded',
        bodyParameters: {
            parameters: [
                {
                    name: 'grant_type',
                    value: 'authorization_code',
                },
                {
                    name: 'code',
                    value: '={{ $json.code }}',
                },
                {
                    name: 'redirect_uri',
                    value: 'https://n8n.nobreluminarias.com.br/webhook/olist-nobre-auth',
                },
            ],
        },
        options: {},
    };

    @node({
        id: '2ad98139-f687-4397-84a4-d6b277e341f0',
        name: 'Salva Token Planilha',
        type: 'n8n-nodes-base.googleSheets',
        version: 4.6,
        position: [672, 0],
        credentials: { googleSheetsOAuth2Api: { id: 'TiPhH1FEnU2CjOmH', name: 'V2 n8n' } },
    })
    SalvaTokenPlanilha = {
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
                expires_in: '={{ $json.expires_in }}',
                refresh_expires_in: '={{ $json.refresh_expires_in }}',
                refresh_token: '={{ $json.refresh_token }}',
                token_type: '={{ $json.token_type }}',
                scope: '={{ $json.scope }}',
                session_state: '={{ $json.session_state }}',
                'not-before-policy': "={{ $json['not-before-policy'] }}",
                id_token: '={{ $json.id_token }}',
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
                },
                {
                    id: 'refresh_expires_in',
                    displayName: 'refresh_expires_in',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
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
                },
                {
                    id: 'id_token',
                    displayName: 'id_token',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'not-before-policy',
                    displayName: 'not-before-policy',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'session_state',
                    displayName: 'session_state',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'scope',
                    displayName: 'scope',
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
        id: '073abc0e-5466-4935-a98b-ce4c8d778924',
        name: 'Resposta OK',
        type: 'n8n-nodes-base.set',
        version: 3.3,
        position: [880, 0],
    })
    RespostaOk = {
        assignments: {
            assignments: [
                {
                    id: 'resp-001',
                    name: 'mensagem',
                    value: 'Autorizacao concluida! Token salvo na planilha. O workflow de busca de pedidos agora vai funcionar.',
                    type: 'string',
                },
            ],
        },
        options: {},
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.WebhookOlistCallback.out(0).to(this.ExtraiCode.in(0));
        this.ExtraiCode.out(0).to(this.TrocaCodePorToken.in(0));
        this.TrocaCodePorToken.out(0).to(this.SalvaTokenPlanilha.in(0));
        this.SalvaTokenPlanilha.out(0).to(this.RespostaOk.in(0));
    }
}
