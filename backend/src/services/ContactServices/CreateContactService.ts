import AppError from "../../errors/AppError";
import CompaniesSettings from "../../models/CompaniesSettings";
import Contact from "../../models/Contact";
import ContactCustomField from "../../models/ContactCustomField";
import logger from "../../utils/logger";
import ContactWallet from "../../models/ContactWallet";

interface ExtraInfo extends ContactCustomField {
  name: string;
  value: string;
}

interface Wallet {
  walletId: number | string;
  contactId: number | string;
  companyId: number | string;
}

interface Request {
  name: string;
  number: string;
  email?: string;
  profilePicUrl?: string;
  acceptAudioMessage?: boolean;
  active?: boolean;
  companyId: number;
  extraInfo?: ExtraInfo[];
  remoteJid?: string;
  wallets?: null | number[] | string[];
  userId?: string | number; // Adicionando o userId

  // Novos campos
  cpfCnpj?: string;
  representativeCode?: string;
  city?: string;
  region?: string;
  instagram?: string;
  situation?: 'Ativo' | 'Baixado' | 'Ex-Cliente' | 'Excluido' | 'Futuro' | 'Inativo';
  fantasyName?: string;
  foundationDate?: Date;
  creditLimit?: string;
  segment?: string;
  contactName?: string;
  florder?: boolean;
  dtUltCompra?: Date | string | null;
  vlUltCompra?: number | string | null;
  bzEmpresa?: string;
}

