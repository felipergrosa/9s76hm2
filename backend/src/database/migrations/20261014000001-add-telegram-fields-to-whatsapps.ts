import { QueryInterface, DataTypes, Op } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const table = "Whatsapps";

    // Canal Telegram Bot (referência Fluxoo):
    // - telegramBotToken: segredo do @BotFather — fica fora do sanitizeWhatsapp
    //   e só é gravado via POST /whatsapp/:id/telegram-setup.
    // - telegramWebhookToken: bearer credential pública da URL do webhook
    //   (/public/telegram/:token). Também usado como secret_token do setWebhook.
    const tableDefinition: any = await queryInterface.describeTable(table);

    if (!tableDefinition.telegramBotToken) {
      await queryInterface.addColumn(table, "telegramBotToken", {
        type: DataTypes.TEXT,
        allowNull: true
      });
    }

    if (!tableDefinition.telegramWebhookToken) {
      await queryInterface.addColumn(table, "telegramWebhookToken", {
        type: DataTypes.TEXT,
        allowNull: true
      });
    }

    // Índice único parcial: só vale para linhas com token preenchido
    // (mesmo padrão do whatsapps_webchat_token_unique).
    const indexes: any = await queryInterface.showIndex(table);
    const hasIndex = indexes.some(
      (idx: any) => idx.name === "whatsapps_telegram_webhook_token_unique"
    );
    if (!hasIndex) {
      await queryInterface.addIndex(table, ["telegramWebhookToken"], {
        name: "whatsapps_telegram_webhook_token_unique",
        unique: true,
        where: { telegramWebhookToken: { [Op.ne]: null } }
      });
    }
  },

  down: async (queryInterface: QueryInterface) => {
    await queryInterface.removeIndex(
      "Whatsapps",
      "whatsapps_telegram_webhook_token_unique"
    );
    await queryInterface.removeColumn("Whatsapps", "telegramWebhookToken");
    await queryInterface.removeColumn("Whatsapps", "telegramBotToken");
  }
};
