import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : NOBRE Refres token Olist
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
    id: 'lSFGOBbYks0grgf3',
    name: 'NOBRE Refres token Olist',
    active: false,
    isArchived: false,
    projectId: 'wFXnwjlGyuHoHb3z',
    tags: ['NOBRE'],
    settings: { executionOrder: 'v1', availableInMCP: false },
})
export class NobreRefresTokenOlistWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: '650b69c3-1a72-4aef-bdf7-23f44117f9c4',
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
        id: '54dc4b15-27e8-401b-b14b-a0077cb4e823',
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
                    lookupValue: '2',
                },
            ],
        },
        options: {},
    };

    @node({
        id: '093925d7-2449-4e60-8228-1b7c86736b2b',
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
        id: 'd2cbc5f5-bf30-4ede-86f0-17dc4a898619',
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
