import cron from 'node-cron';
import { Op } from 'sequelize';
import Contact from '../models/Contact';
import Company from '../models/Company';
import ApplyTagRulesService from '../services/TagServices/ApplyTagRulesService';

// Executa a cada 5 minutos para processar contatos criados/atualizados recentemente
const tagRulesRecentContactsCron = () => {
  cron.schedule('*/5 * * * *', async () => {
    console.log('[TagRules Recent] Verificando contatos recentes...');
    
    try {
      // Busca todas as companies ativas
      const companies = await Company.findAll({
        where: { status: true },
        attributes: ['id', 'name']
      });

      // Define janela de tempo: últimos 10 minutos
      const timeWindow = new Date(Date.now() - 10 * 60 * 1000);

      for (const company of companies) {
        try {
          // Busca contatos criados ou atualizados nos últimos 10 minutos
          const recentContacts = await Contact.findAll({
            where: {
              companyId: company.id,
              [Op.or]: [
                { createdAt: { [Op.gte]: timeWindow } },
                { updatedAt: { [Op.gte]: timeWindow } }
              ]
            },
            attributes: ['id', 'name', 'createdAt', 'updatedAt']
          });

          if (recentContacts.length === 0) {
            continue;
          }

          console.log(`[TagRules Recent] Company ${company.id}: ${recentContacts.length} contatos recentes encontrados`);

          // Aplica regras para cada contato recente
          let totalProcessed = 0;
          for (const contact of recentContacts) {
            try {
              await ApplyTagRulesService({
                companyId: company.id,
                contactId: contact.id
              });
              totalProcessed++;
            } catch (err) {
              console.error(`[TagRules Recent] Erro ao processar contato ${contact.id}:`, err);
            }
          }

          console.log(`[TagRules Recent] Company ${company.id}: ${totalProcessed} contatos processados`);
        } catch (err) {
          console.error(`[TagRules Recent] Erro ao processar company ${company.id}:`, err);
        }
      }

      console.log('[TagRules Recent] Verificação concluída!');
    } catch (err) {
      console.error('[TagRules Recent] Erro geral:', err);
    }
  });

  console.log('[TagRules Recent] Agendamento configurado: a cada 5 minutos para contatos recentes');
};

export default tagRulesRecentContactsCron;
