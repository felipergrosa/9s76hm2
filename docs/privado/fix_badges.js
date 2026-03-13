const fs = require('fs');

// Função para aplicar substituição global com regex
function applyFix(file, oldStr, newStr) {
  let text = fs.readFileSync(file, 'utf8');
  const before = text;
  text = text.split(oldStr).join(newStr);
  if (text === before) {
    console.log(`NADA MUDOU em ${file} para: ${oldStr.slice(0, 60)}`);
  } else {
    fs.writeFileSync(file, text, 'utf8');
    console.log(`OK: ${file}`);
  }
}

// 1. MomentsUser - remover max={99} dos badges de coluna
const momentsFile = 'c:/Users/feliperosa/9s76hm2/frontend/src/components/MomentsUser/index.js';
applyFix(momentsFile, 'max={99} overlap="rectangular">', 'max={99999} overlap="rectangular">');

// 2. TicketListItemCustom - badges de unreadMessages sem max têm default 99 do MUI
// Precisamos adicionar max={99999} em cada <Badge que usa badgeContent={ticket.unreadMessages}
const ticketCustom = 'c:/Users/feliperosa/9s76hm2/frontend/src/components/TicketListItemCustom/index.js';
let text = fs.readFileSync(ticketCustom, 'utf8');
// Adicionar max onde tem badgeContent={ticket.unreadMessages} e não tem max={
let count = 0;
text = text.replace(
  /(<Badge[\s\S]*?badgeContent=\{ticket\.unreadMessages\}[\s\S]*?overlap="rectangular")/g,
  (match) => {
    if (!match.includes('max={')) {
      count++;
      return match.replace('overlap="rectangular"', 'max={99999}\n                                overlap="rectangular"');
    }
    return match;
  }
);
fs.writeFileSync(ticketCustom, text, 'utf8');
console.log(`TicketListItemCustom: ${count} badges atualizados`);

// 3. TicketListItem (simples)
const ticketSimple = 'c:/Users/feliperosa/9s76hm2/frontend/src/components/TicketListItem/index.js';
let text2 = fs.readFileSync(ticketSimple, 'utf8');
let count2 = 0;
text2 = text2.replace(
  /(<Badge[\s\S]*?badgeContent=\{ticket\.unreadMessages\}[\s\S]*?overlap="rectangular")/g,
  (match) => {
    if (!match.includes('max={')) {
      count2++;
      return match.replace('overlap="rectangular"', 'max={99999}\n                                overlap="rectangular"');
    }
    return match;
  }
);
fs.writeFileSync(ticketSimple, text2, 'utf8');
console.log(`TicketListItem: ${count2} badges atualizados`);

// 4. TicketsManagerTabs - as tabs com openCount, pendingCount, groupingCount, botCount, campaignCount
const tabsFile = 'c:/Users/feliperosa/9s76hm2/frontend/src/components/TicketsManagerTabs/index.js';
let text3 = fs.readFileSync(tabsFile, 'utf8');
const tabBadgeVars = ['openCount', 'pendingCount', 'groupingCount', 'botCount', 'campaignCount'];
let count3 = 0;
tabBadgeVars.forEach(varName => {
  const re = new RegExp(`(badgeContent=\\{${varName}\\}[\\s\\S]*?color="primary")`, 'g');
  text3 = text3.replace(re, (match) => {
    if (!match.includes('max={')) {
      count3++;
      return match.replace(`color="primary"`, `max={99999}\r\n                          color="primary"`);
    }
    return match;
  });
});
fs.writeFileSync(tabsFile, text3, 'utf8');
console.log(`TicketsManagerTabs: ${count3} badges atualizados`);

console.log('Concluído!');
