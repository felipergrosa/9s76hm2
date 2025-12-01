import { QueryInterface } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    // Remove a constraint de foreign key se existir
    await queryInterface.sequelize.query(
      'ALTER TABLE "Queues" DROP CONSTRAINT IF EXISTS "Queues_folderId_fkey";'
    );
  },

  down: async (queryInterface: QueryInterface) => {
    // Recria a constraint de foreign key exatamente como na migration original
    await queryInterface.sequelize.query(
      'ALTER TABLE "Queues" ADD CONSTRAINT "Queues_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "LibraryFolders" ("id") ON UPDATE CASCADE ON DELETE SET NULL;'
    );
  }
};
