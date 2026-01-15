import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
    up: async (queryInterface: QueryInterface) => {
        // Verificar se a tabela já existe
        const tables = await queryInterface.showAllTables();
        const tableList = tables as string[];

        // Primeiro, criar a tabela WhatsappLabels se não existir
        if (!tableList.includes("WhatsappLabels")) {
            await queryInterface.createTable("WhatsappLabels", {
                id: {
                    type: DataTypes.INTEGER,
                    autoIncrement: true,
                    primaryKey: true,
                    allowNull: false
                },
                whatsappLabelId: {
                    type: DataTypes.STRING,
                    allowNull: false
                },
                name: {
                    type: DataTypes.STRING,
                    allowNull: false
                },
                color: {
                    type: DataTypes.INTEGER,
                    defaultValue: 0
                },
                predefinedId: {
                    type: DataTypes.STRING,
                    allowNull: true
                },
                deleted: {
                    type: DataTypes.BOOLEAN,
                    defaultValue: false
                },
                whatsappId: {
                    type: DataTypes.INTEGER,
                    references: { model: "Whatsapps", key: "id" },
                    onUpdate: "CASCADE",
                    onDelete: "CASCADE"
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
            console.log("[Migration] Tabela WhatsappLabels criada com sucesso");
        } else {
            console.log("[Migration] Tabela WhatsappLabels já existe");
        }

        // Depois, criar a tabela ContactWhatsappLabels se não existir
        if (!tableList.includes("ContactWhatsappLabels")) {
            await queryInterface.createTable("ContactWhatsappLabels", {
                id: {
                    type: DataTypes.INTEGER,
                    autoIncrement: true,
                    primaryKey: true,
                    allowNull: false
                },
                contactId: {
                    type: DataTypes.INTEGER,
                    references: { model: "Contacts", key: "id" },
                    onUpdate: "CASCADE",
                    onDelete: "CASCADE"
                },
                whatsappLabelId: {
                    type: DataTypes.INTEGER,
                    references: { model: "WhatsappLabels", key: "id" },
                    onUpdate: "CASCADE",
                    onDelete: "CASCADE"
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
            console.log("[Migration] Tabela ContactWhatsappLabels criada com sucesso");
        } else {
            console.log("[Migration] Tabela ContactWhatsappLabels já existe");
        }

        // Por último, adicionar os índices (com tratamento de erro caso já existam)
        try {
            await queryInterface.addIndex("WhatsappLabels", ["whatsappLabelId", "whatsappId"], {
                unique: true,
                name: "whatsapp_labels_unique_idx"
            });
            console.log("[Migration] Índice whatsapp_labels_unique_idx criado");
        } catch (error: any) {
            console.log("Índice whatsapp_labels_unique_idx já existe ou erro:", error.message);
        }

        try {
            await queryInterface.addIndex("ContactWhatsappLabels", ["contactId", "whatsappLabelId"], {
                unique: true,
                name: "contact_whatsapp_labels_unique_idx"
            });
            console.log("[Migration] Índice contact_whatsapp_labels_unique_idx criado");
        } catch (error: any) {
            console.log("Índice contact_whatsapp_labels_unique_idx já existe ou erro:", error.message);
        }
    },

    down: async (queryInterface: QueryInterface) => {
        // Primeiro, remover a tabela dependente
        await queryInterface.dropTable("ContactWhatsappLabels");
        // Depois, remover a tabela principal
        await queryInterface.dropTable("WhatsappLabels");
    }
};
