import User from "../models/User";

/**
 * Lista completa de permissões disponíveis no sistema
 * Organizada por categorias para facilitar manutenção
 */
export const AVAILABLE_PERMISSIONS = {
  // ÁREA PRINCIPAL (Sempre Visível)
  tickets: [
    "tickets.view",
    "tickets.create",
    "tickets.update",
    "tickets.transfer",
    "tickets.close",
    "tickets.delete"
  ],
  quickMessages: [
    "quick-messages.view",
    "quick-messages.create",
    "quick-messages.edit",
    "quick-messages.delete"
  ],
  contacts: [
    "contacts.view",
    "contacts.create",
    "contacts.edit",
    "contacts.edit-fields",
    "contacts.delete",
    "contacts.import",
    "contacts.export",
    "contacts.bulk-edit"
  ],
  tags: [
    "tags.view",
    "tags.create",
    "tags.edit",
    "tags.delete"
  ],
  helps: [
    "helps.view"
  ],

  // GESTÃO/DASHBOARD
  dashboard: [
    "dashboard.view",
    "reports.view",
    "realtime.view"
  ],

  // CAMPANHAS
  campaigns: [
    "campaigns.view",
    "campaigns.create",
    "campaigns.edit",
    "campaigns.delete",
    "contact-lists.view",
    "contact-lists.create",
    "contact-lists.edit",
    "contact-lists.delete",
    "campaigns-config.view"
  ],

  // FLOWBUILDER
  flowbuilder: [
    "flowbuilder.view",
    "flowbuilder.create",
    "flowbuilder.edit",
    "flowbuilder.delete",
    "phrase-campaigns.view",
    "phrase-campaigns.create",
    "phrase-campaigns.edit",
    "phrase-campaigns.delete"
  ],

  // MÓDULOS OPCIONAIS
  modules: [
    "kanban.view",
    "schedules.view",
    "schedules.create",
    "schedules.edit",
    "schedules.delete",
    "internal-chat.view",
    "external-api.view",
    "prompts.view",
    "prompts.create",
    "prompts.edit",
    "prompts.delete",
    "integrations.view",
    "ai-agents.view",
    "ai-agents.create",
    "ai-agents.edit",
    "ai-agents.delete",
    "ai-training.view"
  ],

  // ADMINISTRAÇÃO
  admin: [
    "users.view",
    "users.create",
    "users.edit",
    "users.delete",
    "queues.view",
    "queues.create",
    "queues.edit",
    "queues.delete",
    "connections.view",
    "connections.create",
    "connections.edit",
    "connections.delete",
    "files.view",
    "files.upload",
    "files.delete",
    "financeiro.view",
    "settings.view",
    "settings.edit",
    "ai-settings.view",
    "ai-settings.edit"
  ],

  // SUPER ADMIN
  super: [
    "announcements.view",
    "announcements.create",
    "announcements.edit",
    "announcements.delete",
    "companies.view",
    "companies.create",
    "companies.edit",
    "companies.delete",
    "all-connections.view"
  ]
};

/**
 * Retorna todas as permissões de administrador
 */
const getAdminPermissions = (): string[] => {
  return [
    ...AVAILABLE_PERMISSIONS.tickets,
    ...AVAILABLE_PERMISSIONS.quickMessages,
    ...AVAILABLE_PERMISSIONS.contacts,
    ...AVAILABLE_PERMISSIONS.tags,
    ...AVAILABLE_PERMISSIONS.helps,
    ...AVAILABLE_PERMISSIONS.dashboard,
    ...AVAILABLE_PERMISSIONS.campaigns,
    ...AVAILABLE_PERMISSIONS.flowbuilder,
    ...AVAILABLE_PERMISSIONS.modules,
    ...AVAILABLE_PERMISSIONS.admin
  ];
};

/**
 * Retorna permissões básicas de usuário comum
 */
const getBaseUserPermissions = (): string[] => {
  return [
    "tickets.view",
    "quick-messages.view",
    "contacts.view",
    "tags.view",
    "helps.view"
  ];
};

/**
 * Converte perfil e flags antigas em permissões granulares
 * FALLBACK para retrocompatibilidade
 */
export const getUserPermissions = (user: User): string[] => {
  // Se usuário já tem permissões definidas, usa elas
  if (user.permissions && Array.isArray(user.permissions) && user.permissions.length > 0) {
    return user.permissions;
  }

  // FALLBACK: converte perfil antigo para permissões
  let permissions: string[] = [];

  // Se é super admin, adiciona TODAS permissões incluindo super
  if (user.super === true) {
    return [...getAdminPermissions(), ...AVAILABLE_PERMISSIONS.super];
  }

  // Se é admin, adiciona todas permissões administrativas
  if (user.profile === "admin") {
    permissions = [...getAdminPermissions()];
    return permissions;
  }

  // User comum: começa com permissões básicas
  permissions = [...getBaseUserPermissions()];

  // Adiciona permissões baseadas nas flags existentes
  if (user.allTicket === "enable") {
    permissions.push("tickets.update", "tickets.transfer");
  }

  if (user.allowGroup === true) {
    permissions.push("tickets.view-groups");
  }

  if (user.allHistoric === "enabled") {
    permissions.push("tickets.view-all-historic");
  }

  if (user.allUserChat === "enabled") {
    permissions.push("tickets.view-all-users");
  }

  if (user.userClosePendingTicket === "enabled") {
    permissions.push("tickets.close");
  }

  if (user.showDashboard === "enabled") {
    permissions.push("dashboard.view", "reports.view");
  }

  if (user.allowRealTime === "enabled") {
    permissions.push("realtime.view");
  }

  if (user.allowConnections === "enabled") {
    permissions.push("connections.view", "connections.edit");
  }

  return permissions;
};

