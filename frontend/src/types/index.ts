// 用户相关类型
export interface User {
  id: number;
  username: string;
}

export interface AuthTokens {
  access: string;
  refresh: string;
}

export interface LoginResponse {
  message: string;
  user: User;
  tokens: {
    access_token: string;
    refresh_token: string;
  };
}

export interface RegisterResponse {
  message: string;
  user: User;
  tokens: {
    access_token: string;
    refresh_token: string;
  };
}

// 旅行计划相关类型
export interface TravelPlan {
  id: number;
  user: number;
  title: string;
  itinerary: any; // JSON数据，结构可能变化
  expenses: any[];
  status?: string;
  budget_limit?: number;
  currency?: string;
  preferences?: object;
  voice_notes?: any[];
  created_at: string;
  updated_at?: string;
}

export interface TravelPlanCreate {
  user_input: string;
}

// 费用相关类型
export interface ExpenseEntry {
  id: number;
  travel_plan: number;
  amount: string;
  currency: string;
  category: string;
  description: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  receipt_image?: string;
  voice_note?: string;
  created_at: string;
  is_synced: boolean;
}

export interface ExpenseCategory {
  code: string;
  name: string;
}

export interface ExpenseStatistics {
  summary: {
    total_amount: number;
    count: number;
    average_amount: number;
  };
  by_category: {
    [key: string]: {
      name: string;
      total: number;
      count: number;
      percentage: number;
    };
  };
  by_date: Array<{
    date: string;
    total: number;
    count: number;
  }>;
  period: {
    start_date?: string;
    end_date?: string;
  };
}

// 预算相关类型
export interface BudgetBreakdown {
  [category: string]: {
    budget: number;
    percentage: number;
    daily_average?: number;
  };
}

export interface BudgetStatus {
  [category: string]: {
    budgeted: number;
    spent: number;
    remaining: number;
    usage_percentage: number;
    status: 'healthy' | 'warning' | 'critical' | 'over_budget';
  };
}

export interface BudgetAnalysis {
  success: boolean;
  budget_breakdown: BudgetBreakdown;
  actual_expenses: {
    [category: string]: {
      spent: number;
      count: number;
      items: Array<{
        amount: number;
        description: string;
        date: string;
      }>;
    };
  };
  budget_status: BudgetStatus;
  optimization_suggestions: Array<{
    category: string;
    type: 'warning' | 'opportunity' | 'ai_suggestion';
    message: string;
    priority: 'high' | 'medium' | 'low';
  }>;
  analysis_date: string;
}

// 语音相关类型
export interface VoiceRecordingState {
  isRecording: boolean;
  isPaused: boolean;
  recordingTime: number;
  audioBlob?: Blob;
  audioUrl?: string;
}

export interface VoiceCommandResult {
  success: boolean;
  transcription?: string;
  intent?: string;
  entities?: object;
  response?: string;
  confidence?: number;
  error?: string;
}

// 地图相关类型
export interface MapLocation {
  latitude: number;
  longitude: number;
  address?: string;
  name?: string;
}

export interface RoutePoint extends MapLocation {
  order: number;
  type: 'accommodation' | 'attraction' | 'restaurant' | 'transportation';
  name: string; // 覆盖MapLocation中的可选name，使其必需
}

export interface GeocodeResult {
  address: string;
  formatted_address: string;
  lng: number;
  lat: number;
  province: string;
  city: string;
  district: string;
  adcode: string;
}

export interface POIResult {
  name: string;
  address: string;
  lng: number;
  lat: number;
  type: string;
  tel: string;
  distance: string;
  adcode: string;
}

export interface RouteStep {
  instruction: string;
  distance: number;
  duration: number;
  polyline: string;
  action: string;
  road: string;
}

export interface RouteResult {
  distance: number; // 总距离（米）
  duration: number; // 总时间（秒）
  tolls: number; // 过路费（元）
  traffic_lights: number; // 红绿灯数量
  polyline: string; // 路线坐标串
  steps: RouteStep[];
  origin: { lng: number; lat: number };
  destination: { lng: number; lat: number };
  waypoints: Array<{ lng: number; lat: number }>;
}

export interface DistanceResult {
  distance: number; // 距离（米）
  duration: number; // 时间（秒）
  origin_index: number;
  destination_index: number;
}

export interface RouteSettings {
  strategy: string;
  avoidTolls: boolean;
  avoidHighways: boolean;
  travelMode: string;
}

// API响应类型
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  errors?: object;
}

// 表单相关类型
export interface LoginForm {
  username: string;
  password: string;
}

export interface RegisterForm {
  username: string;
  password: string;
  password2: string;
}

export interface ExpenseForm {
  travel_plan: number;
  amount: string;
  category: string;
  description: string;
  currency?: string;
}

export interface BudgetPlanForm {
  destination: string;
  days: number;
  total_budget: string;
  preferences?: {
    focus_on_comfort?: boolean;
    focus_on_experience?: boolean;
    budget_conscious?: boolean;
  };
}