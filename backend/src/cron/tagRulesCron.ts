import cron from 'node-cron';
import Company from '../models/Company';
import ApplyTagRulesService from '../services/TagServices/ApplyTagRulesService';

// Executa todos os dias às 2h da manhã
const tagRulesCron = () => {
  cron.schedule('0 2 * * *', async () => {
    console.log('[TagRules Cron] Iniciando aplicação automática de regras de tags...');
    
    try {
      // Busca todas as companies ativas
      const companies = await Company.findAll({
        where: { status: true },
        attributes: ['id', 'name']
      });

      for (const company of companies) {
        try {
          console.log(`[TagRules Cron] Processando company ${company.id} - ${company.name}`);
          
          const results = await ApplyTagRulesService({
            companyId: company.id
          });

          const totalAffected = results.reduce((sum, r) => sum + r.contactsAffected, 0);
          console.log(`[TagRules Cron] Company ${company.id}: ${totalAffected} contatos afetados`);
          
          results.forEach(r => {
            if (r.contactsAffected > 0) {
              console.log(`  - Tag "${r.tagName}": ${r.contactsAffected} contatos`);
            }
          });
        } catch (err) {
          console.error(`[TagRules Cron] Erro ao processar company ${company.id}:`, err);
        }
      }

      console.log('[TagRules Cron] Aplicação automática concluída!');
    } catch (err) {
      console.error('[TagRules Cron] Erro geral:', err);
    }
  });

  console.log('[TagRules Cron] Agendamento configurado: todos os dias às 2h da manhã');
};

export default tagRulesCron;
