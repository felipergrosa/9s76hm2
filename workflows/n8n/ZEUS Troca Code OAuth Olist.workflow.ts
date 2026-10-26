import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : ZEUS Troca Code OAuth Olist
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
    id: 'XMCJwxGPrwp1V3Ah',
    name: 'ZEUS Troca Code OAuth Olist',
    active: false,
    isArchived: false,
    tags: ['ZEUS'],
    settings: { executionOrder: 'v1', callerPolicy: 'workflowsFromSameOwner', availableInMCP: false },
})
export class ZeusTrocaCodeOauthOlistWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: 'tc-0001',
        name: 'Manual Trigger',
        type: 'n8n-nodes-base.manualTrigger',
        version: 1,
        position: [0, 0],
    })
    ManualTrigger = {};

    @node({
        id: 'tc-0002',
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
        id: 'tc-0003',
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
                    value: "=Basic {{ Buffer.from('tiny-api-7eda645c546d1ef5060712274b7acc144eddcd04-1748567574:F7ILGy2h9MXtwG4tj3fGVlHB8POL3R0BC').toString('base64') }}",
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
                    value: 'https://n8n.nobreluminarias.com.br/webhook/olist-auth',
                },
            ],
        },
        options: {},
    };

    @node({
        id: 'tc-0004',
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
