import Contact from "./src/models/Contact";
import { sequelize } from "./src/database/index"; // Import the initialized connection

async function run() {
  try {
    const contact = await Contact.findOne({ where: { number: "551937013347" } });
    if (contact) {
      console.log("CONTACT DB STATE:");
      console.log(contact.get({ plain: true }));
    } else {
      console.log("Contact not found");
    }
  } catch (err) {
    console.error(err);
  }
  process.exit(0);
}
run();
