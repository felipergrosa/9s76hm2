export const expandPlaceholders = (text, contact, ticket, user) => {
  if (!text || typeof text !== 'string') return text;

  const c = contact || {};
  const t = ticket || {};
  const u = user || {};

  const safe = (v) => (v === undefined || v === null ? "" : String(v));
  
  const fullName = safe(c.name || c.contactName || c.fantasyName);
  const firstName = fullName.split(/\s+/)[0] || "";
  const lastName = fullName.split(/\s+/).slice(1).join(' ') || "";
  const number = safe(c.number);
  const email = safe(c.email);
  const city = safe(c.city);
  const cpfCnpj = safe(c.cpfCnpj);
  const representativeCode = safe(c.representativeCode);
  const segment = safe(c.segment);
  const contactIdStr = safe(c.id);

  const ticketIdStr = safe(t.id);
  const queueName = safe(t.queue?.name || t.queueName || "");
  const conexao = safe(t.whatsapp?.name || t.connectionName || "");
  const protocolo = safe(t.protocol || t.uuid || t.id || "");

  const attendant = safe(u.name || "");
  const companyName = safe(u.companyName || u.tenant?.name || c.bzEmpresa || c.companyName || "");

  // CRM / Smart Placeholders
  const company = safe(c.bzEmpresa || c.companyName || companyName || "");
  const jobTitle = safe(c.cargo || c.jobTitle || "");
  const opportunityValue = safe(c.valor_oportunidade || c.value || c.vlUltCompra || "");
  const calendarLink = safe(c.link_agenda || c.calendarLink || "");

  const now = new Date();
  const pad2 = (n) => String(n).padStart(2, '0');
  const data = `${pad2(now.getDate())}/${pad2(now.getMonth() + 1)}/${now.getFullYear()}`;
  const hora = `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
  const dataHora = `${data} ${hora}`;
  const h = now.getHours();
  const periodoDia = h < 12 ? 'manhã' : (h < 18 ? 'tarde' : 'noite');
  const saudacao = h < 12 ? 'Bom dia' : (h < 18 ? 'Boa tarde' : 'Boa noite');

  const valueMap = {
    'nome': fullName,
    'name': fullName,
    'fullname': fullName,
    'primeiro_nome': firstName,
    'first_name': firstName,
    'firstname': firstName,
    'ultimo_nome': lastName,
    'last_name': lastName,
    'lastname': lastName,
    'numero': number,
    'telefone': number,
    'whatsapp': number,
    'phone': number,
    'email': email,
    'cidade': city,
    'city': city,
    'cpf_cnpj': cpfCnpj,
    'cnpj_cpf': cpfCnpj,
    'representante': representativeCode,
    'representative_code': representativeCode,
    'segmento': segment,
    'segment': segment,
    'id_contato': contactIdStr,
    'contact_id': contactIdStr,
    'atendente': attendant,
    'agent': attendant,
    'usuario': attendant,
    'user': attendant,
    'username': attendant,
    'user_name': attendant,
    'empresa': company,
    'company': company,
    'cargo': jobTitle,
    'jobtitle': jobTitle,
    'valor': opportunityValue,
    'value': opportunityValue,
    'agenda': calendarLink,
    'calendarlink': calendarLink,
    'data': data,
    'hora': hora,
    'protocolo': protocolo,
    'protocol': protocolo,
    'queue': queueName,
    'fila': queueName,
    'conexao': conexao,
    'connection': conexao,
    'ticket': ticketIdStr,
    'ticket_id': ticketIdStr,
    'data_hora': dataHora,
    'ms': saudacao,
    'greeting': saudacao,
    'saudacao': saudacao,
    'periodo_dia': periodoDia,
    'periodo-dia': periodoDia,
  };

  const normalizeKey = (k) =>
    String(k || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}+/gu, '')
      .trim();

  return text.replace(/\{\{\s*([^}]+?)\s*\}\}|\{\s*([^}]+?)\s*\}/g, (m, k1, k2) => {
    const key = normalizeKey(k1 || k2);
    const val = valueMap[key];
    return val !== undefined ? val : m; // Mantém o token se não encontrar, ou ""? 
    // O MessageInput original usava "" para tokens não encontrados.
  }).replace(/\{\{\s*([^}]+?)\s*\}\}|\{\s*([^}]+?)\s*\}/g, (m, k1, k2) => {
      // Segunda passada para garantir que limpamos se não houver valor
      const key = normalizeKey(k1 || k2);
      const val = valueMap[key];
      return val !== undefined ? val : "";
  });
};
