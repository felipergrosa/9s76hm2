/**
 * Otimizador de queries para reduzir uso de memória
 * Aplica limites, paginação e limpeza de recursos
 */

import { Op } from "sequelize";

/**
 * Configurações de paginação padrão
 */
export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 200;

/**
 * Limita o tamanho da página para evitar queries muito grandes
 */
export function limitPageSize(limit?: number): number {
  if (!limit || limit <= 0) return DEFAULT_PAGE_SIZE;
  return Math.min(limit, MAX_PAGE_SIZE);
}

/**
 * Calcula offset para paginação
 */
export function calculateOffset(page?: number, limit?: number): number {
  const validPage = Math.max(1, page || 1);
  const validLimit = limitPageSize(limit);
  return (validPage - 1) * validLimit;
}

/**
 * Atributos mínimos para queries de listagem (reduz memória)
 */
export const MINIMAL_TICKET_ATTRIBUTES = [
  "id",
  "uuid",
  "status",
  "lastMessage",
  "updatedAt",
  "unreadMessages",
  "contactId",
  "userId",
  "queueId",
  "whatsappId",
  "companyId"
];

export const MINIMAL_MESSAGE_ATTRIBUTES = [
  "id",
  "body",
  "fromMe",
  "read",
  "mediaType",
  "mediaUrl",
  "createdAt",
  "ticketId",
  "contactId",
  "quotedMsgId"
];

export const MINIMAL_CONTACT_ATTRIBUTES = [
  "id",
  "name",
  "number",
  "profilePicUrl",
  "isGroup"
];

/**
 * Limpa objetos grandes da memória após uso
 */
export function cleanupLargeObject(obj: any): void {
  if (!obj) return;
  
  try {
    // Limpar propriedades grandes
    Object.keys(obj).forEach(key => {
      if (obj[key] && typeof obj[key] === 'object') {
        delete obj[key];
      }
    });
  } catch (e) {
    // Ignorar erros de limpeza
  }
}

/**
 * Processa resultados em lotes para evitar sobrecarga de memória
 */
export async function processBatch<T>(
  items: T[],
  batchSize: number,
  processor: (batch: T[]) => Promise<void>
): Promise<void> {
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    await processor(batch);
    
    // Limpar batch da memória
    batch.length = 0;
  }
}

/**
 * Cria condição de data otimizada para queries
 */
export function createDateRangeCondition(
  field: string,
  daysAgo?: number
): any {
  if (!daysAgo || daysAgo <= 0) return {};
  
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  
  return {
    [field]: {
      [Op.gte]: date
    }
  };
}

/**
 * Limita resultados de queries para evitar memory leak
 */
export function addQueryLimits(options: any): any {
  return {
    ...options,
    limit: limitPageSize(options.limit),
    subQuery: false, // Evita subqueries pesadas
    benchmark: process.env.NODE_ENV === 'development', // Benchmark apenas em dev
  };
}
