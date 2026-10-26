import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : ZEUS Autorizacao Inicial Olist
// Nodes   : 2  |  Connections: 1
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// ManualTrigger                      manualTrigger
// GeraUrlAuth                        code
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// ManualTrigger
//    → GeraUrlAuth
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: '61dhnnoMhpXHkFrw',
    name: 'ZEUS Autorizacao Inicial Olist',
    active: false,
    isArchived: false,
    projectId: 'wFXnwjlGyuHoHb3z',
    tags: ['ZEUS'],
    settings: { executionOrder: 'v1', callerPolicy: 'workflowsFromSameOwner', availableInMCP: false },
})
export class ZeusAutorizacaoInicialOlistWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: 'auth-0001',
        name: 'Manual Trigger',
        type: 'n8n-nodes-base.manualTrigger',
        version: 1,
        position: [0, 0],
    })
    ManualTrigger = {};

    @node({
        id: 'auth-0002',
        name: 'Gera URL Auth',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [224, 0],
    })
    GeraUrlAuth = {
        jsCode: `const clientId = 'tiny-api-7eda645c546d1ef5060712274b7acc144eddcd04-1748567574';
const redirectUri = 'https://n8n.nobreluminarias.com.br/webhook-test/a267c1e6-bf23-4fac-8e6e-69e00a3aft';

const authUrl = \`https://accounts.tiny.com.br/realms/tiny/protocol/openid-connect/auth?response_type=code&client_id=\${clientId}&redirect_uri=\${encodeURIComponent(redirectUri)}\`;

return [{
  json: {
    mensagem: 'Acesse esta URL no navegador e autorize o aplicativo:',
    authUrl,
    proximoPasso: 'Depois de autorizar, copie o CODE da URL de retorno e cole no workflow de Troca Code por Token'
  }
}];`,
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.ManualTrigger.out(0).to(this.GeraUrlAuth.in(0));
    }
}
