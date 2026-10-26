import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : NOBRE Troca Code OAuth Olist
// Nodes   : 4  |  Connections: 3
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// ManualTrigger                      manualTrigger
// ColeOCode                          code
// TrocaCodePorToken                  httpRequest
// SalvaTokenPlanilha                 googleSheets               [creds]
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// ManualTrigger
//    → ColeOCode
//      → TrocaCodePorToken
//        → SalvaTokenPlanilha
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: 'jOQQZ2yP59vMyRJO',
    name: 'NOBRE Troca Code OAuth Olist',
    active: false,
    isArchived: false,
    tags: ['NOBRE'],
    settings: { executionOrder: 'v1', callerPolicy: 'workflowsFromSameOwner', availableInMCP: false },
})
export class NobreTrocaCodeOauthOlistWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: '6fb8da0b-ce27-4f1b-92f8-d1f4f236d1e8',
        name: 'Manual Trigger',
        type: 'n8n-nodes-base.manualTrigger',
        version: 1,
        position: [0, 0],
    })
    ManualTrigger = {};

    @node({
        id: '9d841435-4514-4ead-ae79-c195221547f6',
        name: 'Cole o Code',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [224, 0],
    })
    ColeOCode = {
        jsCode: `// Colar o CODE da URL de callback aqui apos autorizar no navegador
// Exemplo: se a URL for https://n8n.nobreluminarias.com.br/webhook-test/...?code=ABC123
// cole apenas ABC123 no campo abaixo

const CODE = ''; // <-- COLE O CODE AQUI

if (!CODE || CODE === '') {
  throw new Error('CODE nao informado. Acesse a URL de autorizacao no navegador, copie o CODE da URL de retorno e cole neste workflow.');
}

return [{ json: { code: CODE } }];`,
    };

    @node({
        id: '4687e51b-b96b-4cb2-bccc-cb802aa2571e',
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
                    value: "=Basic {{ Buffer.from('tiny-api-53196f10aa5e61e1d3577618ea2b8ac4f24136a8-1748913407:8gIOJs3fxNEeUfr0dUYt3esj9DJnUB4J').toString('base64') }}",
                },
                {
                    name: 'Content-Type',
                    value: 'application/x-www-form-urlencoded',
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
        id: 'dc880ff6-b07a-4e99-84b4-04e7957db6c9',
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
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'access_token',
                    displayName: 'access_token',
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'expires_in',
                    displayName: 'expires_in',
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'refresh_expires_in',
                    displayName: 'refresh_expires_in',
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'refresh_token',
                    displayName: 'refresh_token',
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'token_type',
                    displayName: 'token_type',
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'scope',
                    displayName: 'scope',
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'session_state',
                    displayName: 'session_state',
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'not-before-policy',
                    displayName: 'not-before-policy',
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'id_token',
                    displayName: 'id_token',
                    type: 'string',
                    canBeUsedToMatch: true,
                },
            ],
            attemptToConvertTypes: false,
            convertFieldsToString: false,
        },
        options: {},
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.ManualTrigger.out(0).to(this.ColeOCode.in(0));
        this.ColeOCode.out(0).to(this.TrocaCodePorToken.in(0));
        this.TrocaCodePorToken.out(0).to(this.SalvaTokenPlanilha.in(0));
    }
}
