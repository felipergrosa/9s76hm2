/**
 * VALIDAÇÕES SEGURAS - Proteções contra valores nulos
 * Helper para adicionar validações sem modificar código existente
 */
import logger from "../../utils/logger";

/**
 * Verifica se um objeto é válido e não nulo
 */
export function isValidObject(obj: any): obj is object {
  return obj !== null && obj !== undefined && typeof obj === 'object';
}

/**
 * Verifica se um ticket é válido
 */
export function isValidTicket(ticket: any): boolean {
  if (!isValidObject(ticket)) return false;
  
  // Verifica campos essenciais
  const requiredFields = ['id', 'contactId', 'companyId'];
  for (const field of requiredFields) {
    if (ticket[field] === null || ticket[field] === undefined) {
      logger.warn(`[Validation] Ticket inválido: campo ${field} é nulo`);
      return false;
    }
  }
  
  return true;
}

/**
 * Verifica se um contato é válido
 */
export function isValidContact(contact: any): boolean {
  if (!isValidObject(contact)) return false;
  
  // Verifica campos essenciais
  if (contact.id === null || contact.id === undefined) {
    logger.warn(`[Validation] Contato inválido: id é nulo`);
    return false;
  }
  
  if (contact.companyId === null || contact.companyId === undefined) {
    logger.warn(`[Validation] Contato inválido: companyId é nulo`);
    return false;
  }
  
  return true;
}

/**
 * Verifica se uma mensagem é válida
 */
export function isValidMessage(message: any): boolean {
  if (!isValidObject(message)) return false;
  
  // Verifica campos essenciais
  const requiredFields = ['id', 'body', 'ticketId', 'contactId', 'companyId'];
  for (const field of requiredFields) {
    if (message[field] === null || message[field] === undefined) {
      logger.warn(`[Validation] Mensagem inválida: campo ${field} é nulo`);
      return false;
    }
  }
  
  return true;
}

/**
 * Validação segura para números de telefone
 */
export function isValidPhoneNumber(number: string): boolean {
  if (!number || typeof number !== 'string') {
    return false;
  }
  
  // Remove caracteres não numéricos
  const cleanNumber = number.replace(/\D/g, '');
  
  // Verifica se tem entre 10 e 15 dígitos
  return cleanNumber.length >= 10 && cleanNumber.length <= 15;
}

/**
 * Validação segura para LID
 */
export function isValidLid(lid: string): boolean {
  if (!lid || typeof lid !== 'string') {
    return false;
  }
  
  // LID deve terminar com @lid
  return lid.endsWith('@lid') && lid.length > 10;
}

/**
 * Wrapper para funções que precisam de validação
 */
export async function withValidatedInputs<T>(
  validations: Array<(input: any) => boolean>,
  operation: (...args: any[]) => Promise<T>,
  ...inputs: any[]
): Promise<T | null> {
  // Valida cada input
  for (let i = 0; i < inputs.length; i++) {
    if (validations[i] && !validations[i](inputs[i])) {
      logger.error(`[Validation] Input ${i} falhou na validação`);
      return null;
    }
  }
  
  try {
    return await operation(...inputs);
  } catch (error) {
    logger.error(`[Validation] Erro na operação: ${error.message}`);
    return null;
  }
}

/**
 * Sanitiza string para evitar valores nulos/undefined
 */
export function sanitizeString(value: any): string {
  if (value === null || value === undefined) {
    return '';
  }
  
  if (typeof value !== 'string') {
    return String(value);
  }
  
  return value.trim();
}

/**
 * Sanitiza número para evitar valores nulos/undefined
 */
export function sanitizeNumber(value: any): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  
  const num = Number(value);
  return isNaN(num) ? null : num;
}

/**
 * Cria um objeto seguro com valores padrão
 */
export function createSafeObject<T>(defaults: Partial<T>, data: any): T {
  const result = { ...defaults };
  
  if (!isValidObject(data)) {
    return result as T;
  }
  
  for (const key in defaults) {
    if (key in data && data[key] !== null && data[key] !== undefined) {
      result[key] = data[key];
    }
  }
  
  return result as T;
}

/**
 * Validação de array seguro
 */
export function isValidArray(array: any): array is any[] {
  return Array.isArray(array) && array.length > 0;
}

/**
 * Validação de ID seguro
 */
export function isValidId(id: any): boolean {
  return id !== null && id !== undefined && 
         (typeof id === 'number' ? id > 0 : typeof id === 'string' ? id.length > 0 : false);
}
