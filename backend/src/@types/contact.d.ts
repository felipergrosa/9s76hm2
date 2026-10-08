declare namespace Contact {
  interface Attributes {
    id?: number;
    name: string;
    number: string;
    email?: string;
    profilePicUrl?: string;
    isGroup?: boolean;
    disableBot?: boolean;
    acceptAudioMessage?: boolean;
    active?: boolean;
    channel?: string;
    companyId: number;
    remoteJid?: string;
    cpfCnpj?: string;
    representativeCode?: string;
    city?: string;
    instagram?: string;
    situation?: 'Ativo' | 'Baixado' | 'Ex-Cliente' | 'Excluido' | 'Futuro' | 'Inativo';
    fantasyName?: string;
    foundationDate?: Date;
    creditLimit?: string;
    verificationCode?: string; // Código de Verificação (referência Fluxoo)
  }

  interface CreateDTO {
    name: string;
    number: string;
    companyId: number;
    email?: string;
    cpfCnpj?: string;
    representativeCode?: string;
    city?: string;
    instagram?: string;
    situation?: 'Ativo' | 'Baixado' | 'Ex-Cliente' | 'Excluido' | 'Futuro' | 'Inativo';
    fantasyName?: string;
    foundationDate?: Date;
    creditLimit?: string;
    verificationCode?: string; // Código de Verificação (referência Fluxoo)
  }

  interface UpdateDTO {
    id?: number;
    name?: string;
    number?: string;
    email?: string;
    cpfCnpj?: string;
    representativeCode?: string;
    city?: string;
    instagram?: string;
    situation?: 'Ativo' | 'Baixado' | 'Ex-Cliente' | 'Excluido' | 'Futuro' | 'Inativo';
    fantasyName?: string;
    foundationDate?: Date;
    creditLimit?: string;
    verificationCode?: string; // Código de Verificação (referência Fluxoo)
  }

  interface FilterOptions {
    companyId: number;
    searchTerm?: string;
    page?: number;
    pageSize?: number;
    cpfCnpj?: string;
    representativeCode?: string;
    city?: string;
    situation?: 'Ativo' | 'Baixado' | 'Ex-Cliente' | 'Excluido' | 'Futuro' | 'Inativo';
  }
}
