import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Collapse,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  ExpandMore,
  ExpandLess,
  Navigation,
  DirectionsCar,
  DirectionsWalk,
  DirectionsTransit,
  AccessTime,
  Straighten,
  MonetizationOn,
  Traffic,
  Settings,
  Close,
} from '@mui/icons-material';
import MapService, { RouteResult } from '../services/mapService';

interface MapToolbarProps {
  routeData?: RouteResult | null;
  onRouteSettingsChange?: (settings: RouteSettings) => void;
  onNavigationStart?: (route: RouteResult) => void;
}

export interface RouteSettings {
  strategy: string;
  avoidTolls: boolean;
  avoidHighways: boolean;
  travelMode: string;
}

const MapToolbar: React.FC<MapToolbarProps> = ({
  routeData,
  onRouteSettingsChange,
  onNavigationStart,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<RouteSettings>({
    strategy: 'fastest',
    avoidTolls: false,
    avoidHighways: false,
    travelMode: 'driving',
  });

  const handleSettingsChange = (newSettings: Partial<RouteSettings>) => {
    const updatedSettings = { ...settings, ...newSettings };
    setSettings(updatedSettings);
    onRouteSettingsChange?.(updatedSettings);
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

  const getStrategyLabel = (strategy: string) => {
    const labels: { [key: string]: string } = {
      fastest: '速度优先',
      shortest: '距离优先',
      avoid_traffic: '避免拥堵',
      avoid_highway: '不走高速',
      avoid_toll: '避免收费',
      highway_first: '高速优先',
    };
    return labels[strategy] || strategy;
  };

  if (!routeData) {
    return null;
  }

  return (
    <>
      <Paper
        sx={{
          position: 'absolute',
          bottom: 20,
          left: 20,
          right: 20,
          zIndex: 1000,
          maxWidth: 400,
          mx: 'auto',
        }}
      >
        {/* 路线摘要 */}
        <Box sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {getTravelModeIcon(settings.travelMode)}
              <Typography variant="h6">
                路线信息
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <IconButton size="small" onClick={() => setShowSettings(true)}>
                <Settings />
              </IconButton>
              <IconButton
                size="small"
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? <ExpandLess /> : <ExpandMore />}
              </IconButton>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', gap: 2, mt: 1, flexWrap: 'wrap' }}>
            <Chip
              icon={<Straighten />}
              label={MapService.formatDistance(routeData.distance)}
              size="small"
              color="primary"
            />
            <Chip
              icon={<AccessTime />}
              label={MapService.formatDuration(routeData.duration)}
              size="small"
              color="primary"
            />
            {routeData.tolls > 0 && (
              <Chip
                icon={<MonetizationOn />}
                label={`¥${routeData.tolls}`}
                size="small"
                color="warning"
              />
            )}
            {routeData.traffic_lights > 0 && (
              <Chip
                icon={<Traffic />}
                label={`${routeData.traffic_lights}个红绿灯`}
                size="small"
                variant="outlined"
              />
            )}
          </Box>

          <Button
            variant="contained"
            startIcon={<Navigation />}
            fullWidth
            sx={{ mt: 2 }}
            onClick={() => onNavigationStart?.(routeData)}
          >
            开始导航
          </Button>
        </Box>

        {/* 详细步骤 */}
        <Collapse in={expanded}>
          <Divider />
          <List dense sx={{ maxHeight: 300, overflow: 'auto' }}>
            {routeData.steps.map((step, index) => (
              <ListItem key={index}>
                <ListItemIcon>
                  <Typography variant="caption" color="primary" fontWeight="bold">
                    {index + 1}
                  </Typography>
                </ListItemIcon>
                <ListItemText
                  primary={step.instruction}
                  secondary={
                    <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                      <Typography variant="caption">
                        {MapService.formatDistance(step.distance)}
                      </Typography>
                      <Typography variant="caption">
                        {MapService.formatDuration(step.duration)}
                      </Typography>
                      {step.road && (
                        <Typography variant="caption" color="text.secondary">
                          {step.road}
                        </Typography>
                      )}
                    </Box>
                  }
                />
              </ListItem>
            ))}
          </List>
        </Collapse>
      </Paper>

      {/* 路线设置对话框 */}
      <Dialog
        open={showSettings}
        onClose={() => setShowSettings(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          路线设置
          <IconButton
            onClick={() => setShowSettings(false)}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>出行方式</InputLabel>
              <Select
                value={settings.travelMode}
                label="出行方式"
                onChange={(e) => handleSettingsChange({ travelMode: e.target.value })}
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

            <FormControl fullWidth>
              <InputLabel>路线策略</InputLabel>
              <Select
                value={settings.strategy}
                label="路线策略"
                onChange={(e) => handleSettingsChange({ strategy: e.target.value })}
              >
                <MenuItem value="fastest">速度优先</MenuItem>
                <MenuItem value="shortest">距离优先</MenuItem>
                <MenuItem value="avoid_traffic">避免拥堵</MenuItem>
                <MenuItem value="avoid_highway">不走高速</MenuItem>
                <MenuItem value="avoid_toll">避免收费</MenuItem>
                <MenuItem value="highway_first">高速优先</MenuItem>
              </Select>
            </FormControl>

            <Typography variant="body2" color="text.secondary">
              当前策略：{getStrategyLabel(settings.strategy)}
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowSettings(false)}>
            取消
          </Button>
          <Button
            onClick={() => setShowSettings(false)}
            variant="contained"
          >
            确定
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default MapToolbar;