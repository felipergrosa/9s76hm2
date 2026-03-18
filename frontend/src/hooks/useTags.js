import { useState, useEffect, useContext } from "react";
import api from "../services/api";
import toastError from "../errors/toastError";
import { AuthContext } from "../context/Auth/AuthContext";

const useTags = () => {
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useContext(AuthContext);

  useEffect(() => {
    let retryCount = 0;
    const maxRetries = 3;
    
    const fetchTags = async () => {
      try {
        const { data } = await api.get(`/tags`, {
          params: { companyId: user.companyId },
        });

        // A API retorna { tags: [...], count: number, hasMore: boolean }
        const tagsArray = Array.isArray(data.tags) ? data.tags : (Array.isArray(data) ? data : []);
        setTags(tagsArray);
        setLoading(false);
      } catch (err) {
        // Retry automático para erros HTTP/2 ou de rede
        const isNetworkError = !err?.response || err?.message?.includes('ERR_HTTP2') || err?.message?.includes('Network Error');

        if (isNetworkError && retryCount < maxRetries) {
          retryCount++;
          const delay = 1000 * retryCount; // 1s, 2s, 3s
          setTimeout(fetchTags, delay);
          return;
        }

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
      setLoading(false);
    }
  }, [user]);

  return { tags, loading };
};

export default useTags;
