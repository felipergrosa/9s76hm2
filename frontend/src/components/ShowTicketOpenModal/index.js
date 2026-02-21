import React, { useEffect } from 'react';
import Swal from 'sweetalert2';
import { i18n } from '../../translate/i18n';

/**
 * Modal que exibe informações sobre um ticket já aberto.
 * 
 * Props:
 *   isOpen       - controla exibição
 *   handleClose  - chamado ao fechar (cancelar)
 *   user         - nome do atendente atual do ticket
 *   queue        - nome da fila do ticket
 *   onAccept     - (opcional) callback para assumir o ticket. Se fornecido, exibe botão "Sim, Assumir"
 */
const ShowTicketOpen = ({ isOpen, handleClose, user, queue, onAccept }) => {
  useEffect(() => {
    if (isOpen) {
      const userName = user || 'Não atribuído';
      const queueName = queue || 'Sem fila';
      const canAssume = typeof onAccept === 'function';

      Swal.fire({
        icon: canAssume ? 'question' : 'warning',
        title: canAssume ? 'Assumir Atendimento' : i18n.t("showTicketOpenModal.title.header"),
        html: `
          <div style="text-align: left; padding: 10px;">
            <p style="margin-bottom: 12px; color: #666;">
              Este ticket está sendo atendido por <strong>${userName}</strong>.
            </p>
            <div style="background: #f8f9fa; border-radius: 12px; padding: 16px; margin-top: 10px;">
              <p style="margin: 0 0 12px 0; display: flex; align-items: center;">
                <strong style="min-width: 90px;">👤 Atendente:</strong>
                <span style="background: ${user ? '#e3f2fd' : '#ffebee'}; padding: 6px 14px; border-radius: 8px; font-weight: 500;">
                  ${userName}
                </span>
              </p>
              <p style="margin: 0; display: flex; align-items: center;">
                <strong style="min-width: 90px;">📁 Fila:</strong>
                <span style="background: #e8f5e9; padding: 6px 14px; border-radius: 8px; font-weight: 500;">
                  ${queueName}
                </span>
              </p>
            </div>
            ${canAssume ? `
              <p style="margin-top: 14px; font-size: 13px; color: #1976d2; background: #e3f2fd; padding: 10px 12px; border-radius: 8px;">
                Deseja assumir este atendimento? Ao confirmar, o ticket será transferido para você.
              </p>
            ` : ''}
            ${!user ? `
              <p style="margin-top: 14px; font-size: 13px; color: #ff9800; background: #fff3e0; padding: 10px 12px; border-radius: 8px;">
                ⏳ ${i18n.t("showTicketOpenModal.form.messageWait")}
              </p>
            ` : ''}
          </div>
        `,
        showCancelButton: canAssume,
        confirmButtonText: canAssume ? 'Sim, Assumir' : 'Fechar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: canAssume ? '#7b1c1c' : '#3085d6',
        cancelButtonColor: '#6c757d',
        reverseButtons: true,
        customClass: {
          popup: 'swal2-rounded-popup',
          confirmButton: 'swal2-rounded-button',
          cancelButton: 'swal2-rounded-button'
        },
        didOpen: () => {
          const popup = Swal.getPopup();
          if (popup) {
            popup.style.borderRadius = '20px';
          }
          const confirmBtn = Swal.getConfirmButton();
          if (confirmBtn) {
            confirmBtn.style.borderRadius = '10px';
            confirmBtn.style.padding = '10px 24px';
            if (canAssume) {
              confirmBtn.style.backgroundColor = '#7b1c1c';
              confirmBtn.style.fontWeight = '600';
            }
          }
          const cancelBtn = Swal.getCancelButton();
          if (cancelBtn) {
            cancelBtn.style.borderRadius = '10px';
            cancelBtn.style.padding = '10px 24px';
          }
        }
      }).then((result) => {
        if (result.isConfirmed && canAssume) {
          onAccept();
        } else {
          handleClose();
        }
      });
    }
  }, [isOpen, user, queue, handleClose, onAccept]);

  return null; // SweetAlert2 gerencia seu próprio DOM
};

export default ShowTicketOpen;
