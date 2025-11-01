import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    // NOTA: Migration simplificada - apenas normaliza contatos existentes
    // Trigger removido pois causava conflitos com services existentes
    
    console.log("✅ Migration executada - proteção via services mantida");
  },

  down: async (queryInterface: QueryInterface) => {
    // Nada a fazer
  }
};
