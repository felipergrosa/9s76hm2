import React, { useEffect, useRef } from 'react';
import { custom } from '../../helpers/swalHelper';
import Swal from 'sweetalert2';

/**
 * ContactNotesEditModal - Agora usa SweetAlert2 para visual moderno
 * 
 * Props:
 * - open: Se o modal está aberto
 * - onClose: Callback quando fecha
 * - note: Nota atual para editar
 * - onSave: Callback com a nota editada
 */
export default function ContactNotesEditModal({ open, onClose, note, onSave }) {
  const hasShownRef = useRef(false);

  useEffect(() => {
    const showModal = async () => {
      if (open && !hasShownRef.current) {
        hasShownRef.current = true;

        const result = await custom({
          title: '📝 Editar Nota',
          html: `
            <div style="text-align: left;">
              <label style="display: block; margin-bottom: 8px; font-weight: 500; color: #555;">
                Nota do Contato
              </label>
            </div>
          `,
          input: 'textarea',
          inputValue: note || '',
          inputPlaceholder: 'Digite a nota aqui...',
          inputAttributes: {
            'aria-label': 'Nota do contato',
            style: 'resize: vertical; min-height: 100px; border-radius: 8px;'
          },
          showCancelButton: true,
          confirmButtonText: '💾 Salvar',
          cancelButtonText: 'Cancelar',
          confirmButtonColor: '#3085d6',
          reverseButtons: true,
          focusConfirm: false,
          preConfirm: (value) => {
            return value;
          }
        });

        if (result.isConfirmed) {
          onSave(result.value);
        }
        onClose();
        hasShownRef.current = false;
      }
    };

    showModal();
  }, [open, note, onClose, onSave]);

  // Quando fecha externamente, resetar o ref
  useEffect(() => {
    if (!open) {
      hasShownRef.current = false;
    }
  }, [open]);

  return null; // SweetAlert2 gerencia seu próprio DOM
}
