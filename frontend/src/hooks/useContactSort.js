import { useState, useCallback, useEffect } from 'react';

/**
 * Hook personalizado para gerenciar a ordenação de contatos
 * 
 * @param {string} defaultField - Campo padrão de ordenação
 * @param {string} defaultDirection - Direção padrão de ordenação ('asc'|'desc')
 * @param {string} userId - ID do usuário para persistência
 * @returns {Object} - Estado e funções para controle de ordenação
 */
const useContactSort = (defaultField = 'name', defaultDirection = 'asc', userId = 'anon') => {
  const [sortField, setSortField] = useState(defaultField);
  const [sortDirection, setSortDirection] = useState(defaultDirection);

  // Carrega preferência de ordenação do usuário
  useEffect(() => {
    const key = `contactsSort:${userId || "anon"}`;
    try {
      const saved = JSON.parse(localStorage.getItem(key));
      if (saved && saved.field) {
        setSortField(saved.field);
        setSortDirection(saved.direction === "desc" ? "desc" : "asc");
      }
    } catch (e) {
      // ignora erro
    }
  }, [userId]);

  // Salva preferências de ordenação
  const persistSort = useCallback((field, direction) => {
    const key = `contactsSort:${userId || "anon"}`;
    try {
      localStorage.setItem(key, JSON.stringify({ field, direction }));
    } catch (e) {
      // ignora erro
    }
  }, [userId]);

  // Alterna a ordenação quando um campo é clicado
  const handleSort = useCallback((field) => {
    setSortField((prevField) => {
      const nextField = field;
      setSortDirection((prevDir) => {
        const nextDir = prevField === field ? (prevDir === "asc" ? "desc" : "asc") : "asc";
        persistSort(nextField, nextDir);
        return nextDir;
      });
      return nextField;
    });
  }, [persistSort]);

  return {
    sortField,
    sortDirection,
    handleSort,
    setSortField,
    setSortDirection
  };
};

export default useContactSort;
