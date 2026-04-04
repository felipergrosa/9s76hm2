import { Op, UniqueConstraintError } from "sequelize";
import Contact from "../../models/Contact";
import { safeNormalizePhoneNumber } from "../../utils/phone";

interface Request {
  participantJid: string;
  participantName?: string | null;
  participantNumber?: string | null;
  profilePicUrl?: string | null;
  companyId: number;
  whatsappId?: number | null;
}

const extractDigits = (value?: string | null): string =>
  String(value || "").replace(/\D/g, "");

const isPhoneLike = (digits: string): boolean =>
  digits.length >= 10 && digits.length <= 13;

const isMeaningfulName = (name?: string | null, number?: string | null): boolean => {
  const trimmedName = String(name || "").trim();
  if (!trimmedName || trimmedName === "Participante") {
    return false;
  }

  const nameDigits = extractDigits(trimmedName);
  const numberDigits = extractDigits(number);

  return !nameDigits || !numberDigits || nameDigits !== numberDigits;
};

const shouldReplaceName = (currentName?: string | null, currentNumber?: string | null): boolean => {
  const trimmedName = String(currentName || "").trim();
  if (!trimmedName || trimmedName === "Participante") {
    return true;
  }

  const currentNameDigits = extractDigits(trimmedName);
  const currentNumberDigits = extractDigits(currentNumber);

  return !!currentNameDigits && !!currentNumberDigits && currentNameDigits === currentNumberDigits;
};

const normalizeParticipantNumber = (participantNumber?: string | null): string | null => {
  const digits = extractDigits(participantNumber);
  if (!isPhoneLike(digits)) {
    return null;
  }

  const { canonical } = safeNormalizePhoneNumber(digits);
  return canonical || digits;
};

const buildLookupConditions = (participantJid: string, normalizedNumber: string | null) => {
  const conditions: any[] = [{ remoteJid: participantJid }, { lidJid: participantJid }];

  if (normalizedNumber) {
    conditions.push({ number: normalizedNumber }, { canonicalNumber: normalizedNumber });
  }

  return conditions;
};

const buildDesiredRemoteJid = (participantJid: string, normalizedNumber: string | null): string | undefined => {
  if (!normalizedNumber) {
    return participantJid.includes("@lid") ? undefined : participantJid;
  }

  return participantJid.includes("@lid")
    ? `${normalizedNumber}@s.whatsapp.net`
    : participantJid;
};

const UpsertParticipantContactService = async ({
  participantJid,
  participantName,
  participantNumber,
  profilePicUrl,
  companyId,
  whatsappId
}: Request): Promise<Contact | null> => {
  if (!participantJid) {
    return null;
  }

  const normalizedNumber = normalizeParticipantNumber(participantNumber);
  const meaningfulName = isMeaningfulName(participantName, normalizedNumber)
    ? String(participantName).trim()
    : "";
  const isLid = participantJid.includes("@lid");
  const desiredRemoteJid = buildDesiredRemoteJid(participantJid, normalizedNumber);
  const desiredName = meaningfulName || (normalizedNumber ? `+${normalizedNumber}` : "Participante");
  const lookupConditions = buildLookupConditions(participantJid, normalizedNumber);

  let contact = await Contact.findOne({
    where: {
      companyId,
      isGroup: false,
      [Op.or]: lookupConditions
    }
  });

  if (!contact && !normalizedNumber) {
    return null;
  }

  if (contact) {
    const nextChannels = Array.isArray(contact.channels)
      ? Array.from(new Set([...contact.channels, "whatsapp"]))
      : ["whatsapp"];

    const updateData: Record<string, any> = {};

    if (!contact.channels?.includes("whatsapp")) {
      updateData.channels = nextChannels;
    }

    if (contact.isGroupParticipant) {
      updateData.isGroupParticipant = true;
    }

    if (!contact.whatsappId && whatsappId) {
      updateData.whatsappId = whatsappId;
    }

    if (isLid) {
      if (contact.lidJid !== participantJid) {
        updateData.lidJid = participantJid;
      }

      if (desiredRemoteJid && (!contact.remoteJid || contact.remoteJid.includes("@lid"))) {
        updateData.remoteJid = desiredRemoteJid;
      }
    } else if (contact.remoteJid !== participantJid) {
      updateData.remoteJid = participantJid;
    }

    if (normalizedNumber) {
      const storedDigits = extractDigits(contact.number);
      const hasStoredPhone = isPhoneLike(storedDigits);

      if (!hasStoredPhone || storedDigits === normalizedNumber) {
        if (contact.number !== normalizedNumber) {
          updateData.number = normalizedNumber;
        }
        if (contact.canonicalNumber !== normalizedNumber) {
          updateData.canonicalNumber = normalizedNumber;
        }
      }
    }

    if (profilePicUrl && contact.profilePicUrl !== profilePicUrl) {
      updateData.profilePicUrl = profilePicUrl;
    }

    if (meaningfulName) {
      if (contact.pushName !== meaningfulName) {
        updateData.pushName = meaningfulName;
      }

      if (shouldReplaceName(contact.name, contact.number) && contact.name !== meaningfulName) {
        updateData.name = meaningfulName;
      }
    }

    if (Object.keys(updateData).length > 0) {
      await contact.update(updateData);
      await contact.reload();
    }

    return contact;
  }

  const createData: Record<string, any> = {
    name: desiredName,
    number: normalizedNumber,
    canonicalNumber: normalizedNumber,
    isGroup: false,
    isGroupParticipant: true,
    companyId,
    channels: ["whatsapp"]
  };

  if (desiredRemoteJid) {
    createData.remoteJid = desiredRemoteJid;
  }

  if (isLid) {
    createData.lidJid = participantJid;
  }

  if (profilePicUrl) {
    createData.profilePicUrl = profilePicUrl;
  }

  if (meaningfulName) {
    createData.pushName = meaningfulName;
  }

  if (whatsappId) {
    createData.whatsappId = whatsappId;
  }

  try {
    return await Contact.create(createData);
  } catch (error) {
    if (!(error instanceof UniqueConstraintError)) {
      throw error;
    }

    return Contact.findOne({
      where: {
        companyId,
        isGroup: false,
        [Op.or]: lookupConditions
      }
    });
  }
};

export default UpsertParticipantContactService;
