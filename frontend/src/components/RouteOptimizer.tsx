import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  Alert,
  CircularProgress,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Route,
  Tune,
  DirectionsCar,
  DirectionsWalk,
  DirectionsTransit,
  Schedule,
  Straighten,
  TrendingDown,
  ExpandMore,
  Close,
  Refresh,
  CheckCircle,
  Warning,
  Info,
  Hotel,
  Restaurant,
  AttractionsOutlined,
  DirectionsBus,
} from '@mui/icons-material';
import { RoutePoint } from '../types';
import RouteOptimizerService, { OptimizedRoute, RouteOptimizationOptions } from '../services/routeOptimizer';
import MapService from '../services/mapService';

interface RouteOptimizerProps {
  routePoints: RoutePoint[];
  onOptimizedRouteChange?: (optimizedRoute: OptimizedRoute) => void;
  onRoutePointsReorder?: (reorderedPoints: RoutePoint[]) => void;
}

const RouteOptimizer: React.FC<RouteOptimizerProps> = ({
  routePoints,
  onOptimizedRouteChange,
  onRoutePointsReorder,
}) => {
  const [open, setOpen] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizedRoute, setOptimizedRoute] = useState<OptimizedRoute | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [options, setOptions] = useState<RouteOptimizationOptions>({
    strategy: 'balanced',
    travelMode: 'driving',
    preserveStartEnd: true,
    maxWaypoints: 20,
  });
  const [multiDayMode, setMultiDayMode] = useState(false);
  const [daysCount, setDaysCount] = useState(1);
  const [multiDayResult, setMultiDayResult] = useState<any>(null);

  // 检查是否可以进行路线优化
  const canOptimize = routePoints.length >= 2;

  const handleOptimize = async () => {
    if (!canOptimize) return;

    setIsOptimizing(true);
    setActiveStep(0);

    try {
      if (multiDayMode && daysCount > 1) {
        // 多日行程优化
        setActiveStep(1);
        const result = await RouteOptimizerService.optimizeMultiDayItinerary(
          routePoints,
          daysCount,
          options
        );
        setMultiDayResult(result);
        setActiveStep(2);
      } else {
        // 单日路线优化
        setActiveStep(1);
        const result = await RouteOptimizerService.optimizeRoute(routePoints, options);
        
        if (result) {
          // 验证优化结果
          const validation = RouteOptimizerService.validateOptimization(result);
          if (!validation.isValid) {
            console.warn('路线优化验证失败:', validation.issues);
          }
          
          setOptimizedRoute(result);
          onOptimizedRouteChange?.(result);
          setActiveStep(2);
        } else {
          throw new Error('路线优化失败');
        }
      }
    } catch (error) {
      console.error('路线优化失败:', error);
      setActiveStep(-1); // 错误状态
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleApplyOptimization = () => {
    if (optimizedRoute) {
      onRoutePointsReorder?.(optimizedRoute.optimizedOrder);
      setOpen(false);
    }
  };

  const handleReset = () => {
    setOptimizedRoute(null);
    setMultiDayResult(null);
    setActiveStep(0);
  };

  const getTravelModeIcon = (mode: string) => {
    switch (mode) {
      case 'walking':
        return <DirectionsWalk />;
      case 'transit':
        return <DirectionsTransit />;
      default:
        return <DirectionsCar />;
    }
  };

  const getPointTypeIcon = (type: string) => {
    switch (type) {
      case 'accommodation':
        return <Hotel />;
      case 'restaurant':
        return <Restaurant />;
      case 'attraction':
        return <AttractionsOutlined />;
      case 'transportation':
        return <DirectionsBus />;
      default:
        return <AttractionsOutlined />;
    }
  };

  const getPointTypeColor = (type: string) => {
    switch (type) {
      case 'accommodation':
        return 'success';
      case 'restaurant':
        return 'warning';
      case 'attraction':
        return 'primary';
      case 'transportation':
        return 'secondary';
      default:
        return 'default';
    }
  };

  const renderOptimizationSteps = () => {
    const steps = [
      {
        label: '准备优化',
        content: '正在分析路线点...'
      },
      {
        label: '计算最优路线',
        content: multiDayMode ? '正在优化多日行程...' : '正在计算最优访问顺序...'
      },
      {
        label: '优化完成',
        content: '路线优化已完成'
      }
    ];

    return (
      <Stepper activeStep={activeStep} orientation="vertical">
        {steps.map((step, index) => (
          <Step key={index}>
            <StepLabel>
              {step.label}
            </StepLabel>
            <StepContent>
              <Typography variant="body2" color="text.secondary">
                {step.content}
              </Typography>
            </StepContent>
          </Step>
        ))}
      </Stepper>
    );
  };

  const renderOptimizationResults = () => {
    if (!optimizedRoute && !multiDayResult) return null;

    if (multiDayResult) {
      return (
        <Box>
          <Typography variant="h6" gutterBottom>
            多日行程优化结果
          </Typography>
          
          <Alert severity="success" sx={{ mb: 2 }}>
            总共节省距离: {MapService.formatDistance(multiDayResult.totalOptimization.savings)}
          </Alert>

          {multiDayResult.days.map((day: any, index: number) => (
            <Accordion key={index}>
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Typography variant="subtitle1">
                  第 {day.day} 天 ({day.points.length} 个地点)
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                {day.optimizedRoute ? (
                  <Box>
                    <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
                      <Chip
                        icon={<Straighten />}
                        label={MapService.formatDistance(day.optimizedRoute.totalDistance)}
                        size="small"
                        color="primary"
                      />
                      <Chip
                        icon={<Schedule />}
                        label={MapService.formatDuration(day.optimizedRoute.totalDuration)}
                        size="small"
                        color="primary"
                      />
                      {day.optimizedRoute.savings.distance > 0 && (
                        <Chip
                          icon={<TrendingDown />}
                          label={`节省 ${MapService.formatDistance(day.optimizedRoute.savings.distance)}`}
                          size="small"
                          color="success"
                        />
                      )}
                    </Box>
                    
                    <List dense>
                      {day.optimizedRoute.optimizedOrder.map((point: RoutePoint, pointIndex: number) => (
                        <ListItem key={pointIndex}>
                          <ListItemIcon>
                            {getPointTypeIcon(point.type)}
                          </ListItemIcon>
                          <ListItemText
                            primary={point.name}
                            secondary={point.address}
                          />
                          <Chip
                            label={point.type}
                            size="small"
                            color={getPointTypeColor(point.type) as any}
                            variant="outlined"
                          />
                        </ListItem>
                      ))}
                    </List>
                  </Box>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    该天只有 {day.points.length} 个地点，无需优化
                  </Typography>
                )}
              </AccordionDetails>
            </Accordion>
          ))}
        </Box>
      );
    }

    if (optimizedRoute) {
      return (
        <Box>
          <Typography variant="h6" gutterBottom>
            路线优化结果
          </Typography>
          
          {/* 优化统计 */}
          <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
            <Chip
              icon={<Straighten />}
              label={MapService.formatDistance(optimizedRoute.totalDistance)}
              color="primary"
            />
            <Chip
              icon={<Schedule />}
              label={MapService.formatDuration(optimizedRoute.totalDuration)}
              color="primary"
            />
            {optimizedRoute.savings.distance > 0 ? (
              <Chip
                icon={<TrendingDown />}
                label={`节省 ${MapService.formatDistance(optimizedRoute.savings.distance)} (${optimizedRoute.savings.percentage.toFixed(1)}%)`}
                color="success"
              />
            ) : (
              <Chip
                icon={<Info />}
                label="已是最优路线"
                color="info"
              />
            )}
          </Box>

          {/* 路线对比 */}
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 3 }}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle2" gutterBottom color="text.secondary">
                原始顺序
              </Typography>
              <List dense>
                {optimizedRoute.originalOrder.map((point, index) => (
                  <ListItem key={index} sx={{ py: 0.5 }}>
                    <ListItemIcon sx={{ minWidth: 32 }}>
                      <Typography variant="caption" color="text.secondary">
                        {index + 1}
                      </Typography>
                    </ListItemIcon>
                    <ListItemText
                      primary={point.name}
                      primaryTypographyProps={{ variant: 'body2' }}
                    />
                  </ListItem>
                ))}
              </List>
            </Paper>

            <Paper sx={{ p: 2, bgcolor: 'success.50' }}>
              <Typography variant="subtitle2" gutterBottom color="success.main">
                优化顺序
              </Typography>
              <List dense>
                {optimizedRoute.optimizedOrder.map((point, index) => (
                  <ListItem key={index} sx={{ py: 0.5 }}>
                    <ListItemIcon sx={{ minWidth: 32 }}>
                      <Typography variant="caption" color="success.main" fontWeight="bold">
                        {index + 1}
                      </Typography>
                    </ListItemIcon>
                    <ListItemText
                      primary={point.name}
                      primaryTypographyProps={{ variant: 'body2', color: 'success.main' }}
                    />
                  </ListItem>
                ))}
              </List>
            </Paper>
          </Box>

          {/* 应用优化按钮 */}
          <Button
            variant="contained"
            color="success"
            fullWidth
            onClick={handleApplyOptimization}
            startIcon={<CheckCircle />}
          >
            应用优化结果
          </Button>
        </Box>
      );
    }

    return null;
  };

  return (
    <>
      {/* 触发按钮 */}
      <Tooltip title={canOptimize ? "优化路线顺序" : "至少需要2个地点才能优化"}>
        <span>
          <Button
            variant="outlined"
            startIcon={<Tune />}
            onClick={() => setOpen(true)}
            disabled={!canOptimize}
            size="small"
          >
            路线优化
          </Button>
        </span>
      </Tooltip>

      {/* 优化对话框 */}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { minHeight: '60vh' }
        }}
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Route />
              <Typography variant="h6">
                路线优化
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {(optimizedRoute || multiDayResult) && (
                <IconButton onClick={handleReset} size="small">
                  <Refresh />
                </IconButton>
              )}
              <IconButton onClick={() => setOpen(false)} size="small">
                <Close />
              </IconButton>
            </Box>
          </Box>
        </DialogTitle>

        <DialogContent>
          {!isOptimizing && !optimizedRoute && !multiDayResult && (
            <Box>
              {/* 优化选项 */}
              <Typography variant="subtitle1" gutterBottom>
                优化设置
              </Typography>
              
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 3 }}>
                <FormControl fullWidth>
                  <InputLabel>优化策略</InputLabel>
                  <Select
                    value={options.strategy}
                    label="优化策略"
                    onChange={(e) => setOptions(prev => ({ ...prev, strategy: e.target.value as any }))}
                  >
                    <MenuItem value="shortest">距离最短</MenuItem>
                    <MenuItem value="fastest">时间最短</MenuItem>
                    <MenuItem value="balanced">平衡优化</MenuItem>
                  </Select>
                </FormControl>

                <FormControl fullWidth>
                  <InputLabel>出行方式</InputLabel>
                  <Select
                    value={options.travelMode}
                    label="出行方式"
                    onChange={(e) => setOptions(prev => ({ ...prev, travelMode: e.target.value as any }))}
                  >
                    <MenuItem value="driving">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <DirectionsCar />
                        驾车
                      </Box>
                    </MenuItem>
                    <MenuItem value="walking">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <DirectionsWalk />
                        步行
                      </Box>
                    </MenuItem>
                    <MenuItem value="transit">
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <DirectionsTransit />
                        公共交通
                      </Box>
                    </MenuItem>
                  </Select>
                </FormControl>
              </Box>

              <Box sx={{ mb: 3 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={options.preserveStartEnd || false}
                      onChange={(e) => setOptions(prev => ({ ...prev, preserveStartEnd: e.target.checked }))}
                    />
                  }
                  label="保持起点和终点不变"
                />
              </Box>

              <Divider sx={{ my: 2 }} />

              {/* 多日行程选项 */}
              <Box sx={{ mb: 3 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={multiDayMode}
                      onChange={(e) => setMultiDayMode(e.target.checked)}
                    />
                  }
                  label="多日行程优化"
                />
                
                {multiDayMode && (
                  <FormControl fullWidth sx={{ mt: 2 }}>
                    <InputLabel>行程天数</InputLabel>
                    <Select
                      value={daysCount}
                      label="行程天数"
                      onChange={(e) => setDaysCount(Number(e.target.value))}
                    >
                      {[1, 2, 3, 4, 5, 6, 7].map(day => (
                        <MenuItem key={day} value={day}>
                          {day} 天
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
              </Box>

              {/* 当前路线点预览 */}
              <Typography variant="subtitle2" gutterBottom>
                当前路线点 ({routePoints.length} 个)
              </Typography>
              <Paper sx={{ p: 2, maxHeight: 200, overflow: 'auto' }}>
                <List dense>
                  {routePoints.map((point, index) => (
                    <ListItem key={index}>
                      <ListItemIcon>
                        {getPointTypeIcon(point.type)}
                      </ListItemIcon>
                      <ListItemText
                        primary={point.name}
                        secondary={point.address}
                      />
                      <Chip
                        label={point.type}
                        size="small"
                        color={getPointTypeColor(point.type) as any}
                        variant="outlined"
                      />
                    </ListItem>
                  ))}
                </List>
              </Paper>
            </Box>
          )}

          {/* 优化进度 */}
          {isOptimizing && (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 4 }}>
              <CircularProgress size={60} sx={{ mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                正在优化路线...
              </Typography>
              <Box sx={{ width: '100%', maxWidth: 400 }}>
                {renderOptimizationSteps()}
              </Box>
            </Box>
          )}

          {/* 优化结果 */}
          {!isOptimizing && (optimizedRoute || multiDayResult) && (
            renderOptimizationResults()
          )}

          {/* 错误状态 */}
          {activeStep === -1 && (
            <Alert severity="error" sx={{ mt: 2 }}>
              路线优化失败，请检查网络连接或稍后重试
            </Alert>
          )}
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setOpen(false)}>
            关闭
          </Button>
          {!isOptimizing && !optimizedRoute && !multiDayResult && (
            <Button
              variant="contained"
              onClick={handleOptimize}
              disabled={!canOptimize}
              startIcon={<Tune />}
            >
              开始优化
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </>
  );
};

export default RouteOptimizer;