const { Sequelize } = require('sequelize');

const seq = new Sequelize({
  dialect: 'postgres',
  host: 'localhost',
  port: 5432,
  database: 'whaticket',
  username: 'postgres',
  password: 'efe487b6a861100fb704ad9f5c160cb8',
  logging: false
});

async function run() {
  try {
    // Contacts indexes
    const [contactsIdx] = await seq.query(
      "SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'Contacts' ORDER BY indexname"
    );
    console.log("\n=== Contacts Indexes ===");
    contactsIdx.forEach(r => console.log(`  ${r.indexname}`));

    // ContactTags indexes
    const [contactTagsIdx] = await seq.query(
      "SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'ContactTags' ORDER BY indexname"
    );
    console.log("\n=== ContactTags Indexes ===");
    contactTagsIdx.forEach(r => console.log(`  ${r.indexname}`));

    // Tags indexes
    const [tagsIdx] = await seq.query(
      "SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'Tags' ORDER BY indexname"
    );
    console.log("\n=== Tags Indexes ===");
    tagsIdx.forEach(r => console.log(`  ${r.indexname}`));

    // Contagem de registros
    const [counts] = await seq.query(`
      SELECT 
        (SELECT COUNT(*) FROM "Contacts") as contacts,
        (SELECT COUNT(*) FROM "ContactTags") as contact_tags,
        (SELECT COUNT(*) FROM "Tags") as tags,
        (SELECT COUNT(*) FROM "Tickets") as tickets
    `);
    console.log("\n=== Record Counts ===");
    console.log(counts[0]);

    // Verificar índices faltantes críticos
    console.log("\n=== Missing Indexes Analysis ===");
    
    const contactsIdxNames = contactsIdx.map(r => r.indexname);
    const contactTagsIdxNames = contactTagsIdx.map(r => r.indexname);
    
    // Índices esperados em Contacts
    const expectedContactsIdx = [
      'Contacts_pkey',
      'number_companyid_unique',
      'idx_contacts_company_id',
      'idx_contacts_canonical_number',
      'idx_contacts_whatsapp_id'
    ];
    
    const missingContacts = expectedContactsIdx.filter(
      idx => !contactsIdxNames.includes(idx)
    );
    if (missingContacts.length > 0) {
      console.log("MISSING Contacts indexes:", missingContacts);
    } else {
      console.log("All expected Contacts indexes present");
    }

    // Índices esperados em ContactTags
    const expectedContactTagsIdx = [
      'ContactTags_pkey',
      'idx_contacttags_contactid',
      'idx_contacttags_tagid'
    ];
    
    const missingContactTags = expectedContactTagsIdx.filter(
      idx => !contactTagsIdxNames.includes(idx)
    );
    if (missingContactTags.length > 0) {
      console.log("MISSING ContactTags indexes:", missingContactTags);
    } else {
      console.log("All expected ContactTags indexes present");
    }

    await seq.close();
  } catch (error) {
    console.error("Erro:", error.message);
    process.exit(1);
  }
}

run();
