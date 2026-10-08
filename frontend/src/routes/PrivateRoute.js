import React, { useContext } from "react";
import { Route as RouterRoute, Redirect } from "react-router-dom";
import { AuthContext } from "../context/Auth/AuthContext";
import BackdropLoading from "../components/BackdropLoading";
import usePermissions from "../hooks/usePermissions";

/**
 * Nomes amigáveis (pt-BR) das permissões usadas em rotas — exibidos no toast
 * de acesso negado em vez da chave crua (ex.: "companies.view")
 */
const PERMISSION_LABELS = {
	"financeiro.view": "Financeiro",
	"companies.view": "Administração",
	"connections.view": "Conexões",
	"quick-messages.view": "Respostas Rápidas",
	"schedules.view": "Agendamentos",
	"tags.view": "Tags",
	"contacts.view": "Contatos",
	"contacts.import": "Importação de Contatos",
	"contacts.edit": "Campos Personalizados",
	"users.view": "Usuários",
	"roles.view": "Perfis de Acesso",
	"meta-templates.view": "Templates Meta",
	"meta-automations.view": "Automações Meta",
	"helps.view": "Base de Conhecimento",
	"external-api.view": "API Externa",
	"settings.view": "Configurações",
	"queues.view": "Filas",
	"reports.view": "Relatórios",
	"integrations.view": "Integrações",
	"announcements.view": "Informativos",
	"phrase-campaigns.view": "Campanhas de Frases",
	"flowbuilder.view": "FlowBuilder",
	"internal-chat.view": "Chat Interno",
	"files.view": "Arquivos",
	"realtime.view": "Tempo Real",
	"kanban.view": "Kanban",
	"ai-settings.view": "Configurações de IA",
	"ai-agents.view": "Agentes de IA",
	"ai-training.view": "Treinamento de IA",
	"contact-lists.view": "Listas de Contatos",
	"campaigns.view": "Campanhas",
	"campaigns.create": "Campanhas",
	"campaigns.edit": "Campanhas",
	"campaigns-config.view": "Configurações de Campanhas",
	"drip-sequences.view": "Follow-ups",
	"drip-sequences.create": "Follow-ups",
	"drip-sequences.edit": "Follow-ups",
	"meta-automations.view": "Automações Meta",
	"meta-automations.create": "Automações Meta",
	"meta-automations.edit": "Automações Meta",
	"email-campaigns.view": "Campanhas de E-mail",
};

// Fallback genérico quando a chave não está mapeada
const getPermissionLabel = (permission) =>
	PERMISSION_LABELS[permission] || "este recurso";

/**
 * PrivateRoute - Rota protegida com verificação de permissões
 * 
 * Uso:
 * <PrivateRoute 
 *   path="/contact-lists" 
 *   component={ContactLists} 
 *   permission="contact-lists.view"
 * />
 * 
 * Se usuário não tiver permissão, redireciona para /tickets com erro 403
 */
const PrivateRoute = ({ 
	component: Component, 
	permission = null,
	permissions = [],
	requireAll = false,
	...rest 
}) => {
	const { isAuth, loading, user } = useContext(AuthContext);
	const { hasPermission, hasAllPermissions, hasAnyPermission } = usePermissions();

	// Os PrivateRoutes ficam FORA de <Switch> (irmãos dentro de LoggedInLayout),
	// então TODOS são montados em qualquer URL. Toda verificação precisa ficar
	// dentro do render da Route — que só executa quando o path realmente bate.
	// Antes, o Redirect de negação disparava em toda página e jogava o usuário
	// para /tickets com o toast do último route negado.
	const denied = (message) => (
		<Redirect
			to={{
				pathname: "/tickets",
				state: {
					error: "ERR_NO_PERMISSION",
					message,
				}
			}}
		/>
	);

	return (
		<RouterRoute
			{...rest}
			render={(props) => {
				// Aguarda carregamento completo do usuário antes de verificar
				// permissões — evita race condition onde hasPermission retorna
				// false temporariamente
				if (loading || !user || !user.id) {
					return <BackdropLoading />;
				}

				if (!isAuth) {
					return <Redirect to={{ pathname: "/login", state: { from: props.location } }} />;
				}

				if (permission && !hasPermission(permission)) {
					return denied(`Você não tem permissão para acessar ${getPermissionLabel(permission)}.`);
				}

				if (permissions.length > 0) {
					const ok = requireAll
						? hasAllPermissions(permissions)
						: hasAnyPermission(permissions);
					if (!ok) {
						const labels = permissions.map(getPermissionLabel).join(" ou ");
						return denied(`Você não tem permissão para acessar ${labels}.`);
					}
				}

				return <Component {...props} />;
			}}
		/>
	);
};

export default PrivateRoute;
