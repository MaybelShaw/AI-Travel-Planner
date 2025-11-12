import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Box,
  IconButton,
  Typography,
  Paper,
  LinearProgress,
  Chip,
  Alert,
  Tooltip,
} from '@mui/material';
import {
  Mic,
  MicOff,
  Stop,
  PlayArrow,
  Pause,
  Delete,
  Send,
} from '@mui/icons-material';
import { VoiceRecordingState } from '../types';

interface VoiceRecorderProps {
  onRecordingComplete?: (audioBlob: Blob, audioUrl: string) => void;
  onSend?: (audioBlob: Blob) => void;
  disabled?: boolean;
  maxDuration?: number; // 最大录制时长（秒）
}

const VoiceRecorder: React.FC<VoiceRecorderProps> = ({
  onRecordingComplete,
  onSend,
  disabled = false,
  maxDuration = 60,
}) => {
  const [recordingState, setRecordingState] = useState<VoiceRecordingState>({
    isRecording: false,
    isPaused: false,
    recordingTime: 0,
  });
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string>('');

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

  // 开始录制
  const startRecording = useCallback(async () => {
    try {
      setError('');
      
      // 请求麦克风权限
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        }
      });
      
      streamRef.current = stream;
      chunksRef.current = [];

      // 创建MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });
      
      mediaRecorderRef.current = mediaRecorder;

      // 处理录制数据
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      // 录制结束处理
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const audioUrl = URL.createObjectURL(audioBlob);
        
        setRecordingState(prev => ({
          ...prev,
          audioBlob,
          audioUrl,
          isRecording: false,
          isPaused: false,
        }));

        // 停止所有音轨
        stream.getTracks().forEach(track => track.stop());
        streamRef.current = null;

        // 回调
        if (onRecordingComplete) {
          onRecordingComplete(audioBlob, audioUrl);
        }
      };

      // 开始录制
      mediaRecorder.start(100); // 每100ms收集一次数据
      
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
          
          // 检查是否达到最大时长
          if (newTime >= maxDuration) {
            if (mediaRecorderRef.current && prev.isRecording) {
              mediaRecorderRef.current.stop();
            }
            return prev;
          }
          
          return { ...prev, recordingTime: newTime };
        });
      }, 1000);

    } catch (err) {
      console.error('录制启动失败:', err);
      setError('无法访问麦克风，请检查权限设置');
    }
  }, [maxDuration, onRecordingComplete]);

  // 停止录制
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && recordingState.isRecording) {
      mediaRecorderRef.current.stop();
    }
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, [recordingState.isRecording]);

  // 暂停/恢复录制
  const togglePause = useCallback(() => {
    if (!mediaRecorderRef.current) return;

    if (recordingState.isPaused) {
      mediaRecorderRef.current.resume();
      // 恢复计时
      timerRef.current = setInterval(() => {
        setRecordingState(prev => {
          const newTime = prev.recordingTime + 1;
          if (newTime >= maxDuration) {
            stopRecording();
            return prev;
          }
          return { ...prev, recordingTime: newTime };
        });
      }, 1000);
    } else {
      mediaRecorderRef.current.pause();
      // 暂停计时
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    setRecordingState(prev => ({
      ...prev,
      isPaused: !prev.isPaused,
    }));
  }, [recordingState.isPaused, maxDuration, stopRecording]);

  // 播放录音
  const playRecording = useCallback(() => {
    if (!recordingState.audioUrl) return;

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    const audio = new Audio(recordingState.audioUrl);
    audioRef.current = audio;

    audio.onplay = () => setIsPlaying(true);
    audio.onpause = () => setIsPlaying(false);
    audio.onended = () => setIsPlaying(false);
    audio.onerror = () => {
      setIsPlaying(false);
      setError('音频播放失败');
    };

    audio.play().catch(err => {
      console.error('播放失败:', err);
      setError('音频播放失败');
    });
  }, [recordingState.audioUrl]);

  // 暂停播放
  const pausePlayback = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
  }, []);

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
    setIsPlaying(false);
    setError('');
  }, [recordingState.audioUrl]);

  // 发送录音
  const sendRecording = useCallback(() => {
    if (recordingState.audioBlob && onSend) {
      onSend(recordingState.audioBlob);
    }
  }, [recordingState.audioBlob, onSend]);

  // 清理资源
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (recordingState.audioUrl) {
        URL.revokeObjectURL(recordingState.audioUrl);
      }
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, [recordingState.audioUrl]);

  return (
    <Paper elevation={2} sx={{ p: 2, maxWidth: 400, mx: 'auto' }}>
      <Box display="flex" flexDirection="column" alignItems="center" gap={2}>
        {/* 标题 */}
        <Typography variant="h6" color="primary">
          语音录制
        </Typography>

        {/* 错误提示 */}
        {error && (
          <Alert severity="error" sx={{ width: '100%' }}>
            {error}
          </Alert>
        )}

        {/* 录制状态显示 */}
        <Box display="flex" alignItems="center" gap={1}>
          {recordingState.isRecording && (
            <Chip
              label={recordingState.isPaused ? '已暂停' : '录制中'}
              color={recordingState.isPaused ? 'warning' : 'error'}
              size="small"
              variant="outlined"
            />
          )}
          
          <Typography variant="body1" fontFamily="monospace">
            {formatTime(recordingState.recordingTime)}
          </Typography>
          
          <Typography variant="caption" color="text.secondary">
            / {formatTime(maxDuration)}
          </Typography>
        </Box>

        {/* 进度条 */}
        {recordingState.isRecording && (
          <LinearProgress
            variant="determinate"
            value={(recordingState.recordingTime / maxDuration) * 100}
            sx={{ width: '100%', height: 6, borderRadius: 3 }}
            color={recordingState.recordingTime > maxDuration * 0.8 ? 'warning' : 'primary'}
          />
        )}

        {/* 控制按钮 */}
        <Box display="flex" gap={1} alignItems="center">
          {!recordingState.isRecording && !recordingState.audioBlob && (
            <Tooltip title="开始录制">
              <IconButton
                color="primary"
                size="large"
                onClick={startRecording}
                disabled={disabled}
                sx={{
                  bgcolor: 'primary.main',
                  color: 'white',
                  '&:hover': { bgcolor: 'primary.dark' },
                }}
              >
                <Mic />
              </IconButton>
            </Tooltip>
          )}

          {recordingState.isRecording && (
            <>
              <Tooltip title={recordingState.isPaused ? '继续录制' : '暂停录制'}>
                <IconButton
                  color="warning"
                  onClick={togglePause}
                  disabled={disabled}
                >
                  {recordingState.isPaused ? <Mic /> : <MicOff />}
                </IconButton>
              </Tooltip>

              <Tooltip title="停止录制">
                <IconButton
                  color="error"
                  onClick={stopRecording}
                  disabled={disabled}
                >
                  <Stop />
                </IconButton>
              </Tooltip>
            </>
          )}

          {recordingState.audioBlob && (
            <>
              <Tooltip title={isPlaying ? '暂停播放' : '播放录音'}>
                <IconButton
                  color="primary"
                  onClick={isPlaying ? pausePlayback : playRecording}
                  disabled={disabled}
                >
                  {isPlaying ? <Pause /> : <PlayArrow />}
                </IconButton>
              </Tooltip>

              <Tooltip title="删除录音">
                <IconButton
                  color="error"
                  onClick={deleteRecording}
                  disabled={disabled}
                >
                  <Delete />
                </IconButton>
              </Tooltip>

              {onSend && (
                <Tooltip title="发送录音">
                  <IconButton
                    color="success"
                    onClick={sendRecording}
                    disabled={disabled}
                    sx={{
                      bgcolor: 'success.main',
                      color: 'white',
                      '&:hover': { bgcolor: 'success.dark' },
                    }}
                  >
                    <Send />
                  </IconButton>
                </Tooltip>
              )}
            </>
          )}
        </Box>

        {/* 提示信息 */}
        <Typography variant="caption" color="text.secondary" textAlign="center">
          {!recordingState.isRecording && !recordingState.audioBlob && '点击麦克风开始录制'}
          {recordingState.isRecording && !recordingState.isPaused && '正在录制中...'}
          {recordingState.isRecording && recordingState.isPaused && '录制已暂停'}
          {recordingState.audioBlob && '录制完成，可以播放或发送'}
        </Typography>
      </Box>
    </Paper>
  );
};

export default VoiceRecorder;