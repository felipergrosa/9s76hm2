import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : ZEUS Callback OAuth Olist
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
    id: 'byDcggI5k5ZMLjWe',
    name: 'ZEUS Callback OAuth Olist',
    active: true,
    isArchived: false,
    projectId: 'wFXnwjlGyuHoHb3z',
    tags: ['ZEUS'],
    settings: { executionOrder: 'v1', callerPolicy: 'workflowsFromSameOwner', availableInMCP: false },
})
export class ZeusCallbackOauthOlistWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: 'cb-0001',
        webhookId: '5e70f39c-fccc-497d-8c15-040c4a3eadca',
        name: 'Webhook Olist Callback',
        type: 'n8n-nodes-base.webhook',
        version: 2,
        position: [0, 0],
    })
    WebhookOlistCallback = {
        path: 'olist-auth',
        responseMode: 'lastNode',
        options: {},
    };

    @node({
        id: 'cb-0002',
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
const CLIENT_ID = 'tiny-api-7eda645c346d1ef5060712274b7acc144ed6dc04-1748567574';
const CLIENT_SECRET = 'F71LGy2h9MXtwG6tj3fGVIH8P0L3R0BC';
const basicAuth = Buffer.from(\`\${CLIENT_ID}:\${CLIENT_SECRET}\`).toString('base64');
return [{ json: { code, basicAuth } }];`,
    };

    @node({
        id: 'cb-0003',
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
                    value: 'https://n8n.nobreluminarias.com.br/webhook/olist-auth',
                },
            ],
        },
        options: {},
    };

    @node({
        id: 'cb-0004',
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
                linha: '1',
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
        id: 'cb-0005',
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
