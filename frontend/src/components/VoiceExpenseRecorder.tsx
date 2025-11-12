import React, { useState, useRef, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
  Chip,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  CircularProgress,
  Tooltip,
} from '@mui/material';
import {
  Mic,
  Stop,
  PlayArrow,
  Pause,
  Delete,
  Send,
  AttachMoney,
  Category,
  Description,
  CheckCircle,
} from '@mui/icons-material';
import { VoiceRecordingState } from '../types';

interface VoiceExpenseRecorderProps {
  open: boolean;
  onClose: () => void;
  onExpenseRecorded: (audioBlob: Blob) => Promise<void>;
  disabled?: boolean;
  maxDuration?: number;
}

interface ExpensePreview {
  amount?: number;
  category?: string;
  description?: string;
  confidence?: number;
}

const VoiceExpenseRecorder: React.FC<VoiceExpenseRecorderProps> = ({
  open,
  onClose,
  onExpenseRecorded,
  disabled = false,
  maxDuration = 30,
}) => {
  const [recordingState, setRecordingState] = useState<VoiceRecordingState>({
    isRecording: false,
    isPaused: false,
    recordingTime: 0,
  });
  const [isPlaying, setIsPlaying] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string>('');
  const [expensePreview, setExpensePreview] = useState<ExpensePreview | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // 格式化时间显示
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // 开始录音
  const startRecording = useCallback(async () => {
    try {
      setError('');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        }
      });
      
      streamRef.current = stream;
      chunksRef.current = [];

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const audioUrl = URL.createObjectURL(audioBlob);
        
        setRecordingState(prev => ({
          ...prev,
          audioBlob,
          audioUrl,
          isRecording: false,
        }));

        // 停止所有音轨
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start(100);
      
      setRecordingState(prev => ({
        ...prev,
        isRecording: true,
        isPaused: false,
        recordingTime: 0,
      }));

      // 开始计时
      timerRef.current = setInterval(() => {
        setRecordingState(prev => {
          const newTime = prev.recordingTime + 1;
          
          // 达到最大时长自动停止
          if (newTime >= maxDuration) {
            stopRecording();
            return prev;
          }
          
          return { ...prev, recordingTime: newTime };
        });
      }, 1000);

    } catch (err) {
      console.error('开始录音失败:', err);
      setError('无法访问麦克风，请检查权限设置');
    }
  }, [maxDuration]);

  // 停止录音
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && recordingState.isRecording) {
      mediaRecorderRef.current.stop();
    }
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, [recordingState.isRecording]);

  // 播放录音
  const playRecording = useCallback(() => {
    if (recordingState.audioUrl && audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.src = recordingState.audioUrl;
        audioRef.current.play();
        setIsPlaying(true);
        
        audioRef.current.onended = () => setIsPlaying(false);
      }
    }
  }, [recordingState.audioUrl, isPlaying]);

  // 删除录音
  const deleteRecording = useCallback(() => {
    if (recordingState.audioUrl) {
      URL.revokeObjectURL(recordingState.audioUrl);
    }
    
    setRecordingState({
      isRecording: false,
      isPaused: false,
      recordingTime: 0,
    });
    setExpensePreview(null);
    setIsPlaying(false);
  }, [recordingState.audioUrl]);

  // 发送录音
  const sendRecording = useCallback(async () => {
    if (!recordingState.audioBlob) return;

    setIsProcessing(true);
    setError('');

    try {
      await onExpenseRecorded(recordingState.audioBlob);
      
      // 清理状态
      deleteRecording();
      onClose();
    } catch (err: any) {
      setError(err.message || '处理语音失败');
    } finally {
      setIsProcessing(false);
    }
  }, [recordingState.audioBlob, onExpenseRecorded, deleteRecording, onClose]);

  // 清理资源
  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    
    if (recordingState.audioUrl) {
      URL.revokeObjectURL(recordingState.audioUrl);
    }
  }, [recordingState.audioUrl]);

  // 组件卸载时清理
  React.useEffect(() => {
    return cleanup;
  }, [cleanup]);

  // 对话框关闭时清理
  const handleClose = () => {
    cleanup();
    deleteRecording();
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: { minHeight: 400 }
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Mic color="primary" />
          <Typography variant="h6">语音记录费用</Typography>
        </Box>
      </DialogTitle>

      <DialogContent>
        {/* 错误提示 */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* 使用说明 */}
        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="body2">
            请清晰地说出费用信息，例如：
            <br />• "午餐花了50元"
            <br />• "打车费用30块钱"
            <br />• "买纪念品花了100元"
          </Typography>
        </Alert>

        {/* 录音控制区域 */}
        <Paper sx={{ p: 3, mb: 3, textAlign: 'center' }}>
          {/* 录音状态显示 */}
          <Box sx={{ mb: 3 }}>
            {recordingState.isRecording ? (
              <Box>
                <Typography variant="h4" color="error" sx={{ mb: 1 }}>
                  {formatTime(recordingState.recordingTime)}
                </Typography>
                <Chip 
                  label="正在录音..." 
                  color="error" 
                  icon={<Mic />}
                  sx={{ 
                    '@keyframes pulse': {
                      '0%': { opacity: 1 },
                      '50%': { opacity: 0.5 },
                      '100%': { opacity: 1 }
                    },
                    animation: 'pulse 1.5s infinite'
                  }}
                />
                <LinearProgress 
                  variant="determinate" 
                  value={(recordingState.recordingTime / maxDuration) * 100}
                  sx={{ mt: 2 }}
                />
              </Box>
            ) : recordingState.audioBlob ? (
              <Box>
                <Typography variant="h6" sx={{ mb: 1 }}>
                  录音完成 ({formatTime(recordingState.recordingTime)})
                </Typography>
                <Chip 
                  label="可以播放或发送" 
                  color="success" 
                  icon={<CheckCircle />}
                />
              </Box>
            ) : (
              <Box>
                <Typography variant="h6" sx={{ mb: 1 }}>
                  准备录音
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  点击麦克风开始录制费用信息
                </Typography>
              </Box>
            )}
          </Box>

          {/* 录音控制按钮 */}
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2 }}>
            {!recordingState.isRecording && !recordingState.audioBlob && (
              <Tooltip title="开始录音">
                <IconButton
                  size="large"
                  color="primary"
                  onClick={startRecording}
                  disabled={disabled || isProcessing}
                  sx={{ 
                    width: 64, 
                    height: 64,
                    bgcolor: 'primary.main',
                    color: 'white',
                    '&:hover': { bgcolor: 'primary.dark' }
                  }}
                >
                  <Mic fontSize="large" />
                </IconButton>
              </Tooltip>
            )}

            {recordingState.isRecording && (
              <Tooltip title="停止录音">
                <IconButton
                  size="large"
                  color="error"
                  onClick={stopRecording}
                  sx={{ 
                    width: 64, 
                    height: 64,
                    bgcolor: 'error.main',
                    color: 'white',
                    '&:hover': { bgcolor: 'error.dark' }
                  }}
                >
                  <Stop fontSize="large" />
                </IconButton>
              </Tooltip>
            )}

            {recordingState.audioBlob && (
              <>
                <Tooltip title={isPlaying ? "暂停播放" : "播放录音"}>
                  <IconButton
                    size="large"
                    color="info"
                    onClick={playRecording}
                    disabled={isProcessing}
                  >
                    {isPlaying ? <Pause fontSize="large" /> : <PlayArrow fontSize="large" />}
                  </IconButton>
                </Tooltip>

                <Tooltip title="删除录音">
                  <IconButton
                    size="large"
                    color="error"
                    onClick={deleteRecording}
                    disabled={isProcessing}
                  >
                    <Delete fontSize="large" />
                  </IconButton>
                </Tooltip>
              </>
            )}
          </Box>

          {/* 隐藏的音频元素 */}
          <audio ref={audioRef} style={{ display: 'none' }} />
        </Paper>

        {/* 费用预览 */}
        {expensePreview && (
          <Paper sx={{ p: 2, mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              识别的费用信息：
            </Typography>
            <List dense>
              {expensePreview.amount && (
                <ListItem>
                  <ListItemIcon>
                    <AttachMoney />
                  </ListItemIcon>
                  <ListItemText 
                    primary="金额" 
                    secondary={`¥${expensePreview.amount}`}
                  />
                </ListItem>
              )}
              {expensePreview.category && (
                <ListItem>
                  <ListItemIcon>
                    <Category />
                  </ListItemIcon>
                  <ListItemText 
                    primary="类别" 
                    secondary={expensePreview.category}
                  />
                </ListItem>
              )}
              {expensePreview.description && (
                <ListItem>
                  <ListItemIcon>
                    <Description />
                  </ListItemIcon>
                  <ListItemText 
                    primary="描述" 
                    secondary={expensePreview.description}
                  />
                </ListItem>
              )}
            </List>
          </Paper>
        )}

        {/* 处理状态 */}
        {isProcessing && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 2 }}>
            <CircularProgress size={24} />
            <Typography>正在处理语音...</Typography>
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} disabled={isProcessing}>
          取消
        </Button>
        <Button
          variant="contained"
          startIcon={isProcessing ? <CircularProgress size={16} /> : <Send />}
          onClick={sendRecording}
          disabled={!recordingState.audioBlob || isProcessing}
        >
          {isProcessing ? '处理中...' : '发送录音'}
        </Button>
      </DialogActions>

      {/* CSS动画通过sx属性实现 */}
    </Dialog>
  );
};

export default VoiceExpenseRecorder;