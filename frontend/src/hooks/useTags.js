import { useState, useEffect, useContext } from "react";
import api from "../services/api";
import toastError from "../errors/toastError";
import { AuthContext } from "../context/Auth/AuthContext";

const useTags = () => {
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user, isAuth } = useContext(AuthContext);

  useEffect(() => {
    if (!isAuth || !user?.companyId) {
      setTags([]);
      setLoading(false);
      return;
    }

    const fetchTags = async () => {
      try {
        const { data } = await api.get(`/tags`, {
          params: { companyId: user.companyId },
        });
        setTags(data.tags);
        setLoading(false);
      } catch (error) {
        toastError(error);
        setLoading(false);
      }
    };

    fetchTags();
  }, [isAuth, user?.companyId]);

  return { tags, loading };
};

export default useTags;
