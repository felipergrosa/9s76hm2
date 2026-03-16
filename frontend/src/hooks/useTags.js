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
      try {
        const { data } = await api.get(`/tags`, {
          params: { companyId: user.companyId },
        });
        setTags(data.tags);
        setLoading(false);
      } catch (err) {
        setLoading(false);
        // 403 = sem permissão tags.view (admin)
        // Silencia o erro
        if (err?.response?.status !== 403) {
          toastError(err);
        }
      }
    };

    fetchTags();
  }, [user]);

  return { tags, loading };
};

export default useTags;
