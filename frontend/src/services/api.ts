import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

// 创建axios实例
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器 - 添加认证token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器 - 处理token过期
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Token过期，清除本地存储并重定向到登录页
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// 认证相关API
export const authAPI = {
  register: (data: { username: string; password: string; password2: string }) =>
    api.post('/auth/register/', data),
  
  login: (data: { username: string; password: string }) =>
    api.post('/auth/login/', data),
  
  logout: () => api.post('/auth/logout/'),
  
  getProfile: () => api.get('/auth/profile/'),
};

// 旅行计划相关API
export const travelPlanAPI = {
  list: () => api.get('/travelplans/'),
  
  create: (data: { user_input: string }) =>
    api.post('/travelplans/create/', data),
  
  get: (id: number) => api.get(`/travelplans/${id}/`),
  
  update: (id: number, data: { user_input: string }) =>
    api.patch(`/travelplans/${id}/`, data),
  
  delete: (id: number) => api.delete(`/travelplans/${id}/`),
  
  addExpense: (id: number, data: { amount: number; category: string; note?: string }) =>
    api.post(`/travelplans/${id}/add_expense/`, data),
  
  geocode: (id: number, data: { address: string }) =>
    api.post(`/travelplans/${id}/geocode/`, data),
  
  checkApiKeys: () => api.get('/travelplans/check-api-keys/'),
};

// API密钥管理相关API
export const apiKeyAPI = {
  list: () => api.get('/api-keys/'),
  
  create: (data: {
    service: string;
    api_key: string;
    base_url?: string;
    model_name?: string;
    extra_config?: object;
  }) => api.post('/api-keys/', data),
  
  update: (id: number, data: {
    service?: string;
    api_key?: string;
    base_url?: string;
    model_name?: string;
    extra_config?: object;
  }) => api.patch(`/api-keys/${id}/`, data),
  
  delete: (id: number) => api.delete(`/api-keys/${id}/`),
  
  test: (id: number) => api.post(`/api-keys/${id}/test_connection/`),
};

// LLM API密钥管理
export const llmApiKeyAPI = {
  list: () => api.get('/llm-api-keys/'),
  
  create: (data: {
    apikey: string;
    base_url: string;
    model: string;
    max_tokens?: number;
    temperature?: number;
  }) => api.post('/llm-api-keys/', data),
  
  update: (id: number, data: {
    apikey?: string;
    base_url?: string;
    model?: string;
    max_tokens?: number;
    temperature?: number;
  }) => api.patch(`/llm-api-keys/${id}/`, data),
  
  delete: (id: number) => api.delete(`/llm-api-keys/${id}/`),
  
  test: (id: number) => api.post(`/llm-api-keys/${id}/test_connection/`),
};

// 语音识别 API密钥管理
export const voiceApiKeyAPI = {
  list: () => api.get('/voice-api-keys/'),
  
  create: (data: {
    appid: string;
    apisecret: string;
    apikey: string;
    language?: string;
    accent?: string;
  }) => api.post('/voice-api-keys/', data),
  
  update: (id: number, data: {
    appid?: string;
    apisecret?: string;
    apikey?: string;
    language?: string;
    accent?: string;
  }) => api.patch(`/voice-api-keys/${id}/`, data),
  
  delete: (id: number) => api.delete(`/voice-api-keys/${id}/`),
  
  test: (id: number) => api.post(`/voice-api-keys/${id}/test_connection/`),
};

// 费用管理相关API
export const expenseAPI = {
  list: (params?: { travel_plan_id?: number; category?: string; start_date?: string; end_date?: string }) =>
    api.get('/expenses/', { params }),
  
  create: (data: {
    travel_plan: number;
    amount: string;
    category: string;
    description: string;
    currency?: string;
  }) => api.post('/expenses/', data),
  
  update: (id: number, data: Partial<{
    amount: string;
    category: string;
    description: string;
  }>) => api.patch(`/expenses/${id}/`, data),
  
  delete: (id: number) => api.delete(`/expenses/${id}/`),
  
  voiceRecord: (data: { travel_plan_id: number; audio_data?: string; audio_file?: File }) => {
    const formData = new FormData();
    formData.append('travel_plan_id', data.travel_plan_id.toString());
    if (data.audio_file) {
      formData.append('audio_file', data.audio_file);
    }
    if (data.audio_data) {
      formData.append('audio_data', data.audio_data);
    }
    return api.post('/expenses/voice-record/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  
  categories: () => api.get('/expenses/categories/'),
  
  batchCreate: (data: { expenses: Array<{
    travel_plan: number;
    amount: string;
    category: string;
    description: string;
  }> }) => api.post('/expenses/batch-create/', data),
  
  statistics: (data: {
    travel_plan_id: number;
    start_date?: string;
    end_date?: string;
    category?: string;
  }) => api.post('/expenses/statistics/', data),
};

// 预算管理相关API
export const budgetAPI = {
  analyze: (data: { travel_plan_id: number }) =>
    api.post('/budget/analyze/', data),
  
  breakdown: (data: {
    destination: string;
    days: number;
    total_budget: string;
    preferences?: object;
  }) => api.post('/budget/breakdown/', data),
  
  predictExpenses: (data: { itinerary: object }) =>
    api.post('/budget/predict-expenses/', data),
  
  status: (travelPlanId: number) =>
    api.get(`/budget/status/${travelPlanId}/`),
  
  recommendations: (params: { travel_plan_id: number }) =>
    api.get('/budget/recommendations/', { params }),
};

// 语音识别相关API
export const voiceAPI = {
  transcribe: (audioBlob: Blob) => {
    const formData = new FormData();
    formData.append('audio_file', audioBlob, 'recording.webm');
    return api.post('/voice/transcribe/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
};

// 地图服务相关API
export const mapAPI = {
  // 地理编码：地址转坐标
  geocode: (data: { address: string; travel_plan_id?: number }) => {
    if (data.travel_plan_id) {
      return api.post(`/travelplans/${data.travel_plan_id}/geocode/`, { address: data.address });
    }
    return api.post('/map/geocode/', data);
  },
  
  // 逆地理编码：坐标转地址
  reverseGeocode: (data: { lng: number; lat: number }) =>
    api.post('/map/reverse-geocode/', data),
  
  // POI搜索
  searchPOI: (data: { keyword: string; city?: string; limit?: number }) =>
    api.post('/map/search-poi/', data),
  
  // 批量地理编码
  batchGeocode: (data: { addresses: string[] }) =>
    api.post('/map/batch-geocode/', data),
  
  // 路线规划
  planRoute: (data: { 
    origin: { lng: number; lat: number }; 
    destination: { lng: number; lat: number };
    waypoints?: Array<{ lng: number; lat: number }>;
    strategy?: string; // 路线策略：fastest, shortest, avoid_traffic
  }) => api.post('/map/plan-route/', data),
  
  // 获取两点间距离和时间
  getDistance: (data: {
    origins: Array<{ lng: number; lat: number }>;
    destinations: Array<{ lng: number; lat: number }>;
    type?: string; // 出行方式：walking, driving, transit
  }) => api.post('/map/distance/', data),
  
  // 周边搜索
  searchNearby: (data: {
    location: { lng: number; lat: number };
    keyword?: string;
    type?: string; // POI类型
    radius?: number; // 搜索半径（米）
    limit?: number;
  }) => api.post('/map/search-nearby/', data),
};

export default api;