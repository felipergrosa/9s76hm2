const fs = require('fs');
const file = 'c:/Users/feliperosa/9s76hm2/frontend/src/components/MomentsUser/index.js';
let text = fs.readFileSync(file, 'utf8');

// Normalize line endings
text = text.replace(/\r\n/g, '\n');

// Remove the old tagContainer closing section (SessionWindow + Typography + </div>)
const oldSection = `            {!ticket.isGroup && ticket.whatsapp?.channelType === "official" && (
              <div style={{ marginLeft: 'auto', marginRight: 4 }}>
                <SessionWindowCounter
                  ticketId={ticket.id}
                  channelType={ticket.channel}
                  isOfficial={ticket.whatsapp?.channelType === "official"}
                  sessionWindowExpiresAt={ticket.sessionWindowExpiresAt}
                  compact={true}
                />
              </div>
            )}
            <Typography className={classes.time} style={{ marginLeft: ticket.whatsapp?.channelType === "official" ? 0 : 'auto' }}>
              {format(parseISO(ticket.updatedAt), "HH:mm")}
            </Typography>
          </div>`;

const newSection = `            <div style={{ display: 'flex', alignItems: 'center', marginLeft: 'auto', gap: 4 }}>
              {!ticket.isGroup && ticket.whatsapp?.channelType === "official" && (
                <SessionWindowCounter
                  ticketId={ticket.id}
                  channelType={ticket.channel}
                  isOfficial={ticket.whatsapp?.channelType === "official"}
                  sessionWindowExpiresAt={ticket.sessionWindowExpiresAt}
                  compact={true}
                />
              )}
              {unreadCount > 0 && (
                <div className={classes.unreadBadge}>
                  {unreadCount}
                </div>
              )}
              <Typography className={classes.time}>
                {format(parseISO(ticket.updatedAt), "HH:mm")}
              </Typography>
            </div>
          </div>`;

if (text.includes(oldSection)) {
  text = text.replace(oldSection, newSection);
  console.log("Substituição feita com sucesso!");
} else {
  console.log("ERRO: Target não encontrado. Gerando dump...");
  // Vamos imprimir a linha relevante para inspecionar
  const idx = text.indexOf('tagContainer');
  console.log("Contexto:", JSON.stringify(text.substring(idx, idx+2000)));
}

// Ensure styles are correct (no absolute positioning)
text = text.replace(
  /unreadBadge:\s*\{\s*position:\s*'absolute',\s*top:\s*-6,\s*right:\s*-3,/g,
  'unreadBadge: {'
);

fs.writeFileSync(file, text, 'utf8');
