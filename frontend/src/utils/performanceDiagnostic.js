/**
 * 🔍 PERFORMANCE DIAGNOSTIC TOOL
 * 
 * Monitora e reporta métricas de performance em tempo real
 * Para usar: import { PerformanceMonitor } from './utils/performanceDiagnostic'
 * 
 * No componente: useEffect(() => { PerformanceMonitor.start('TicketsScreen'); }, []);
 */

class PerformanceDiagnostic {
  constructor() {
    this.metrics = {};
    this.timers = {};
    this.renderCounts = {};
    this.enabled = true;
  }

  start(label) {
    if (!this.enabled) return;
    
    const timestamp = performance.now();
    this.timers[label] = {
      start: timestamp,
      memoryStart: this.getMemoryUsage(),
    };
    
    console.log(`[PERF] 🟢 START: ${label} | Memory: ${this.timers[label].memoryStart}MB`);
  }

  end(label) {
    if (!this.enabled || !this.timers[label]) return;
    
    const duration = performance.now() - this.timers[label].start;
    const memoryEnd = this.getMemoryUsage();
    const memoryDelta = memoryEnd - this.timers[label].memoryStart;
    
    this.metrics[label] = {
      duration,
      memoryStart: this.timers[label].memoryStart,
      memoryEnd,
      memoryDelta,
      timestamp: new Date().toISOString(),
    };
    
    // Color coding baseado na duração
    const color = duration < 100 ? '🟢' : duration < 500 ? '🟡' : '🔴';
    
    console.log(`[PERF] ${color} END: ${label} | Duration: ${duration.toFixed(2)}ms | Memory Δ: ${memoryDelta > 0 ? '+' : ''}${memoryDelta.toFixed(2)}MB`);
    
    delete this.timers[label];
    
    return this.metrics[label];
  }

  mark(label, data = {}) {
    if (!this.enabled) return;
    
    const memory = this.getMemoryUsage();
    console.log(`[PERF] 📍 MARK: ${label} | Memory: ${memory}MB`, data);
  }

  trackRender(componentName) {
    if (!this.enabled) return;
    
    this.renderCounts[componentName] = (this.renderCounts[componentName] || 0) + 1;
    
    if (this.renderCounts[componentName] > 10) {
      console.warn(`[PERF] ⚠️ EXCESSIVE RENDERS: ${componentName} rendered ${this.renderCounts[componentName]} times`);
    }
  }

  getMemoryUsage() {
    if (performance.memory) {
      return (performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(2);
    }
    return 0;
  }

  measureAPI(endpoint, startTime) {
    const duration = performance.now() - startTime;
    const color = duration < 200 ? '🟢' : duration < 1000 ? '🟡' : '🔴';
    
    console.log(`[PERF] ${color} API: ${endpoint} | Duration: ${duration.toFixed(2)}ms`);
    
    return duration;
  }

  reportSummary() {
    console.group('[PERF] 📊 PERFORMANCE SUMMARY');
    
    console.log('\n🎯 Timings:');
    Object.entries(this.metrics).forEach(([label, data]) => {
      const color = data.duration < 100 ? '🟢' : data.duration < 500 ? '🟡' : '🔴';
      console.log(`  ${color} ${label}: ${data.duration.toFixed(2)}ms`);
    });
    
    console.log('\n🔁 Render Counts:');
    Object.entries(this.renderCounts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([component, count]) => {
        const color = count < 5 ? '🟢' : count < 15 ? '🟡' : '🔴';
        console.log(`  ${color} ${component}: ${count} renders`);
      });
    
    console.log('\n💾 Memory:', this.getMemoryUsage(), 'MB');
    
    console.groupEnd();
  }

  reset() {
    this.metrics = {};
    this.timers = {};
    this.renderCounts = {};
    console.log('[PERF] 🔄 Metrics reset');
  }

  enable() {
    this.enabled = true;
    console.log('[PERF] ✅ Performance monitoring enabled');
  }

  disable() {
    this.enabled = false;
    console.log('[PERF] ❌ Performance monitoring disabled');
  }
}

export const PerformanceMonitor = new PerformanceDiagnostic();

// Hook React para tracking automático
export const usePerformanceTracking = (componentName) => {
  const renderCount = React.useRef(0);
  
  React.useEffect(() => {
    renderCount.current++;
    PerformanceMonitor.trackRender(componentName);
  });
  
  return {
    renderCount: renderCount.current,
    startTimer: (label) => PerformanceMonitor.start(`${componentName}:${label}`),
    endTimer: (label) => PerformanceMonitor.end(`${componentName}:${label}`),
    mark: (label, data) => PerformanceMonitor.mark(`${componentName}:${label}`, data),
  };
};

// Helper para medir async operations
export const measureAsync = async (label, asyncFn) => {
  PerformanceMonitor.start(label);
  try {
    const result = await asyncFn();
    PerformanceMonitor.end(label);
    return result;
  } catch (error) {
    PerformanceMonitor.end(label);
    throw error;
  }
};

// Auto-report após 30 segundos
if (typeof window !== 'undefined') {
  setTimeout(() => {
    PerformanceMonitor.reportSummary();
  }, 30000);
}

export default PerformanceMonitor;
