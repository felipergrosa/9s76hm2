let deferredPrompt = null;

export function register() {
  console.log("Registrando service worker", navigator)
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      const swUrl = `${process.env.PUBLIC_URL}/service-worker.js`;

      navigator.serviceWorker.register(swUrl)
        .then((registration) => {
          console.log('Service worker registrado com sucesso!', registration);
        })
        .catch((error) => {
          console.error('Erro durante o registro do service worker:', error);
        });
    });
  }

  // Tratar evento beforeinstallprompt para PWA
  window.addEventListener('beforeinstallprompt', (e) => {
    console.log('Evento beforeinstallprompt recebido');
    e.preventDefault();
    deferredPrompt = e;
    
    // Opcional: mostrar botão de instalação customizado
    // showInstallButton();
  });
}

export function showInstallPrompt() {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        console.log('Usuário aceitou a instalação do PWA');
      } else {
        console.log('Usuário recusou a instalação do PWA');
      }
      deferredPrompt = null;
    });
  }
}

export function unregister() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then((registration) => {
        registration.unregister();
      })
      .catch((error) => {
        console.error('Erro durante o desregistro do service worker:', error);
      });
  }
}
