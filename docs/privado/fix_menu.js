const fs = require('fs');
const file = 'c:/Users/feliperosa/9s76hm2/frontend/src/layout/MainListItems.js';
let text = fs.readFileSync(file, 'utf8');

// Normalize line endings
text = text.replace(/\r\n/g, '\n');

// The new block ends cleanly with:
//   };
// Then the old code starts with:
//           <ListItemLink
// We need to cut everything after the correct closing }; of MainListItems component
// Find the closing }; followed by the stale old code starting with whitespace + <ListItemLink

const marker = '};\n          <ListItemLink';
const idx = text.indexOf(marker);
if (idx === -1) {
  console.log('Marker not found, trying alternative...');
  // Try with \r\n
  const marker2 = '};\r\n          <ListItemLink';
  const idx2 = text.indexOf(marker2);
  console.log('idx2:', idx2);
} else {
  // Keep only up to and including "};\n" (the component closing)
  const cutPoint = idx + 2; // keep "};\n" -> index 0='}'  1=';'  2='\n'
  const cleanText = text.substring(0, cutPoint + 1) + '\nexport default MainListItems;\n';
  fs.writeFileSync(file, cleanText, 'utf8');
  console.log('Done! File cleaned. Length:', cleanText.length);
}
