import { useState, useEffect } from "react";
import api from "../../services/api";

const useRAGCollections = () => {
    const [collections, setCollections] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchCollections = async () => {
            setLoading(true);
            try {
                const { data } = await api.get("/helps/rag/collections");
                setCollections(data.collections || []);
            } catch (err) {
                console.error("Erro ao buscar coleções RAG:", err);
                setCollections([]);
            } finally {
                setLoading(false);
            }
        };

        fetchCollections();
    }, []);

    return { collections, loading };
};

export default useRAGCollections;
