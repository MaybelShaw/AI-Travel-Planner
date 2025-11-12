import React from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import { TravelExplore } from '@mui/icons-material';

interface LoadingScreenProps {
  message?: string;
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({ 
  message = '加载中...' 
}) => {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        bgcolor: 'background.default',
        gap: 3,
      }}
    >
      {/* Logo */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 80,
          height: 80,
          borderRadius: '50%',
          bgcolor: 'primary.main',
          mb: 2,
          animation: 'pulse 2s infinite',
          '@keyframes pulse': {
            '0%': {
              transform: 'scale(1)',
              opacity: 1,
            },
            '50%': {
              transform: 'scale(1.1)',
              opacity: 0.8,
            },
            '100%': {
              transform: 'scale(1)',
              opacity: 1,
            },
          },
        }}
      >
        <TravelExplore sx={{ fontSize: 40, color: 'white' }} />
      </Box>

      {/* 加载指示器 */}
      <CircularProgress size={40} thickness={4} />

      {/* 加载文本 */}
      <Typography variant="h6" color="text.secondary" textAlign="center">
        {message}
      </Typography>

      {/* 品牌名称 */}
      <Typography variant="h4" color="primary" fontWeight="bold" textAlign="center">
        智能旅行助手
      </Typography>
    </Box>
  );
};

export default LoadingScreen;