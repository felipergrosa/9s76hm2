import { toast } from "react-toastify";
import { i18n } from "../translate/i18n";
import { isString } from 'lodash';

const toastError = err => {
	console.log("Disparando toastError com o erro:", err);
	const errorMsg = err.response?.data?.error;
	const statusCode = err.response?.status;
	const requestUrl = err.config?.url;
	const isTagsSyncRequest = typeof requestUrl === "string" && requestUrl.includes("/tags/sync");
	if (isTagsSyncRequest && (statusCode === 403 || errorMsg === "ERR_NO_PERMISSION")) {
		toast.error("Você não tem permissão para realizar esta ação.", {
			toastId: "ERR_NO_PERMISSION",
			autoClose: 2500,
			hideProgressBar: false,
			closeOnClick: true,
			pauseOnHover: false,
			draggable: true,
			progress: undefined,
			theme: "light",
		});
		return;
	}
	if (errorMsg) {
		if (i18n.exists(`backendErrors.${errorMsg}`)) {
			toast.error(i18n.t(`backendErrors.${errorMsg}`), {
				toastId: errorMsg,
				autoClose: 2000,
				hideProgressBar: false,
				closeOnClick: true,
				pauseOnHover: false,
				draggable: true,
				progress: undefined,
				theme: "light",
			});
			return
		} else {
			toast.error(errorMsg, {
				toastId: errorMsg,
				autoClose: 2000,
				hideProgressBar: false,
				closeOnClick: true,
				pauseOnHover: false,
				draggable: true,
				progress: undefined,
				theme: "light",
			});
			return
		}
	} if (isString(err)) {
		toast.error(err);
		return
	} else {
		toast.error("Ocorreu um erro!");
		return
	}
};

export default toastError;
