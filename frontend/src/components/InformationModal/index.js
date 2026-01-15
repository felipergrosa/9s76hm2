import React, { useEffect, useRef } from "react";
import { alert } from "../../helpers/swalHelper";
import { i18n } from "../../translate/i18n";

/**
 * InformationModal - Agora usa SweetAlert2 para visual moderno
 * 
 * Props:
 * - title: Título do modal
 * - children: Conteúdo/texto do modal
 * - open: Se o modal está aberto
 * - onClose: Callback quando fecha
 */
const InformationModal = ({ title, children, open, onClose }) => {
	const hasShownRef = useRef(false);

	useEffect(() => {
		const showModal = async () => {
			if (open && !hasShownRef.current) {
				hasShownRef.current = true;

				await alert({
					title: title || "ℹ️ Informação",
					text: typeof children === "string" ? children : "",
					html: typeof children !== "string" ? `<div style="text-align: center; padding: 10px;">${children}</div>` : null,
					icon: "info",
					confirmText: i18n.t("Fechar"),
				});

				onClose(false);
				hasShownRef.current = false;
			}
		};

		showModal();
	}, [open, title, children, onClose]);

	// Quando fecha externamente, resetar o ref
	useEffect(() => {
		if (!open) {
			hasShownRef.current = false;
		}
	}, [open]);

	return null; // SweetAlert2 gerencia seu próprio DOM
};

export default InformationModal;