import { QueryInterface } from "sequelize";
import { Op } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    return queryInterface.sequelize.transaction(async (t) => {
      // Verificar se os planos já existem
      const existingPlans = await queryInterface.sequelize.query(
        `SELECT name FROM "Plans" WHERE name IN ('Starter', 'Professional', 'Enterprise')`,
        { transaction: t }
      );

      const existingNames = (existingPlans[0] as any[]).map((plan: any) => plan.name);

      const plans = [
        {
          name: "Starter",
          users: 3,
          connections: 1,
          queues: 3,
          amount: "149.00",
          recurrence: "MENSAL",
          trial: true,
          trialDays: 14,
          useWhatsapp: true,
          useFacebook: false,
          useInstagram: false,
          useCampaigns: false,
          useKanban: false,
          useOpenAi: false,
          useSchedules: true,
          useInternalChat: true,
          useExternalApi: false,
          useIntegrations: false,
          isPublic: true,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          name: "Professional",
          users: 10,
          connections: 3,
          queues: 10,
          amount: "399.00",
          recurrence: "MENSAL",
          trial: true,
          trialDays: 14,
          useWhatsapp: true,
          useFacebook: false,
          useInstagram: false,
          useCampaigns: true,
          useKanban: true,
          useOpenAi: true,
          useSchedules: true,
          useInternalChat: true,
          useExternalApi: true,
          useIntegrations: true,
          isPublic: true,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          name: "Enterprise",
          users: 50,
          connections: 10,
          queues: 50,
          amount: "999.00",
          recurrence: "MENSAL",
          trial: true,
          trialDays: 30,
          useWhatsapp: true,
          useFacebook: true,
          useInstagram: true,
          useCampaigns: true,
          useKanban: true,
          useOpenAi: true,
          useSchedules: true,
          useInternalChat: true,
          useExternalApi: true,
          useIntegrations: true,
          isPublic: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      // Inserir apenas planos que não existem
      const plansToInsert = plans.filter(
        (plan) => !existingNames.includes(plan.name)
      );

      if (plansToInsert.length > 0) {
        await queryInterface.bulkInsert("Plans", plansToInsert, {
          transaction: t
        });
      }
    });
  },

  down: async (queryInterface: QueryInterface) => {
    return queryInterface.sequelize.transaction(async (t) => {
      await queryInterface.bulkDelete(
        "Plans",
        {
          name: {
            [Op.in]: ["Starter", "Professional", "Enterprise"]
          }
        },
        { transaction: t }
      );
    });
  }
};

