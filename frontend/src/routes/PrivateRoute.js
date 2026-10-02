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

	// Aguarda carregamento completo do usuário antes de verificar permissões
	// Isso evita race condition onde hasPermission retorna false temporariamente
	if (loading || !user || !user.id) {
		return (
			<>
				<BackdropLoading />
			</>
		);
	}

	// Verifica autenticação
	if (!isAuth) {
		return (
			<>
				<Redirect to={{ pathname: "/login", state: { from: rest.location } }} />
			</>
		);
	}

	// Se não requer permissão específica, renderiza normalmente
	if (!permission && permissions.length === 0) {
		return (
			<>
				<RouterRoute {...rest} component={Component} />
			</>
		);
	}

	// Verifica permissão única
	if (permission) {
		const hasPerm = hasPermission(permission);
		if (!hasPerm) {
			return (
				<>
					<Redirect 
						to={{ 
							pathname: "/tickets", 
							state: { 
								error: "ERR_NO_PERMISSION",
								message: `Você não tem permissão para acessar ${getPermissionLabel(permission)}.`,
								from: rest.location 
							} 
						}} 
					/>
				</>
			);
		}
	}

	// Verifica múltiplas permissões
	if (permissions.length > 0) {
		const hasRequiredPermissions = requireAll 
			? hasAllPermissions(permissions)
			: hasAnyPermission(permissions);

		if (!hasRequiredPermissions) {
			const labels = permissions.map(getPermissionLabel).join(" ou ");
			return (
				<>
					<Redirect 
						to={{ 
							pathname: "/tickets", 
							state: { 
								error: "ERR_NO_PERMISSION",
								message: `Você não tem permissão para acessar ${labels}.`,
								from: rest.location 
							} 
						}} 
					/>
				</>
			);
		}
	}

	// Usuário autenticado e com permissão
	return (
		<>
			<RouterRoute {...rest} component={Component} />
		</>
	);
};

export default PrivateRoute;
