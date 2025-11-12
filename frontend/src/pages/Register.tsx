import React, { useState } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Container,
  Paper,
  Box,
  TextField,
  Button,
  Typography,
  Link,
  Alert,
  CircularProgress,
  InputAdornment,
  IconButton,
  LinearProgress,
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  Person,
  Lock,
  TravelExplore,
  CheckCircle,
  Cancel,
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { RegisterForm } from '../types';

const Register: React.FC = () => {
  const navigate = useNavigate();
  const { register } = useAuth();
  
  const [formData, setFormData] = useState<RegisterForm>({
    username: '',
    password: '',
    password2: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showPassword2, setShowPassword2] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // 密码强度检查
  const getPasswordStrength = (password: string) => {
    let strength = 0;
    const checks = {
      length: password.length >= 8,
      lowercase: /[a-z]/.test(password),
      uppercase: /[A-Z]/.test(password),
      numbers: /\d/.test(password),
      symbols: /[^A-Za-z0-9]/.test(password),
    };

    strength = Object.values(checks).filter(Boolean).length;
    
    return {
      score: strength,
      checks,
      level: strength < 2 ? 'weak' : strength < 4 ? 'medium' : 'strong',
    };
  };

  const passwordStrength = getPasswordStrength(formData.password);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
    // 清除错误信息
    if (error) setError('');
  };

  const validateForm = () => {
    if (!formData.username.trim()) {
      setError('请输入用户名');
      return false;
    }
    
    if (formData.username.length < 3) {
      setError('用户名至少需要3个字符');
      return false;
    }

    if (!formData.password) {
      setError('请输入密码');
      return false;
    }

    if (formData.password.length < 6) {
      setError('密码至少需要6个字符');
      return false;
    }

    if (formData.password !== formData.password2) {
      setError('两次输入的密码不一致');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await register(formData.username, formData.password, formData.password2);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || '注册失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  const togglePasswordVisibility = (field: 'password' | 'password2') => {
    if (field === 'password') {
      setShowPassword(!showPassword);
    } else {
      setShowPassword2(!showPassword2);
    }
  };

  const getStrengthColor = (level: string) => {
    switch (level) {
      case 'weak': return 'error';
      case 'medium': return 'warning';
      case 'strong': return 'success';
      default: return 'primary';
    }
  };

  const getStrengthText = (level: string) => {
    switch (level) {
      case 'weak': return '弱';
      case 'medium': return '中等';
      case 'strong': return '强';
      default: return '';
    }
  };

  return (
    <Container component="main" maxWidth="sm">
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          py: 4,
        }}
      >
        <Paper
          elevation={3}
          sx={{
            p: 4,
            width: '100%',
            maxWidth: 450,
            borderRadius: 3,
          }}
        >
          {/* Logo和标题 */}
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              mb: 3,
            }}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 60,
                height: 60,
                borderRadius: '50%',
                bgcolor: 'primary.main',
                mb: 2,
              }}
            >
              <TravelExplore sx={{ fontSize: 30, color: 'white' }} />
            </Box>
            <Typography component="h1" variant="h4" color="primary" fontWeight="bold">
              创建账号
            </Typography>
            <Typography variant="body2" color="text.secondary" textAlign="center" mt={1}>
              加入我们，开始您的智能旅行之旅
            </Typography>
          </Box>

          {/* 错误提示 */}
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {/* 注册表单 */}
          <Box component="form" onSubmit={handleSubmit} noValidate>
            <TextField
              margin="normal"
              required
              fullWidth
              id="username"
              label="用户名"
              name="username"
              autoComplete="username"
              autoFocus
              value={formData.username}
              onChange={handleInputChange}
              disabled={isLoading}
              helperText="用户名至少需要3个字符"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Person color="action" />
                  </InputAdornment>
                ),
              }}
            />
            
            <TextField
              margin="normal"
              required
              fullWidth
              name="password"
              label="密码"
              type={showPassword ? 'text' : 'password'}
              id="password"
              autoComplete="new-password"
              value={formData.password}
              onChange={handleInputChange}
              disabled={isLoading}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Lock color="action" />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label="toggle password visibility"
                      onClick={() => togglePasswordVisibility('password')}
                      edge="end"
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            {/* 密码强度指示器 */}
            {formData.password && (
              <Box sx={{ mt: 1, mb: 1 }}>
                <Box display="flex" alignItems="center" gap={1} mb={1}>
                  <Typography variant="caption" color="text.secondary">
                    密码强度:
                  </Typography>
                  <Typography 
                    variant="caption" 
                    color={`${getStrengthColor(passwordStrength.level)}.main`}
                    fontWeight="bold"
                  >
                    {getStrengthText(passwordStrength.level)}
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={(passwordStrength.score / 5) * 100}
                  color={getStrengthColor(passwordStrength.level) as any}
                  sx={{ height: 4, borderRadius: 2 }}
                />
                <Box display="flex" gap={1} mt={1} flexWrap="wrap">
                  {Object.entries({
                    '8位以上': passwordStrength.checks.length,
                    '小写字母': passwordStrength.checks.lowercase,
                    '大写字母': passwordStrength.checks.uppercase,
                    '数字': passwordStrength.checks.numbers,
                    '特殊字符': passwordStrength.checks.symbols,
                  }).map(([label, passed]) => (
                    <Box key={label} display="flex" alignItems="center" gap={0.5}>
                      {passed ? (
                        <CheckCircle sx={{ fontSize: 12, color: 'success.main' }} />
                      ) : (
                        <Cancel sx={{ fontSize: 12, color: 'error.main' }} />
                      )}
                      <Typography variant="caption" color={passed ? 'success.main' : 'error.main'}>
                        {label}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Box>
            )}

            <TextField
              margin="normal"
              required
              fullWidth
              name="password2"
              label="确认密码"
              type={showPassword2 ? 'text' : 'password'}
              id="password2"
              autoComplete="new-password"
              value={formData.password2}
              onChange={handleInputChange}
              disabled={isLoading}
              error={!!(formData.password2 && formData.password !== formData.password2)}
              helperText={
                formData.password2 && formData.password !== formData.password2
                  ? '密码不一致'
                  : ''
              }
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Lock color="action" />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label="toggle password visibility"
                      onClick={() => togglePasswordVisibility('password2')}
                      edge="end"
                    >
                      {showPassword2 ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 3, mb: 2, py: 1.5 }}
              disabled={isLoading}
              startIcon={isLoading ? <CircularProgress size={20} /> : null}
            >
              {isLoading ? '注册中...' : '注册'}
            </Button>

            <Box textAlign="center">
              <Typography variant="body2" color="text.secondary">
                已有账号？{' '}
                <Link
                  component={RouterLink}
                  to="/login"
                  color="primary"
                  sx={{ textDecoration: 'none', fontWeight: 500 }}
                >
                  立即登录
                </Link>
              </Typography>
            </Box>
          </Box>
        </Paper>

        {/* 页脚信息 */}
        <Box mt={4} textAlign="center">
          <Typography variant="caption" color="text.secondary">
            © 2024 智能旅行助手. 让每一次旅行都充满惊喜
          </Typography>
        </Box>
      </Box>
    </Container>
  );
};

export default Register;