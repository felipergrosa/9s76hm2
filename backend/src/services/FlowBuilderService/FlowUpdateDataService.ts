import { FlowBuilderModel } from "../../models/FlowBuilder";
import { WebhookModel } from "../../models/Webhook";
import { randomString } from "../../utils/randomCode";

interface node {
    id: string,
    position: { x: number, y: number },
    data: { 
        label: string
        sec?: number
        title?: string
        text?: string
    },
    type: string,
    style: { backgroundColor: string, color: string }
}

interface body {
    nodes : node
    idFlow: number
    connections: any
    status?: "draft" | "published" // item 9 do plano: versionamento opcional
}


interface Request {
  companyId: number;
  bodyData: body;
}

const FlowUpdateDataService = async ({
  companyId,
  bodyData
}: Request): Promise<String> => {
  try {

    const updatePayload: any = {
        flow: {
            nodes: bodyData.nodes,
            connections: bodyData.connections
        }
    };

    // Botão "Salvar" original não envia status — comportamento 1:1 preservado.
    // "Salvar como rascunho"/"Publicar" (novos, opcionais) enviam status explícito.
    if (bodyData.status === "draft" || bodyData.status === "published") {
        updatePayload.status = bodyData.status;

        if (bodyData.status === "published") {
            const current = await FlowBuilderModel.findOne({
                where: { id: bodyData.idFlow, company_id: companyId }
            });
            updatePayload.version = (current?.version || 1) + 1;
        }
    }

    const flow = await FlowBuilderModel.update(updatePayload, {
      where: {id: bodyData.idFlow, company_id: companyId}
    });

    return 'ok';
  } catch (error) {
    console.error("Erro ao inserir o usuário:", error);

    return error
  }
};

export default FlowUpdateDataService;
