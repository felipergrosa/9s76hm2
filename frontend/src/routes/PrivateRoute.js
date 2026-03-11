import React, { useContext } from "react";
import { Route as RouterRoute, Redirect } from "react-router-dom";
import { AuthContext } from "../context/Auth/AuthContext";
import BackdropLoading from "../components/BackdropLoading";
import usePermissions from "../hooks/usePermissions";

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

	// DEBUG: Log do estado atual
	console.log('[PrivateRoute]', { 
		path: rest.path, 
		permission, 
		loading, 
		isAuth, 
		hasUser: !!user, 
		hasUserId: !!user?.id,
		userPermissions: user?.permissions,
		hasPermission: permission ? hasPermission(permission) : 'N/A'
	});

	// Aguarda carregamento completo do usuário antes de verificar permissões
	// Isso evita race condition onde hasPermission retorna false temporariamente
	if (loading || !user || !user.id) {
		console.log('[PrivateRoute] Aguardando carregamento do usuário...');
		return (
			<>
				<BackdropLoading />
			</>
		);
	}

	// Verifica autenticação
	if (!isAuth) {
		console.log('[PrivateRoute] Usuário não autenticado, redirecionando para login');
		return (
			<>
				<Redirect to={{ pathname: "/login", state: { from: rest.location } }} />
			</>
		);
	}

	// Se não requer permissão específica, renderiza normalmente
	if (!permission && permissions.length === 0) {
		console.log('[PrivateRoute] Sem permissão necessária, renderizando componente');
		return (
			<>
				<RouterRoute {...rest} component={Component} />
			</>
		);
	}

	// Verifica permissão única
	if (permission) {
		const hasPerm = hasPermission(permission);
		console.log(`[PrivateRoute] Verificando permissão ${permission}:`, hasPerm);
		if (!hasPerm) {
			console.log('[PrivateRoute] Permissão negada, redirecionando para /tickets');
			return (
				<>
					<Redirect 
						to={{ 
							pathname: "/tickets", 
							state: { 
								error: "ERR_NO_PERMISSION",
								message: `Você não tem permissão para acessar este recurso. Permissão necessária: ${permission}`,
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
			return (
				<>
					<Redirect 
						to={{ 
							pathname: "/tickets", 
							state: { 
								error: "ERR_NO_PERMISSION",
								message: `Você não tem permissão para acessar este recurso. Permissões necessárias: ${permissions.join(", ")}`,
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
