import AppError from "../../errors/AppError";
import Contact from "../../models/Contact";
import ContactCustomField from "../../models/ContactCustomField";
import ContactWallet from "../../models/ContactWallet";

interface ExtraInfo {
  id?: number;
  name: string;
  value: string;
}

interface Wallet {
  walletId: number | string;
  contactId: number | string;
  companyId: number | string;
}

interface ContactData {
  email?: string;
  number?: string;
  name?: string;
  contactName?: string;
  acceptAudioMessage?: boolean;
  active?: boolean;
  extraInfo?: ExtraInfo[];
  disableBot?: boolean;
  remoteJid?: string;
  wallets?: null | number[] | string[];

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
  florder?: boolean;
  vlUltCompra?: number | string | null;
  dtUltCompra?: Date | string | null;
  bzEmpresa?: string;
}

interface Request {
  contactData: ContactData;
  contactId: string;
  companyId: number;
  userId?: number;
}

const UpdateContactService = async ({
                                      contactData,
                                      contactId,
                                      companyId,
                                      userId
                                    }: Request): Promise<Contact> => {
  const {
    email,
    name,
    contactName,
    number,
    extraInfo,
    acceptAudioMessage,
    active,
    disableBot,
    remoteJid,
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
    florder,
    vlUltCompra,
    dtUltCompra,
    bzEmpresa
  } = contactData;

  const sanitizedCreditLimit = creditLimit !== undefined ? creditLimit : null;

  // Validação de CPF/CNPJ
  if (cpfCnpj) {
    const cleanDoc = cpfCnpj.replace(/\D/g, '');
    if (![11, 14].includes(cleanDoc.length)) {
      throw new AppError("CPF/CNPJ inválido");
    }
  }

  // Validação da data de fundação
  let foundationDateValue: Date | null = null;
  if (contactData.foundationDate && typeof contactData.foundationDate === 'string' && contactData.foundationDate !== '') {
    const date = new Date(contactData.foundationDate);
    if (isNaN(date.getTime())) {
      throw new AppError("INVALID_FOUNDATION_DATE");
    } else {
      foundationDateValue = date;
    }
  }

  // Converter string vazia para null para foundationDate
  if (typeof contactData.foundationDate === 'string' && contactData.foundationDate === '') {
    foundationDateValue = null;
  }

  // Normalização da data de última compra
  let lastPurchaseValue: Date | null = null;
  if (dtUltCompra && typeof dtUltCompra === 'string' && dtUltCompra !== '') {
    const d = new Date(dtUltCompra);
    if (isNaN(d.getTime())) {
      throw new AppError("INVALID_LAST_PURCHASE_DATE");
    } else {
      lastPurchaseValue = d;
    }
  }
  if (typeof dtUltCompra === 'string' && dtUltCompra === '') {
    lastPurchaseValue = null;
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

  const contact = await Contact.findOne({
    where: { id: contactId },
    attributes: [
      "id", "name", "number", "channel", "email", "companyId",
      "acceptAudioMessage", "active", "disableBot", "profilePicUrl", "remoteJid",
      "urlPicture", "florder", "contactName",
      // Adicionar novos campos aos atributos
      "cpfCnpj", "representativeCode", "city", "region", "instagram",
      "situation", "fantasyName", "foundationDate", "creditLimit", "segment", "dtUltCompra", "vlUltCompra"
    ],
    include: ["extraInfo", "tags",
      {
        association: "wallets",
        attributes: ["id", "name"]
      }]
  });

  if (contact?.companyId !== companyId) {
    throw new AppError("Não é possível alterar registros de outra empresa");
  }

  if (!contact) {
    throw new AppError("ERR_NO_CONTACT_FOUND", 404);
  }

  if (extraInfo) {
    await Promise.all(
      extraInfo.map(async (info: any) => {
        await ContactCustomField.upsert({ ...info, contactId: contact.id });
      })
    );

    await Promise.all(
      contact.extraInfo.map(async oldInfo => {
        const stillExists = extraInfo.findIndex(info => info.id === oldInfo.id);

        if (stillExists === -1) {
          await ContactCustomField.destroy({ where: { id: oldInfo.id } });
        }
      })
    );
  }

  if (wallets) {
    await ContactWallet.destroy({
      where: {
        companyId,
        contactId
      }
    });

    const contactWallets: Wallet[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    wallets.forEach((wallet: any) => {
      contactWallets.push({
        walletId: !wallet.id ? wallet : wallet.id,
        contactId,
        companyId
      });
    });

    await ContactWallet.bulkCreate(contactWallets);
  }

  // Função auxiliar para converter strings vazias/whitespace em null
  const emptyToNull = (value: any) => {
    if (value === undefined || value === null) return null;
    if (typeof value === 'string' && value.trim() === '') return null;
    return value;
  };

  // Proteção de nome: preservar nome personalizado já válido
  const currentName = (contact.name || "").trim();
  const currentIsNumber = currentName.replace(/\D/g, "") === String(contact.number);
  const hasValidExistingName = currentName !== "" && !currentIsNumber;

  let resolvedName = contact.name;
  if (name === undefined) {
    resolvedName = contact.name; // sem alteração do campo name
  } else {
    const incomingName = (name || "").trim();
    const incomingIsNumber = incomingName.replace(/\D/g, "") === String(number ?? contact.number);

    if (hasValidExistingName) {
      // Só aceitar alteração se o novo nome for explicitamente válido (não vazio e não igual ao número)
      if (incomingName && !incomingIsNumber) {
        resolvedName = incomingName;
      } else {
        resolvedName = contact.name; // ignora tentativa inválida
      }
    } else {
      // Nome atual é vazio ou igual ao número: aceitar um nome melhor, senão manter número
      resolvedName = incomingName && !incomingIsNumber ? incomingName : String(number ?? contact.number);
    }
  }

  const updateData: any = {
    name: resolvedName,
    number: number !== undefined ? number : contact.number,
    contactName: contactName !== undefined ? emptyToNull(contactName) : (contact as any).contactName,
    // Email: nunca salvar como null (modelo não permite). Vazio => "".
    email: email !== undefined
      ? (email === null ? "" : (typeof email === "string" ? email.trim() : (contact.email ?? "")))
      : (contact.email ?? ""),
    acceptAudioMessage: acceptAudioMessage !== undefined ? acceptAudioMessage : contact.acceptAudioMessage,
    active: active !== undefined ? active : contact.active,
    disableBot: disableBot !== undefined ? disableBot : contact.disableBot,
    remoteJid: remoteJid !== undefined ? remoteJid : contact.remoteJid,
    
    // Novos campos com tratamento para valores vazios
    cpfCnpj: cpfCnpj !== undefined ? emptyToNull(cpfCnpj) : contact.cpfCnpj,
    representativeCode: representativeCode !== undefined ? emptyToNull(representativeCode) : contact.representativeCode,
    city: city !== undefined ? emptyToNull(city) : contact.city,
    region: region !== undefined ? emptyToNull(region) : (contact as any).region,
    instagram: instagram !== undefined ? emptyToNull(instagram) : contact.instagram,
    situation: situation !== undefined ? situation : contact.situation || 'Ativo',
    fantasyName: fantasyName !== undefined ? emptyToNull(fantasyName) : contact.fantasyName,
    foundationDate: foundationDateValue,
    creditLimit: creditLimit !== undefined ? emptyToNull(creditLimit) : contact.creditLimit,
    segment: segment !== undefined ? emptyToNull(segment) : (contact as any).segment,
    vlUltCompra: vlUltCompra !== undefined ? vlUltCompraValue : (contact as any).vlUltCompra,
    dtUltCompra: dtUltCompra !== undefined ? lastPurchaseValue : (contact as any).dtUltCompra,
    florder: florder !== undefined ? !!florder : (contact as any).florder,
    bzEmpresa: bzEmpresa !== undefined ? emptyToNull(bzEmpresa) : (contact as any).bzEmpresa,
  };

  // Apenas atualiza o userId se ele for fornecido
  if (userId) {
    updateData.userId = userId;
  }

  await contact.update(updateData);

  // Chama o serviço centralizado para atualizar nome/avatar com proteção
  try {
    const RefreshContactAvatarService = (await import("./RefreshContactAvatarService")).default;
    await RefreshContactAvatarService({ contactId: contact.id, companyId });
  } catch (err) {
    console.warn("Falha ao atualizar avatar/nome centralizado", err);
  }

  // Aplica regras de tags automaticamente (forma assíncrona, não bloqueia)
  setImmediate(async () => {
    try {
      const ApplyTagRulesService = (await import("../TagServices/ApplyTagRulesService")).default;
      await ApplyTagRulesService({ companyId, contactId: contact.id });
    } catch (err) {
      console.warn(`Falha ao aplicar regras de tags no contato ${contact.id}`, err);
    }
  });

  await contact.reload({
    attributes: [
      "id", "name", "number", "channel", "email", "companyId",
      "acceptAudioMessage", "active", "disableBot", "profilePicUrl", "remoteJid",
      "urlPicture", "florder", "vlUltCompra", "contactName",
      // Adicionar novos campos aos atributos
      "cpfCnpj", "representativeCode", "city", "region", "instagram",
      "situation", "fantasyName", "foundationDate", "creditLimit", "segment", "dtUltCompra", "bzEmpresa"
    ],
    include: ["extraInfo", "tags",
      {
        association: "wallets",
        attributes: ["id", "name"]
      }]
  });

  return contact;
};

export default UpdateContactService;
