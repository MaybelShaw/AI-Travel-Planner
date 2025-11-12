/**
 * API调用优化工具
 */

// 请求缓存接口
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiry: number;
}

// 简单的内存缓存
class SimpleCache<T> {
  private cache = new Map<string, CacheEntry<T>>();

  set(key: string, data: T, ttl: number = 30000): void {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      expiry: Date.now() + ttl,
    };
    this.cache.set(key, entry);
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  clear(): void {
    this.cache.clear();
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) {
      return false;
    }

    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }
}

// 请求去重器
class RequestDeduplicator {
  private pendingRequests = new Map<string, Promise<any>>();

  async deduplicate<T>(key: string, requestFn: () => Promise<T>): Promise<T> {
    // 如果已有相同的请求在进行中，返回该请求的Promise
    if (this.pendingRequests.has(key)) {
      return this.pendingRequests.get(key) as Promise<T>;
    }

    // 创建新的请求
    const promise = requestFn().finally(() => {
      // 请求完成后清理
      this.pendingRequests.delete(key);
    });

    this.pendingRequests.set(key, promise);
    return promise;
  }

  clear(): void {
    this.pendingRequests.clear();
  }
}

// 防抖函数
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// 节流函数
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

// 创建全局实例
export const apiCache = new SimpleCache();
export const requestDeduplicator = new RequestDeduplicator();

// API调用优化装饰器
export function withOptimization<T>(
  requestFn: () => Promise<T>,
  options: {
    cacheKey?: string;
    cacheTTL?: number;
    enableDeduplication?: boolean;
  } = {}
): () => Promise<T> {
  const {
    cacheKey,
    cacheTTL = 30000,
    enableDeduplication = true,
  } = options;

  return async (): Promise<T> => {
    // 检查缓存
    if (cacheKey && apiCache.has(cacheKey)) {
      const cachedData = apiCache.get(cacheKey);
      if (cachedData !== null) {
        console.log(`使用缓存数据: ${cacheKey}`);
        return cachedData as T;
      }
    }

    // 请求去重
    const requestKey = cacheKey || `request_${Date.now()}`;
    const executeRequest = async () => {
      console.log(`执行API请求: ${requestKey}`);
      const data = await requestFn();
      
      // 缓存结果
      if (cacheKey) {
        apiCache.set(cacheKey, data, cacheTTL);
      }
      
      return data;
    };

    if (enableDeduplication) {
      return requestDeduplicator.deduplicate(requestKey, executeRequest);
    } else {
      return executeRequest();
    }
  };
}

// 批量请求优化
export class BatchRequestManager {
  private batches = new Map<string, {
    requests: Array<() => Promise<any>>;
    timeout: NodeJS.Timeout;
  }>();

  addToBatch<T>(
    batchKey: string,
    requestFn: () => Promise<T>,
    delay: number = 100
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const batch = this.batches.get(batchKey) || {
        requests: [],
        timeout: setTimeout(() => this.executeBatch(batchKey), delay),
      };

      batch.requests.push(async () => {
        try {
          const result = await requestFn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });

      this.batches.set(batchKey, batch);
    });
  }

  private async executeBatch(batchKey: string): Promise<void> {
    const batch = this.batches.get(batchKey);
    if (!batch) return;

    this.batches.delete(batchKey);
    
    // 并行执行所有请求
    await Promise.allSettled(
      batch.requests.map(request => request())
    );
  }
}

export const batchRequestManager = new BatchRequestManager();