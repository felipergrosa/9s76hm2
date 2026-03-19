import { Buffer } from "buffer";
import React from "react";
import ReactDOM from "react-dom";
import "./index.css";
import "./modern-ui.css";
import CssBaseline from "@material-ui/core/CssBaseline";
import { ToastContainer } from "react-toastify";
import * as serviceworker from './serviceWorker';
import App from "./App";

window.Buffer = Buffer;

// Suprimir erro não crítico do ResizeObserver que ocorre em desmontagem de componentes
// Este erro não afeta a funcionalidade, apenas polui o console
const resizeObserverErr = window.onerror;
window.onerror = (message, source, lineno, colno, error) => {
  if (message && message.toString().includes('ResizeObserver loop')) {
    return true; // Suprimir erro
  }
  return resizeObserverErr ? resizeObserverErr(message, source, lineno, colno, error) : false;
};

// Handler adicional para capturar erros de runtime (React error overlay)
window.addEventListener('error', (event) => {
  if (event.message && event.message.includes('ResizeObserver loop')) {
    event.stopImmediatePropagation();
    event.preventDefault();
    return true;
  }
});

ReactDOM.render(
	<>
		<CssBaseline />
		<App />
		<ToastContainer
			position="top-center"
			autoClose={3000}
			style={{ zIndex: 99999 }}
		/>
	</>,
	document.getElementById("root"),
	() => {
		window.finishProgress();
	}
);

// Desabilita o Service Worker para evitar cache agressivo e erro de MIME em dev/prod
serviceworker.unregister();
