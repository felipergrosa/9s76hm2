import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : ZEUS Refres token Olist
// Nodes   : 4  |  Connections: 3
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// HttpRequest                        httpRequest
// GoogleSheets                       googleSheets               [creds]
// GoogleSheets1                      googleSheets               [creds]
// ScheduleTrigger                    scheduleTrigger
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// ScheduleTrigger
//    → GoogleSheets
//      → HttpRequest
//        → GoogleSheets1
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: '08AWZvRk00CVXlSY',
    name: 'ZEUS Refres token Olist',
    active: true,
    isArchived: false,
    tags: ['ZEUS'],
    settings: { executionOrder: 'v1' },
})
export class ZeusRefresTokenOlistWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: '6d663fe2-4697-42bd-a991-cba91e77ed3a',
        name: 'HTTP Request',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [384, -16],
    })
    HttpRequest = {
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
        id: '990a582f-bafe-4f36-b0d3-d073c8893cc4',
        name: 'Google Sheets',
        type: 'n8n-nodes-base.googleSheets',
        version: 4.6,
        position: [160, -16],
        credentials: { googleSheetsOAuth2Api: { id: 'TiPhH1FEnU2CjOmH', name: 'V2 n8n' } },
    })
    GoogleSheets = {
        documentId: {
            __rl: true,
            value: '1zNT5vaP3_fkq9nlJ7SfYXISicejLCllB44mTf4y8h0M',
            mode: 'list',
            cachedResultName: 'n8n tiny key | auto-refresh ',
            cachedResultUrl:
                'https://docs.google.com/spreadsheets/d/1zNT5vaP3_fkq9nlJ7SfYXISicejLCllB44mTf4y8h0M/edit?usp=drivesdk',
        },
        sheetName: {
            __rl: true,
            value: 'gid=0',
            mode: 'list',
            cachedResultName: 'Página1',
            cachedResultUrl:
                'https://docs.google.com/spreadsheets/d/1zNT5vaP3_fkq9nlJ7SfYXISicejLCllB44mTf4y8h0M/edit#gid=0',
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
        id: '859c5f02-0820-4b31-8941-87b8b8aef120',
        name: 'Google Sheets1',
        type: 'n8n-nodes-base.googleSheets',
        version: 4.6,
        position: [608, -16],
        credentials: { googleSheetsOAuth2Api: { id: 'TiPhH1FEnU2CjOmH', name: 'V2 n8n' } },
    })
    GoogleSheets1 = {
        operation: 'appendOrUpdate',
        documentId: {
            __rl: true,
            value: '1zNT5vaP3_fkq9nlJ7SfYXISicejLCllB44mTf4y8h0M',
            mode: 'list',
            cachedResultName: 'n8n tiny key | auto-refresh ',
            cachedResultUrl:
                'https://docs.google.com/spreadsheets/d/1zNT5vaP3_fkq9nlJ7SfYXISicejLCllB44mTf4y8h0M/edit?usp=drivesdk',
        },
        sheetName: {
            __rl: true,
            value: 'gid=0',
            mode: 'list',
            cachedResultName: 'Página1',
            cachedResultUrl:
                'https://docs.google.com/spreadsheets/d/1zNT5vaP3_fkq9nlJ7SfYXISicejLCllB44mTf4y8h0M/edit#gid=0',
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
                    removed: false,
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
        id: '58b9ca02-5e6d-4be4-80bf-291d574977e3',
        name: 'Schedule Trigger',
        type: 'n8n-nodes-base.scheduleTrigger',
        version: 1.2,
        position: [-48, -16],
    })
    ScheduleTrigger = {
        rule: {
            interval: [
                {
                    field: 'hours',
                    hoursInterval: 3,
                    triggerAtMinute: 30,
                },
            ],
        },
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.HttpRequest.out(0).to(this.GoogleSheets1.in(0));
        this.GoogleSheets.out(0).to(this.HttpRequest.in(0));
        this.ScheduleTrigger.out(0).to(this.GoogleSheets.in(0));
    }
}
