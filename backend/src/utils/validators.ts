export const isValidCPF = (cpf: string): boolean => {
  if (!cpf) return false;
  const cpfDigits = cpf.replace(/\D/g, '');
  if (cpfDigits.length !== 11 || /^(\d)\1{10}$/.test(cpfDigits)) {
    return false;
  }
  let sum = 0;
  let remainder: number;
  for (let i = 1; i <= 9; i++) {
    sum += parseInt(cpfDigits.substring(i - 1, i)) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) {
    remainder = 0;
  }
  if (remainder !== parseInt(cpfDigits.substring(9, 10))) {
    return false;
  }
  sum = 0;
  for (let i = 1; i <= 10; i++) {
    sum += parseInt(cpfDigits.substring(i - 1, i)) * (12 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) {
    remainder = 0;
  }
  if (remainder !== parseInt(cpfDigits.substring(10, 11))) {
    return false;
  }
  return true;
};

export const isValidCNPJ = (cnpj: string): boolean => {
  if (!cnpj) return false;
  const cnpjDigits = cnpj.replace(/\D/g, '');
  if (cnpjDigits.length !== 14 || /^(\d)\1{13}$/.test(cnpjDigits)) {
    return false;
  }
  let size = cnpjDigits.length - 2;
  let numbers = cnpjDigits.substring(0, size);
  const digits = cnpjDigits.substring(size);
  let sum = 0;
  let pos = size - 7;
  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i)) * pos--;
    if (pos < 2) {
      pos = 9;
    }
  }
  let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(0))) {
    return false;
  }
  size += 1;
  numbers = cnpjDigits.substring(0, size);
  sum = 0;
  pos = size - 7;
  for (let i = size; i >= 1; i--) {
    sum += parseInt(numbers.charAt(size - i)) * pos--;
    if (pos < 2) {
      pos = 9;
    }
  }
  result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
  if (result !== parseInt(digits.charAt(1))) {
    return false;
  }
  return true;
};

export const isValidEmailFormat = (email: string): boolean => {
  if (!email) return false;
  const e = String(email).trim();
  // Regex pragmática (não perfeita por RFC, mas segura para validação de cadastro)
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
  return re.test(e);
};

export const hasMxRecord = async (email: string): Promise<boolean> => {
  try {
    const e = String(email).trim();
    const at = e.lastIndexOf("@");
    if (at <= 0 || at === e.length - 1) return false;
    const domain = e.slice(at + 1);
    // Import dinâmico para não quebrar ambientes sem dns/promises
    const dns = await import("node:dns/promises");
    const records = await dns.resolveMx(domain);
    return Array.isArray(records) && records.length > 0;
  } catch {
    return false;
  }
};
