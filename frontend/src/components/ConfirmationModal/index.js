import React, { useEffect, useRef } from "react";
import { confirm } from "../../helpers/swalHelper";
import { i18n } from "../../translate/i18n";

/**
 * ConfirmationModal - Agora usa SweetAlert2 para visual moderno
 * 
 * Props:
 * - title: Título do modal
 * - children: Conteúdo/texto do modal
 * - open: Se o modal está aberto
 * - onClose: Callback quando fecha (recebe false)
 * - onConfirm: Callback quando confirma
 */
const ConfirmationModal = ({ title, children, open, onClose, onConfirm }) => {
	const hasShownRef = useRef(false);

	useEffect(() => {
		const showModal = async () => {
			if (open && !hasShownRef.current) {
				hasShownRef.current = true;

				const confirmed = await confirm({
					title: title || "Confirmar?",
					text: typeof children === "string" ? children : "",
					html: typeof children !== "string" ? `<div style="text-align: center; padding: 10px;">${children}</div>` : null,
					confirmText: i18n.t("confirmationModal.buttons.confirm"),
					cancelText: i18n.t("confirmationModal.buttons.cancel"),
					icon: "warning",
					confirmButtonColor: "#d33",
				});

				if (confirmed) {
					onConfirm();
				}
				onClose(false);
				hasShownRef.current = false;
			}
		};

		showModal();
	}, [open, title, children, onClose, onConfirm]);

	// Quando fecha externamente, resetar o ref
	useEffect(() => {
		if (!open) {
			hasShownRef.current = false;
		}
	}, [open]);

	return null; // SweetAlert2 gerencia seu próprio DOM
};

export default ConfirmationModal;
