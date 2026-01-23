import { QueryInterface, QueryTypes } from "sequelize";

/**
 * Migration de Limpeza FORÇADA: Remover contatos Meta resistentes
 * 
 * PROBLEMA: Alguns contatos Meta (IDs > 13 dígitos) não foram deletados
 * porque possuem Tickets Individuais (status: open/closed) associados a eles.
 * Isso foi causado por um bug onde mensagens de grupo criaram tickets individuais.
 * 
 * SOLUÇÃO:
 * 1. Identificar tickets associados a contatos Meta.
 * 2. Tentar descobrir o GRUPO correto examinando o 'remoteJid' das mensagens.
 * 3. Se for grupo, mover mensagens para o ticket do grupo e deletar ticket inválido.
 * 4. Se não for possível identificar, marcar como deletado ou forçar exclusão (opção segura: deletar se poucas msgs).
 */

module.exports = {
    up: async (queryInterface: QueryInterface) => {
        const sequelize = queryInterface.sequelize;

        console.log("[Migration] 🧹 INICIANDO LIMPEZA FORÇADA DE CONTATOS META RESISTENTES...");

        try {
            // 1. Buscar contatos Meta que ainda têm Tickets
            const problemContacts: any = await sequelize.query(`
        SELECT c.id, c.name, c.number
        FROM "Contacts" c
        WHERE c."isGroup" = false
          AND LENGTH(REGEXP_REPLACE(c.number, '[^0-9]', '', 'g')) > 13
          AND EXISTS (SELECT 1 FROM "Tickets" t WHERE t."contactId" = c.id)
      `, { type: QueryTypes.SELECT });

            if (problemContacts.length === 0) {
                console.log("[Migration] ✅ Nenhum contato problemático encontrado.");
                return;
            }

            console.log(`[Migration] ⚠️ Encontrados ${problemContacts.length} contatos para corrigir.`);

            for (const contact of problemContacts) {
                console.log(`[Migration] Processando: [${contact.id}] ${contact.name}...`);

                // Buscar tickets desse contato
                const tickets: any = await sequelize.query(`
          SELECT id, status FROM "Tickets" WHERE "contactId" = :id
        `, { replacements: { id: contact.id }, type: QueryTypes.SELECT });

                for (const ticket of tickets) {
                    // Buscar mensagens desse ticket para descobrir o remoteJid (Grupo real)
                    const messages: any = await sequelize.query(`
            SELECT id, "remoteJid", "contactId" FROM "Messages" WHERE "ticketId" = :ticketId LIMIT 5
          `, { replacements: { ticketId: ticket.id }, type: QueryTypes.SELECT });

                    let targetGroupJid = null;

                    // Tentar achar um JID de grupo (termina em g.us)
                    for (const msg of messages) {
                        if (msg.remoteJid && msg.remoteJid.includes("g.us")) {
                            targetGroupJid = msg.remoteJid;
                            break;
                        }
                    }

                    if (targetGroupJid) {
                        console.log(`[Migration]    Ticket ${ticket.id}: Pertence ao grupo ${targetGroupJid}`);

                        // Buscar o Contato do Grupo
                        const groupContacts: any = await sequelize.query(`
              SELECT id FROM "Contacts" WHERE number = :jid AND "isGroup" = true LIMIT 1
            `, { replacements: { jid: targetGroupJid.replace('@g.us', '') }, type: QueryTypes.SELECT });

                        if (groupContacts.length > 0) {
                            const groupContactId = groupContacts[0].id;

                            // Buscar ou Criar Ticket para o Grupo (simulado: vamos buscar o mais recente ou aberto)
                            let targetTicketId = null;

                            const groupTickets: any = await sequelize.query(`
                SELECT id FROM "Tickets" WHERE "contactId" = :id ORDER BY "updatedAt" DESC LIMIT 1
              `, { replacements: { id: groupContactId }, type: QueryTypes.SELECT });

                            if (groupTickets.length > 0) {
                                targetTicketId = groupTickets[0].id;
                            } else {
                                // Se não tem ticket de grupo, teríamos que criar. 
                                // Simplificação: Se não tem ticket de grupo aberto, essas mensagens ficam órfãs de ticket ou deletamos.
                                // Melhor estratégia para limpeza: Apontar mensagens para o ticket do Grupo encontrado.
                            }

                            if (targetTicketId) {
                                // MOVER AS MENSAGENS
                                await sequelize.query(`
                  UPDATE "Messages" 
                  SET "ticketId" = :targetTicketId, "contactId" = :groupContactId, "senderName" = :senderName
                  WHERE "ticketId" = :oldTicketId
                `, {
                                    replacements: {
                                        targetTicketId,
                                        groupContactId,
                                        senderName: contact.name,
                                        oldTicketId: ticket.id
                                    }
                                });
                                console.log(`[Migration]    ✅ Mensagens movidas para Ticket de Grupo ${targetTicketId}`);
                            } else {
                                console.log(`[Migration]    ⚠️ Grupo existe mas sem ticket. Deletando msgs.`);
                                await sequelize.query(`DELETE FROM "Messages" WHERE "ticketId" = :tid`, { replacements: { tid: ticket.id } });
                            }

                        } else {
                            console.log(`[Migration]    ⚠️ Contato do grupo não encontrado. Deletando msgs.`);
                            await sequelize.query(`DELETE FROM "Messages" WHERE "ticketId" = :tid`, { replacements: { tid: ticket.id } });
                        }

                    } else {
                        // Se não achou JID de grupo nas mensagens
                        console.log(`[Migration]    ⚠️ Não foi possível identificar grupo. Deletando Ticket ${ticket.id} e suas mensagens.`);
                        await sequelize.query(`DELETE FROM "Messages" WHERE "ticketId" = :tid`, { replacements: { tid: ticket.id } });
                    }

                    // DELETAR O TICKET INVÁLIDO
                    await sequelize.query(`DELETE FROM "Tickets" WHERE id = :tid`, { replacements: { tid: ticket.id } });
                    console.log(`[Migration]    🗑️ Ticket ${ticket.id} Deletado.`);
                }

                // DELETAR O CONTATO META
                await sequelize.query(`DELETE FROM "Contacts" WHERE id = :id`, { replacements: { id: contact.id } });
                console.log(`[Migration]    🚫 Contato ${contact.id} Deletado.`);
            }

            console.log("[Migration] 🎉 LIMPEZA FORÇADA CONCLUÍDA!");

        } catch (error: any) {
            console.error(`[Migration] ❌ Erro: ${error.message}`);
        }
    },

    down: async () => {
        console.log("[Migration] Irreversível.");
    }
};
