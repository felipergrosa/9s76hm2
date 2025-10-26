import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    // Índice para busca por campanha e status (usado no relatório detalhado)
    await queryInterface.addIndex("CampaignShipping", ["campaignId", "status"], {
      name: "idx_campaign_shipping_campaign_status",
      concurrently: true
    });

    // Índice para busca por deliveredAt (usado para verificar progresso)
    await queryInterface.addIndex("CampaignShipping", ["campaignId", "deliveredAt"], {
      name: "idx_campaign_shipping_delivered",
      concurrently: true
    });

    // Índice para busca por tentativas (usado no monitoramento de falhas)
    await queryInterface.addIndex("CampaignShipping", ["campaignId", "attempts"], {
      name: "idx_campaign_shipping_attempts",
      concurrently: true
    });

    // Índice composto para queries complexas do relatório
    await queryInterface.addIndex(
      "CampaignShipping",
      ["campaignId", "status", "deliveredAt"],
      {
        name: "idx_campaign_shipping_report",
        concurrently: true
      }
    );

    // Índice para busca por número (usado em filtros)
    await queryInterface.addIndex("CampaignShipping", ["number"], {
      name: "idx_campaign_shipping_number",
      concurrently: true
    });

    // Índice para jobId (usado para cancelamento e reagendamento)
    await queryInterface.addIndex("CampaignShipping", ["jobId"], {
      name: "idx_campaign_shipping_job_id",
      concurrently: true
    });
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeIndex(
      "CampaignShipping",
      "idx_campaign_shipping_campaign_status"
    );
    await queryInterface.removeIndex(
      "CampaignShipping",
      "idx_campaign_shipping_delivered"
    );
    await queryInterface.removeIndex(
      "CampaignShipping",
      "idx_campaign_shipping_attempts"
    );
    await queryInterface.removeIndex(
      "CampaignShipping",
      "idx_campaign_shipping_report"
    );
    await queryInterface.removeIndex(
      "CampaignShipping",
      "idx_campaign_shipping_number"
    );
    await queryInterface.removeIndex(
      "CampaignShipping",
      "idx_campaign_shipping_job_id"
    );
  },
};
