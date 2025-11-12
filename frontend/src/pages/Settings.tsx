import React, { useState, useEffect, useCallback } from 'react';
import {
  Container,
  Paper,
  Box,
  Typography,
  Tabs,
  Tab,
  TextField,
  Button,
  Card,
  CardContent,
  CardActions,
  Switch,
  FormControlLabel,
  Alert,
  Divider,
  IconButton,
  InputAdornment,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  AppBar,
  Toolbar,
  CircularProgress,
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  Save,
  PlayArrow as Test,
  Add,
  Edit,
  Delete,
  CheckCircle,
  Error,
  Mic,
  Map,
  Psychology,
  ArrowBack,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { apiKeyAPI, llmApiKeyAPI, voiceApiKeyAPI } from '../services/api';

// 防抖函数
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`settings-tabpanel-${index}`}
      aria-labelledby={`settings-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

interface APIKey {
  id: number;
  service: string;
  serviceName: string;
  isValid: boolean;
  lastValidated?: string;
  isActive: boolean;
  baseUrl?: string;
  model?: string;
  modelName?: string; // 保持向后兼容
  maskedKey?: string;
  appid?: string;
  maskedSecret?: string;
}

const Settings: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tabValue, setTabValue] = useState(0);
  const [apiKeys, setApiKeys] = useState<APIKey[]>([]);
  const [showApiKey, setShowApiKey] = useState<{ [key: string]: boolean }>({});
  const [newApiKey, setNewApiKey] = useState({ 
    service: '', 
    key: '', 
    name: '', 
    baseUrl: '', 
    model: '',
    modelName: '', // 保持向后兼容
    appid: '',
    apiSecret: '',
    extraConfig: {} as Record<string, string>
  });
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [testingApiKey, setTestingApiKey] = useState<number | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [deletingApiKey, setDeletingApiKey] = useState<number | null>(null);
  const [message, setMessage] = useState({ type: '', text: '' });
  
  // 缓存相关状态
  const [lastFetchTime, setLastFetchTime] = useState(0);
  const CACHE_DURATION = 30000; // 30秒缓存
  
  // 用户偏好设置
  const [preferences, setPreferences] = useState({
    language: 'zh-CN',
    currency: 'CNY',
    voiceEnabled: true,
    autoSync: true,
    notifications: true,
    theme: 'light',
  });

  // API服务配置
  const apiServices = [
    {
      code: 'llm',
      name: 'LLM服务',
      description: '用于智能行程规划和对话',
      icon: <Psychology />,
      placeholder: 'sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    },
    {
      code: 'voice',
      name: '语音识别',
      description: '科大讯飞语音识别服务',
      icon: <Mic />,
      placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      extraFields: [
        { key: 'appid', label: 'APPID', placeholder: 'xxxxxxxx' },
        { key: 'apisecret', label: 'API Secret', placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' }
      ]
    },

    {
      code: 'maps',
      name: '地图服务',
      description: '高德地图或百度地图API',
      icon: <Map />,
      placeholder: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    },
  ];

  // 获取API密钥列表
  const fetchApiKeys = useCallback(async (forceRefresh = false) => {
    // 防止重复调用
    if (isLoading) {
      return;
    }
    
    // 检查缓存
    const now = Date.now();
    if (!forceRefresh && now - lastFetchTime < CACHE_DURATION && apiKeys.length > 0) {
      console.log('使用缓存的API密钥数据');
      return;
    }
    
    setIsLoading(true);
    try {
      // 并行调用所有API接口，但使用Promise.allSettled来处理失败的情况
      const [oldKeysResult, llmKeysResult, voiceKeysResult] = await Promise.allSettled([
        apiKeyAPI.list(),
        llmApiKeyAPI.list(),
        voiceApiKeyAPI.list()
      ]);

      // 处理旧的API密钥
      let oldKeys: any[] = [];
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
      }

      // 处理新的LLM API密钥
      let llmKeys: any[] = [];
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
        console.log('LLM API密钥接口不可用，使用旧接口');
      }

      // 处理新的语音识别 API密钥
      let voiceKeys: any[] = [];
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
        console.log('语音识别 API密钥接口不可用，使用旧接口');
      }

      // 合并所有密钥，新接口优先
      const allKeys = [...llmKeys, ...voiceKeys];
      
      // 添加旧接口中不在新接口中的密钥
      oldKeys.forEach((oldKey: any) => {
        const hasNewKey = allKeys.some((newKey: any) => 
          newKey.service === oldKey.service
        );
        if (!hasNewKey) {
          allKeys.push(oldKey);
        }
      });

      setApiKeys(allKeys);
      setLastFetchTime(Date.now());
    } catch (error) {
      console.error('获取API密钥失败:', error);
      setMessage({ type: 'error', text: '获取API密钥失败' });
    } finally {
      setIsLoading(false);
    }
  }, [apiServices, isLoading, lastFetchTime, apiKeys.length]);

  // 创建防抖版本的fetchApiKeys
  const debouncedFetchApiKeys = useCallback(
    debounce((forceRefresh = false) => {
      fetchApiKeys(forceRefresh);
    }, 1000),
    [fetchApiKeys]
  );

  // 使用ref来跟踪是否已经初始化
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (!isInitialized) {
      fetchApiKeys();
      setIsInitialized(true);
    }
  }, [isInitialized, fetchApiKeys]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const toggleApiKeyVisibility = (service: string) => {
    setShowApiKey(prev => ({
      ...prev,
      [service]: !prev[service],
    }));
  };

  const handleAddApiKey = async () => {
    if (!newApiKey.service || !newApiKey.key) {
      setMessage({ type: 'error', text: '请填写完整信息' });
      return;
    }

    // LLM服务需要额外验证
    if (newApiKey.service === 'llm') {
      if (!newApiKey.baseUrl || !newApiKey.model) {
        setMessage({ type: 'error', text: 'LLM服务需要填写Base URL和模型名称' });
        return;
      }
    }

    // 语音服务需要额外验证
    if (newApiKey.service === 'voice') {
      if (!newApiKey.appid || !newApiKey.apiSecret) {
        setMessage({ type: 'error', text: '语音识别服务需要填写APPID和API Secret' });
        return;
      }
    }

    setIsLoading(true);
    try {
      if (newApiKey.service === 'llm') {
        // 使用新的LLM API接口
        const data = {
          apikey: newApiKey.key,
          base_url: newApiKey.baseUrl,
          model: newApiKey.model,
        };
        await llmApiKeyAPI.create(data);
      } else if (newApiKey.service === 'voice') {
        // 使用新的语音识别 API接口
        const data = {
          appid: newApiKey.appid,
          apisecret: newApiKey.apiSecret,
          apikey: newApiKey.key,
        };
        await voiceApiKeyAPI.create(data);
      } else {
        // 使用旧的API接口
        const data: any = {
          service: newApiKey.service,
          api_key: newApiKey.key,
        };
        await apiKeyAPI.create(data);
      }
      
      // 重置表单
      setNewApiKey({ 
        service: '', 
        key: '', 
        name: '', 
        baseUrl: '', 
        model: '',
        modelName: '', 
        appid: '',
        apiSecret: '',
        extraConfig: {} 
      });
      setShowAddDialog(false);
      setMessage({ type: 'success', text: 'API密钥添加成功' });
      
      // 使用防抖刷新列表
      debouncedFetchApiKeys(true);
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || 
                      error.response?.data?.error || 
                      'API密钥添加失败';
      setMessage({ type: 'error', text: errorMsg });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestApiKey = async (keyId: number) => {
    setTestingApiKey(keyId);
    try {
      const apiKey = apiKeys.find(k => k.id === keyId);
      let response;
      
      if (apiKey?.service === 'llm') {
        response = await llmApiKeyAPI.test(keyId);
      } else if (apiKey?.service === 'voice') {
        response = await voiceApiKeyAPI.test(keyId);
      } else {
        response = await apiKeyAPI.test(keyId);
      }
      
      if (response.data.success) {
        setMessage({ type: 'success', text: response.data.message });
        // 使用防抖刷新列表
        debouncedFetchApiKeys(true);
      } else {
        setMessage({ type: 'error', text: response.data.message });
      }
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || 
                      error.response?.data?.error || 
                      'API密钥验证失败';
      setMessage({ type: 'error', text: errorMsg });
    } finally {
      setTestingApiKey(null);
    }
  };

  const handleDeleteApiKey = async (keyId: number) => {
    if (!window.confirm('确定要删除这个API密钥吗？')) {
      return;
    }

    setDeletingApiKey(keyId);
    try {
      const apiKey = apiKeys.find(k => k.id === keyId);
      
      if (apiKey?.service === 'llm') {
        await llmApiKeyAPI.delete(keyId);
      } else if (apiKey?.service === 'voice') {
        await voiceApiKeyAPI.delete(keyId);
      } else {
        await apiKeyAPI.delete(keyId);
      }
      
      setMessage({ type: 'success', text: 'API密钥删除成功' });
      // 使用防抖刷新列表
      debouncedFetchApiKeys(true);
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || '删除API密钥失败';
      setMessage({ type: 'error', text: errorMsg });
    } finally {
      setDeletingApiKey(null);
    }
  };

  const handleSavePreferences = async () => {
    setIsLoading(true);
    try {
      // 这里应该调用API保存用户偏好
      console.log('保存用户偏好:', preferences);
      
      // 模拟API调用
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setMessage({ type: 'success', text: '设置保存成功' });
    } catch (error) {
      setMessage({ type: 'error', text: '保存设置失败' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box>
      {/* 顶部导航栏 */}
      <AppBar position="static" elevation={1}>
        <Toolbar>
          <IconButton
            edge="start"
            color="inherit"
            onClick={() => navigate('/dashboard')}
            sx={{ mr: 2 }}
          >
            <ArrowBack />
          </IconButton>
          
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            设置
          </Typography>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        {/* 消息提示 */}
      {message.text && (
        <Alert 
          severity={message.type as any} 
          sx={{ mb: 3 }}
          onClose={() => setMessage({ type: '', text: '' })}
        >
          {message.text}
        </Alert>
      )}

      <Paper sx={{ width: '100%' }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={handleTabChange}>
            <Tab label="API密钥管理" />
            <Tab label="用户偏好" />
            <Tab label="账户设置" />
          </Tabs>
        </Box>

        {/* API密钥管理 */}
        <TabPanel value={tabValue} index={0}>
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              API密钥管理
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              配置您自己的API密钥以使用各种服务。密钥将被加密存储。
            </Typography>
            
            <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={() => setShowAddDialog(true)}
              >
                添加API密钥
              </Button>
              <Button
                variant="outlined"
                startIcon={checkingStatus ? <CircularProgress size={16} /> : undefined}
                disabled={checkingStatus}
                onClick={async () => {
                  setCheckingStatus(true);
                  try {
                    const response = await fetch('/api/travelplans/check-api-keys/', {
                      headers: {
                        'Authorization': `Bearer ${localStorage.getItem('access_token')}`
                      }
                    });
                    const data = await response.json();
                    setMessage({ 
                      type: data.has_required ? 'success' : 'warning', 
                      text: data.message 
                    });
                  } catch (err) {
                    setMessage({ type: 'error', text: '检查API密钥状态失败' });
                  } finally {
                    setCheckingStatus(false);
                  }
                }}
              >
                {checkingStatus ? '检查中...' : '检查状态'}
              </Button>
            </Box>
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
            {apiServices.map((service) => {
              const existingKey = apiKeys.find(k => k.service === service.code);
              
              return (
                <Box key={service.code}>
                  <Card>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                        {service.icon}
                        <Box sx={{ ml: 2 }}>
                          <Typography variant="h6">
                            {service.name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {service.description}
                          </Typography>
                        </Box>
                      </Box>

                      {existingKey ? (
                        <Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                            <Chip
                              icon={existingKey.isValid ? <CheckCircle /> : <Error />}
                              label={existingKey.isValid ? '已验证' : '未验证'}
                              color={existingKey.isValid ? 'success' : 'error'}
                              size="small"
                            />
                            {existingKey.lastValidated && (
                              <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                                最后验证: {new Date(existingKey.lastValidated).toLocaleDateString()}
                              </Typography>
                            )}
                          </Box>
                          
                          <Box>
                            {/* LLM服务字段 */}
                            {existingKey.service === 'llm' && (
                              <>
                                <TextField
                                  fullWidth
                                  size="small"
                                  label="API密钥"
                                  value={existingKey.maskedKey || '***'}
                                  InputProps={{
                                    readOnly: true,
                                  }}
                                  sx={{ mb: 1 }}
                                />
                                {existingKey.baseUrl && (
                                  <TextField
                                    fullWidth
                                    size="small"
                                    label="Base URL"
                                    value={existingKey.baseUrl}
                                    InputProps={{
                                      readOnly: true,
                                    }}
                                    sx={{ mb: 1 }}
                                  />
                                )}
                                {(existingKey.model || existingKey.modelName) && (
                                  <TextField
                                    fullWidth
                                    size="small"
                                    label="模型名称"
                                    value={existingKey.model || existingKey.modelName}
                                    InputProps={{
                                      readOnly: true,
                                    }}
                                  />
                                )}
                              </>
                            )}

                            {/* 语音识别服务字段 - 按APPID, API Secret, API Key顺序 */}
                            {existingKey.service === 'voice' && (
                              <>
                                {existingKey.appid && (
                                  <TextField
                                    fullWidth
                                    size="small"
                                    label="APPID"
                                    value={existingKey.appid}
                                    InputProps={{
                                      readOnly: true,
                                    }}
                                    sx={{ mb: 1 }}
                                  />
                                )}
                                {existingKey.maskedSecret && (
                                  <TextField
                                    fullWidth
                                    size="small"
                                    label="API Secret"
                                    value={existingKey.maskedSecret}
                                    InputProps={{
                                      readOnly: true,
                                    }}
                                    sx={{ mb: 1 }}
                                  />
                                )}
                                <TextField
                                  fullWidth
                                  size="small"
                                  label="API密钥"
                                  value={existingKey.maskedKey || '***'}
                                  InputProps={{
                                    readOnly: true,
                                  }}
                                />
                              </>
                            )}

                            {/* 其他服务字段 */}
                            {existingKey.service !== 'llm' && existingKey.service !== 'voice' && (
                              <>
                                <TextField
                                  fullWidth
                                  size="small"
                                  label="API密钥"
                                  value={existingKey.maskedKey || '***'}
                                  InputProps={{
                                    readOnly: true,
                                  }}
                                  sx={{ mb: 1 }}
                                />
                                {existingKey.baseUrl && (
                                  <TextField
                                    fullWidth
                                    size="small"
                                    label="Base URL"
                                    value={existingKey.baseUrl}
                                    InputProps={{
                                      readOnly: true,
                                    }}
                                    sx={{ mb: 1 }}
                                  />
                                )}
                                {(existingKey.model || existingKey.modelName) && (
                                  <TextField
                                    fullWidth
                                    size="small"
                                    label="模型名称"
                                    value={existingKey.model || existingKey.modelName}
                                    InputProps={{
                                      readOnly: true,
                                    }}
                                  />
                                )}
                              </>
                            )}
                          </Box>
                        </Box>
                      ) : (
                        <Alert severity="info" sx={{ mt: 1 }}>
                          未配置API密钥，将使用系统默认配置
                        </Alert>
                      )}
                    </CardContent>
                    
                    {existingKey && (
                      <CardActions>
                        <Button
                          size="small"
                          startIcon={testingApiKey === existingKey.id ? <CircularProgress size={16} /> : <Test />}
                          onClick={() => handleTestApiKey(existingKey.id)}
                          disabled={testingApiKey !== null}
                        >
                          {testingApiKey === existingKey.id ? '测试中...' : '测试'}
                        </Button>
                        <Button
                          size="small"
                          startIcon={<Edit />}
                          onClick={() => {
                            setNewApiKey({
                              service: service.code,
                              key: '',
                              name: service.name,
                              baseUrl: existingKey.baseUrl || '',
                              model: existingKey.model || '',
                              modelName: existingKey.modelName || '',
                              appid: existingKey.appid || '',
                              apiSecret: '',
                              extraConfig: {},
                            });
                            setShowAddDialog(true);
                          }}
                        >
                          编辑
                        </Button>
                        <Button
                          size="small"
                          color="error"
                          startIcon={deletingApiKey === existingKey.id ? <CircularProgress size={16} /> : <Delete />}
                          onClick={() => handleDeleteApiKey(existingKey.id)}
                          disabled={deletingApiKey !== null}
                        >
                          {deletingApiKey === existingKey.id ? '删除中...' : '删除'}
                        </Button>
                      </CardActions>
                    )}
                  </Card>
                </Box>
              );
            })}
          </Box>
        </TabPanel>

        {/* 用户偏好 */}
        <TabPanel value={tabValue} index={1}>
          <Typography variant="h6" gutterBottom>
            用户偏好设置
          </Typography>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  语言和地区
                </Typography>
                
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <TextField
                    label="界面语言"
                    select
                    value={preferences.language}
                    onChange={(e) => setPreferences(prev => ({ ...prev, language: e.target.value }))}
                    SelectProps={{ native: true }}
                  >
                    <option value="zh-CN">简体中文</option>
                    <option value="en-US">English</option>
                  </TextField>
                  
                  <TextField
                    label="默认货币"
                    select
                    value={preferences.currency}
                    onChange={(e) => setPreferences(prev => ({ ...prev, currency: e.target.value }))}
                    SelectProps={{ native: true }}
                  >
                    <option value="CNY">人民币 (¥)</option>
                    <option value="USD">美元 ($)</option>
                    <option value="EUR">欧元 (€)</option>
                  </TextField>
                </Box>
              </CardContent>
            </Card>

            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  功能设置
                </Typography>
                
                <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={preferences.voiceEnabled}
                        onChange={(e) => setPreferences(prev => ({ ...prev, voiceEnabled: e.target.checked }))}
                      />
                    }
                    label="启用语音功能"
                  />
                  
                  <FormControlLabel
                    control={
                      <Switch
                        checked={preferences.autoSync}
                        onChange={(e) => setPreferences(prev => ({ ...prev, autoSync: e.target.checked }))}
                      />
                    }
                    label="自动同步数据"
                  />
                  
                  <FormControlLabel
                    control={
                      <Switch
                        checked={preferences.notifications}
                        onChange={(e) => setPreferences(prev => ({ ...prev, notifications: e.target.checked }))}
                      />
                    }
                    label="推送通知"
                  />
                </Box>
              </CardContent>
            </Card>
          </Box>

          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              variant="contained"
              startIcon={<Save />}
              onClick={handleSavePreferences}
              disabled={isLoading}
            >
              保存设置
            </Button>
          </Box>
        </TabPanel>

        {/* 账户设置 */}
        <TabPanel value={tabValue} index={2}>
          <Typography variant="h6" gutterBottom>
            账户信息
          </Typography>

          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <TextField
                  label="用户名"
                  value={user?.username || ''}
                  disabled
                  sx={{ flex: '1 1 300px' }}
                />
                <TextField
                  label="注册时间"
                  value="2024-01-01"
                  disabled
                  sx={{ flex: '1 1 300px' }}
                />
              </Box>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom color="error">
                危险操作
              </Typography>
              <Divider sx={{ mb: 2 }} />
              
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box>
                  <Typography variant="subtitle1" gutterBottom>
                    更改密码
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    定期更改密码以保护账户安全
                  </Typography>
                  <Button variant="outlined">
                    更改密码
                  </Button>
                </Box>
                
                <Divider />
                
                <Box>
                  <Typography variant="subtitle1" gutterBottom color="error">
                    删除账户
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    永久删除您的账户和所有相关数据。此操作不可撤销。
                  </Typography>
                  <Button variant="outlined" color="error">
                    删除账户
                  </Button>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </TabPanel>
      </Paper>

      {/* API密钥测试等待对话框 */}
      <Dialog 
        open={testingApiKey !== null} 
        disableEscapeKeyDown
        PaperProps={{
          sx: { 
            minWidth: 300,
            textAlign: 'center',
            py: 3
          }
        }}
      >
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <CircularProgress size={48} />
            <Typography variant="h6">
              正在测试API密钥
            </Typography>
            <Typography variant="body2" color="text.secondary">
              请稍候，这可能需要几秒钟时间...
            </Typography>
          </Box>
        </DialogContent>
      </Dialog>

      {/* 添加API密钥对话框 */}
      <Dialog open={showAddDialog} onClose={() => setShowAddDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {newApiKey.service ? '编辑' : '添加'} API密钥
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="服务类型"
              select
              value={newApiKey.service}
              onChange={(e) => setNewApiKey(prev => ({ ...prev, service: e.target.value }))}
              required
              fullWidth
              SelectProps={{ native: true }}
            >
              <option value="">请选择服务</option>
              {apiServices.map((service) => (
                <option key={service.code} value={service.code}>
                  {service.name}
                </option>
              ))}
            </TextField>
            
            {newApiKey.service && (
              <>
                <Alert severity="info">
                  {apiServices.find(s => s.code === newApiKey.service)?.description}
                </Alert>
                
                {newApiKey.service === 'llm' && (
                  <TextField
                    label="API密钥"
                    type={showApiKey.new ? 'text' : 'password'}
                    value={newApiKey.key}
                    onChange={(e) => setNewApiKey(prev => ({ ...prev, key: e.target.value }))}
                    required
                    fullWidth
                    placeholder={apiServices.find(s => s.code === newApiKey.service)?.placeholder}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            onClick={() => toggleApiKeyVisibility('new')}
                            edge="end"
                          >
                            {showApiKey.new ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />
                )}

                {newApiKey.service === 'voice' && (
                  <>
                    <TextField
                      label="APPID"
                      value={newApiKey.appid}
                      onChange={(e) => setNewApiKey(prev => ({ 
                        ...prev, 
                        appid: e.target.value
                      }))}
                      required
                      fullWidth
                      placeholder="xxxxxxxx"
                      helperText="科大讯飞应用ID (APPID)"
                    />
                    
                    <TextField
                      label="API Secret"
                      type={showApiKey.secret ? 'text' : 'password'}
                      value={newApiKey.apiSecret}
                      onChange={(e) => setNewApiKey(prev => ({ 
                        ...prev, 
                        apiSecret: e.target.value
                      }))}
                      required
                      fullWidth
                      placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                      helperText="科大讯飞API Secret"
                      sx={{ mt: 2 }}
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton
                              onClick={() => toggleApiKeyVisibility('secret')}
                              edge="end"
                            >
                              {showApiKey.secret ? <VisibilityOff /> : <Visibility />}
                            </IconButton>
                          </InputAdornment>
                        ),
                      }}
                    />

                    <TextField
                      label="API密钥"
                      type={showApiKey.new ? 'text' : 'password'}
                      value={newApiKey.key}
                      onChange={(e) => setNewApiKey(prev => ({ ...prev, key: e.target.value }))}
                      required
                      fullWidth
                      placeholder={apiServices.find(s => s.code === newApiKey.service)?.placeholder}
                      helperText="科大讯飞API Key"
                      sx={{ mt: 2 }}
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton
                              onClick={() => toggleApiKeyVisibility('new')}
                              edge="end"
                            >
                              {showApiKey.new ? <VisibilityOff /> : <Visibility />}
                            </IconButton>
                          </InputAdornment>
                        ),
                      }}
                    />
                  </>
                )}

                {newApiKey.service === 'llm' && (
                  <>
                    <TextField
                      label="Base URL"
                      value={newApiKey.baseUrl}
                      onChange={(e) => setNewApiKey(prev => ({ ...prev, baseUrl: e.target.value }))}
                      required
                      fullWidth
                      placeholder="https://api.openai.com/v1"
                      helperText="API服务的基础URL地址"
                      sx={{ mt: 2 }}
                    />
                    
                    <TextField
                      label="模型名称"
                      value={newApiKey.model}
                      onChange={(e) => setNewApiKey(prev => ({ ...prev, model: e.target.value }))}
                      required
                      fullWidth
                      placeholder="gpt-3.5-turbo"
                      helperText="要使用的AI模型名称"
                      sx={{ mt: 2 }}
                    />
                  </>
                )}

                {/* 其他服务的API密钥字段 */}
                {newApiKey.service && newApiKey.service !== 'llm' && newApiKey.service !== 'voice' && (
                  <TextField
                    label="API密钥"
                    type={showApiKey.new ? 'text' : 'password'}
                    value={newApiKey.key}
                    onChange={(e) => setNewApiKey(prev => ({ ...prev, key: e.target.value }))}
                    required
                    fullWidth
                    placeholder={apiServices.find(s => s.code === newApiKey.service)?.placeholder}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            onClick={() => toggleApiKeyVisibility('new')}
                            edge="end"
                          >
                            {showApiKey.new ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />
                )}
              </>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAddDialog(false)}>
            取消
          </Button>
          <Button
            onClick={handleAddApiKey}
            variant="contained"
            disabled={isLoading || !newApiKey.service || !newApiKey.key}
          >
            {isLoading ? '保存中...' : '保存'}
          </Button>
        </DialogActions>
      </Dialog>
      </Container>
    </Box>
  );
};

export default Settings;