import { useState, useEffect, useContext } from "react";
import api from "../services/api";
import toastError from "../errors/toastError";
import { AuthContext } from "../context/Auth/AuthContext";

const useTags = () => {
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useContext(AuthContext);

  useEffect(() => {
    const fetchTags = async () => {
      console.log("[useTags] Iniciando fetch de tags...");
      console.log("[useTags] User:", user);
      
      try {
        const { data } = await api.get(`/tags`, {
          params: { companyId: user.companyId },
        });
        console.log("[useTags] Resposta completa:", data);
        console.log("[useTags] data.tags:", data.tags);
        console.log("[useTags] data.tags existe?", Array.isArray(data.tags));
        
        // A API retorna { tags: [...], count: number, hasMore: boolean }
        const tagsArray = Array.isArray(data.tags) ? data.tags : (Array.isArray(data) ? data : []);
        console.log("[useTags] Tags processadas:", tagsArray?.length);
        setTags(tagsArray);
        setLoading(false);
      } catch (err) {
        console.error("[useTags] Erro ao buscar tags:", err);
        console.error("[useTags] Status:", err?.response?.status);
        console.error("[useTags] Mensagem:", err?.message);
        setLoading(false);
        // 403 = sem permissão tags.view (admin)
        // Silencia o erro
        if (err?.response?.status !== 403) {
          toastError(err);
        }
      }
    };

    if (user?.companyId) {
      fetchTags();
    } else {
      console.log("[useTags] Sem companyId, pulando fetch");
      setLoading(false);
    }
  }, [user]);

  return { tags, loading };
};

export default useTags;