/**
 * Verifica se usuário tem uma permissão específica
 * Suporta wildcard: "campaigns.*" concede todas permissões de campanhas
 */
export const hasPermission = (user: User | null | undefined, permission: string): boolean => {
  if (!user) return false;

  // Super admin sempre tem todas permissões
  if (user.super === true) {
    return true;
  }

  const userPermissions = getUserPermissions(user);

  // Verifica permissão exata
  if (userPermissions.includes(permission)) {
    return true;
  }

  // Verifica wildcards
  return userPermissions.some(p => {
    if (p.endsWith(".*")) {
      const prefix = p.slice(0, -2);
      return permission.startsWith(prefix + ".");
    }
    return false;
  });
};

/**
 * Verifica se usuário tem TODAS as permissões fornecidas
 */
export const hasAllPermissions = (user: User | null | undefined, permissions: string[]): boolean => {
  if (!user) return false;
  return permissions.every(permission => hasPermission(user, permission));
};

/**
 * Verifica se usuário tem QUALQUER uma das permissões fornecidas
 */
export const hasAnyPermission = (user: User | null | undefined, permissions: string[]): boolean => {
  if (!user) return false;
  return permissions.some(permission => hasPermission(user, permission));
};

/**
 * Retorna lista de todas as permissões disponíveis (flat)
 */
export const getAllAvailablePermissions = (): string[] => {
  return Object.values(AVAILABLE_PERMISSIONS).flat();
};

/**
 * Retorna permissões organizadas por categoria para exibição no frontend
 */
export const getPermissionsCatalog = () => {
  return [
    {
      category: "Atendimento",
      permissions: AVAILABLE_PERMISSIONS.tickets.map(key => ({
        key,
        label: formatPermissionLabel(key),
        description: getPermissionDescription(key)
      }))
    },
    {
      category: "Respostas Rápidas",
      permissions: AVAILABLE_PERMISSIONS.quickMessages.map(key => ({
        key,
        label: formatPermissionLabel(key),
        description: getPermissionDescription(key)
      }))
    },
    {
      category: "Contatos",
      permissions: AVAILABLE_PERMISSIONS.contacts.map(key => ({
        key,
        label: formatPermissionLabel(key),
        description: getPermissionDescription(key)
      }))
    },
    {
      category: "Tags",
      permissions: AVAILABLE_PERMISSIONS.tags.map(key => ({
        key,
        label: formatPermissionLabel(key),
        description: getPermissionDescription(key)
      }))
    },
    {
      category: "Dashboard",
      permissions: AVAILABLE_PERMISSIONS.dashboard.map(key => ({
        key,
        label: formatPermissionLabel(key),
        description: getPermissionDescription(key)
      }))
    },
    {
      category: "Ajuda",
      permissions: AVAILABLE_PERMISSIONS.helps.map(key => ({
        key,
        label: formatPermissionLabel(key),
        description: getPermissionDescription(key)
      }))
    },
    {
      category: "Campanhas",
      permissions: AVAILABLE_PERMISSIONS.campaigns.map(key => ({
        key,
        label: formatPermissionLabel(key),
        description: getPermissionDescription(key)
      }))
    },
    {
      category: "Flowbuilder",
      permissions: AVAILABLE_PERMISSIONS.flowbuilder.map(key => ({
        key,
        label: formatPermissionLabel(key),
        description: getPermissionDescription(key)
      }))
    },
    {
      category: "Módulos",
      permissions: AVAILABLE_PERMISSIONS.modules.filter(key => 
        !key.startsWith("ai-agents.") && !key.startsWith("prompts.")
      ).map(key => ({
        key,
        label: formatPermissionLabel(key),
        description: getPermissionDescription(key)
      }))
    },
    {
      category: "Inteligência Artificial",
      permissions: [
        ...AVAILABLE_PERMISSIONS.modules.filter(key => 
          key.startsWith("ai-agents.") || key.startsWith("prompts.")
        ),
        "ai-training.view",
        "ai-settings.view",
        "ai-settings.edit",
        "files.view",
        "files.upload",
        "files.delete"
      ].map(key => ({
        key,
        label: formatPermissionLabel(key),
        description: getPermissionDescription(key)
      }))
    },
    {
      category: "Administração",
      permissions: AVAILABLE_PERMISSIONS.admin.filter(key => 
        !key.startsWith("ai-settings.") && !key.startsWith("files.")
      ).map(key => ({
        key,
        label: formatPermissionLabel(key),
        description: getPermissionDescription(key)
      }))
    }
  ];
};

