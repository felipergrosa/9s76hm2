import { useState, useEffect, useContext, useCallback } from "react";
import api from "../services/api";
import { AuthContext } from "../context/Auth/AuthContext";

/**
 * Hook para buscar lista simples de usuários (para dropdowns, selects, etc)
 * Já inclui verificação de permissão users.view e tratamento silencioso de 403
 */
const useUsersList = (autoLoad = true) => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const { user } = useContext(AuthContext);

    // Verificação de permissão
    const hasPermission = useCallback((permission) => {
        if (user?.super === true) return true;
        if (user?.profile === "admin") return true;
        
        if (Array.isArray(user?.permissions) && user.permissions.length > 0) {
            if (user.permissions.includes(permission)) return true;
            return user.permissions.some(p => {
                if (p.endsWith(".*")) {
                    const prefix = p.slice(0, -2);
                    return permission.startsWith(prefix + ".");
                }
                return false;
            });
        }
        
        return false;
    }, [user]);

    /**
     * Busca completa de usuários (requer permissão users.view)
     * Usa: Páginas administrativas
     */
    const loadUsers = useCallback(async () => {
        // Verifica permissão ANTES de fazer a chamada
        if (!hasPermission("users.view")) {
            console.log("[useUsersList] Usuário sem permissão users.view, retornando lista vazia");
            setUsers([]);
            return [];
        }

        setLoading(true);
        try {
            const { data } = await api.get("/users/list");
            setUsers(data || []);
            return data || [];
        } catch (err) {
            // Silencia erro 403 (sem permissão)
            if (err?.response?.status !== 403) {
                console.error("[useUsersList] Erro ao buscar usuários:", err);
            }
            setUsers([]);
            return [];
        } finally {
            setLoading(false);
        }
    }, [hasPermission]);

    /**
     * Busca simplificada para SELEÇÃO de usuários (SEM permissão)
     * Usa: TransferTicket, CampaignModal, ScheduleModal, etc
     * Retorna apenas: id, name, email, profile
     */
    const loadUsersForSelection = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await api.get("/users/available");
            setUsers(data || []);
            return data || [];
        } catch (err) {
            console.error("[useUsersList] Erro ao buscar usuários disponíveis:", err);
            setUsers([]);
            return [];
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (autoLoad) {
            loadUsers();
        }
    }, [autoLoad, loadUsers]);

    return { users, loading, loadUsers, loadUsersForSelection, hasPermission };
};

export default useUsersList;
