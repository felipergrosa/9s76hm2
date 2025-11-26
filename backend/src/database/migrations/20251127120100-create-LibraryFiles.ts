import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
    up: async (queryInterface: QueryInterface) => {
        await queryInterface.createTable("LibraryFiles", {
            id: {
                type: DataTypes.INTEGER,
                autoIncrement: true,
                primaryKey: true,
                allowNull: false
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
            fileOptionId: {
                type: DataTypes.INTEGER,
                allowNull: false,
                references: {
                    model: "FilesOptions",
                    key: "id"
                },
                onUpdate: "CASCADE",
                onDelete: "RESTRICT"
            },
            title: {
                type: DataTypes.STRING(500),
                allowNull: false
            },
            tags: {
                type: DataTypes.TEXT,
                allowNull: true,
                comment: "JSON array de tags específicas do arquivo"
            },
            statusRag: {
                type: DataTypes.ENUM("pending", "indexing", "indexed", "failed"),
                allowNull: false,
                defaultValue: "pending"
            },
            lastIndexedAt: {
                type: DataTypes.DATE,
                allowNull: true
            },
            knowledgeDocumentId: {
                type: DataTypes.INTEGER,
                allowNull: true,
                references: {
                    model: "KnowledgeDocuments",
                    key: "id"
                },
                onUpdate: "CASCADE",
                onDelete: "SET NULL"
            },
            errorMessage: {
                type: DataTypes.TEXT,
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

        // Índices para performance
        await queryInterface.addIndex("LibraryFiles", ["folderId"], {
            name: "library_files_folder_idx"
        });

        await queryInterface.addIndex("LibraryFiles", ["statusRag"], {
            name: "library_files_status_idx"
        });

        await queryInterface.addIndex("LibraryFiles", ["knowledgeDocumentId"], {
            name: "library_files_knowledge_doc_idx"
        });

        await queryInterface.addIndex("LibraryFiles", ["fileOptionId"], {
            name: "library_files_file_option_idx"
        });
    },

    down: async (queryInterface: QueryInterface) => {
        await queryInterface.dropTable("LibraryFiles");
    }
};
