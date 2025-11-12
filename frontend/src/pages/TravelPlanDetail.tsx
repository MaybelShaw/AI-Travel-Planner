import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Paper,
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Chip,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
  IconButton,
  AppBar,
  Toolbar,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from '@mui/material';
import {
  ArrowBack,
  Edit,
  Delete,
  Share,
  Download,
  AttachMoney,
  Schedule,
  LocationOn,
  Refresh,
  Mic,
} from '@mui/icons-material';
import { TravelPlan } from '../types';
import { travelPlanAPI } from '../services/api';
import BudgetManager from '../components/BudgetManager';
import ItineraryVisualization from '../components/ItineraryVisualization';
import TravelMap from '../components/TravelMap';
import VoiceRecorder from '../components/VoiceRecorder';

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
      id={`plan-tabpanel-${index}`}
      aria-labelledby={`plan-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

const TravelPlanDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [travelPlan, setTravelPlan] = useState<TravelPlan | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [tabValue, setTabValue] = useState(0);
  const [showRegenerateDialog, setShowRegenerateDialog] = useState(false);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [userInput, setUserInput] = useState('');

  // 获取旅行计划详情
  const fetchTravelPlan = async () => {
    if (!id) return;
    
    try {
      setError('');
      const response = await travelPlanAPI.get(parseInt(id));
      setTravelPlan(response.data);
    } catch (err: any) {
      setError('获取旅行计划详情失败');
      console.error('获取旅行计划详情失败:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTravelPlan();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleEdit = () => {
    navigate(`/travel-plan/${id}/edit`);
  };

  const handleDelete = async () => {
    if (!id || !window.confirm('确定要删除这个旅行计划吗？')) return;
    
    try {
      await travelPlanAPI.delete(parseInt(id));
      navigate('/dashboard');
    } catch (err: any) {
      setError('删除旅行计划失败');
    }
  };

  const handleShare = () => {
    // 实现分享功能
    if (navigator.share) {
      navigator.share({
        title: travelPlan?.title,
        text: `查看我的旅行计划：${travelPlan?.title}`,
        url: window.location.href,
      });
    } else {
      // 复制链接到剪贴板
      navigator.clipboard.writeText(window.location.href);
      alert('链接已复制到剪贴板');
    }
  };

  const handleDownload = () => {
    // 实现下载功能
    if (!travelPlan) return;
    
    const data = {
      title: travelPlan.title,
      itinerary: travelPlan.itinerary,
      budget: travelPlan.budget_limit,
      currency: travelPlan.currency,
      expenses: travelPlan.expenses,
      created_at: travelPlan.created_at,
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${travelPlan.title}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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

  // 格式化日期
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // 处理重新生成计划
  const handleRegenerate = async () => {
    if (!id || !userInput.trim()) {
      setError('请输入新的需求描述');
      return;
    }

    setIsRegenerating(true);
    setError('');
    setSuccess('');

    try {
      await travelPlanAPI.update(parseInt(id), { user_input: userInput });
      setSuccess('行程已重新生成！');
      await fetchTravelPlan();
      setUserInput('');
      setShowRegenerateDialog(false);
    } catch (err: any) {
      setError(err.response?.data?.error || '重新生成失败');
    } finally {
      setIsRegenerating(false);
    }
  };

  // 处理语音重新生成
  const handleVoiceRegenerate = async (audioBlob: Blob) => {
    setIsRegenerating(true);
    try {
      // 这里应该调用语音识别API，然后更新旅行计划
      // 暂时使用模拟数据
      const mockUserInput = "我想修改行程，增加一天购物时间";
      
      await travelPlanAPI.update(parseInt(id!), { user_input: mockUserInput });
      setSuccess('语音更新成功！');
      await fetchTravelPlan();
      setShowVoiceRecorder(false);
      setShowRegenerateDialog(false);
    } catch (err: any) {
      setError('语音更新失败');
    } finally {
      setIsRegenerating(false);
    }
  };

  // 打开重新生成对话框
  const handleOpenRegenerateDialog = () => {
    setShowRegenerateDialog(true);
    setUserInput('');
    setError('');
    setSuccess('');
  };

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress />
      </Box>
    );
  }

  if (!travelPlan) {
    return (
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Alert severity="error">
          旅行计划不存在或已被删除
        </Alert>
        <Button
          variant="contained"
          startIcon={<ArrowBack />}
          onClick={() => navigate('/dashboard')}
          sx={{ mt: 2 }}
        >
          返回首页
        </Button>
      </Container>
    );
  }

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
            {travelPlan.title}
          </Typography>
          
          <IconButton color="inherit" onClick={handleOpenRegenerateDialog}>
            <Refresh />
          </IconButton>
          <IconButton color="inherit" onClick={handleShare}>
            <Share />
          </IconButton>
          <IconButton color="inherit" onClick={handleDownload}>
            <Download />
          </IconButton>
          <IconButton color="inherit" onClick={handleEdit}>
            <Edit />
          </IconButton>
          <IconButton color="inherit" onClick={handleDelete}>
            <Delete />
          </IconButton>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        {/* 消息提示 */}
        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}
        {success && (
          <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess('')}>
            {success}
          </Alert>
        )}

        {/* 计划概览 */}
        <Paper sx={{ p: 3, mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
            <Box>
              <Typography variant="h4" component="h1" gutterBottom>
                {travelPlan.title}
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                创建时间: {formatDate(travelPlan.created_at)}
              </Typography>
              {travelPlan.updated_at && (
                <Typography variant="body2" color="text.secondary">
                  最后更新: {formatDate(travelPlan.updated_at)}
                </Typography>
              )}
            </Box>
            <Chip
              label={getStatusText(travelPlan.status)}
              color={getStatusColor(travelPlan.status) as any}
              size="medium"
            />
          </Box>

          {/* 快速统计 */}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr 1fr' }, gap: 3, mb: 3 }}>
            <Card variant="outlined">
              <CardContent sx={{ textAlign: 'center' }}>
                <AttachMoney sx={{ fontSize: 40, color: 'success.main', mb: 1 }} />
                <Typography variant="h6" component="div">
                  ¥{travelPlan.budget_limit || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  总预算
                </Typography>
              </CardContent>
            </Card>
            
            <Card variant="outlined">
              <CardContent sx={{ textAlign: 'center' }}>
                <Schedule sx={{ fontSize: 40, color: 'warning.main', mb: 1 }} />
                <Typography variant="h6" component="div">
                  {travelPlan.itinerary?.days || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  天数
                </Typography>
              </CardContent>
            </Card>
            
            <Card variant="outlined">
              <CardContent sx={{ textAlign: 'center' }}>
                <LocationOn sx={{ fontSize: 40, color: 'info.main', mb: 1 }} />
                <Typography variant="h6" component="div">
                  {travelPlan.itinerary?.destinations?.length || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  目的地
                </Typography>
              </CardContent>
            </Card>
            
            <Card variant="outlined">
              <CardContent sx={{ textAlign: 'center' }}>
                <AttachMoney sx={{ fontSize: 40, color: 'error.main', mb: 1 }} />
                <Typography variant="h6" component="div">
                  {travelPlan.expenses?.length || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  费用记录
                </Typography>
              </CardContent>
            </Card>
          </Box>

          {/* 快速操作按钮 */}
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
            <Button
              variant="contained"
              startIcon={<Refresh />}
              onClick={handleOpenRegenerateDialog}
              size="large"
            >
              重新生成计划
            </Button>
            <Button
              variant="outlined"
              startIcon={<Edit />}
              onClick={handleEdit}
              size="large"
            >
              编辑计划
            </Button>
          </Box>
        </Paper>

        {/* 详细内容标签页 */}
        <Paper sx={{ width: '100%' }}>
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs value={tabValue} onChange={handleTabChange}>
              <Tab label="行程安排" />
              <Tab label="预算管理" />
              <Tab label="地图视图" />
              <Tab label="详细信息" />
            </Tabs>
          </Box>

          {/* 行程安排 */}
          <TabPanel value={tabValue} index={0}>
            <ItineraryVisualization travelPlan={travelPlan} />
          </TabPanel>

          {/* 预算管理 */}
          <TabPanel value={tabValue} index={1}>
            <BudgetManager 
              travelPlan={travelPlan} 
              onExpenseAdded={fetchTravelPlan}
            />
          </TabPanel>

          {/* 地图视图 */}
          <TabPanel value={tabValue} index={2}>
            <TravelMap travelPlan={travelPlan} />
          </TabPanel>

          {/* 详细信息 */}
          <TabPanel value={tabValue} index={3}>
            <Box>
              <Typography variant="h6" gutterBottom>
                计划详情
              </Typography>
              <Divider sx={{ mb: 2 }} />
              
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle1" gutterBottom>
                  基本信息
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  计划ID: {travelPlan.id}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  用户ID: {travelPlan.user}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  货币: {travelPlan.currency || 'CNY'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  状态: {getStatusText(travelPlan.status)}
                </Typography>
              </Box>

              {travelPlan.preferences && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle1" gutterBottom>
                    偏好设置
                  </Typography>
                  <pre style={{ 
                    background: '#f5f5f5', 
                    padding: '16px', 
                    borderRadius: '4px',
                    fontSize: '14px',
                    overflow: 'auto'
                  }}>
                    {JSON.stringify(travelPlan.preferences, null, 2)}
                  </pre>
                </Box>
              )}

              {travelPlan.itinerary && (
                <Box>
                  <Typography variant="subtitle1" gutterBottom>
                    完整行程数据
                  </Typography>
                  <pre style={{ 
                    background: '#f5f5f5', 
                    padding: '16px', 
                    borderRadius: '4px',
                    fontSize: '14px',
                    overflow: 'auto',
                    maxHeight: '400px'
                  }}>
                    {JSON.stringify(travelPlan.itinerary, null, 2)}
                  </pre>
                </Box>
              )}
            </Box>
          </TabPanel>
        </Paper>
      </Container>

      {/* 重新生成计划对话框 */}
      <Dialog 
        open={showRegenerateDialog} 
        onClose={() => !isRegenerating && setShowRegenerateDialog(false)} 
        maxWidth="md" 
        fullWidth
        PaperProps={{
          sx: { borderRadius: 2 }
        }}
      >
        <DialogTitle>
          <Typography variant="h5" component="div">
            重新生成旅行计划
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            描述您的新需求，AI将为您重新生成个性化的行程安排
          </Typography>
        </DialogTitle>
        
        <DialogContent>
          {!showVoiceRecorder ? (
            <Box>
              <TextField
                label="新的需求描述"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                multiline
                rows={6}
                fullWidth
                disabled={isRegenerating}
                placeholder="例如：我想增加一天购物时间，减少景点游览，预算调整为8000元..."
                sx={{ mb: 2 }}
                helperText="请详细描述您想要修改的内容，AI将根据您的描述重新生成行程"
              />
              
              <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                <Button
                  variant="outlined"
                  startIcon={<Mic />}
                  onClick={() => setShowVoiceRecorder(true)}
                  disabled={isRegenerating}
                >
                  语音输入
                </Button>
              </Box>

              {/* 快捷输入示例 */}
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  快捷输入示例：
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {[
                    '增加一天购物时间，减少景点游览',
                    '调整预算为8000元，提升住宿标准',
                    '增加美食体验，减少户外活动',
                    '延长行程到7天，增加周边城市'
                  ].map((example, index) => (
                    <Button
                      key={index}
                      variant="outlined"
                      size="small"
                      onClick={() => setUserInput(example)}
                      disabled={isRegenerating}
                      sx={{ mb: 1 }}
                    >
                      {example}
                    </Button>
                  ))}
                </Box>
              </Box>
            </Box>
          ) : (
            <Box>
              <Typography variant="body1" gutterBottom>
                语音输入需求
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                请清晰地说出您的修改需求
              </Typography>
              <VoiceRecorder
                onSend={handleVoiceRegenerate}
                disabled={isRegenerating}
                maxDuration={60}
              />
              <Button
                variant="outlined"
                onClick={() => setShowVoiceRecorder(false)}
                disabled={isRegenerating}
                sx={{ mt: 2 }}
              >
                返回文字输入
              </Button>
            </Box>
          )}
        </DialogContent>
        
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button 
            onClick={() => setShowRegenerateDialog(false)} 
            disabled={isRegenerating}
          >
            取消
          </Button>
          {!showVoiceRecorder && (
            <Button
              variant="contained"
              startIcon={isRegenerating ? <CircularProgress size={20} /> : <Refresh />}
              onClick={handleRegenerate}
              disabled={isRegenerating || !userInput.trim()}
            >
              {isRegenerating ? '生成中...' : '重新生成'}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TravelPlanDetail;