/**
 * Sistema de permissões granulares
 * Este arquivo agora funciona como adaptador para user.permissions do backend
 * 
 * IMPORTANTE: O componente Can deve usar user.permissions diretamente
 * Este rules.js mantém apenas compatibilidade com código legado que usa dois pontos (:)
 */

const rules = {
	user: {
		static: [],
	},

	admin: {
		static: [
			// Permissões legadas (formato antigo com :)
			"dashboard:view",
			"drawer-admin-items:view",
			"tickets-manager:showall",
			"user-modal:editProfile",
			"user-modal:editQueues",
			"ticket-options:deleteTicket",
			"contacts-page:deleteContact",
			"contacts-page:bulkEdit",
			"contacts-page:editTags",
			"contacts-page:editWallets",
			"contacts-page:editRepresentative",
			"connections-page:actionButtons",
			"connections-page:addConnection",
			"connections-page:editOrDeleteConnection",
			"tickets-manager:closeAll",
		],
	},
};

export default rules;
