import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Alert,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  Settings,
  Key,
  Psychology,
  Close,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

interface ApiKeyRequiredDialogProps {
  open: boolean;
  onClose: () => void;
  message?: string;
  missingServices?: string[];
}

const ApiKeyRequiredDialog: React.FC<ApiKeyRequiredDialogProps> = ({
  open,
  onClose,
  message = '请先配置API密钥',
  missingServices = ['llm'],
}) => {
  const navigate = useNavigate();

  const handleGoToSettings = () => {
    onClose();
    navigate('/settings');
  };

  const getServiceInfo = (service: string) => {
    const serviceMap = {
      llm: {
        name: 'LLM服务',
        description: '用于智能行程规划和对话',
        icon: <Psychology color="primary" />,
      },
      voice: {
        name: '语音识别',
        description: '用于语音输入功能',
        icon: <Key color="primary" />,
      },
      maps: {
        name: '地图服务',
        description: '用于地图显示和路线规划',
        icon: <Key color="primary" />,
      },
    };

    return serviceMap[service as keyof typeof serviceMap] || {
      name: service,
      description: '未知服务',
      icon: <Key color="primary" />,
    };
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Settings color="warning" />
          <Typography variant="h6">需要配置API密钥</Typography>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Alert severity="warning" sx={{ mb: 3 }}>
          {message}
        </Alert>

        <Typography variant="body1" gutterBottom>
          为了使用智能旅行规划功能，您需要配置以下API服务：
        </Typography>

        <List>
          {missingServices.map((service) => {
            const serviceInfo = getServiceInfo(service);
            return (
              <ListItem key={service}>
                <ListItemIcon>{serviceInfo.icon}</ListItemIcon>
                <ListItemText
                  primary={serviceInfo.name}
                  secondary={serviceInfo.description}
                />
              </ListItem>
            );
          })}
        </List>

        <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
          <Typography variant="subtitle2" gutterBottom>
            💡 为什么需要配置API密钥？
          </Typography>
          <Typography variant="body2" color="text.secondary">
            • 保护您的隐私：使用您自己的API密钥，数据更安全
          </Typography>
          <Typography variant="body2" color="text.secondary">
            • 个性化服务：根据您的偏好提供更好的服务
          </Typography>
          <Typography variant="body2" color="text.secondary">
            • 成本控制：您可以控制API使用量和费用
          </Typography>
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} startIcon={<Close />}>
          稍后配置
        </Button>
        <Button
          variant="contained"
          onClick={handleGoToSettings}
          startIcon={<Settings />}
        >
          前往设置
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ApiKeyRequiredDialog;