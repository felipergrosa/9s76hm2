import { WebhookModel } from "../../models/Webhook";
import User from "../../models/User";
import { FlowBuilderModel } from "../../models/FlowBuilder";
import { sanitizeFlowSecrets } from "./flowSecrets";

interface Request {
  companyId: number;
}

interface Response {
  flows: FlowBuilderModel[];
}

const ListFlowBuilderService = async ({
  companyId,
}: Request): Promise<Response> => {
  
    try {
    
        // Realiza a consulta com paginação usando findAndCountAll
        const { count, rows } = await FlowBuilderModel.findAndCountAll({
          where: {
            company_id: companyId
          }
        });
    
        const flowResult = []
        rows.forEach((flow) => {
          const json: any = flow.toJSON();
          // Não expõe credenciais de nós "openai" ao frontend
          json.flow = sanitizeFlowSecrets(json.flow);
          flowResult.push(json);
        });

        return {
            flows: flowResult,
        }
      } catch (error) {
        console.error('Erro ao consultar usuários:', error);
      }
};

export default ListFlowBuilderService;
