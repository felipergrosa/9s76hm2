import { useState, useMemo, useCallback, useEffect } from 'react';

/**
 * Hook personalizado para gerenciar a paginação da lista de contatos
 * 
 * @param {number} initialItemsPerPage - Número inicial de itens por página
 * @param {string} userId - ID do usuário para persistir preferências
 * @returns {Object} - Estado e funções para controle de paginação
 */
const useContactPagination = (initialItemsPerPage = 25, userId = 'anon') => {
  // Estado de paginação
  const [pageNumber, setPageNumber] = useState(1);
  const [contactsPerPage, setContactsPerPage] = useState(initialItemsPerPage);
  const [totalContacts, setTotalContacts] = useState(0);
  
  // Cálculo memoizado para o total de páginas
  const totalPages = useMemo(() => {
    return totalContacts === 0 ? 1 : Math.ceil(totalContacts / contactsPerPage);
  }, [totalContacts, contactsPerPage]);

  // Carrega preferência de itens por página do usuário
  useEffect(() => {
    const key = `contactsPerPage:${userId || "anon"}`;
    try {
      const saved = parseInt(localStorage.getItem(key), 10);
      if (!isNaN(saved) && saved > 0) {
        setContactsPerPage(saved);
      }
    } catch (_) { /* ignore */ }
  }, [userId]);

  // Salva preferência de itens por página
  const handleChangePerPage = useCallback((value) => {
    const intValue = parseInt(value, 10) || initialItemsPerPage;
    setContactsPerPage(intValue);
    setPageNumber(1); // Reseta para primeira página
    
    try { 
      localStorage.setItem(`contactsPerPage:${userId || "anon"}`, String(intValue)); 
    } catch {}
  }, [userId, initialItemsPerPage]);

  // Função para ir para uma página específica
  const goToPage = useCallback((page) => {
    if (page >= 1 && page <= totalPages) {
      setPageNumber(page);
    }
  }, [totalPages]);

  // Função para renderizar os números de página (sempre 3, janela deslizante)
  const renderPageNumbers = useCallback(() => {
    const pages = [];
    if (totalPages <= 3) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      const start = Math.max(1, Math.min(pageNumber - 1, totalPages - 2));
      const end = Math.min(totalPages, start + 2);
      for (let i = start; i <= end; i++) pages.push(i);
    }
    
    return pages;
  }, [pageNumber, totalPages]);

  return {
    pageNumber,
    setPageNumber,
    contactsPerPage,
    setContactsPerPage,
    totalContacts,
    setTotalContacts,
    totalPages,
    handleChangePerPage,
    goToPage,
    renderPageNumbers
  };
};

export default useContactPagination;
