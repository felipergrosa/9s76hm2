import { QueryInterface, DataTypes, QueryTypes, Op } from "sequelize";
import { safeNormalizePhoneNumber } from "../../utils/phone";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      await queryInterface.addColumn(
        "Contacts",
        "canonicalNumber",
        {
          type: DataTypes.STRING,
          allowNull: true
        },
        { transaction }
      );

      const contacts: Array<{ id: number; number: string | null; isGroup: boolean }> = await queryInterface.sequelize.query(
        'SELECT id, "number", "isGroup" FROM "Contacts"',
        {
          type: QueryTypes.SELECT,
          transaction
        }
      );

      for (const contact of contacts) {
        if (contact.isGroup) {
          continue;
        }

        const { canonical } = safeNormalizePhoneNumber(contact.number);

        if (canonical && contact.number !== canonical) {
          await queryInterface.sequelize.query(
            'UPDATE "Contacts" SET "number" = :canonical, "canonicalNumber" = :canonical WHERE id = :id',
            {
              replacements: { canonical, id: contact.id },
              type: QueryTypes.UPDATE,
              transaction
            }
          );
        } else if (canonical) {
          await queryInterface.sequelize.query(
            'UPDATE "Contacts" SET "canonicalNumber" = :canonical WHERE id = :id',
            {
              replacements: { canonical, id: contact.id },
              type: QueryTypes.UPDATE,
              transaction
            }
          );
        } else {
          await queryInterface.sequelize.query(
            'UPDATE "Contacts" SET "canonicalNumber" = NULL WHERE id = :id',
            {
              replacements: { id: contact.id },
              type: QueryTypes.UPDATE,
              transaction
            }
          );
        }
      }

      await queryInterface.addIndex(
        "Contacts",
        ["companyId", "canonicalNumber"],
        {
          name: "contacts_company_canonical_idx",
          unique: false,
          where: {
            canonicalNumber: {
              [Op.ne]: null
            }
          },
          transaction
        }
      );

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  down: async (queryInterface: QueryInterface) => {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      await queryInterface.removeIndex("Contacts", "contacts_company_canonical_idx", { transaction });
      await queryInterface.removeColumn("Contacts", "canonicalNumber", { transaction });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
};
