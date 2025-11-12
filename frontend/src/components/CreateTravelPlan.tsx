import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  TextField,
  Tabs,
  Tab,
  Paper,
  Alert,
  CircularProgress,
  Divider,
} from '@mui/material';
import {
  Mic,
  Edit,
  Send,
  Cancel,
} from '@mui/icons-material';
import VoiceRecorder from './VoiceRecorder';

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
      id={`create-tabpanel-${index}`}
      aria-labelledby={`create-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 2 }}>{children}</Box>}
    </div>
  );
}

interface CreateTravelPlanProps {
  open: boolean;
  onClose: () => void;
  onTextCreate: (userInput: string) => Promise<void>;
  onVoiceCreate: (audioBlob: Blob) => Promise<void>;
  isCreating: boolean;
  error?: string;
}

const CreateTravelPlan: React.FC<CreateTravelPlanProps> = ({
  open,
  onClose,
  onTextCreate,
  onVoiceCreate,
  isCreating,
  error,
}) => {
  const [tabValue, setTabValue] = useState(0);
  const [textInput, setTextInput] = useState('');
  const [textError, setTextError] = useState('');

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
    setTextError('');
  };

  const handleTextSubmit = async () => {
    if (!textInput.trim()) {
      setTextError('请输入您的旅行需求');
      return;
    }

    try {
      await onTextCreate(textInput.trim());
      setTextInput('');
      setTextError('');
    } catch (err) {
      // 错误由父组件处理
    }
  };

  const handleVoiceSubmit = async (audioBlob: Blob) => {
    try {
      await onVoiceCreate(audioBlob);
    } catch (err) {
      // 错误由父组件处理
    }
  };

  const handleClose = () => {
    if (!isCreating) {
      // 如果有输入内容，询问用户是否确认关闭
      if (textInput.trim() && !window.confirm('您有未保存的内容，确定要关闭吗？')) {
        return;
      }
      setTextInput('');
      setTextError('');
      setTabValue(0);
      onClose();
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose} 
      maxWidth="md" 
      fullWidth
      PaperProps={{
        sx: { 
          minHeight: '500px',
          borderRadius: 2,
        }
      }}
    >
      <DialogTitle>
        <Typography variant="h5" component="div">
          创建旅行计划
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          选择您喜欢的方式来描述您的旅行需求
        </Typography>
      </DialogTitle>

      <DialogContent>
        {/* 错误提示 */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* 创建方式选择 */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
          <Tabs value={tabValue} onChange={handleTabChange}>
            <Tab 
              icon={<Edit />} 
              label="文字输入" 
              iconPosition="start"
              disabled={isCreating}
            />
            <Tab 
              icon={<Mic />} 
              label="语音输入" 
              iconPosition="start"
              disabled={isCreating}
            />
          </Tabs>
        </Box>

        {/* 文字输入面板 */}
        <TabPanel value={tabValue} index={0}>
          <Box>
            <Typography variant="h6" gutterBottom>
              描述您的旅行需求
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              请详细描述您的旅行计划，包括目的地、时间、预算、偏好等信息
            </Typography>

            <TextField
              fullWidth
              multiline
              rows={6}
              placeholder="例如：我想去上海旅游3天，预算5000元，喜欢美食和购物，希望住在市中心附近..."
              value={textInput}
              onChange={(e) => {
                setTextInput(e.target.value);
                if (textError) setTextError('');
              }}
              disabled={isCreating}
              error={!!textError}
              helperText={textError || '请详细描述您的旅行需求，AI将根据您的描述生成个性化的旅行计划'}
              sx={{ mb: 2 }}
            />

            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <Typography variant="caption" color="text.secondary">
                {textInput.length}/1000 字符
              </Typography>
              {textInput.length > 1000 && (
                <Typography variant="caption" color="error">
                  输入内容过长
                </Typography>
              )}
            </Box>

            {/* 快捷输入按钮 */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" gutterBottom>
                快捷输入：
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {[
                  '我想去北京旅游5天，预算3000元，对历史文化感兴趣',
                  '计划和朋友去三亚度假一周，预算8000元，想要海边酒店',
                  '商务出差上海3天，需要方便的交通和商务酒店',
                  '和家人去成都旅游4天，预算4000元，喜欢美食和熊猫'
                ].map((example, index) => (
                  <Button
                    key={index}
                    variant="outlined"
                    size="small"
                    onClick={() => setTextInput(example)}
                    disabled={isCreating}
                    sx={{ mb: 1 }}
                  >
                    示例 {index + 1}
                  </Button>
                ))}
              </Box>
            </Box>

            {/* 示例提示 */}
            <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
              <Typography variant="subtitle2" gutterBottom>
                💡 输入提示：
              </Typography>
              <Typography variant="body2" color="text.secondary">
                • 包含目的地、天数、预算等基本信息
              </Typography>
              <Typography variant="body2" color="text.secondary">
                • 描述您的兴趣爱好和偏好
              </Typography>
              <Typography variant="body2" color="text.secondary">
                • 提及住宿、交通等特殊要求
              </Typography>
            </Paper>
          </Box>
        </TabPanel>

        {/* 语音输入面板 */}
        <TabPanel value={tabValue} index={1}>
          <Box>
            <Typography variant="h6" gutterBottom>
              语音描述您的旅行需求
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              点击录音按钮，清晰地说出您的旅行计划，包括目的地、时间、预算等信息
            </Typography>

            <VoiceRecorder
              onSend={handleVoiceSubmit}
              disabled={isCreating}
              maxDuration={60}
            />

            <Divider sx={{ my: 3 }} />

            {/* 语音输入提示 */}
            <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
              <Typography variant="subtitle2" gutterBottom>
                🎤 语音输入提示：
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                • 请在安静的环境中录音，确保声音清晰
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                • 说话速度适中，发音清楚
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                • 包含关键信息：目的地、天数、预算、偏好
              </Typography>
              <Typography variant="body2" color="text.secondary">
                • 录音时长建议在30-60秒内
              </Typography>
            </Paper>
          </Box>
        </TabPanel>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button 
          onClick={handleClose} 
          disabled={isCreating}
          startIcon={<Cancel />}
        >
          取消
        </Button>
        
        {tabValue === 0 && (
          <Button
            variant="contained"
            onClick={handleTextSubmit}
            disabled={isCreating || !textInput.trim() || textInput.length > 1000}
            startIcon={isCreating ? <CircularProgress size={20} /> : <Send />}
          >
            {isCreating ? '创建中...' : '创建计划'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default CreateTravelPlan;