const CreateContactService = async ({
                                      name,
                                      number,
                                      email = "",
                                      acceptAudioMessage,
                                      active,
                                      companyId,
                                      extraInfo = [],
                                      remoteJid = "",
                                      userId,
                                      wallets,

                                      // Novos campos
                                      cpfCnpj,
                                      representativeCode,
                                      city,
                                      region,
                                      instagram,
                                      situation,
                                      fantasyName,
                                      foundationDate,
                                      creditLimit,
                                      segment,
                                      contactName,
                                      florder,
                                      dtUltCompra,
                                      vlUltCompra,
                                      bzEmpresa,
                                    }: Request): Promise<Contact> => {
  const numberExists = await Contact.findOne({
    where: { number, companyId }
  });

  if (numberExists) {
    throw new AppError("ERR_DUPLICATED_CONTACT");
  }

  // Validação de CPF/CNPJ
  if (cpfCnpj) {
    const cleanDoc = cpfCnpj.replace(/\D/g, '');
    if (![11, 14].includes(cleanDoc.length)) {
      throw new AppError("CPF/CNPJ inválido");
    }
  }

  const settings = await CompaniesSettings.findOne({
    where: { companyId }
  });

  const { acceptAudioMessageContact } = settings;

  // Função auxiliar para converter strings vazias/whitespace em null
  const emptyToNull = (value: any) => {
    if (value === undefined || value === null) return null;
    if (typeof value === 'string' && value.trim() === '') return null;
    return value;
  };

  // Definindo a interface para o contactData incluindo o userId como opcional

  // Validação da data de fundação
  let foundationDateValue: Date | null = null;
  if (foundationDate && typeof foundationDate === 'string' && foundationDate !== '') {
    const date = new Date(foundationDate);
    if (isNaN(date.getTime())) {
      throw new AppError("INVALID_FOUNDATION_DATE");
    } else {
      foundationDateValue = date;
    }
  }

  // Converter string vazia para null para foundationDate
  if (typeof foundationDate === 'string' && foundationDate === '') {
    foundationDateValue = null;
  }

  // Validação/normalização da data de última compra
  let dtUltCompraValue: Date | null = null;
  if (dtUltCompra && typeof dtUltCompra === 'string' && dtUltCompra !== '') {
    const d = new Date(dtUltCompra);
    if (isNaN(d.getTime())) {
      throw new AppError("INVALID_LAST_PURCHASE_DATE");
    } else {
      dtUltCompraValue = d;
    }
  }
  if (typeof dtUltCompra === 'string' && dtUltCompra === '') {
    dtUltCompraValue = null;
  }

  // Normalização do valor da última compra (aceita string BRL)
  const MAX_LAST_PURCHASE = 10000000000; // 10 bilhões (limite DECIMAL(12,2))

  const parseMoney = (val: any): number | null => {
    if (val === undefined || val === null || val === '') return null;
    if (typeof val === 'number') return val;
    const cleaned = String(val)
      .replace(/\s+/g, '')
      .replace(/R\$?/gi, '')
      .replace(/\./g, '')
      .replace(',', '.');
    const num = parseFloat(cleaned);
    if (isNaN(num)) return null;
    if (Math.abs(num) >= MAX_LAST_PURCHASE) {
      throw new AppError("INVALID_LAST_PURCHASE_AMOUNT");
    }
    return num;
  };
  const vlUltCompraValue = parseMoney(vlUltCompra as any);

  const contactData: {
    name: string;
    number: string;
    email: string;
    acceptAudioMessage: boolean;
    active: boolean;
    extraInfo: ExtraInfo[];
    companyId: number;
    remoteJid: string;
    cpfCnpj: string | null;
    representativeCode: string | null;
    city: string | null;
    region: string | null;
    instagram: string | null;
    situation: string;
    fantasyName: string | null;
    foundationDate: Date | null;
    creditLimit: string | null;
    userId?: number | string;
    segment: string | null;
    contactName?: string | null;
    florder?: boolean;
    dtUltCompra?: Date | null;
    vlUltCompra?: number | null;
    bzEmpresa?: string | null;
  } = {
    name: name || '',
    number: number || '',
    email: (() => {
      if (email === undefined || email === null) return '';
      const e = typeof email === 'string' ? email.trim() : String(email);
      return e === '' ? '' : e;
    })(),
    acceptAudioMessage: acceptAudioMessageContact === 'enabled' ? true : false,
    active: active !== undefined ? active : true,
    extraInfo: extraInfo || [],
    companyId,
    remoteJid: remoteJid || '',

    // Novos campos com tratamento para valores vazios
    cpfCnpj: emptyToNull(cpfCnpj),
    representativeCode: emptyToNull(representativeCode),
    city: emptyToNull(city),
    region: emptyToNull(region),
    instagram: emptyToNull(instagram),
    situation: situation || 'Ativo',
    fantasyName: emptyToNull(fantasyName),
    foundationDate: foundationDateValue,
    creditLimit: emptyToNull(creditLimit),
    segment: emptyToNull(segment),
    contactName: typeof contactName === 'string' ? (contactName.trim() || null) : null,
    florder: !!florder,
    dtUltCompra: dtUltCompraValue,
    vlUltCompra: vlUltCompraValue,
    bzEmpresa: emptyToNull(bzEmpresa),
  };

  // Apenas adiciona o userId se ele for fornecido
  if (userId) {
    contactData.userId = userId;
  }

  const contact = await Contact.create(contactData, {
    include: [
      "extraInfo",
      {
        association: "wallets",
        attributes: ["id", "name"]
      }
    ]
  });

  // Chama o serviço centralizado para atualizar nome/avatar com proteção
  try {
    const RefreshContactAvatarService = (await import("./RefreshContactAvatarService")).default;
    await RefreshContactAvatarService({ contactId: contact.id, companyId });
  } catch (err) {
    logger.warn("Falha ao atualizar avatar/nome centralizado", err);
  }

  // Aplica regras de tags automaticamente (forma assíncrona, não bloqueia)
  setImmediate(async () => {
    try {
      const ApplyTagRulesService = (await import("../TagServices/ApplyTagRulesService")).default;
      await ApplyTagRulesService({ companyId, contactId: contact.id });
    } catch (err) {
      logger.warn(`Falha ao aplicar regras de tags no contato ${contact.id}`, err);
    }
  });

  if (wallets) {
    await ContactWallet.destroy({
      where: {
        companyId,
        contactId: contact.id
      }
    });

    const contactWallets: Wallet[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    wallets.forEach((wallet: any) => {
      contactWallets.push({
        walletId: !wallet.id ? wallet : wallet.id,
        contactId: contact.id,
        companyId
      });
    });

    await ContactWallet.bulkCreate(contactWallets);
  }

  return contact;
};

export default CreateContactService;
