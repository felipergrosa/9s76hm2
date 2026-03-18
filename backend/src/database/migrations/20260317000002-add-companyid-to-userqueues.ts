import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const transaction = await queryInterface.sequelize.transaction();
    
    try {
      // Verificar se a coluna já existe
      const tableInfo = await queryInterface.describeTable("UserQueues");
      const columnExists = tableInfo.hasOwnProperty("companyId");

      if (!columnExists) {
        // Coluna não existe - criar do zero
        await queryInterface.addColumn("UserQueues", "companyId", {
          type: DataTypes.INTEGER,
          allowNull: true,
          references: {
            model: "Companies",
            key: "id"
          },
          onUpdate: "CASCADE",
          onDelete: "CASCADE"
        }, { transaction });

        // Criar índice
        await queryInterface.addIndex("UserQueues", ["companyId"], { transaction });
      }

      // Atualizar registros existentes com companyId baseado no usuário
      await queryInterface.sequelize.query(`
        UPDATE "UserQueues" uq
        SET "companyId" = u."companyId"
        FROM "Users" u
        WHERE uq."userId" = u.id
        AND uq."companyId" IS NULL
      `, { transaction });

      // Verificar se ainda há registros nulos
      const [nullCount] = await queryInterface.sequelize.query(
        `SELECT COUNT(*) as count FROM "UserQueues" WHERE "companyId" IS NULL`,
        { type: (queryInterface.sequelize as any).QueryTypes.SELECT, transaction }
      ) as any;

      if (parseInt(nullCount?.count || 0) > 0) {
        // Tentar obter companyId padrão da primeira empresa
        const [defaultCompany] = await queryInterface.sequelize.query(
          `SELECT id FROM "Companies" ORDER BY id LIMIT 1`,
          { type: (queryInterface.sequelize as any).QueryTypes.SELECT, transaction }
        ) as any;

        if (defaultCompany?.id) {
          await queryInterface.sequelize.query(`
            UPDATE "UserQueues" 
            SET "companyId" = ${defaultCompany.id}
            WHERE "companyId" IS NULL
          `, { transaction });
        }
      }

      // Tornar a coluna NOT NULL (agora que todos têm valor)
      await queryInterface.changeColumn("UserQueues", "companyId", {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "Companies",
          key: "id"
        },
        onUpdate: "CASCADE",
        onDelete: "CASCADE"
      }, { transaction });

      await transaction.commit();
      console.log("✅ Migration 20260317000002-add-companyid-to-userqueues concluída com sucesso");

    } catch (error) {
      await transaction.rollback();
      console.error("❌ Erro na migration:", error);
      throw error;
    }
  },

  down: async (queryInterface: QueryInterface) => {
    const tableInfo = await queryInterface.describeTable("UserQueues");
    if (tableInfo.hasOwnProperty("companyId")) {
      await queryInterface.removeColumn("UserQueues", "companyId");
    }
  }
};
