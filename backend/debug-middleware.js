// Middleware de debug para identificar origem do erro
// Adicione temporariamente ao apiContactRoutes.ts

const debugRequest = (req, res, next) => {
  console.log('=== DEBUG API REQUEST ===');
  console.log('Método:', req.method);
  console.log('URL:', req.originalUrl);
  console.log('Headers:', req.headers);
  console.log('Body:', req.body);
  console.log('Query:', req.query);
  console.log('Params:', req.params);
  console.log('========================');
  
  // Capturar resposta
  const originalSend = res.send;
  res.send = function(data) {
    console.log('Resposta:', data);
    console.log('Status:', res.statusCode);
    console.log('========================');
    originalSend.call(this, data);
  };
  
  next();
};

module.exports = debugRequest;
