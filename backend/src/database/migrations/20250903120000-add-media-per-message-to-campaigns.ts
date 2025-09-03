import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    const addPair = async (idx: number) => {
      await queryInterface.addColumn("Campaigns", `mediaUrl${idx}`, {
        type: DataTypes.STRING,
        allowNull: true
      });
      await queryInterface.addColumn("Campaigns", `mediaName${idx}`, {
        type: DataTypes.STRING,
        allowNull: true
      });
    };

    for (let i = 1; i <= 5; i++) {
      // eslint-disable-next-line no-await-in-loop
      await addPair(i);
    }
  },

  down: async (queryInterface: QueryInterface) => {
    const removePair = async (idx: number) => {
      await queryInterface.removeColumn("Campaigns", `mediaUrl${idx}`);
      await queryInterface.removeColumn("Campaigns", `mediaName${idx}`);
    };

    for (let i = 1; i <= 5; i++) {
      // eslint-disable-next-line no-await-in-loop
      await removePair(i);
    }
  }
};
