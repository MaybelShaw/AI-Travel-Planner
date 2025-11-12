import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Paper,
  Box,
  Typography,
  Button,
  TextField,
  Alert,
  CircularProgress,
  AppBar,
  Toolbar,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,

  Divider,
  Chip,
} from '@mui/material';
import {
  ArrowBack,
  Save,
  Cancel,
} from '@mui/icons-material';
import { TravelPlan } from '../types';
import { travelPlanAPI } from '../services/api';

const TravelPlanEdit: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [travelPlan, setTravelPlan] = useState<TravelPlan | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');


  // 表单数据
  const [formData, setFormData] = useState({
    title: '',
    status: 'draft',
    budget_limit: '',
    currency: 'CNY',
  });

  // 获取旅行计划详情
  const fetchTravelPlan = async () => {
    if (!id) return;
    
    try {
      setError('');
      const response = await travelPlanAPI.get(parseInt(id));
      const plan = response.data;
      setTravelPlan(plan);
      
      // 填充表单数据
      setFormData({
        title: plan.title || '',
        status: plan.status || 'draft',
        budget_limit: plan.budget_limit?.toString() || '',
        currency: plan.currency || 'CNY',
      });
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
    // 清除消息
    if (error) setError('');
    if (success) setSuccess('');
  };

  const handleSelectChange = (name: string) => (e: any) => {
    setFormData(prev => ({
      ...prev,
      [name]: e.target.value,
    }));
    if (error) setError('');
    if (success) setSuccess('');
  };

  const handleSave = async () => {
    if (!id || !travelPlan) return;

    // 基本验证
    if (!formData.title.trim()) {
      setError('请输入计划标题');
      return;
    }

    setIsSaving(true);
    setError('');
    setSuccess('');

    try {
      // 构建更新数据
      const updateData = {
        title: formData.title,
        status: formData.status,
        budget_limit: formData.budget_limit ? parseFloat(formData.budget_limit) : undefined,
        currency: formData.currency,
      };

      // 调用更新API（这里需要后端支持PATCH方法）
      await travelPlanAPI.update(parseInt(id), { user_input: JSON.stringify(updateData) });
      
      setSuccess('保存成功！');
      
      // 刷新数据
      await fetchTravelPlan();
    } catch (err: any) {
      setError(err.response?.data?.error || '保存失败');
    } finally {
      setIsSaving(false);
    }
  };



  // 获取状态选项
  const statusOptions = [
    { value: 'draft', label: '草稿' },
    { value: 'active', label: '进行中' },
    { value: 'completed', label: '已完成' },
    { value: 'cancelled', label: '已取消' },
  ];

  // 获取货币选项
  const currencyOptions = [
    { value: 'CNY', label: '人民币 (¥)' },
    { value: 'USD', label: '美元 ($)' },
    { value: 'EUR', label: '欧元 (€)' },
    { value: 'JPY', label: '日元 (¥)' },
    { value: 'KRW', label: '韩元 (₩)' },
  ];

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
            onClick={() => navigate(`/travel-plan/${id}`)}
            sx={{ mr: 2 }}
          >
            <ArrowBack />
          </IconButton>
          
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            编辑旅行计划
          </Typography>
          
          <Button
            color="inherit"
            startIcon={<Cancel />}
            onClick={() => navigate(`/travel-plan/${id}`)}
            sx={{ mr: 1 }}
          >
            取消
          </Button>
          <Button
            color="inherit"
            startIcon={<Save />}
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? '保存中...' : '保存'}
          </Button>
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

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' }, gap: 3 }}>
          {/* 左侧：编辑表单 */}
          <Box>
            {/* 基本信息编辑 */}
            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                基本信息
              </Typography>
              <Divider sx={{ mb: 3 }} />

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <TextField
                  label="计划标题"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  required
                  fullWidth
                  disabled={isSaving}
                />

                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                  <FormControl fullWidth disabled={isSaving}>
                    <InputLabel>状态</InputLabel>
                    <Select
                      value={formData.status}
                      label="状态"
                      onChange={handleSelectChange('status')}
                    >
                      {statusOptions.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <FormControl fullWidth disabled={isSaving}>
                    <InputLabel>货币</InputLabel>
                    <Select
                      value={formData.currency}
                      label="货币"
                      onChange={handleSelectChange('currency')}
                    >
                      {currencyOptions.map((option) => (
                        <MenuItem key={option.value} value={option.value}>
                          {option.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>

                <TextField
                  label="预算限额"
                  name="budget_limit"
                  type="number"
                  value={formData.budget_limit}
                  onChange={handleInputChange}
                  fullWidth
                  disabled={isSaving}
                  InputProps={{
                    startAdornment: <Typography sx={{ mr: 1 }}>¥</Typography>,
                  }}
                />
              </Box>
            </Paper>
          </Box>

          {/* 右侧：计划信息 */}
          <Box>
            <Paper sx={{ p: 3, position: 'sticky', top: 20 }}>
              <Typography variant="h6" gutterBottom>
                计划信息
              </Typography>
              <Divider sx={{ mb: 2 }} />

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  创建时间
                </Typography>
                <Typography variant="body1">
                  {formatDate(travelPlan.created_at)}
                </Typography>
              </Box>

              {travelPlan.updated_at && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    最后更新
                  </Typography>
                  <Typography variant="body1">
                    {formatDate(travelPlan.updated_at)}
                  </Typography>
                </Box>
              )}

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  当前状态
                </Typography>
                <Chip
                  label={statusOptions.find(s => s.value === travelPlan.status)?.label || '草稿'}
                  color={travelPlan.status === 'active' ? 'success' : 'default'}
                  size="small"
                />
              </Box>

              {travelPlan.itinerary && (
                <>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      行程天数
                    </Typography>
                    <Typography variant="body1">
                      {travelPlan.itinerary.days || 0} 天
                    </Typography>
                  </Box>

                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      目的地数量
                    </Typography>
                    <Typography variant="body1">
                      {travelPlan.itinerary.destinations?.length || 0} 个
                    </Typography>
                  </Box>
                </>
              )}

              <Box>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  费用记录
                </Typography>
                <Typography variant="body1">
                  {travelPlan.expenses?.length || 0} 条
                </Typography>
              </Box>
            </Paper>
          </Box>
        </Box>
      </Container>
    </Box>
  );
};

export default TravelPlanEdit;