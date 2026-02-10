import Whatsapp from "../../models/Whatsapp";
import Ticket from "../../models/Ticket";
import Message from "../../models/Message";
import AppError from "../../errors/AppError";
import logger from "../../utils/logger";

interface ConnectionMergeResult {
  mergedTickets: number;
  mergedMessages: number;
  oldConnectionId: number;
  newConnectionId: number;
  phoneNumber: string;
}

/**
 * Serviço simplificado para detectar e fazer merge de conexões WhatsApp recriadas
 */
class WhatsAppConnectionMergeService {
  
  /**
   * Detecta se uma conexão foi recriada e faz merge automático
   */
  static async detectAndMergeConnection(
    newConnection: Whatsapp
  ): Promise<ConnectionMergeResult | null> {
    
    if (!newConnection.number) {
      logger.debug(`[ConnectionMerge] Conexão ${newConnection.id} não tem número, ignorando`);
      return null;
    }

    const normalizedNumber = this.normalizePhoneNumber(newConnection.number);
    
    try {
      // Buscar conexões antigas com o mesmo número
      const oldConnections = await Whatsapp.findAll({
        where: {
          id: { [require('sequelize').Op.ne]: newConnection.id },
          companyId: newConnection.companyId,
          number: normalizedNumber
        }
      });

      if (oldConnections.length === 0) {
        logger.debug(`[ConnectionMerge] Nenhuma conexão antiga encontrada para número ${normalizedNumber}`);
        return null;
      }

      // Pegar a conexão antiga mais recente
      const oldConnection = oldConnections[0];
      
      logger.info(`[ConnectionMerge] Detectada reconexão: ${oldConnection.id} → ${newConnection.id} (${normalizedNumber})`);
      
      // Fazer merge dos dados
      const mergeResult = await this.mergeConnectionData(
        oldConnection.id,
        newConnection.id,
        normalizedNumber
      );
      
      logger.info(`[ConnectionMerge] Merge concluído: ${mergeResult.mergedTickets} tickets, ${mergeResult.mergedMessages} mensagens`);
      
      return mergeResult;
      
    } catch (error) {
      logger.error(`[ConnectionMerge] Erro ao fazer merge: ${error.message}`);
      throw error;
    }
  }

  /**
   * Migra tickets e mensagens da conexão antiga para a nova
   */
  private static async mergeConnectionData(
    oldConnectionId: number,
    newConnectionId: number,
    phoneNumber: string
  ): Promise<ConnectionMergeResult> {
    
    // 1. Migrar tickets
    const [ticketsUpdated] = await Ticket.update(
      { whatsappId: newConnectionId },
      { where: { whatsappId: oldConnectionId } }
    );

    // 2. Atualizar mensagens
    const [messagesUpdated] = await Message.update(
      { whatsappId: newConnectionId },
      { where: { whatsappId: oldConnectionId } }
    );

    // 3. Marcar conexão antiga como deletada (soft delete)
    await Whatsapp.update(
      { 
        status: 'merged',
        name: `[MERGED] ${phoneNumber}`
      },
      { where: { id: oldConnectionId } }
    );

    const result: ConnectionMergeResult = {
      mergedTickets: ticketsUpdated || 0,
      mergedMessages: messagesUpdated || 0,
      oldConnectionId,
      newConnectionId,
      phoneNumber
    };

    return result;
  }

  /**
   * Normaliza número de telefone para comparação
   */
  private static normalizePhoneNumber(number: string): string {
    if (!number) return '';
    
    // Remove caracteres não numéricos
    let normalized = number.replace(/\D/g, '');
    
    // Garante que comece com 55 (Brasil)
    if (normalized.length === 12 && normalized.startsWith('55')) {
      return normalized;
    }
    
    // Se tem 11 dígitos (DDD + número), adiciona 55
    if (normalized.length === 11) {
      return '55' + normalized;
    }
    
    // Se tem 10 dígitos (sem 9), adiciona 55 e 9
    if (normalized.length === 10) {
      return '55' + normalized.substring(0, 2) + '9' + normalized.substring(2);
    }
    
    return normalized;
  }

  /**
   * Recuperação imediata para o problema atual (conexão #31)
   */
  static async fixConnection31(): Promise<{ recovered: number; errors: string[] }> {
    logger.info(`[ConnectionMerge] Iniciando correção emergencial para conexão #31`);
    
    const errors: string[] = [];
    let recovered = 0;

    try {
      // 1. Verificar se conexão #31 existe
      const connection31 = await Whatsapp.findByPk(31);
      
      if (connection31) {
        logger.info(`[ConnectionMerge] Conexão #31 encontrada: ${connection31.status} - ${connection31.name}`);
        errors.push('Conexão #31 ainda existe. Verifique se está conectada.');
        return { recovered: 0, errors };
      }

      // 2. Buscar tickets com whatsappId=31
      const tickets31 = await Ticket.findAll({
        where: { whatsappId: 31 }
      });

      if (tickets31.length === 0) {
        logger.info(`[ConnectionMerge] Nenhum ticket encontrado com whatsappId=31`);
        return { recovered: 0, errors };
      }

      // 3. Buscar conexão disponível (preferencialmente #13)
      const availableConnection = await Whatsapp.findOne({
        where: {
          status: 'connected'
        },
        order: [['id', 'ASC']]
      });

      if (!availableConnection) {
        errors.push('Nenhuma conexão conectada disponível para migração');
        return { recovered: 0, errors };
      }

      logger.info(`[ConnectionMerge] Migrando ${tickets31.length} tickets para conexão #${availableConnection.id}`);

      // 4. Migrar tickets
      const [updated] = await Ticket.update(
        { whatsappId: availableConnection.id },
        { where: { whatsappId: 31 } }
      );

      recovered = updated || 0;
      
      logger.info(`[ConnectionMerge] Correção concluída: ${recovered} tickets migrados para conexão #${availableConnection.id}`);
      
    } catch (error) {
      errors.push(`Erro na correção: ${error.message}`);
      logger.error(`[ConnectionMerge] Erro na correção: ${error.message}`);
    }

    return { recovered, errors };
  }
}

export default WhatsAppConnectionMergeService;
