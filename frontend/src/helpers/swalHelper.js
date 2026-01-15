/**
 * SweetAlert2 Helper with Whaticket standard styling
 * Use this for confirmations, alerts, and simple prompts
 */
import Swal from 'sweetalert2';

// Configuração padrão para todos os modais SweetAlert2
const defaultConfig = {
    customClass: {
        popup: 'swal2-whaticket-popup',
        confirmButton: 'swal2-whaticket-confirm',
        cancelButton: 'swal2-whaticket-cancel',
        title: 'swal2-whaticket-title',
    },
    buttonsStyling: false,
    didOpen: (popup) => {
        // Aplica estilos inline para garantir consistência
        popup.style.borderRadius = '20px';
        popup.style.padding = '24px';

        const confirmBtn = Swal.getConfirmButton();
        if (confirmBtn) {
            confirmBtn.style.borderRadius = '10px';
            confirmBtn.style.padding = '10px 24px';
            confirmBtn.style.fontWeight = '600';
            confirmBtn.style.fontSize = '14px';
            confirmBtn.style.margin = '0 8px';
            confirmBtn.style.cursor = 'pointer';
            confirmBtn.style.border = 'none';
            confirmBtn.style.backgroundColor = '#3085d6';
            confirmBtn.style.color = '#fff';
        }

        const cancelBtn = Swal.getCancelButton();
        if (cancelBtn) {
            cancelBtn.style.borderRadius = '10px';
            cancelBtn.style.padding = '10px 24px';
            cancelBtn.style.fontWeight = '600';
            cancelBtn.style.fontSize = '14px';
            cancelBtn.style.margin = '0 8px';
            cancelBtn.style.cursor = 'pointer';
            cancelBtn.style.border = '1px solid #ddd';
            cancelBtn.style.backgroundColor = '#f5f5f5';
            cancelBtn.style.color = '#333';
        }
    }
};

/**
 * Modal de Confirmação
 * @param {string} title - Título do modal
 * @param {string} text - Texto/mensagem do modal  
 * @param {string} confirmText - Texto do botão de confirmação
 * @param {string} cancelText - Texto do botão de cancelar
 * @param {string} icon - Ícone (warning, error, success, info, question)
 * @returns {Promise<boolean>} - true se confirmou, false se cancelou
 */
export const confirm = async ({
    title = 'Confirmar?',
    text = '',
    html = null,
    confirmText = 'Confirmar',
    cancelText = 'Cancelar',
    icon = 'warning',
    confirmButtonColor = '#d33',
    showCancelButton = true,
}) => {
    const result = await Swal.fire({
        ...defaultConfig,
        title,
        text: html ? undefined : text,
        html: html || undefined,
        icon,
        showCancelButton,
        confirmButtonText: confirmText,
        cancelButtonText: cancelText,
        confirmButtonColor,
        reverseButtons: true,
    });

    return result.isConfirmed;
};

/**
 * Modal de Alerta (apenas OK)
 */
export const alert = async ({
    title = 'Aviso',
    text = '',
    html = null,
    icon = 'info',
    confirmText = 'OK',
}) => {
    await Swal.fire({
        ...defaultConfig,
        title,
        text: html ? undefined : text,
        html: html || undefined,
        icon,
        confirmButtonText: confirmText,
        confirmButtonColor: '#3085d6',
    });
};

/**
 * Modal de Sucesso
 */
export const success = async ({
    title = 'Sucesso!',
    text = '',
    timer = 2000,
    showConfirmButton = false,
}) => {
    await Swal.fire({
        ...defaultConfig,
        title,
        text,
        icon: 'success',
        timer,
        showConfirmButton,
        timerProgressBar: true,
    });
};

/**
 * Modal de Erro
 */
export const error = async ({
    title = 'Erro',
    text = '',
    confirmText = 'Fechar',
}) => {
    await Swal.fire({
        ...defaultConfig,
        title,
        text,
        icon: 'error',
        confirmButtonText: confirmText,
        confirmButtonColor: '#d33',
    });
};

/**
 * Modal de Input simples
 */
export const prompt = async ({
    title = '',
    inputLabel = '',
    inputPlaceholder = '',
    inputValue = '',
    confirmText = 'Salvar',
    cancelText = 'Cancelar',
    inputType = 'text',
}) => {
    const result = await Swal.fire({
        ...defaultConfig,
        title,
        input: inputType,
        inputLabel,
        inputPlaceholder,
        inputValue,
        showCancelButton: true,
        confirmButtonText: confirmText,
        cancelButtonText: cancelText,
        confirmButtonColor: '#3085d6',
        reverseButtons: true,
    });

    return result.isConfirmed ? result.value : null;
};

/**
 * Modal personalizado com HTML
 */
export const custom = async (options) => {
    return Swal.fire({
        ...defaultConfig,
        ...options,
    });
};

// Export default para acesso direto ao Swal configurado
export default Swal;
