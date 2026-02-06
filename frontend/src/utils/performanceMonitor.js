/**
 * Monitor de Performance - Detecta gargalos automaticamente
 * Uso: import { PerformanceMonitor } from './utils/performanceMonitor';
 * 
 * Em desenvolvimento, mostra métricas no console
 * Em produção, pode enviar para analytics (opcional)
 */

const isDev = process.env.NODE_ENV === 'development';

// Core Web Vitals thresholds
const THRESHOLDS = {
  LCP: { good: 2500, poor: 4000 },    // Largest Contentful Paint
  FID: { good: 100, poor: 300 },       // First Input Delay
  CLS: { good: 0.1, poor: 0.25 },      // Cumulative Layout Shift
  INP: { good: 200, poor: 500 },       // Interaction to Next Paint
  TTFB: { good: 800, poor: 1800 },     // Time to First Byte
};

// Classificar métrica
const getStatus = (name, value) => {
  const threshold = THRESHOLDS[name];
  if (!threshold) return 'unknown';
  if (value <= threshold.good) return '✅ BOM';
  if (value <= threshold.poor) return '⚠️ PRECISA MELHORAR';
  return '❌ RUIM';
};

// Formatar valor
const formatValue = (name, value) => {
  if (name === 'CLS') return value.toFixed(3);
  return `${Math.round(value)}ms`;
};

// Armazenar métricas
const metrics = {};

// Callback para processar métricas
const handleMetric = (metric) => {
  const { name, value, id } = metric;
  metrics[name] = value;
  
  if (isDev) {
    const status = getStatus(name, value);
    const formatted = formatValue(name, value);
    console.log(`[Performance] ${name}: ${formatted} ${status}`);
    
    // Alertar sobre métricas ruins
    if (status.includes('RUIM')) {
      console.warn(`[Performance] ⚠️ ${name} está ruim! Valor: ${formatted}. Meta: <${THRESHOLDS[name]?.good}ms`);
    }
  }
};

// Observar Long Tasks (tarefas que bloqueiam o main thread > 50ms)
const observeLongTasks = () => {
  if (!window.PerformanceObserver) return;
  
  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (isDev && entry.duration > 100) {
          console.warn(`[Performance] Long Task detectada: ${Math.round(entry.duration)}ms`, entry);
        }
      }
    });
    observer.observe({ entryTypes: ['longtask'] });
  } catch (e) {
    // Long Tasks não suportadas
  }
};

// Observar Layout Shifts
const observeLayoutShifts = () => {
  if (!window.PerformanceObserver) return;
  
  let clsValue = 0;
  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) {
          clsValue += entry.value;
        }
      }
      handleMetric({ name: 'CLS', value: clsValue });
    });
    observer.observe({ entryTypes: ['layout-shift'], buffered: true });
  } catch (e) {
    // Layout Shift não suportado
  }
};

// Observar LCP
const observeLCP = () => {
  if (!window.PerformanceObserver) return;
  
  try {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1];
      if (lastEntry) {
        handleMetric({ name: 'LCP', value: lastEntry.startTime });
        
        if (isDev && lastEntry.element) {
          console.log('[Performance] Elemento LCP:', lastEntry.element);
        }
      }
    });
    observer.observe({ entryTypes: ['largest-contentful-paint'], buffered: true });
  } catch (e) {
    // LCP não suportado
  }
};

// Observar FID
const observeFID = () => {
  if (!window.PerformanceObserver) return;
  
  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        handleMetric({ name: 'FID', value: entry.processingStart - entry.startTime });
      }
    });
    observer.observe({ entryTypes: ['first-input'], buffered: true });
  } catch (e) {
    // FID não suportado
  }
};

// Medir TTFB
const measureTTFB = () => {
  try {
    const navigation = performance.getEntriesByType('navigation')[0];
    if (navigation) {
      handleMetric({ name: 'TTFB', value: navigation.responseStart });
    }
  } catch (e) {
    // Navigation Timing não suportado
  }
};

// Medir tempo de carregamento de componente
const measureComponent = (componentName) => {
  const start = performance.now();
  return {
    end: () => {
      const duration = performance.now() - start;
      if (isDev && duration > 100) {
        console.log(`[Performance] Componente ${componentName}: ${Math.round(duration)}ms`);
      }
      return duration;
    }
  };
};

// Medir requisição de API
const measureAPI = (endpoint) => {
  const start = performance.now();
  return {
    end: (success = true) => {
      const duration = performance.now() - start;
      if (isDev && duration > 500) {
        const status = success ? '✅' : '❌';
        console.log(`[Performance] API ${endpoint}: ${Math.round(duration)}ms ${status}`);
      }
      return duration;
    }
  };
};

// Iniciar monitoramento
const init = () => {
  if (typeof window === 'undefined') return;
  
  // Aguardar load para medir corretamente
  if (document.readyState === 'complete') {
    startObservers();
  } else {
    window.addEventListener('load', startObservers);
  }
};

const startObservers = () => {
  observeLCP();
  observeFID();
  observeLayoutShifts();
  observeLongTasks();
  measureTTFB();
  
  if (isDev) {
    console.log('[Performance] Monitor iniciado. Métricas serão exibidas no console.');
  }
};

// Relatório completo
const getReport = () => {
  return {
    metrics,
    thresholds: THRESHOLDS,
    timestamp: new Date().toISOString()
  };
};

// Export
export const PerformanceMonitor = {
  init,
  measureComponent,
  measureAPI,
  getReport,
  metrics
};

// Auto-init em desenvolvimento
if (isDev && typeof window !== 'undefined') {
  init();
}

export default PerformanceMonitor;
