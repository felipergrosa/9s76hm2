import React, { createContext, useMemo } from "react";

import useAuth from "../../hooks/useAuth.js/index.js";

const AuthContext = createContext();

const AuthProvider = ({ children }) => {
	const { loading, user, isAuth, handleLogin, handleLogout, socket } = useAuth();

	// Memoiza o value para evitar re-render de todos os consumidores.
	// handleLogin/handleLogout só usam refs estáveis (setState, history, api),
	// então podem ficar fora das deps sem risco de closure obsoleta.
	const value = useMemo(
		() => ({ loading, user, isAuth, handleLogin, handleLogout, socket }),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[loading, user, isAuth, socket]
	);

	return (
		<AuthContext.Provider value={value}>
			{children}
		</AuthContext.Provider>
	);
};

export { AuthContext, AuthProvider };