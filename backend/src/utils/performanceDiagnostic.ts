/**
 * 🔍 BACKEND PERFORMANCE DIAGNOSTIC
 * 
 * Monitora queries SQL, tempo de processamento e recursos
 */

interface PerformanceMetric {
  duration: number;
  timestamp: string;
  metadata?: any;
}

interface QueryMetric extends PerformanceMetric {
  sql: string;
  rowCount?: number;
  cached?: boolean;
}

class BackendPerformanceDiagnostic {
  private metrics: Map<string, PerformanceMetric> = new Map();
  private timers: Map<string, number> = new Map();
  private queryMetrics: QueryMetric[] = [];
  private enabled: boolean = true;

  start(label: string): void {
    if (!this.enabled) return;
    
    const timestamp = Date.now();
    this.timers.set(label, timestamp);
    
    console.log(`[PERF] 🟢 START: ${label} | Time: ${new Date().toISOString()}`);
  }

  end(label: string, metadata?: any): number | undefined {
    if (!this.enabled || !this.timers.has(label)) return;
    
    const startTime = this.timers.get(label)!;
    const duration = Date.now() - startTime;
    
    this.metrics.set(label, {
      duration,
      timestamp: new Date().toISOString(),
      metadata,
    });
    
    const color = duration < 100 ? '🟢' : duration < 500 ? '🟡' : '🔴';
    
    console.log(`[PERF] ${color} END: ${label} | Duration: ${duration}ms`, metadata || '');
    
    this.timers.delete(label);
    
    return duration;
  }

  trackQuery(sql: string, duration: number, rowCount?: number): void {
    if (!this.enabled) return;
    
    const color = duration < 50 ? '🟢' : duration < 200 ? '🟡' : '🔴';
    
    this.queryMetrics.push({
      sql: sql.substring(0, 150),
      duration,
      rowCount,
      timestamp: new Date().toISOString(),
    });
    
    console.log(`[PERF] ${color} QUERY: ${duration}ms | Rows: ${rowCount || 'N/A'} | ${sql.substring(0, 80)}...`);
    
    // Alerta para queries lentas
    if (duration > 200) {
      console.warn(`[PERF] ⚠️ SLOW QUERY DETECTED: ${duration}ms\n${sql}`);
    }
  }

  mark(label: string, data?: any): void {
    if (!this.enabled) return;
    
    console.log(`[PERF] 📍 MARK: ${label}`, data || '');
  }

  reportSummary(): void {
    console.log('\n\n[PERF] 📊 ========== BACKEND PERFORMANCE SUMMARY ==========\n');
    
    console.log('🎯 Operation Timings:');
    const sortedMetrics = Array.from(this.metrics.entries())
      .sort((a, b) => b[1].duration - a[1].duration);
    
    sortedMetrics.forEach(([label, data]) => {
      const color = data.duration < 100 ? '🟢' : data.duration < 500 ? '🟡' : '🔴';
      console.log(`  ${color} ${label}: ${data.duration}ms`);
    });
    
    console.log('\n📊 Query Statistics:');
    if (this.queryMetrics.length > 0) {
      const totalQueryTime = this.queryMetrics.reduce((sum, q) => sum + q.duration, 0);
      const avgQueryTime = totalQueryTime / this.queryMetrics.length;
      const slowQueries = this.queryMetrics.filter(q => q.duration > 200);
      
      console.log(`  Total Queries: ${this.queryMetrics.length}`);
      console.log(`  Total Query Time: ${totalQueryTime.toFixed(2)}ms`);
      console.log(`  Average Query Time: ${avgQueryTime.toFixed(2)}ms`);
      console.log(`  Slow Queries (>200ms): ${slowQueries.length}`);
      
      if (slowQueries.length > 0) {
        console.log('\n  ⚠️ Top 5 Slowest Queries:');
        slowQueries
          .sort((a, b) => b.duration - a.duration)
          .slice(0, 5)
          .forEach((q, i) => {
            console.log(`    ${i + 1}. ${q.duration}ms | ${q.sql.substring(0, 100)}...`);
          });
      }
    } else {
      console.log('  No queries tracked');
    }
    
    console.log('\n========================================================\n\n');
  }

  reset(): void {
    this.metrics.clear();
    this.timers.clear();
    this.queryMetrics = [];
    console.log('[PERF] 🔄 Metrics reset');
  }

  enable(): void {
    this.enabled = true;
    console.log('[PERF] ✅ Backend performance monitoring enabled');
  }

  disable(): void {
    this.enabled = false;
    console.log('[PERF] ❌ Backend performance monitoring disabled');
  }

  getMetrics() {
    return {
      operations: Array.from(this.metrics.entries()),
      queries: this.queryMetrics,
      summary: {
        totalQueries: this.queryMetrics.length,
        totalQueryTime: this.queryMetrics.reduce((sum, q) => sum + q.duration, 0),
        slowQueries: this.queryMetrics.filter(q => q.duration > 200).length,
      }
    };
  }
}

export const BackendPerfMonitor = new BackendPerformanceDiagnostic();

// Middleware Express para tracking
export const performanceMiddleware = (req: any, res: any, next: any) => {
  const label = `${req.method} ${req.path}`;
  BackendPerfMonitor.start(label);
  
  const originalSend = res.send;
  res.send = function(data: any) {
    BackendPerfMonitor.end(label, { 
      statusCode: res.statusCode,
      contentLength: data?.length 
    });
    originalSend.call(this, data);
  };
  
  next();
};

// Helper para medir funções async
export const measureAsync = async <T>(label: string, fn: () => Promise<T>): Promise<T> => {
  BackendPerfMonitor.start(label);
  try {
    const result = await fn();
    BackendPerfMonitor.end(label);
    return result;
  } catch (error) {
    BackendPerfMonitor.end(label, { error: true });
    throw error;
  }
};

// Auto-report após 60 segundos
setTimeout(() => {
  BackendPerfMonitor.reportSummary();
}, 60000);

export default BackendPerfMonitor;
