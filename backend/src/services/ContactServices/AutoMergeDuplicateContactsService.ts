import { Op, fn, col, literal } from "sequelize";
import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import Message from "../../models/Message";
import ContactTag from "../../models/ContactTag";
import sequelize from "../../database";
import logger from "../../utils/logger";
import { getIO } from "../../libs/socket";

/**
 * Serviço para limpeza e mesclagem automática de contatos duplicados
 * baseado no canonicalNumber.
 */
const AutoMergeDuplicateContactsService = async (companyId: number): Promise<{
    totalProcessed: number;
    mergedCount: number;
    errors: number;
}> => {
    try {
        // 1. Encontrar grupos de contatos que possuem o mesmo canonicalNumber
        // mas são registros diferentes.
        const duplicates = await Contact.findAll({
            attributes: ['canonicalNumber', [fn('COUNT', col('id')), 'count']],
            where: {
                companyId,
                canonicalNumber: { [Op.ne]: null },
                isGroup: false
            },
            group: ['canonicalNumber'],
            having: literal('count > 1'),
            raw: true
        });

        let mergedCount = 0;
        let errors = 0;

        for (const dup of duplicates as any[]) {
            const canonicalNumber = dup.canonicalNumber;

            // Buscar todos os contatos deste grupo, ordenados pelo mais antigo (ou com mais tickets)
            // O primeiro (mais antigo) será o MESTRE.
            const contacts = await Contact.findAll({
                where: { companyId, canonicalNumber, isGroup: false },
                order: [['createdAt', 'ASC']]
            });

            if (contacts.length < 2) continue;

            const master = contacts[0];
            const others = contacts.slice(1);

            for (const slave of others) {
                const transaction = await sequelize.transaction();
                try {
                    logger.info(`[AutoMerge] Mesclando duplicata: ${slave.id} -> ${master.id} (${canonicalNumber})`);

                    // Mover tickets
                    await Ticket.update(
                        { contactId: master.id },
                        { where: { contactId: slave.id }, transaction }
                    );

                    // Mover mensagens
                    await Message.update(
                        { contactId: master.id },
                        { where: { contactId: slave.id }, transaction }
                    );

                    // Copiar tags
                    const tags = await ContactTag.findAll({ where: { contactId: slave.id }, transaction });
                    for (const tag of tags) {
                        await ContactTag.findOrCreate({
                            where: { contactId: master.id, tagId: tag.tagId },
                            defaults: { contactId: master.id, tagId: tag.tagId } as any,
                            transaction
                        });
                    }

                    // Atualizar JIDs se o mestre não tiver mas o escravo tiver
                    if (!master.lidJid && slave.lidJid) {
                        await master.update({ lidJid: slave.lidJid }, { transaction });
                    }
                    if (master.number.startsWith("PENDING_") && !slave.number.startsWith("PENDING_")) {
                        await master.update({ number: slave.number }, { transaction });
                    }

                    // Deletar o escravo
                    await slave.destroy({ transaction });

                    await transaction.commit();
                    mergedCount++;

                    // Notificar via socket
                    const io = getIO();
                    io.of(`/workspace-${companyId}`).emit(`company-${companyId}-contact`, {
                        action: "delete",
                        contactId: slave.id
                    });
                } catch (err) {
                    await transaction.rollback();
                    logger.error(`[AutoMerge] Erro ao mesclar ${slave.id}: ${err.message}`);
                    errors++;
                }
            }
        }

        return { totalProcessed: duplicates.length, mergedCount, errors };
    } catch (error) {
        logger.error(`[AutoMerge] Falha no serviço: ${error.message}`);
        throw error;
    }
};

export default AutoMergeDuplicateContactsService;
