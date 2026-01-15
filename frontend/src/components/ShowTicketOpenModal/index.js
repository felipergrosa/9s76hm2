import React, { useEffect } from 'react';
import Swal from 'sweetalert2';
import { i18n } from '../../translate/i18n';

const ShowTicketOpen = ({ isOpen, handleClose, user, queue }) => {
  useEffect(() => {
    if (isOpen) {
      const userName = user || 'Não atribuído';
      const queueName = queue || 'Sem fila';

      Swal.fire({
        icon: 'warning',
        title: i18n.t("showTicketOpenModal.title.header"),
        html: `
          <div style="text-align: left; padding: 10px;">
            <p style="margin-bottom: 12px; color: #666;">
              ${i18n.t("showTicketOpenModal.form.message")}
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
            ${!user ? `
              <p style="margin-top: 14px; font-size: 13px; color: #ff9800; background: #fff3e0; padding: 10px 12px; border-radius: 8px;">
                ⏳ ${i18n.t("showTicketOpenModal.form.messageWait")}
              </p>
            ` : ''}
          </div>
        `,
        confirmButtonText: 'Fechar',
        confirmButtonColor: '#3085d6',
        customClass: {
          popup: 'swal2-rounded-popup',
          confirmButton: 'swal2-rounded-button'
        },
        didOpen: () => {
          // Aplica estilos diretamente ao popup para garantir bordas arredondadas
          const popup = Swal.getPopup();
          if (popup) {
            popup.style.borderRadius = '20px';
          }
          const confirmBtn = Swal.getConfirmButton();
          if (confirmBtn) {
            confirmBtn.style.borderRadius = '10px';
            confirmBtn.style.padding = '10px 24px';
          }
        }
      }).then(() => {
        handleClose();
      });
    }
  }, [isOpen, user, queue, handleClose]);

  return null; // SweetAlert2 gerencia seu próprio DOM
};

export default ShowTicketOpen;
