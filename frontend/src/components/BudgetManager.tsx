import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  LinearProgress,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  IconButton,
  Alert,
  Divider,
  CircularProgress,
  Tooltip,
  Fab,
} from '@mui/material';
import {
  AttachMoney,
  TrendingUp,
  TrendingDown,
  Warning,
  CheckCircle,
  Add,
  Edit,
  Delete,
  Mic,
  Receipt,
  BarChart,
  Lightbulb,
} from '@mui/icons-material';
import { PieChart as RechartsPieChart, Pie, Cell, ResponsiveContainer, BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend } from 'recharts';
import { BudgetAnalysis, ExpenseEntry, ExpenseCategory, TravelPlan } from '../types';
import { budgetAPI, expenseAPI } from '../services/api';
import VoiceExpenseRecorder from './VoiceExpenseRecorder';

interface BudgetManagerProps {
  travelPlan: TravelPlan;
  onExpenseAdded?: () => void;
}

const BudgetManager: React.FC<BudgetManagerProps> = ({
  travelPlan,
  onExpenseAdded,
}) => {
  const [budgetAnalysis, setBudgetAnalysis] = useState<BudgetAnalysis | null>(null);
  const [expenses, setExpenses] = useState<ExpenseEntry[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  
  // 对话框状态
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  
  // 表单状态
  const [newExpense, setNewExpense] = useState({
    amount: '',
    category: '',
    description: '',
  });

  // 图表颜色
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

  // 获取预算分析
  const fetchBudgetAnalysis = async () => {
    try {
      const response = await budgetAPI.analyze({ travel_plan_id: travelPlan.id });
      console.log('预算分析响应:', response.data);
      setBudgetAnalysis(response.data.analysis);
    } catch (err) {
      console.error('获取预算分析失败:', err);
      setError('获取预算分析失败');
    }
  };

  // 获取费用列表
  const fetchExpenses = async () => {
    try {
      const response = await expenseAPI.list({ travel_plan_id: travelPlan.id });
      console.log('费用列表响应:', response.data);
      setExpenses(response.data);
    } catch (err) {
      console.error('获取费用列表失败:', err);
      setError('获取费用列表失败');
    }
  };

  // 获取费用类别
  const fetchCategories = async () => {
    try {
      const response = await expenseAPI.categories();
      setCategories(response.data);
    } catch (err) {
      console.error('获取费用类别失败:', err);
    }
  };

  // 初始化数据
  useEffect(() => {
    const initData = async () => {
      setIsLoading(true);
      try {
        await Promise.all([
          fetchBudgetAnalysis(),
          fetchExpenses(),
          fetchCategories(),
        ]);
      } catch (err) {
        setError('加载数据失败');
      } finally {
        setIsLoading(false);
      }
    };

    initData();
  }, [travelPlan.id]);

  // 添加费用
  const handleAddExpense = async () => {
    if (!newExpense.amount || !newExpense.category || !newExpense.description) {
      setError('请填写完整的费用信息');
      return;
    }

    try {
      await expenseAPI.create({
        travel_plan: travelPlan.id,
        amount: newExpense.amount,
        category: newExpense.category,
        description: newExpense.description,
        currency: travelPlan.currency || 'CNY',
      });

      // 刷新数据
      await Promise.all([fetchBudgetAnalysis(), fetchExpenses()]);
      
      // 重置表单
      setNewExpense({ amount: '', category: '', description: '' });
      setShowAddExpense(false);
      onExpenseAdded?.();
    } catch (err: any) {
      setError(err.response?.data?.error || '添加费用失败');
    }
  };

  // 语音添加费用
  const handleVoiceExpense = async (audioBlob: Blob) => {
    try {
      const response = await expenseAPI.voiceRecord({
        travel_plan_id: travelPlan.id,
        audio_file: new File([audioBlob], 'expense.webm', { type: 'audio/webm' }),
      });

      // 显示成功消息
      if (response.data.success) {
        setError(''); // 清除错误
        // 可以显示成功提示，但这里我们通过刷新数据来体现
      }

      // 刷新数据
      await Promise.all([fetchBudgetAnalysis(), fetchExpenses()]);
      onExpenseAdded?.();
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || err.response?.data?.message || '语音添加费用失败';
      throw new Error(errorMessage);
    }
  };

  // 删除费用
  const handleDeleteExpense = async (expenseId: number) => {
    try {
      await expenseAPI.delete(expenseId);
      await Promise.all([fetchBudgetAnalysis(), fetchExpenses()]);
    } catch (err: any) {
      setError(err.response?.data?.error || '删除费用失败');
    }
  };

  // 获取状态颜色
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'success';
      case 'warning': return 'warning';
      case 'critical': return 'error';
      case 'over_budget': return 'error';
      default: return 'default';
    }
  };

  // 获取状态文本
  const getStatusText = (status: string) => {
    switch (status) {
      case 'healthy': return '健康';
      case 'warning': return '注意';
      case 'critical': return '紧急';
      case 'over_budget': return '超支';
      default: return '未知';
    }
  };

  // 准备图表数据
  const pieChartData = budgetAnalysis?.budget_status ? Object.entries(budgetAnalysis.budget_status)
    .filter(([key]) => key !== 'total')
    .map(([key, value]) => ({
      name: categories.find(c => c.code === key)?.name || key,
      value: value?.spent || 0,
      budget: value?.budgeted || 0,
    })) : [];

  const barChartData = budgetAnalysis?.budget_status ? Object.entries(budgetAnalysis.budget_status)
    .filter(([key]) => key !== 'total')
    .map(([key, value]) => ({
      category: categories.find(c => c.code === key)?.name || key,
      budgeted: value?.budgeted || 0,
      spent: value?.spent || 0,
      remaining: value?.remaining || 0,
    })) : [];

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={200}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* 错误提示 */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* 预算概览 */}
      {budgetAnalysis ? (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h6">预算概览</Typography>
            <Button
              variant="outlined"
              startIcon={<BarChart />}
              onClick={() => setShowAnalysis(true)}
            >
              详细分析
            </Button>
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' }, gap: 3 }}>
            {/* 总预算状态 */}
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <AttachMoney color="primary" sx={{ mr: 1 }} />
                  <Typography variant="h6">总预算</Typography>
                </Box>
                <Typography variant="h4" color="primary" gutterBottom>
                  ¥{budgetAnalysis.budget_status?.total?.budgeted?.toFixed(0) || '0'}
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    已支出: ¥{budgetAnalysis.budget_status?.total?.spent?.toFixed(0) || '0'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    剩余: ¥{budgetAnalysis.budget_status?.total?.remaining?.toFixed(0) || '0'}
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={budgetAnalysis.budget_status?.total?.usage_percentage || 0}
                  color={getStatusColor(budgetAnalysis.budget_status?.total?.status || 'default') as any}
                  sx={{ height: 8, borderRadius: 4 }}
                />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
                  <Typography variant="body2">
                    {budgetAnalysis.budget_status?.total?.usage_percentage?.toFixed(1) || '0'}% 已使用
                  </Typography>
                  <Chip
                    label={getStatusText(budgetAnalysis.budget_status?.total?.status || 'unknown')}
                    color={getStatusColor(budgetAnalysis.budget_status?.total?.status || 'default') as any}
                    size="small"
                  />
                </Box>
              </CardContent>
            </Card>

            {/* 分类预算状态 */}
            {budgetAnalysis.budget_status && Object.entries(budgetAnalysis.budget_status)
              .filter(([key]) => key !== 'total')
              .slice(0, 2)
              .map(([key, value]) => (
                <Card key={key}>
                  <CardContent>
                    <Typography variant="subtitle1" gutterBottom>
                      {categories.find(c => c.code === key)?.name || key}
                    </Typography>
                    <Typography variant="h5" gutterBottom>
                      ¥{value?.spent?.toFixed(0) || '0'} / ¥{value?.budgeted?.toFixed(0) || '0'}
                    </Typography>
                    <LinearProgress
                      variant="determinate"
                      value={value?.usage_percentage || 0}
                      color={getStatusColor(value?.status || 'default') as any}
                      sx={{ mb: 1 }}
                    />
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="body2" color="text.secondary">
                        {value?.usage_percentage?.toFixed(1) || '0'}%
                      </Typography>
                      <Chip
                        label={getStatusText(value?.status || 'unknown')}
                        color={getStatusColor(value?.status || 'default') as any}
                        size="small"
                      />
                    </Box>
                  </CardContent>
                </Card>
              ))}
          </Box>
        </Paper>
      ) : (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              预算分析数据不可用
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {isLoading ? '正在加载预算分析...' : '无法获取预算分析数据'}
            </Typography>
          </Box>
        </Paper>
      )}

      {/* 最近费用 */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">最近费用</Typography>
          <Box>
            <Button
              variant="outlined"
              startIcon={<Mic />}
              onClick={() => setShowVoiceRecorder(true)}
              sx={{ mr: 1 }}
            >
              语音记录
            </Button>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => setShowAddExpense(true)}
            >
              添加费用
            </Button>
          </Box>
        </Box>

        {expenses.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Receipt sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              还没有费用记录
            </Typography>
            <Typography variant="body2" color="text.secondary">
              开始记录您的旅行支出吧
            </Typography>
          </Box>
        ) : (
          <List>
            {expenses.slice(0, 5).map((expense) => (
              <ListItem key={expense.id} divider>
                <ListItemIcon>
                  <Receipt color="action" />
                </ListItemIcon>
                <ListItemText
                  primary={expense.description}
                  secondary={
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        {categories.find(c => c.code === expense.category)?.name} • 
                        {new Date(expense.created_at).toLocaleDateString()}
                      </Typography>
                    </Box>
                  }
                />
                <ListItemSecondaryAction>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body1" fontWeight="bold">
                      ¥{parseFloat(expense.amount).toFixed(2)}
                    </Typography>
                    <IconButton
                      edge="end"
                      color="error"
                      onClick={() => handleDeleteExpense(expense.id)}
                      size="small"
                    >
                      <Delete />
                    </IconButton>
                  </Box>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        )}

        {expenses.length > 5 && (
          <Box sx={{ textAlign: 'center', mt: 2 }}>
            <Button variant="text">查看全部费用</Button>
          </Box>
        )}
      </Paper>

      {/* 优化建议 */}
      {budgetAnalysis?.optimization_suggestions && budgetAnalysis.optimization_suggestions.length > 0 && (
        <Paper sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Lightbulb color="warning" sx={{ mr: 1 }} />
            <Typography variant="h6">优化建议</Typography>
          </Box>
          <List>
            {budgetAnalysis.optimization_suggestions.slice(0, 3).map((suggestion, index) => (
              <ListItem key={index}>
                <ListItemIcon>
                  {suggestion.type === 'warning' ? (
                    <Warning color="warning" />
                  ) : suggestion.type === 'opportunity' ? (
                    <TrendingUp color="success" />
                  ) : (
                    <CheckCircle color="info" />
                  )}
                </ListItemIcon>
                <ListItemText
                  primary={suggestion.message}
                  secondary={`优先级: ${suggestion.priority === 'high' ? '高' : suggestion.priority === 'medium' ? '中' : '低'}`}
                />
              </ListItem>
            ))}
          </List>
        </Paper>
      )}

      {/* 添加费用对话框 */}
      <Dialog open={showAddExpense} onClose={() => setShowAddExpense(false)} maxWidth="sm" fullWidth>
        <DialogTitle>添加费用</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="金额"
              type="number"
              value={newExpense.amount}
              onChange={(e) => setNewExpense(prev => ({ ...prev, amount: e.target.value }))}
              required
              fullWidth
              InputProps={{
                startAdornment: <Typography sx={{ mr: 1 }}>¥</Typography>,
              }}
            />
            <TextField
              label="类别"
              select
              value={newExpense.category}
              onChange={(e) => setNewExpense(prev => ({ ...prev, category: e.target.value }))}
              required
              fullWidth
            >
              {categories.map((category) => (
                <MenuItem key={category.code} value={category.code}>
                  {category.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="描述"
              value={newExpense.description}
              onChange={(e) => setNewExpense(prev => ({ ...prev, description: e.target.value }))}
              required
              fullWidth
              multiline
              rows={2}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAddExpense(false)}>取消</Button>
          <Button onClick={handleAddExpense} variant="contained">添加</Button>
        </DialogActions>
      </Dialog>

      {/* 语音费用记录对话框 */}
      <VoiceExpenseRecorder
        open={showVoiceRecorder}
        onClose={() => setShowVoiceRecorder(false)}
        onExpenseRecorded={handleVoiceExpense}
        maxDuration={30}
      />

      {/* 详细分析对话框 */}
      <Dialog open={showAnalysis} onClose={() => setShowAnalysis(false)} maxWidth="md" fullWidth>
        <DialogTitle>预算详细分析</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
            {/* 饼图 */}
            <Box>
              <Typography variant="h6" gutterBottom>支出分布</Typography>
              <ResponsiveContainer width="100%" height={300}>
                <RechartsPieChart>
                  <Pie
                    data={pieChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }: any) => `${name || ''} ${((percent || 0) * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip formatter={(value) => [`¥${value}`, '支出']} />
                </RechartsPieChart>
              </ResponsiveContainer>
            </Box>

            {/* 柱状图 */}
            <Box>
              <Typography variant="h6" gutterBottom>预算对比</Typography>
              <ResponsiveContainer width="100%" height={300}>
                <RechartsBarChart data={barChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="category" />
                  <YAxis />
                  <RechartsTooltip formatter={(value) => `¥${value}`} />
                  <Legend />
                  <Bar dataKey="budgeted" fill="#8884d8" name="预算" />
                  <Bar dataKey="spent" fill="#82ca9d" name="支出" />
                </RechartsBarChart>
              </ResponsiveContainer>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAnalysis(false)}>关闭</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default BudgetManager;