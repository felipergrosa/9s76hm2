import { sequelize } from '../dist/models';

async function checkIndexes() {
  try {
    // Contacts indexes
    const [contactsIdx] = await sequelize.query(
      "SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'Contacts' ORDER BY indexname;"
    );
    console.log("\n=== Contacts Indexes ===");
    console.log(JSON.stringify(contactsIdx, null, 2));

    // ContactTags indexes
    const [contactTagsIdx] = await sequelize.query(
      "SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'ContactTags' ORDER BY indexname;"
    );
    console.log("\n=== ContactTags Indexes ===");
    console.log(JSON.stringify(contactTagsIdx, null, 2));

    // Tags indexes
    const [tagsIdx] = await sequelize.query(
      "SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'Tags' ORDER BY indexname;"
    );
    console.log("\n=== Tags Indexes ===");
    console.log(JSON.stringify(tagsIdx, null, 2));

    // Tickets indexes
    const [ticketsIdx] = await sequelize.query(
      "SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'Tickets' ORDER BY indexname;"
    );
    console.log("\n=== Tickets Indexes ===");
    console.log(JSON.stringify(ticketsIdx, null, 2));

    // Contagem de registros
    const [counts] = await sequelize.query(`
      SELECT 
        (SELECT COUNT(*) FROM "Contacts") as contacts,
        (SELECT COUNT(*) FROM "ContactTags") as contact_tags,
        (SELECT COUNT(*) FROM "Tags") as tags,
        (SELECT COUNT(*) FROM "Tickets") as tickets
    `);
    console.log("\n=== Record Counts ===");
    console.log(JSON.stringify(counts, null, 2));

    await sequelize.close();
  } catch (error) {
    console.error("Erro:", error);
    process.exit(1);
  }
}

checkIndexes();