/**
 * Formata chave de permissão para label legível
 */
const formatPermissionLabel = (key: string): string => {
  const labels: Record<string, string> = {
    "tickets.view": "Ver Atendimentos",
    "tickets.create": "Criar Atendimentos",
    "tickets.update": "Atualizar Atendimentos",
    "tickets.transfer": "Transferir Atendimentos",
    "tickets.close": "Fechar Atendimentos",
    "tickets.delete": "Deletar Atendimentos",
    "quick-messages.view": "Ver Respostas Rápidas",
    "quick-messages.create": "Criar Respostas Rápidas",
    "quick-messages.edit": "Editar Respostas Rápidas",
    "quick-messages.delete": "Deletar Respostas Rápidas",
    "contacts.view": "Ver Contatos",
    "contacts.create": "Criar Contatos",
    "contacts.edit": "Editar Contatos",
    "contacts.edit-fields": "Editar Campos do Contato",
    "contacts.delete": "Deletar Contatos",
    "contacts.import": "Importar Contatos",
    "contacts.export": "Exportar Contatos",
    "contacts.bulk-edit": "Edição em Massa",
    "dashboard.view": "Ver Dashboard",
    "reports.view": "Ver Relatórios",
    "realtime.view": "Ver Tempo Real",
    "campaigns.view": "Ver Campanhas",
    "campaigns.create": "Criar Campanhas",
    "campaigns.edit": "Editar Campanhas",
    "campaigns.delete": "Deletar Campanhas",
    "users.view": "Ver Usuários",
    "users.create": "Criar Usuários",
    "users.edit": "Editar Usuários",
    "users.delete": "Deletar Usuários",
    "connections.view": "Ver Conexões",
    "connections.edit": "Gerenciar Conexões",
    "connections.create": "Criar Conexões",
    "connections.delete": "Deletar Conexões",
    "kanban.view": "Ver Kanban",
    "schedules.view": "Ver Agendamentos",
    "schedules.create": "Criar Agendamentos",
    "schedules.edit": "Editar Agendamentos",
    "schedules.delete": "Deletar Agendamentos",
    "internal-chat.view": "Ver Chat Interno",
    "external-api.view": "Ver API Externa",
    "prompts.view": "Ver Prompts",
    "prompts.create": "Criar Prompts",
    "prompts.edit": "Editar Prompts",
    "prompts.delete": "Deletar Prompts",
    "integrations.view": "Ver Integrações",
    "ai-agents.view": "Ver Agentes de IA",
    "ai-agents.create": "Criar Agentes de IA",
    "ai-agents.edit": "Editar Agentes de IA",
    "ai-agents.delete": "Deletar Agentes de IA",
    "ai-training.view": "Acessar Training / Sandbox (IA)",
    "queues.view": "Ver Filas",
    "queues.create": "Criar Filas",
    "queues.edit": "Editar Filas",
    "queues.delete": "Deletar Filas",
    "files.view": "Ver Base de Conhecimento",
    "files.upload": "Upload de Arquivos",
    "files.delete": "Deletar Arquivos",
    "financeiro.view": "Ver Financeiro",
    "settings.view": "Ver Configurações",
    "settings.edit": "Editar Configurações",
    "ai-settings.view": "Ver Config. IA",
    "ai-settings.edit": "Editar Config. IA",
    "contact-lists.view": "Ver Listas de Contatos",
    "contact-lists.create": "Criar Listas de Contatos",
    "contact-lists.edit": "Editar Listas de Contatos",
    "contact-lists.delete": "Deletar Listas de Contatos",
    "campaigns-config.view": "Ver Config. Campanhas",
    "flowbuilder.view": "Ver Flowbuilder",
    "flowbuilder.create": "Criar Flowbuilder",
    "flowbuilder.edit": "Editar Flowbuilder",
    "flowbuilder.delete": "Deletar Flowbuilder",
    "phrase-campaigns.view": "Ver Campanhas de Frases",
    "phrase-campaigns.create": "Criar Campanhas de Frases",
    "phrase-campaigns.edit": "Editar Campanhas de Frases",
    "phrase-campaigns.delete": "Deletar Campanhas de Frases",
    "helps.view": "Ver Ajuda"
  };
  return labels[key] || key;
};

/**
 * Retorna descrição da permissão
 */
const getPermissionDescription = (key: string): string => {
  const descriptions: Record<string, string> = {
    "tickets.view": "Visualizar atendimentos e tickets",
    "campaigns.create": "Criar e configurar novas campanhas",
    "users.edit": "Editar informações e permissões de usuários",
    "connections.edit": "Adicionar, editar e remover conexões WhatsApp"
  };
  return descriptions[key] || "";
};
