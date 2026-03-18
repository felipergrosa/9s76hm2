/**
 * Script para verificar variáveis de ambiente em produção
 * Executa no backend e mostra as URLs configuradas
 */

require('dotenv').config();

console.log('\n=== Verificação de Variáveis de Ambiente ===\n');

const vars = {
  'NODE_ENV': process.env.NODE_ENV,
  'BACKEND_URL': process.env.BACKEND_URL,
  'FRONTEND_URL': process.env.FRONTEND_URL,
  'PORT': process.env.PORT,
  'PROXY_PORT': process.env.PROXY_PORT
};

let hasIssues = false;

Object.entries(vars).forEach(([key, value]) => {
  const status = value ? '✅' : '❌';
  console.log(`${status} ${key}: ${value || '(não definida)'}`);
  
  if (!value && key !== 'PROXY_PORT') {
    hasIssues = true;
  }
});

console.log('\n=== Análise ===\n');

if (process.env.NODE_ENV === 'production') {
  console.log('Modo: PRODUÇÃO');
  
  if (process.env.BACKEND_URL && process.env.BACKEND_URL.includes('localhost')) {
    console.log('⚠️  BACKEND_URL aponta para localhost em produção!');
    console.log('   Deveria ser: https://chatsapi.nobreluminarias.com.br');
    hasIssues = true;
  }
  
  if (process.env.FRONTEND_URL && process.env.FRONTEND_URL.includes('localhost')) {
    console.log('⚠️  FRONTEND_URL aponta para localhost em produção!');
    console.log('   Deveria ser: https://chatsapi.nobreluminarias.com.br');
    hasIssues = true;
  }
} else {
  console.log('Modo: DESENVOLVIMENTO');
}

console.log('\n=== URLs que serão geradas para avatares ===\n');

const mockCompanyId = 1;
const mockFile = 'contacts/uuid/avatar.jpg';

const be = (process.env.BACKEND_URL || '').trim();
const fe = (process.env.FRONTEND_URL || '').trim();
const proxyPort = (process.env.PROXY_PORT || '').trim();
const devFallback = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:8080';
const origin = be
  ? `${be}${proxyPort ? `:${proxyPort}` : ''}`
  : (fe || devFallback);

const exampleUrl = origin
  ? `${origin}/public/company${mockCompanyId}/${mockFile}`
  : `/public/company${mockCompanyId}/${mockFile}`;

console.log(`Exemplo de URL gerada: ${exampleUrl}`);

if (hasIssues) {
  console.log('\n❌ Problemas encontrados nas variáveis de ambiente!');
  console.log('   Corrija o arquivo .env antes de continuar.\n');
  process.exit(1);
} else {
  console.log('\n✅ Variáveis de ambiente configuradas corretamente!\n');
  process.exit(0);
}
