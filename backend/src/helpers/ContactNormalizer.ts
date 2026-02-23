/**
 * ContactNormalizer - Normalização e variações de números de telefone
 * 
 * Integra:
 * - Normalização E.164 (da proposta)
 * - Variações para busca (da proposta)
 * - Validações robustas (do sistema atual)
 * - LID handling (do sistema atual)
 */

import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { safeNormalizePhoneNumber, isRealPhoneNumber, MAX_PHONE_DIGITS } from '../utils/phone';

export interface NormalizedContact {
  number: string;           // Número normalizado (dígitos apenas)
  canonicalNumber: string;  // Número canônico (para busca)
  jid: string;              // JID completo (@s.whatsapp.net ou @g.us)
  isGroup: boolean;         // Se é grupo
  isLid: boolean;           // Se é LID
  groupId?: string;         // ID do grupo (se aplicável)
}

export interface ContactVariations {
  primary: string;          // Número principal
  canonical: string;        // Número canônico
  variations: string[];     // Todas variações possíveis
}

class ContactNormalizer {
  /**
   * Normaliza JID do WhatsApp para estrutura consistente
   */
  static normalize(jid: string): NormalizedContact {
    if (!jid || typeof jid !== 'string') {
      throw new Error('JID inválido');
    }

    const cleaned = jid.trim();

    // Detecta tipo pelo sufixo
    const isGroup = cleaned.endsWith('@g.us');
    const isLid = cleaned.endsWith('@lid');
    const isNewsletter = cleaned.endsWith('@newsletter');
    const isBroadcast = cleaned.endsWith('@broadcast');

    // Extrai o identificador (antes do @)
    let rawId = cleaned.split('@')[0];
    const suffix = cleaned.split('@')[1] || '';

    // Para grupos, retorna estrutura específica
    if (isGroup) {
      const groupId = rawId.replace(/\D/g, '');
      return {
        number: groupId,
        canonicalNumber: groupId,
        jid: `${groupId}@g.us`,
        isGroup: true,
        isLid: false,
        groupId
      };
    }

    // Para LIDs, retorna estrutura específica (não normaliza como telefone)
    if (isLid) {
      return {
        number: `PENDING_${cleaned}`, // Identificador temporário
        canonicalNumber: '',
        jid: cleaned,
        isGroup: false,
        isLid: true
      };
    }

    // Para contatos individuais, normaliza o número
    const digitsOnly = rawId.replace(/\D/g, '');

    // VALIDAÇÃO: Rejeitar números muito longos (LIDs disfarçados)
    if (digitsOnly.length > MAX_PHONE_DIGITS) {
      // Parece ser LID ou ID interno da Meta
      return {
        number: `PENDING_${digitsOnly}@lid`,
        canonicalNumber: '',
        jid: `${digitsOnly}@lid`,
        isGroup: false,
        isLid: true
      };
    }

    // Usar normalização existente (mais robusta que libphonenumber-js sozinho)
    const { canonical, digits } = safeNormalizePhoneNumber(digitsOnly);

    // Tentar melhorar com libphonenumber-js se disponível
    let normalizedNumber = digits;
    try {
      const parsed = parsePhoneNumberFromString(`+${digits}`);
      if (parsed && parsed.isValid()) {
        normalizedNumber = parsed.nationalNumber; // Sem código do país
      }
    } catch {
      // Manter normalização existente
    }

    return {
      number: normalizedNumber,
      canonicalNumber: canonical,
      jid: `${digits}@s.whatsapp.net`,
      isGroup: false,
      isLid: false
    };
  }

  /**
   * Gera variações possíveis de um número para busca
   * 
   * Exemplo: 5511998765432 → [
   *   '5511998765432',  // Original
   *   '11998765432',    // Sem 55
   *   '551198765432',   // Sem o 9
   *   '1198765432',     // Sem 55 e sem 9
   *   '998765432',      // Apenas número
   * ]
   */
  static getVariations(number: string): ContactVariations {
    const cleaned = number.replace(/\D/g, '');
    const variations = new Set<string>([cleaned]);

    // Se for LID ou muito longo, não gerar variações
    if (cleaned.length > MAX_PHONE_DIGITS) {
      return {
        primary: cleaned,
        canonical: cleaned,
        variations: [cleaned]
      };
    }

    // Normalização canônica
    const { canonical } = safeNormalizePhoneNumber(cleaned);
    variations.add(canonical);

    // Variações Brasil (55 + DDD + 9 + 8 dígitos)
    if (cleaned.startsWith('55')) {
      const withoutCountry = cleaned.substring(2);
      variations.add(withoutCountry);

      // Com 9 dígitos: 5511998765432 → 551198765432
      if (withoutCountry.length === 11 && withoutCountry[2] === '9') {
        const without9 = withoutCountry.substring(0, 2) + withoutCountry.substring(3);
        variations.add(without9);
        variations.add(`55${without9}`);
      }
    } else if (cleaned.length <= 11) {
      // Sem 55: adicionar
      variations.add(`55${cleaned}`);

      // Com 9 dígitos locais
      if (cleaned.length === 11 && cleaned[2] === '9') {
        const without9 = cleaned.substring(0, 2) + cleaned.substring(3);
        variations.add(without9);
        variations.add(`55${without9}`);
      }
    }

    // Variações internacionais (apenas remover código do país se presente)
    if (cleaned.length > 10 && !cleaned.startsWith('55')) {
      // Assumir que os primeiros 2-3 dígitos são código do país
      for (let i = 2; i <= 3; i++) {
        const withoutCountry = cleaned.substring(i);
        if (withoutCountry.length >= 8) {
          variations.add(withoutCountry);
        }
      }
    }

    return {
      primary: cleaned,
      canonical,
      variations: Array.from(variations)
    };
  }

  /**
   * Extrai informações do JID
   */
  static parseJid(jid: string): {
    type: 'individual' | 'group' | 'lid' | 'broadcast' | 'newsletter';
    id: string;
    suffix: string;
  } {
    if (!jid || typeof jid !== 'string') {
      return { type: 'individual', id: '', suffix: '' };
    }

    const [id, suffix] = jid.split('@');

    if (suffix === 'g.us') return { type: 'group', id, suffix };
    if (suffix === 'lid') return { type: 'lid', id, suffix };
    if (suffix === 'newsletter') return { type: 'newsletter', id, suffix };
    if (suffix === 'broadcast') return { type: 'broadcast', id, suffix };
    
    return { type: 'individual', id, suffix: suffix || 's.whatsapp.net' };
  }

  /**
   * Verifica se dois números são equivalentes (considerando variações)
   */
  static areEquivalent(number1: string, number2: string): boolean {
    const variations1 = this.getVariations(number1);
    const variations2 = this.getVariations(number2);

    // Se algum número de variations1 está em variations2, são equivalentes
    return variations1.variations.some(v => variations2.variations.includes(v));
  }

  /**
   * Valida se um número pode ser salvo como telefone
   */
  static isValidPhoneNumber(number: string): boolean {
    const digits = number.replace(/\D/g, '');
    
    // Rejeitar LIDs
    if (digits.length > MAX_PHONE_DIGITS) return false;
    
    // Validar formato
    return isRealPhoneNumber(digits);
  }
}

export default ContactNormalizer;
