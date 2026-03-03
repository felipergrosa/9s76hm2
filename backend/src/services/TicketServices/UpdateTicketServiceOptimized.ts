// OTIMIZAÇÕES DE CÓDIGO PARA UpdateTicketService
// Substituir partes do arquivo existente

// 1. Cache simples para tickets (evitar consultas repetidas)
const ticketCache = new Map<string, { ticket: any; timestamp: number }>();
const CACHE_TTL = 5000; // 5 segundos

// 2. Função otimizada para buscar ticket (com cache)
const getTicketCached = async (id: string | number, companyId: number): Promise<Ticket> => {
  const cacheKey = `${companyId}-${id}`;
  const cached = ticketCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.ticket;
  }
  
  // Consulta simplificada - apenas campos essenciais para updates
  const ticket = await Ticket.findOne({
    where: { id, companyId },
    include: [
      {
        model: Contact,
        as: "contact",
        attributes: ["id", "name", "number", "remoteJid"]
      },
      {
        model: User,
        as: "user",
        attributes: ["id", "name"]
      },
      {
        model: Queue,
        as: "queue",
        attributes: ["id", "name", "color"]
      },
      {
        model: Whatsapp,
        as: "whatsapp",
        attributes: ["id", "status"]
      }
    ]
  });
  
  if (ticket) {
    ticketCache.set(cacheKey, { ticket, timestamp: Date.now() });
  }
  
  return ticket;
};

// 3. Emitir eventos de forma assíncrona (não bloquear)
const emitTicketEventsAsync = async (
  companyId: number,
  ticketId: number,
  ticketUuid: string,
  ticket: any,
  oldStatus: string
) => {
  // Usar setImmediate para não bloquear
  setImmediate(() => {
    ticketEventBus.publishTicketDeleted(companyId, ticketId, ticketUuid, oldStatus);
    ticketEventBus.publishTicketUpdated(companyId, ticketId, ticketUuid, ticket);
  });
};

// 4. Enviar mensagem WhatsApp de forma assíncrona (não bloquear)
const sendWhatsAppMessageAsync = async (body: string, ticket: Ticket) => {
  if (!ticket.whatsapp?.status === 'CONNECTED') return;
  
  setImmediate(async () => {
    try {
      const sentMessage = await SendWhatsAppMessage({ body, ticket, isForwarded: false });
      await verifyMessage(sentMessage, ticket, ticket.contact);
    } catch (error) {
      logger.error(`[UpdateTicketService] Erro ao enviar mensagem WhatsApp:`, error);
    }
  });
};

// 5. Criar logs de forma assíncrona (em lote)
const logQueue = [];
let logTimeout = null;

const flushLogQueue = async () => {
  if (logQueue.length === 0) return;
  
  const logsToCreate = [...logQueue];
  logQueue.length = 0;
  
  try {
    // Criar todos logs em batch (se suportado pelo seu ORM)
    await Promise.all(logsToCreate.map(logData => 
      CreateLogTicketService(logData).catch(err => 
        logger.error('[UpdateTicketService] Erro ao criar log:', err)
      )
    ));
  } catch (error) {
    logger.error('[UpdateTicketService] Erro ao criar lote de logs:', error);
  }
};

const queueLog = (logData: any) => {
  logQueue.push(logData);
  
  if (logTimeout) {
    clearTimeout(logTimeout);
  }
  
  // Processar lote após 500ms (batch logs)
  logTimeout = setTimeout(flushLogQueue, 500);
};

// 6. Limpar cache periodicamente
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of ticketCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      ticketCache.delete(key);
    }
  }
}, CACHE_TTL);

// 7. UpdateTicketService otimizado (versão simplificada)
export const UpdateTicketServiceOptimized = async ({
  ticketData,
  ticketId,
  companyId
}: Request): Promise<Response> => {
  const startTime = Date.now();
  
  try {
    const io = getIO();
    
    // Buscar ticket com cache
    let ticket = await getTicketCached(ticketId, companyId);
    const oldStatus = ticket?.status;
    const oldUserId = ticket.user?.id;
    const oldQueueId = ticket?.queueId;
    
    // Marcar mensagens como lidas (se necessário)
    if (ticket.channel === "whatsapp" && ticket.whatsappId) {
      SetTicketMessagesAsRead(ticket).catch(err => 
        logger.error('[UpdateTicketService] Erro ao marcar mensagens lidas:', err)
      );
    }
    
    // Processar dados do ticket
    const { status, userId, queueId, sendFarewellMessage = true } = ticketData;
    
    // Enviar mensagem de despedida de forma assíncrona
    if (status === "closed" && sendFarewellMessage && !ticket.isGroup) {
      const settings = await CompaniesSettings.findOne({ where: { companyId } });
      const user = ticket.user;
      
      let body = user?.farewellMessage || settings?.complationMessage || '';
      if (body) {
        sendWhatsAppMessageAsync(`\u200e ${body}`, ticket);
      }
    }
    
    // Atualizar tracking de forma assíncrona
    const ticketTraking = await FindOrCreateATicketTrakingService({ 
      ticketId, 
      companyId, 
      whatsappId: ticket.whatsappId, 
      userId: oldUserId 
    });
    
    if (status === "closed") {
      ticketTraking.finishedAt = moment().toDate();
      ticketTraking.closedAt = moment().toDate();
      queueLog({ userId: oldUserId, queueId: oldQueueId, ticketId, type: "closed" });
    }
    
    await ticketTraking.save();
    
    // Update principal no banco
    await ticket.update({
      status,
      queueId,
      userId,
      lastMessage: ticketData.lastMessage || ticket.lastMessage,
      unreadMessages: ticketData.unreadMessages
    });
    
    // Invalidar cache
    ticketCache.delete(`${companyId}-${ticketId}`);
    
    // Buscar ticket completo para emissão (apenas se necessário)
    const ticketForEmit = await ShowTicketService(ticket.id, companyId);
    
    // Emitir eventos de forma assíncrona
    emitTicketEventsAsync(companyId, ticket.id, ticket.uuid, ticketForEmit, oldStatus);
    
    // Processar logs em lote
    if (status === "pending") {
      queueLog({ userId: oldUserId, ticketId, type: "pending" });
    } else if (status === "open") {
      queueLog({ userId, ticketId, queueId: ticket.queueId, type: "open" });
    }
    
    const duration = Date.now() - startTime;
    logger.debug(`[UpdateTicketService] Ticket ${ticketId} atualizado em ${duration}ms`);
    
    return { ticket: ticketForEmit, oldStatus, oldUserId };
    
  } catch (err) {
    logger.error(`[UpdateTicketService] Erro ao atualizar ticket ${ticketId}:`, err);
    Sentry.captureException(err);
    throw err;
  }
};
