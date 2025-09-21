import { useCallback } from 'react';
import { toast } from "react-toastify";
import { i18n } from "../translate/i18n";
import toastError from "../errors/toastError";
import api from "../services/api";

// Hook personalizado para gerenciar todos os handlers de contatos
// Isso ajuda a memoizar as funções e evita recriá-las a cada renderização
const useContactHandlers = (
  setDeletingContact,
  setBlockingContact,
  setUnBlockingContact,
  setContactTicket,
  setNewTicketModalOpen,
  setSelectedContactId,
  setContactModalOpen,
  setSearchParam,
  setPageNumber
) => {
  
  // Handler para editar um contato
  const handleEditContact = useCallback((contactId) => {
    setSelectedContactId(contactId);
    setContactModalOpen(true);
  }, [setSelectedContactId, setContactModalOpen]);

  // Handler para deletar um contato
  const handleDeleteContact = useCallback(async (contactId) => {
    try {
      await api.delete(`/contacts/${contactId}`);
      toast.success(i18n.t("contacts.toasts.deleted"));
    } catch (err) {
      toastError(err);
    }
    setDeletingContact(null);
  }, [setDeletingContact]);

  // Handler para mostrar modal de confirmação de deleção
  const handleShowDeleteConfirm = useCallback((contact) => {
    setDeletingContact(contact);
  }, [setDeletingContact]);

  // Handler para bloquear um contato
  const handleBlockContact = useCallback(async (contactId) => {
    try {
      await api.put(`/contacts/block/${contactId}`, { active: false });
      toast.success("Contato bloqueado");
    } catch (err) {
      toastError(err);
    }
    setSearchParam("");
    setPageNumber(1);
    setBlockingContact(null);
  }, [setSearchParam, setPageNumber, setBlockingContact]);

  // Handler para mostrar modal de confirmação de bloqueio
  const handleShowBlockConfirm = useCallback((contact) => {
    setBlockingContact(contact);
  }, [setBlockingContact]);

  // Handler para desbloquear um contato
  const handleUnblockContact = useCallback(async (contactId) => {
    try {
      await api.put(`/contacts/block/${contactId}`, { active: true });
      toast.success("Contato desbloqueado");
    } catch (err) {
      toastError(err);
    }
    setSearchParam("");
    setPageNumber(1);
    setUnBlockingContact(null);
  }, [setSearchParam, setPageNumber, setUnBlockingContact]);

  // Handler para mostrar modal de confirmação de desbloqueio
  const handleShowUnblockConfirm = useCallback((contact) => {
    setUnBlockingContact(contact);
  }, [setUnBlockingContact]);

  // Handler para iniciar um novo ticket/conversa
  const handleStartNewTicket = useCallback((contact) => {
    setContactTicket(contact);
    setNewTicketModalOpen(true);
  }, [setContactTicket, setNewTicketModalOpen]);

  return {
    handleEditContact,
    handleDeleteContact,
    handleShowDeleteConfirm,
    handleBlockContact,
    handleShowBlockConfirm,
    handleUnblockContact,
    handleShowUnblockConfirm,
    handleStartNewTicket,
  };
};

export default useContactHandlers;
