import { useState, useEffect, useContext } from "react";
import toastError from "../../errors/toastError";

import api from "../../services/api";
import { AuthContext } from "../../context/Auth/AuthContext";

const useUsers = () => {
    const [loading, setLoading] = useState(true);
    const [hasMore, setHasMore] = useState(false);
    const [users, setUsers] = useState([]);
    const [count, setCount] = useState(0);
    const { user } = useContext(AuthContext);

    // Função auxiliar para verificar permissão
    const hasPermission = (permission) => {
        // Se user ainda não está pronto, não tem permissão
        if (!user || user.loading) return false;
        if (user?.super === true) return true;
        if (user?.profile === "admin") return true;
        return user?.permissions?.includes(permission);
    };

    useEffect(() => {
        // Se user ainda não está pronto, não carrega
        if (!user || user.loading) {
            setLoading(false);
            return;
        }

        // Só carrega usuários se tiver permissão
        if (!hasPermission("users.view")) {
            setLoading(false);
            return;
        }

        setLoading(true);
        const delayDebounceFn = setTimeout(() => {
            const fetchUsers = async () => {
                try {
                    const { data } = await api.get("/users", {
                        params: {},
                    });
                    setUsers(data.users);
                    setHasMore(data.hasMore);
                    setCount(data.count);
                    setLoading(false);
                } catch (err) {
                    setLoading(false);
                    // 403 = sem permissão users.view (admin)
                    // Silencia o erro, lista de usuários fica vazia
                    if (err?.response?.status !== 403) {
                        toastError(err);
                    }
                }
            };

            fetchUsers();
        }, 500);
        return () => clearTimeout(delayDebounceFn);
    }, []);

    return { users, loading, hasMore, count };
};

export default useUsers;
