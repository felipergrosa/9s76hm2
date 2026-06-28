import React, { useMemo } from "react";
import { useHistory } from "react-router-dom";
import { makeStyles } from "@material-ui/core/styles";
import {
  KBarProvider,
  KBarPortal,
  KBarPositioner,
  KBarAnimator,
  KBarSearch,
  KBarResults,
  useMatches,
} from "kbar";
import usePermissions from "../../hooks/usePermissions";

const useStyles = makeStyles((theme) => ({
  positioner: {
    zIndex: 13000,
  },
  animator: {
    maxWidth: 600,
    width: "100%",
    background: theme.mode === "light" ? "#fff" : "#1e1e1e",
    color: theme.mode === "light" ? "#222" : "#eee",
    borderRadius: 12,
    overflow: "hidden",
    boxShadow: "0 16px 48px rgba(0,0,0,0.25)",
  },
  search: {
    padding: "16px 20px",
    fontSize: 16,
    width: "100%",
    boxSizing: "border-box",
    border: "none",
    outline: "none",
    background: "transparent",
    color: "inherit",
    borderBottom: theme.mode === "light" ? "1px solid #eee" : "1px solid #333",
  },
  resultsWrapper: {
    maxHeight: 400,
    overflowY: "auto",
  },
  groupName: {
    padding: "8px 20px",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    opacity: 0.6,
  },
  item: {
    padding: "10px 20px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    cursor: "pointer",
    fontSize: 14,
  },
  itemActive: {
    background: theme.mode === "light" ? "#f3f4f6" : "#2a2a2a",
  },
}));

const RenderResults = () => {
  const classes = useStyles();
  const { results } = useMatches();

  return (
    <div className={classes.resultsWrapper}>
      <KBarResults
        items={results}
        onRender={({ item, active }) =>
          typeof item === "string" ? (
            <div className={classes.groupName}>{item}</div>
          ) : (
            <div className={`${classes.item} ${active ? classes.itemActive : ""}`}>
              <span>{item.name}</span>
              {item.subtitle && (
                <span style={{ opacity: 0.5, fontSize: 12 }}>{item.subtitle}</span>
              )}
            </div>
          )
        }
      />
    </div>
  );
};

const CommandPaletteUI = () => {
  const classes = useStyles();
  return (
    <KBarPortal>
      <KBarPositioner className={classes.positioner}>
        <KBarAnimator className={classes.animator}>
          <KBarSearch
            className={classes.search}
            placeholder="Buscar páginas e ações..."
          />
          <RenderResults />
        </KBarAnimator>
      </KBarPositioner>
    </KBarPortal>
  );
};

// Mantido fora do componente: lista estática de navegação, cada item gated
// pela permission key equivalente usada no menu lateral (MainListItems.js).
const NAV_ITEMS = [
  { id: "nav-dashboard", name: "Dashboard", to: "/", permission: "dashboard.view" },
  { id: "nav-tickets", name: "Atendimentos", to: "/tickets", permission: "tickets.view" },
  { id: "nav-contacts", name: "Contatos", to: "/contacts", permission: "contacts.view" },
  { id: "nav-groups", name: "Grupos", to: "/groups", permission: "contacts.view" },
  { id: "nav-kanban", name: "Kanban", to: "/Kanban", permission: "kanban.view" },
  { id: "nav-quick-messages", name: "Respostas Rápidas", to: "/quick-messages", permission: "quick-messages.view" },
  { id: "nav-schedules", name: "Agendamentos", to: "/schedules", permission: "schedules.view" },
  { id: "nav-tags", name: "Tags", to: "/tags", permission: "tags.view" },
  { id: "nav-users", name: "Usuários", to: "/users", permission: "users.view" },
  { id: "nav-roles", name: "Perfis de Acesso", to: "/roles", permission: "roles.view" },
  { id: "nav-connections", name: "Conexões", to: "/connections", permission: "connections.view" },
  { id: "nav-campaigns", name: "Campanhas", to: "/campaigns", permission: "campaigns.view" },
  { id: "nav-email-campaigns", name: "Campanhas de E-mail", to: "/email-campaigns", permission: "email-campaigns.view" },
  { id: "nav-drip-sequences", name: "Sequências (Drip)", to: "/drip-sequences", permission: "drip-sequences.view" },
  { id: "nav-contact-lists", name: "Listas de Contatos", to: "/contact-lists", permission: "contact-lists.view" },
  { id: "nav-ai-agents", name: "Agentes de IA", to: "/ai-agents", permission: "ai-agents.view" },
  { id: "nav-ai-training", name: "Treinamento de IA", to: "/ai-training", permission: "ai-training.view" },
  { id: "nav-ai-settings", name: "Configurações de IA", to: "/ai-settings", permission: "ai-settings.view" },
  { id: "nav-flowbuilders", name: "Flow Builder", to: "/flowbuilders", permission: "flowbuilders.view" },
  { id: "nav-queues", name: "Filas", to: "/queues", permission: "queues.view" },
  { id: "nav-announcements", name: "Informativos", to: "/announcements", permission: "announcements.view" },
  { id: "nav-financeiro", name: "Financeiro", to: "/financeiro", permission: "financeiro.view" },
  { id: "nav-settings", name: "Configurações", to: "/settings", permission: "settings.view" },
];

const CommandPaletteActions = ({ children }) => {
  const history = useHistory();
  const { hasPermission } = usePermissions();

  const actions = useMemo(() => {
    return NAV_ITEMS.filter((item) => !item.permission || hasPermission(item.permission)).map(
      (item) => ({
        id: item.id,
        name: item.name,
        section: "Navegação",
        subtitle: item.to,
        keywords: item.name,
        perform: () => history.push(item.to),
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history]);

  return (
    <KBarProvider actions={actions}>
      {children}
      <CommandPaletteUI />
    </KBarProvider>
  );
};

export default CommandPaletteActions;
