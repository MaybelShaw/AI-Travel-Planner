/**
 * 优化的API密钥管理Hook
 */
import { useState, useCallback, useEffect } from 'react';
import { apiKeyAPI, llmApiKeyAPI, voiceApiKeyAPI } from '../services/api';
import { withOptimization, debounce } from '../utils/apiOptimization';

interface APIKey {
  id: number;
  service: string;
  serviceName: string;
  isValid: boolean;
  lastValidated?: string;
  isActive: boolean;
  baseUrl?: string;
  model?: string;
  modelName?: string;
  maskedKey?: string;
  appid?: string;
  maskedSecret?: string;
}

interface UseOptimizedApiKeysResult {
  apiKeys: APIKey[];
  isLoading: boolean;
  error: string | null;
  fetchApiKeys: (forceRefresh?: boolean) => Promise<void>;
  refreshApiKeys: () => void;
}

const apiServices = [
  { code: 'llm', name: 'LLM服务' },
  { code: 'voice', name: '语音识别' },
  { code: 'maps', name: '地图服务' },
];

export function useOptimizedApiKeys(): UseOptimizedApiKeysResult {
  const [apiKeys, setApiKeys] = useState<APIKey[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 优化的API调用函数
  const optimizedFetchOldKeys = withOptimization(
    () => apiKeyAPI.list(),
    { cacheKey: 'old_api_keys', cacheTTL: 30000 }
  );

  const optimizedFetchLLMKeys = withOptimization(
    () => llmApiKeyAPI.list(),
    { cacheKey: 'llm_api_keys', cacheTTL: 30000 }
  );

  const optimizedFetchVoiceKeys = withOptimization(
    () => voiceApiKeyAPI.list(),
    { cacheKey: 'voice_api_keys', cacheTTL: 30000 }
  );

  const fetchApiKeys = useCallback(async (forceRefresh = false) => {
    if (isLoading) {
      console.log('API调用已在进行中，跳过重复请求');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log('开始获取API密钥', { forceRefresh });

      // 如果强制刷新，清除缓存
      if (forceRefresh) {
        const { apiCache } = await import('../utils/apiOptimization');
        apiCache.clear();
      }

      // 并行调用所有API接口
      const [oldKeysResult, llmKeysResult, voiceKeysResult] = await Promise.allSettled([
        optimizedFetchOldKeys(),
        optimizedFetchLLMKeys(),
        optimizedFetchVoiceKeys()
      ]);

      // 处理旧的API密钥
      let oldKeys: APIKey[] = [];
      if (oldKeysResult.status === 'fulfilled') {
        oldKeys = oldKeysResult.value.data.map((key: any) => ({
          id: key.id,
          service: key.service,
          serviceName: apiServices.find(s => s.code === key.service)?.name || key.service,
          isValid: key.is_valid,
          lastValidated: key.last_validated,
          isActive: key.is_active,
          baseUrl: key.base_url,
          modelName: key.model_name,
          maskedKey: key.masked_key,
        }));
      } else {
        console.warn('获取旧API密钥失败:', oldKeysResult.reason);
      }

      // 处理新的LLM API密钥
      let llmKeys: APIKey[] = [];
      if (llmKeysResult.status === 'fulfilled') {
        llmKeys = llmKeysResult.value.data.map((key: any) => ({
          id: key.id,
          service: 'llm',
          serviceName: 'LLM服务',
          isValid: key.is_valid,
          lastValidated: key.last_validated,
          isActive: key.is_active,
          baseUrl: key.base_url,
          model: key.model,
          maskedKey: key.masked_key,
        }));
      } else {
        console.warn('获取LLM API密钥失败:', llmKeysResult.reason);
      }

      // 处理新的语音识别 API密钥
      let voiceKeys: APIKey[] = [];
      if (voiceKeysResult.status === 'fulfilled') {
        voiceKeys = voiceKeysResult.value.data.map((key: any) => ({
          id: key.id,
          service: 'voice',
          serviceName: '语音识别',
          isValid: key.is_valid,
          lastValidated: key.last_validated,
          isActive: key.is_active,
          appid: key.appid,
          maskedKey: key.masked_key,
          maskedSecret: key.masked_secret,
        }));
      } else {
        console.warn('获取语音识别 API密钥失败:', voiceKeysResult.reason);
      }

      // 合并所有密钥，新接口优先
      const allKeys = [...llmKeys, ...voiceKeys];
      
      // 添加旧接口中不在新接口中的密钥
      oldKeys.forEach((oldKey) => {
        const hasNewKey = allKeys.some((newKey) => 
          newKey.service === oldKey.service
        );
        if (!hasNewKey) {
          allKeys.push(oldKey);
        }
      });

      setApiKeys(allKeys);
      console.log('API密钥获取完成', { count: allKeys.length });

    } catch (error) {
      console.error('获取API密钥失败:', error);
      setError('获取API密钥失败');
    } finally {
      setIsLoading(false);
    }
  }, [isLoading]);

  // 防抖版本的刷新函数
  const debouncedRefresh = useCallback(
    debounce(() => {
      fetchApiKeys(true);
    }, 1000),
    [fetchApiKeys]
  );

  // 初始化时获取数据
  useEffect(() => {
    fetchApiKeys();
  }, []); // 只在组件挂载时执行一次

  return {
    apiKeys,
    isLoading,
    error,
    fetchApiKeys,
    refreshApiKeys: debouncedRefresh,
  };
}