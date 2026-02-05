import React, { createContext, useState, useCallback } from "react";

// Contexto para Optimistic UI: mensagens aparecem imediatamente antes da resposta do servidor
export const OptimisticMessageContext = createContext();

export const OptimisticMessageProvider = ({ children }) => {
  // Mensagens otimísticas pendentes (ainda não confirmadas pelo servidor)
  const [optimisticMessages, setOptimisticMessages] = useState({});

  // Adiciona uma mensagem otimística (antes de enviar ao servidor)
  const addOptimisticMessage = useCallback((ticketId, message) => {
    const tempId = `optimistic-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const optimisticMessage = {
      ...message,
      id: tempId,
      tempId,
      ack: 0, // Pendente (ícone de relógio)
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      _optimistic: true,
      _pending: true,
    };

    setOptimisticMessages(prev => ({
      ...prev,
      [ticketId]: [...(prev[ticketId] || []), optimisticMessage]
    }));

    return tempId;
  }, []);

  // Confirma uma mensagem otimística (substituir pela real do servidor)
  const confirmOptimisticMessage = useCallback((ticketId, tempId, realMessage) => {
    setOptimisticMessages(prev => {
      const ticketMessages = prev[ticketId] || [];
      return {
        ...prev,
        [ticketId]: ticketMessages.filter(msg => msg.tempId !== tempId)
      };
    });
    return realMessage;
  }, []);

  // Marca uma mensagem otimística como falha
  const failOptimisticMessage = useCallback((ticketId, tempId, error) => {
    setOptimisticMessages(prev => {
      const ticketMessages = prev[ticketId] || [];
      return {
        ...prev,
        [ticketId]: ticketMessages.map(msg => 
          msg.tempId === tempId 
            ? { ...msg, ack: -1, _failed: true, _error: error, _pending: false }
            : msg
        )
      };
    });
  }, []);

  // Remove uma mensagem otimística (ex: após retry bem-sucedido ou cancelamento)
  const removeOptimisticMessage = useCallback((ticketId, tempId) => {
    setOptimisticMessages(prev => {
      const ticketMessages = prev[ticketId] || [];
      return {
        ...prev,
        [ticketId]: ticketMessages.filter(msg => msg.tempId !== tempId)
      };
    });
  }, []);

  // Obtém mensagens otimísticas para um ticket
  const getOptimisticMessages = useCallback((ticketId) => {
    return optimisticMessages[ticketId] || [];
  }, [optimisticMessages]);

  // Limpa mensagens otimísticas de um ticket
  const clearOptimisticMessages = useCallback((ticketId) => {
    setOptimisticMessages(prev => {
      const { [ticketId]: removed, ...rest } = prev;
      return rest;
    });
  }, []);

  return (
    <OptimisticMessageContext.Provider
      value={{
        optimisticMessages,
        addOptimisticMessage,
        confirmOptimisticMessage,
        failOptimisticMessage,
        removeOptimisticMessage,
        getOptimisticMessages,
        clearOptimisticMessages,
      }}
    >
      {children}
    </OptimisticMessageContext.Provider>
  );
};

export default OptimisticMessageContext;
