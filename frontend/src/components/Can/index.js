import rules from "../../rules";

/**
 * Verifica se usuário tem permissão
 * Suporta tanto o sistema novo (user.permissions) quanto o antigo (rules[role])
 * 
 * @param {object} user - Objeto do usuário completo (não apenas role)
 * @param {string} action - Permissão a verificar (ex: "contact-lists.edit")
 * @param {object} data - Dados adicionais para verificações dinâmicas
 */
const check = (user, action, data) => {
	if (!user) return false;

	// Super admin sempre tem tudo
	if (user.super === true) {
		return true;
	}

	// SISTEMA NOVO: Verifica user.permissions (array de permissões granulares)
	if (user.permissions && Array.isArray(user.permissions) && user.permissions.length > 0) {
		// Verifica permissão exata
		if (user.permissions.includes(action)) {
			return true;
		}

		// Verifica wildcards (ex: "campaigns.*" permite "campaigns.create")
		const hasWildcard = user.permissions.some(p => {
			if (p.endsWith(".*")) {
				const prefix = p.slice(0, -2);
				return action.startsWith(prefix + ".");
			}
			return false;
		});

		if (hasWildcard) {
			return true;
		}
	}

	// FALLBACK: Admin profile tem todas permissões (exceto super)
	if (user.profile === "admin") {
		// Admin não tem permissões de super (companies, all-connections)
		if (action.startsWith("companies.") || action === "all-connections.view") {
			return false;
		}
		return true;
	}

	// FALLBACK: Sistema legado (rules.js com formato antigo usando :)
	const permissions = rules[user.profile];
	if (!permissions) {
		return false;
	}

	const staticPermissions = permissions.static;
	if (staticPermissions && staticPermissions.includes(action)) {
		return true;
	}

	const dynamicPermissions = permissions.dynamic;
	if (dynamicPermissions) {
		const permissionCondition = dynamicPermissions[action];
		if (!permissionCondition) {
			return false;
		}
		return permissionCondition(data);
	}

	return false;
};

/**
 * Componente Can - Renderização condicional baseada em permissões
 * 
 * IMPORTANTE: Agora recebe o objeto user completo, não apenas role
 * 
 * Uso:
 * <Can user={user} perform="contact-lists.edit" yes={() => <Button />} />
 * 
 * Compatibilidade: Ainda aceita role (user.profile) mas recomenda-se passar user completo
 */
const Can = ({ user, role, perform, data, yes, no }) => {
	// Se recebeu user completo, usa ele
	if (user && typeof user === 'object') {
		return check(user, perform, data) ? yes() : no();
	}
	
	// FALLBACK: Se recebeu apenas role (string), cria objeto user mínimo
	if (role && typeof role === 'string') {
		const userObj = { profile: role };
		return check(userObj, perform, data) ? yes() : no();
	}

	return no();
};

Can.defaultProps = {
	yes: () => null,
	no: () => null,
};

export { Can };
