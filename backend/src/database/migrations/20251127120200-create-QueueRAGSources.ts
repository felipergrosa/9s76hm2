import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
    up: async (queryInterface: QueryInterface) => {
        await queryInterface.createTable("QueueRAGSources", {
            id: {
                type: DataTypes.INTEGER,
                autoIncrement: true,
                primaryKey: true,
                allowNull: false
            },
            queueId: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: "Queues",
                    key: "id"
                },
                onUpdate: "CASCADE",
                onDelete: "CASCADE"
            },
            folderId: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: "LibraryFolders",
                    key: "id"
                },
                onUpdate: "CASCADE",
                onDelete: "CASCADE"
            },
            mode: {
                type: DataTypes.ENUM("include", "exclude"),
                allowNull: false,
                defaultValue: "include",
                comment: "include = usar essa pasta; exclude = ignorar (futuro)"
            },
            weight: {
                type: DataTypes.FLOAT,
                allowNull: true,
                defaultValue: 1.0,
                comment: "Peso/prioridade na busca (futuro)"
            },
            createdAt: {
                type: DataTypes.DATE,
                allowNull: false
            }
        });

        // Índices para performance
        await queryInterface.addIndex("QueueRAGSources", ["queueId"], {
            name: "queue_rag_sources_queue_idx"
        });

        await queryInterface.addIndex("QueueRAGSources", ["folderId"], {
            name: "queue_rag_sources_folder_idx"
        });

        // Índice único para evitar duplicatas
        await queryInterface.addIndex("QueueRAGSources", ["queueId", "folderId"], {
            name: "queue_rag_sources_unique_idx",
            unique: true
        });
    },

    down: async (queryInterface: QueryInterface) => {
        await queryInterface.dropTable("QueueRAGSources");
    }
};
