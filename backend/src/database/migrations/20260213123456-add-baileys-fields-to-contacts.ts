import { QueryInterface, DataTypes } from "sequelize";

async function addColumnIfNotExists(
    queryInterface: QueryInterface,
    table: string,
    column: string,
    attributes: any
) {
    const tableDesc = await queryInterface.describeTable(table);
    if (!(tableDesc as any)[column]) {
        await queryInterface.addColumn(table, column, attributes);
    }
}

module.exports = {
    up: async (queryInterface: QueryInterface) => {
        await addColumnIfNotExists(queryInterface, "Contacts", "notify", {
            type: DataTypes.STRING,
            allowNull: true,
        });

        await addColumnIfNotExists(queryInterface, "Contacts", "verifiedName", {
            type: DataTypes.STRING,
            allowNull: true,
        });

        await addColumnIfNotExists(queryInterface, "Contacts", "pushName", {
            type: DataTypes.STRING,
            allowNull: true,
        });

        await addColumnIfNotExists(queryInterface, "Contacts", "profilePicUrlHD", {
            type: DataTypes.TEXT,
            allowNull: true,
        });

        await addColumnIfNotExists(queryInterface, "Contacts", "about", {
            type: DataTypes.TEXT,
            allowNull: true,
        });

        await addColumnIfNotExists(queryInterface, "Contacts", "aboutTag", {
            type: DataTypes.STRING,
            allowNull: true,
        });

        await addColumnIfNotExists(queryInterface, "Contacts", "isBusiness", {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        });

        await addColumnIfNotExists(queryInterface, "Contacts", "businessCategory", {
            type: DataTypes.STRING,
            allowNull: true,
        });

        await addColumnIfNotExists(queryInterface, "Contacts", "businessDescription", {
            type: DataTypes.TEXT,
            allowNull: true,
        });

        await addColumnIfNotExists(queryInterface, "Contacts", "businessAddress", {
            type: DataTypes.STRING,
            allowNull: true,
        });

        await addColumnIfNotExists(queryInterface, "Contacts", "businessEmail", {
            type: DataTypes.STRING,
            allowNull: true,
        });

        await addColumnIfNotExists(queryInterface, "Contacts", "businessWebsite", {
            type: DataTypes.JSON,
            allowNull: true,
        });

        await addColumnIfNotExists(queryInterface, "Contacts", "businessHours", {
            type: DataTypes.JSON,
            allowNull: true,
        });

        await addColumnIfNotExists(queryInterface, "Contacts", "businessVerifiedLevel", {
            type: DataTypes.STRING,
            allowNull: true,
        });

        await addColumnIfNotExists(queryInterface, "Contacts", "businessCatalog", {
            type: DataTypes.JSON,
            allowNull: true,
        });

        await addColumnIfNotExists(queryInterface, "Contacts", "isBlocked", {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        });

        await addColumnIfNotExists(queryInterface, "Contacts", "isMyContact", {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        });

        await addColumnIfNotExists(queryInterface, "Contacts", "isPremium", {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        });

        await addColumnIfNotExists(queryInterface, "Contacts", "isEnterprise", {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        });

        await addColumnIfNotExists(queryInterface, "Contacts", "lastSeen", {
            type: DataTypes.BIGINT,
            allowNull: true,
        });

        await addColumnIfNotExists(queryInterface, "Contacts", "isOnline", {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        });

        await addColumnIfNotExists(queryInterface, "Contacts", "privacySettings", {
            type: DataTypes.JSON,
            allowNull: true,
        });

        await addColumnIfNotExists(queryInterface, "Contacts", "lastDiscoveryAt", {
            type: DataTypes.DATE,
            allowNull: true,
        });

        await addColumnIfNotExists(queryInterface, "Contacts", "rawData", {
            type: DataTypes.JSON,
            allowNull: true,
        });
    },

    down: async (queryInterface: QueryInterface) => {
        const columns = [
            "notify", "verifiedName", "pushName", "profilePicUrlHD", "about", "aboutTag",
            "isBusiness", "businessCategory", "businessDescription", "businessAddress",
            "businessEmail", "businessWebsite", "businessHours", "businessVerifiedLevel",
            "businessCatalog", "isBlocked", "isMyContact", "isPremium", "isEnterprise",
            "lastSeen", "isOnline", "privacySettings", "lastDiscoveryAt", "rawData"
        ];

        for (const column of columns) {
            try {
                await queryInterface.removeColumn("Contacts", column);
            } catch (e) {
                // Coluna pode já ter sido removida
            }
        }
    },
};
