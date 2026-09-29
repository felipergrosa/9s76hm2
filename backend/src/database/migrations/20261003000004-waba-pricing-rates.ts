import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    // Tabela de tarifas por mensagem da Meta (pricing_analytics)
    // Uma linha por (whatsappId, categoria, país): rate na moeda da WABA + rateBrl convertido
    const tables = await queryInterface.showAllTables();
    const hasRates = tables.some(
      (t: any) =>
        (typeof t === "string" ? t : t.tableName) === "WabaPricingRates"
    );

    if (!hasRates) {
      await queryInterface.createTable("WabaPricingRates", {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          allowNull: false
        },
        companyId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: { model: "Companies", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "CASCADE"
        },
        whatsappId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: { model: "Whatsapps", key: "id" },
          onUpdate: "CASCADE",
          onDelete: "CASCADE"
        },
        // Categoria Meta: MARKETING | UTILITY | AUTHENTICATION
        category: {
          type: DataTypes.STRING(30),
          allowNull: false
        },
        // País do destinatário (rate cards são por mercado). Default BR.
        country: {
          type: DataTypes.STRING(2),
          allowNull: false,
          defaultValue: "BR"
        },
        // Preço unitário por mensagem na moeda da WABA (cost/volume)
        rate: {
          type: DataTypes.DECIMAL(12, 6),
          allowNull: true
        },
        // Moeda da WABA conforme faturamento da Meta (geralmente USD)
        currency: {
          type: DataTypes.STRING(8),
          allowNull: false,
          defaultValue: "USD"
        },
        // rate convertido para BRL com a cotação vigente no sync
        rateBrl: {
          type: DataTypes.DECIMAL(12, 6),
          allowNull: true
        },
        // Faixa de volume (tier) reportada pela Meta, ex.: "0:750000"
        tier: {
          type: DataTypes.STRING(30),
          allowNull: true
        },
        // Origem do rate: "meta" (pricing_analytics) ou "manual" (configurado)
        source: {
          type: DataTypes.STRING(10),
          allowNull: false,
          defaultValue: "meta"
        },
        // Última vez que o rate foi recalculado a partir de dados reais
        lastSyncAt: {
          type: DataTypes.DATE,
          allowNull: true
        },
        createdAt: {
          type: DataTypes.DATE,
          allowNull: false
        },
        updatedAt: {
          type: DataTypes.DATE,
          allowNull: false
        }
      });

      await queryInterface.addIndex("WabaPricingRates", {
        name: "waba_pricing_rates_unique",
        unique: true,
        fields: ["whatsappId", "category", "country"]
      });
    }

    // Custo estimado carimbado em cada envio individual
    const shippingDef: any = await queryInterface.describeTable(
      "CampaignShipping"
    );
    if (!shippingDef.estimatedCost) {
      await queryInterface.addColumn("CampaignShipping", "estimatedCost", {
        type: DataTypes.DECIMAL(10, 4),
        allowNull: true
      });
    }

    // Índice que a migration 20260122170000 tentava criar com nome errado
    // ("CampaignShippings") e era engolido por .catch — cria agora, idempotente
    await queryInterface.sequelize
      .query(
        `CREATE INDEX IF NOT EXISTS idx_perf_campaign_shipping
         ON "CampaignShipping" ("campaignId", "deliveredAt")`
      )
      .catch(() => {});

    const messagesDef: any = await queryInterface.describeTable("Messages");
    if (!messagesDef.estimatedCost) {
      await queryInterface.addColumn("Messages", "estimatedCost", {
        type: DataTypes.DECIMAL(10, 4),
        allowNull: true
      });
    }

    // Cotação USD→BRL configurável por empresa
    const settingsDef: any = await queryInterface.describeTable(
      "CompaniesSettings"
    );
    if (!settingsDef.usdToBrlRate) {
      await queryInterface.addColumn("CompaniesSettings", "usdToBrlRate", {
        type: DataTypes.STRING(10),
        allowNull: false,
        defaultValue: "5.60"
      });
    }
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeColumn("CompaniesSettings", "usdToBrlRate");
    await queryInterface.removeColumn("Messages", "estimatedCost");
    await queryInterface.removeColumn("CampaignShipping", "estimatedCost");
    await queryInterface.dropTable("WabaPricingRates");
  }
};
