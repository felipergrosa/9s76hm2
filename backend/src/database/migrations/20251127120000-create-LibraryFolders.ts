import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
    up: async (queryInterface: QueryInterface) => {
        await queryInterface.createTable("LibraryFolders", {
            id: {
                type: DataTypes.INTEGER,
                autoIncrement: true,
                primaryKey: true,
                allowNull: false
            },
            companyId: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: "Companies",
                    key: "id"
                },
                onUpdate: "CASCADE",
                onDelete: "CASCADE"
            },
            name: {
                type: DataTypes.STRING(255),
                allowNull: false
            },
            parentId: {
                type: DataTypes.INTEGER,
                allowNull: true,
                references: {
                    model: "LibraryFolders",
                    key: "id"
                },
                onUpdate: "CASCADE",
                onDelete: "CASCADE"
            },
            description: {
                type: DataTypes.TEXT,
                allowNull: true
            },
            slug: {
                type: DataTypes.STRING(500),
                allowNull: true
            },
            defaultTags: {
                type: DataTypes.TEXT,
                allowNull: true,
                comment: "JSON array de tags padrão"
            },
            defaultLanguage: {
                type: DataTypes.STRING(10),
                allowNull: true,
                defaultValue: "pt-BR"
            },
            ragPriority: {
                type: DataTypes.INTEGER,
                allowNull: true,
                defaultValue: 5,
                comment: "Prioridade de ranking (0-10)"
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

        // Índices para performance
        await queryInterface.addIndex("LibraryFolders", ["companyId"], {
            name: "library_folders_company_idx"
        });

        await queryInterface.addIndex("LibraryFolders", ["parentId"], {
            name: "library_folders_parent_idx"
        });

        await queryInterface.addIndex("LibraryFolders", ["slug"], {
            name: "library_folders_slug_idx"
        });
    },

    down: async (queryInterface: QueryInterface) => {
        await queryInterface.dropTable("LibraryFolders");
    }
};
