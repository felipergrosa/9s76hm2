interface WebhookConfig {
    attempts: number;
    backoff: {
      type: 'fixed' | 'exponential';
      delay: number;
    };
    limiter: {
      max: number;
      duration: number;
    };
  }
  
  interface Config {
    webhook: WebhookConfig;
    // Adicione outras configurações conforme necessário
  }
  
  function configLoader(): Config {

    return {
      webhook: {
        attempts: 10,
        backoff: {
          type: 'exponential',
          delay: 3000,
        },
        limiter: {
          max: 1,
          duration: 150,
        },
      },
      // Adicione outras configurações conforme necessário
    };
  }
  
  export default configLoader;
  