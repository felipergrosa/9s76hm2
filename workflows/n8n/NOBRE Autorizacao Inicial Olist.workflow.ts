import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : NOBRE Autorizacao Inicial Olist
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
    id: 'xtMnYiGoT961uTxP',
    name: 'NOBRE Autorizacao Inicial Olist',
    active: false,
    isArchived: false,
    projectId: 'wFXnwjlGyuHoHb3z',
    tags: ['NOBRE'],
    settings: { executionOrder: 'v1', callerPolicy: 'workflowsFromSameOwner', availableInMCP: false },
})
export class NobreAutorizacaoInicialOlistWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: '9688dc94-43a5-4e79-8a69-e7c50b17a19c',
        name: 'Manual Trigger',
        type: 'n8n-nodes-base.manualTrigger',
        version: 1,
        position: [0, 0],
    })
    ManualTrigger = {};

    @node({
        id: 'e940ba57-2187-4e85-b78a-63602e7737f2',
        name: 'Gera URL Auth',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [224, 0],
    })
    GeraUrlAuth = {
        jsCode: `const clientId = 'tiny-api-53196f10aa5e61e1d3577618ea2b8ac4f24136a8-1748913407';
const redirectUri = 'https://n8n.nobreluminarias.com.br/webhook/olist-nobre-auth';

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
