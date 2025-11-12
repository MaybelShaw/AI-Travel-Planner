import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Paper,
  Typography,
  Button,
  Card,
  CardContent,
  CardActions,
  Fab,
  AppBar,
  Toolbar,
  IconButton,
  Avatar,
  Menu,
  MenuItem,
  Chip,
  Alert,
  Dialog,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Add,
  AccountCircle,
  Logout,
  Settings as SettingsIcon,
  TravelExplore,
  AttachMoney,
  Schedule,
  LocationOn,
  CheckCircle,
  Visibility,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { travelPlanAPI, voiceAPI } from '../services/api';
import { TravelPlan } from '../types';
import VoiceRecorder from '../components/VoiceRecorder';
import LoadingScreen from '../components/LoadingScreen';
import CreateTravelPlan from '../components/CreateTravelPlan';
import ApiKeyRequiredDialog from '../components/ApiKeyRequiredDialog';

const Dashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [travelPlans, setTravelPlans] = useState<TravelPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [isCreatingPlan, setIsCreatingPlan] = useState(false);
  const [showApiKeyDialog, setShowApiKeyDialog] = useState(false);
  const [apiKeyMessage, setApiKeyMessage] = useState('');
  const [missingServices, setMissingServices] = useState<string[]>([]);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [newPlanId, setNewPlanId] = useState<number | null>(null);
  const [newPlanTitle, setNewPlanTitle] = useState('');

  // 获取旅行计划列表
  const fetchTravelPlans = async () => {
    try {
      setError('');
      const response = await travelPlanAPI.list();
      setTravelPlans(response.data);
    } catch (err: any) {
      setError('获取旅行计划失败');
      console.error('获取旅行计划失败:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTravelPlans();
  }, []);

  // 处理用户菜单
  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    logout();
    handleMenuClose();
  };

  // 处理语音创建旅行计划
  const handleVoiceRecordingComplete = async (audioBlob: Blob) => {
    setIsCreatingPlan(true);
    try {
      // 先检查API密钥配置
      const apiCheck = await checkApiKeys();
      if (!apiCheck.has_required) {
        setApiKeyMessage(apiCheck.message);
        setMissingServices(apiCheck.missing_services || ['llm']);
        setShowApiKeyDialog(true);
        return;
      }

      // 调用语音识别API
      let userInput = '';
      try {
        console.log('开始调用语音识别API...');
        console.log('音频Blob信息:', {
          size: audioBlob.size,
          type: audioBlob.type
        });
        
        // 调用语音识别接口
        const voiceResponse = await voiceAPI.transcribe(audioBlob);
        console.log('语音识别API响应状态:', voiceResponse.status);
        
        if (voiceResponse.status === 200) {
          const voiceResult = voiceResponse.data;
          userInput = voiceResult.transcription || voiceResult.text || '';
          console.log('语音识别成功，结果:', userInput);
        } else {
          console.error('语音识别失败:', voiceResponse.status, voiceResponse.data);
          userInput = "我想制定一个5天的旅行计划，预算5000元，喜欢自然风光和历史文化";
        }
      } catch (voiceError: any) {
        console.error('语音识别网络错误:', voiceError);
        if (voiceError.response) {
          console.error('错误响应:', voiceError.response.status, voiceError.response.data);
        }
        userInput = "我想制定一个5天的旅行计划，预算5000元，喜欢自然风光和历史文化";
      }
      
      // 如果语音识别结果为空，使用默认输入
      if (!userInput.trim()) {
        userInput = "我想制定一个5天的旅行计划，预算5000元，喜欢自然风光和历史文化";
      }
      console.log('最终用户输入:', userInput);
      
      const response = await travelPlanAPI.create({ user_input: userInput });
      
      // 刷新旅行计划列表
      await fetchTravelPlans();
      
      // 关闭语音录制器
      setShowVoiceRecorder(false);
      
      // 显示成功弹窗
      setNewPlanId(response.data.id);
      setNewPlanTitle(response.data.title || '新的旅行计划');
      setShowSuccessDialog(true);
      
    } catch (err: any) {
      if (err.response?.data?.api_keys) {
        setApiKeyMessage(err.response.data.api_keys);
        setMissingServices(err.response.data.missing_services || ['llm']);
        setShowApiKeyDialog(true);
      } else if (!showApiKeyDialog) {
        setError('创建旅行计划失败');
      }
      console.error('创建旅行计划失败:', err);
    } finally {
      setIsCreatingPlan(false);
    }
  };

  // 检查API密钥配置
  const checkApiKeys = async () => {
    try {
      const response = await travelPlanAPI.checkApiKeys();
      return response.data;
    } catch (err: any) {
      console.error('检查API密钥失败:', err);
      return {
        has_required: false,
        message: '检查API密钥配置时出错',
        missing_services: ['llm']
      };
    }
  };

  // 处理文本创建旅行计划
  const handleTextCreate = async (userInput: string) => {
    setIsCreatingPlan(true);
    try {
      // 先检查API密钥配置
      const apiCheck = await checkApiKeys();
      if (!apiCheck.has_required) {
        setApiKeyMessage(apiCheck.message);
        setMissingServices(apiCheck.missing_services || ['llm']);
        setShowApiKeyDialog(true);
        throw new Error(apiCheck.message);
      }

      const response = await travelPlanAPI.create({ user_input: userInput });
      
      // 刷新旅行计划列表
      await fetchTravelPlans();
      
      // 关闭创建对话框
      setShowCreateDialog(false);
      
      // 显示成功弹窗
      setNewPlanId(response.data.id);
      setNewPlanTitle(response.data.title || '新的旅行计划');
      setShowSuccessDialog(true);
      
    } catch (err: any) {
      if (err.response?.data?.api_keys) {
        setApiKeyMessage(err.response.data.api_keys);
        setMissingServices(err.response.data.missing_services || ['llm']);
        setShowApiKeyDialog(true);
      } else if (!showApiKeyDialog) {
        setError('创建旅行计划失败');
      }
      console.error('创建旅行计划失败:', err);
      throw err; // 重新抛出错误让组件处理
    } finally {
      setIsCreatingPlan(false);
    }
  };



  // 格式化日期
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // 获取计划状态颜色
  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'active': return 'success';
      case 'completed': return 'info';
      case 'cancelled': return 'error';
      default: return 'default';
    }
  };

  // 获取计划状态文本
  const getStatusText = (status?: string) => {
    switch (status) {
      case 'active': return '进行中';
      case 'completed': return '已完成';
      case 'cancelled': return '已取消';
      default: return '草稿';
    }
  };

  // 处理成功弹窗的操作
  const handleViewPlan = () => {
    if (newPlanId) {
      navigate(`/travel-plan/${newPlanId}`);
    }
    setShowSuccessDialog(false);
  };

  const handleCloseSuccessDialog = () => {
    setShowSuccessDialog(false);
    setNewPlanId(null);
    setNewPlanTitle('');
  };

  if (isLoading) {
    return <LoadingScreen message="加载旅行计划中..." />;
  }

  return (
    <Box sx={{ flexGrow: 1 }}>
      {/* 顶部导航栏 */}
      <AppBar position="static" elevation={1}>
        <Toolbar>
          <TravelExplore sx={{ mr: 2 }} />
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            智能旅行助手
          </Typography>
          
          <IconButton
            size="large"
            edge="end"
            aria-label="account of current user"
            aria-controls="menu-appbar"
            aria-haspopup="true"
            onClick={handleMenuOpen}
            color="inherit"
          >
            <Avatar sx={{ width: 32, height: 32, bgcolor: 'secondary.main' }}>
              {user?.username?.charAt(0).toUpperCase()}
            </Avatar>
          </IconButton>
          
          <Menu
            id="menu-appbar"
            anchorEl={anchorEl}
            anchorOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
            keepMounted
            transformOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
          >
            <MenuItem onClick={handleMenuClose}>
              <AccountCircle sx={{ mr: 1 }} />
              个人资料
            </MenuItem>
            <MenuItem onClick={() => { navigate('/settings'); handleMenuClose(); }}>
              <SettingsIcon sx={{ mr: 1 }} />
              设置
            </MenuItem>
            <MenuItem onClick={handleLogout}>
              <Logout sx={{ mr: 1 }} />
              退出登录
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        {/* 欢迎信息 */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            欢迎回来，{user?.username}！
          </Typography>
          <Typography variant="body1" color="text.secondary">
            开始规划您的下一次精彩旅行吧
          </Typography>
        </Box>

        {/* 错误提示 */}
        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        {/* 语音录制器 */}
        {showVoiceRecorder && (
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              语音创建旅行计划
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              请说出您的旅行需求，例如："我想去上海旅游3天，预算5000元，喜欢美食和购物"
            </Typography>
            <VoiceRecorder
              onSend={handleVoiceRecordingComplete}
              disabled={isCreatingPlan}
              maxDuration={60}
            />
            <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
              <Button
                variant="outlined"
                onClick={() => setShowVoiceRecorder(false)}
                disabled={isCreatingPlan}
              >
                取消
              </Button>
            </Box>
          </Paper>
        )}

        {/* 快速操作 */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr 1fr' }, gap: 3, mb: 4 }}>
          <Card sx={{ textAlign: 'center', p: 2 }}>
            <CardContent>
              <TravelExplore sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
              <Typography variant="h6" component="div">
                {travelPlans.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                旅行计划
              </Typography>
            </CardContent>
          </Card>
          
          <Card sx={{ textAlign: 'center', p: 2 }}>
            <CardContent>
              <AttachMoney sx={{ fontSize: 40, color: 'success.main', mb: 1 }} />
              <Typography variant="h6" component="div">
                ¥0
              </Typography>
              <Typography variant="body2" color="text.secondary">
                总预算
              </Typography>
            </CardContent>
          </Card>
          
          <Card sx={{ textAlign: 'center', p: 2 }}>
            <CardContent>
              <Schedule sx={{ fontSize: 40, color: 'warning.main', mb: 1 }} />
              <Typography variant="h6" component="div">
                0
              </Typography>
              <Typography variant="body2" color="text.secondary">
                进行中
              </Typography>
            </CardContent>
          </Card>
          
          <Card sx={{ textAlign: 'center', p: 2 }}>
            <CardContent>
              <LocationOn sx={{ fontSize: 40, color: 'info.main', mb: 1 }} />
              <Typography variant="h6" component="div">
                0
              </Typography>
              <Typography variant="body2" color="text.secondary">
                目的地
              </Typography>
            </CardContent>
          </Card>
        </Box>

        {/* 旅行计划列表 */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h5" component="h2">
            我的旅行计划
          </Typography>
          {travelPlans.length > 0 && (
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => setShowCreateDialog(true)}
            >
              新建计划
            </Button>
          )}
        </Box>

        {travelPlans.length === 0 ? (
          <Paper sx={{ p: 4, textAlign: 'center' }}>
            <TravelExplore sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              还没有旅行计划
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              创建您的第一个旅行计划，开始精彩的旅程吧！
            </Typography>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => setShowCreateDialog(true)}
              size="large"
            >
              创建旅行计划
            </Button>
          </Paper>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' }, gap: 3 }}>
            {travelPlans.map((plan) => (
              <Box key={plan.id}>
                <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                      <Typography variant="h6" component="div" noWrap>
                        {plan.title}
                      </Typography>
                      <Chip
                        label={getStatusText(plan.status)}
                        color={getStatusColor(plan.status) as any}
                        size="small"
                      />
                    </Box>
                    
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      创建时间: {formatDate(plan.created_at)}
                    </Typography>
                    
                    {plan.budget_limit && (
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        预算: ¥{plan.budget_limit} {plan.currency}
                      </Typography>
                    )}
                    
                    <Typography variant="body2" color="text.secondary">
                      费用记录: {plan.expenses?.length || 0} 条
                    </Typography>
                  </CardContent>
                  
                  <CardActions>
                    <Button 
                      size="small" 
                      color="primary"
                      onClick={() => navigate(`/travel-plan/${plan.id}`)}
                    >
                      查看详情
                    </Button>
                    <Button 
                      size="small" 
                      color="secondary"
                      onClick={() => navigate(`/travel-plan/${plan.id}/edit`)}
                    >
                      编辑
                    </Button>
                  </CardActions>
                </Card>
              </Box>
            ))}
          </Box>
        )}
      </Container>

      {/* 创建旅行计划对话框 */}
      <CreateTravelPlan
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onTextCreate={handleTextCreate}
        onVoiceCreate={handleVoiceRecordingComplete}
        isCreating={isCreatingPlan}
        error={error}
      />

      {/* API密钥配置提示对话框 */}
      <ApiKeyRequiredDialog
        open={showApiKeyDialog}
        onClose={() => setShowApiKeyDialog(false)}
        message={apiKeyMessage}
        missingServices={missingServices}
      />

      {/* 创建成功弹窗 */}
      <Dialog 
        open={showSuccessDialog} 
        onClose={handleCloseSuccessDialog}
        maxWidth="sm" 
        fullWidth
        PaperProps={{
          sx: { 
            borderRadius: 3,
            textAlign: 'center',
            overflow: 'visible'
          }
        }}
      >
        <DialogContent sx={{ pt: 5, pb: 3, px: 4 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
            <Box
              sx={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                bgcolor: 'success.light',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mb: 1
              }}
            >
              <CheckCircle sx={{ fontSize: 48, color: 'success.main' }} />
            </Box>
            
            <Box>
              <Typography variant="h4" component="div" sx={{ fontWeight: 'bold', mb: 1 }}>
                创建成功！
              </Typography>
              <Typography variant="h6" color="primary" sx={{ mb: 2 }}>
                {newPlanTitle}
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
                您的旅行计划已经准备就绪
              </Typography>
              <Typography variant="body2" color="text.secondary">
                现在可以查看详细的行程安排，管理预算和费用记录
              </Typography>
            </Box>
          </Box>
        </DialogContent>
        
        <DialogActions sx={{ justifyContent: 'center', pb: 4, px: 4, gap: 2 }}>
          <Button
            onClick={handleCloseSuccessDialog}
            variant="outlined"
            size="large"
            sx={{ minWidth: 120 }}
          >
            稍后查看
          </Button>
          <Button
            onClick={handleViewPlan}
            variant="contained"
            startIcon={<Visibility />}
            size="large"
            sx={{ minWidth: 120 }}
          >
            立即查看
          </Button>
        </DialogActions>
      </Dialog>

      {/* 浮动操作按钮 */}
      {!showVoiceRecorder && !showCreateDialog && (
        <Fab
          color="primary"
          aria-label="create plan"
          sx={{
            position: 'fixed',
            bottom: 16,
            right: 16,
          }}
          onClick={() => setShowCreateDialog(true)}
        >
          <Add />
        </Fab>
      )}
    </Box>
  );
};

export default Dashboard;