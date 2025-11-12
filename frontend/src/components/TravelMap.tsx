import React, { useState, useEffect, useRef } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Tooltip,
  Fab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Chip,
  Alert,
  CircularProgress,
  Snackbar,
} from '@mui/material';
import {
  MyLocation,
  Edit,
  Delete,
  AttractionsOutlined,
  Search,
  Close,
  Route,
} from '@mui/icons-material';
import { MapLocation, RoutePoint } from '../types';
import MapService, { POIResult } from '../services/mapService';
import MapToolbar, { RouteSettings } from './MapToolbar';

// 修复Leaflet默认图标问题
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

// 自定义图标
const createCustomIcon = (type: string, color: string = '#1976d2') => {
  const iconMap: { [key: string]: string } = {
    accommodation: '🏨',
    restaurant: '🍽️',
    attraction: '🎯',
    transportation: '🚌',
    default: '📍',
  };

  return L.divIcon({
    html: `
      <div style="
        background-color: ${color};
        width: 30px;
        height: 30px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 2px solid white;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        font-size: 14px;
      ">
        ${iconMap[type] || iconMap.default}
      </div>
    `,
    className: 'custom-marker',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
};

interface TravelMapProps {
  travelPlan?: any; // 添加travelPlan属性
  center?: [number, number];
  zoom?: number;
  height?: string | number;
  routePoints?: RoutePoint[];
  onLocationAdd?: (location: MapLocation) => void;
  onLocationEdit?: (location: MapLocation) => void;
  onLocationDelete?: (location: MapLocation) => void;
  onNavigationStart?: (route: any) => void;
  editable?: boolean;
  showRoute?: boolean;
  showToolbar?: boolean;
}

// 地图事件处理组件
const MapEventHandler: React.FC<{
  onMapClick?: (location: MapLocation) => void;
  editable: boolean;
}> = ({ onMapClick, editable }) => {
  useMapEvents({
    click: (e) => {
      if (editable && onMapClick) {
        onMapClick({
          latitude: e.latlng.lat,
          longitude: e.latlng.lng,
        });
      }
    },
  });
  return null;
};

// 地图刷新组件
const MapRefreshControl: React.FC = () => {
  const map = useMap();
  
  useEffect(() => {
    // 定期刷新地图尺寸以修复显示问题
    const refreshMap = () => {
      map.invalidateSize();
    };
    
    // 监听窗口大小变化
    window.addEventListener('resize', refreshMap);
    
    // 初始刷新
    const timer = setTimeout(refreshMap, 100);
    
    return () => {
      window.removeEventListener('resize', refreshMap);
      clearTimeout(timer);
    };
  }, [map]);
  
  return null;
};

// 定位到用户位置组件
const LocationControl: React.FC = () => {
  const map = useMap();

  const handleLocateUser = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          map.setView([latitude, longitude], 15);
          // 刷新地图显示
          setTimeout(() => map.invalidateSize(), 100);
        },
        (error) => {
          console.error('获取位置失败:', error);
        }
      );
    }
  };

  return (
    <Fab
      size="small"
      color="primary"
      onClick={handleLocateUser}
      sx={{
        position: 'absolute',
        top: 10,
        right: 10,
        zIndex: 1000,
      }}
    >
      <MyLocation />
    </Fab>
  );
};

const TravelMap: React.FC<TravelMapProps> = ({
  travelPlan,
  center = [39.9042, 116.4074], // 默认北京
  zoom = 10,
  height = 400,
  routePoints = [],
  onLocationAdd,
  onLocationEdit,
  onLocationDelete,
  onNavigationStart,
  editable = false,
  showRoute = true,
  showToolbar = true,
}) => {
  const mapRef = useRef<L.Map | null>(null);

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newLocation, setNewLocation] = useState<Partial<MapLocation>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<POIResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [routeData, setRouteData] = useState<any>(null);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  const [routeSettings, setRouteSettings] = useState<RouteSettings>({
    strategy: 'fastest',
    avoidTolls: false,
    avoidHighways: false,
    travelMode: 'driving',
  });
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info' | 'warning';
  }>({
    open: false,
    message: '',
    severity: 'info'
  });

  // 修复Leaflet地图显示问题
  useEffect(() => {
    // 添加Leaflet CSS修复样式
    const style = document.createElement('style');
    style.id = 'leaflet-fix-styles';
    style.textContent = `
      .leaflet-container {
        height: 100% !important;
        width: 100% !important;
        background: #f8f9fa;
      }
      .leaflet-tile {
        max-width: none !important;
        filter: none !important;
      }
      .leaflet-tile-container {
        overflow: visible !important;
      }
      .leaflet-tile-pane {
        opacity: 1 !important;
      }
      .leaflet-map-pane {
        z-index: 1 !important;
      }
      .leaflet-control-container {
        z-index: 1000 !important;
      }
    `;
    
    // 避免重复添加样式
    const existingStyle = document.getElementById('leaflet-fix-styles');
    if (!existingStyle) {
      document.head.appendChild(style);
    }
    
    return () => {
      const styleElement = document.getElementById('leaflet-fix-styles');
      if (styleElement) {
        document.head.removeChild(styleElement);
      }
    };
  }, []);

  // 地图尺寸刷新
  useEffect(() => {
    const timer = setTimeout(() => {
      if (mapRef.current) {
        mapRef.current.invalidateSize();
      }
    }, 100);
    
    return () => clearTimeout(timer);
  }, [height, routePoints]);

  // 处理地图点击
  const handleMapClick = (location: MapLocation) => {
    if (editable) {
      setNewLocation(location);
      setShowAddDialog(true);
    }
  };

  // 添加新位置
  const handleAddLocation = async () => {
    if (newLocation.latitude && newLocation.longitude && newLocation.name) {
      const location: MapLocation = {
        latitude: newLocation.latitude,
        longitude: newLocation.longitude,
        name: newLocation.name,
        address: newLocation.address,
      };
      
      // 如果没有地址，尝试逆地理编码获取
      if (!location.address && location.longitude && location.latitude) {
        try {
          const geocodeResult = await MapService.reverseGeocode(location.longitude, location.latitude);
          if (geocodeResult) {
            location.address = geocodeResult.formatted_address;
          }
        } catch (error) {
          console.error('逆地理编码失败:', error);
        }
      }
      
      onLocationAdd?.(location);
      setShowAddDialog(false);
      setNewLocation({});
      setSnackbar({
        open: true,
        message: '位置添加成功',
        severity: 'success'
      });
    }
  };

  // 搜索位置
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const results = await MapService.searchPOI(searchQuery, undefined, 10);
      setSearchResults(results);
      
      if (results.length === 0) {
        setSnackbar({
          open: true,
          message: '未找到相关地点',
          severity: 'info'
        });
      }
    } catch (error) {
      console.error('搜索失败:', error);
      setSnackbar({
        open: true,
        message: '搜索失败，请稍后重试',
        severity: 'error'
      });
    } finally {
      setIsSearching(false);
    }
  };

  // 生成路线
  const generateRoute = (): [number, number][] => {
    if (!showRoute || routePoints.length < 2) return [];
    
    return routePoints
      .sort((a, b) => a.order - b.order)
      .map(point => [point.latitude, point.longitude]);
  };

  // 获取点类型颜色
  const getPointColor = (type: string) => {
    const colorMap: { [key: string]: string } = {
      accommodation: '#4caf50',
      restaurant: '#ff9800',
      attraction: '#2196f3',
      transportation: '#9c27b0',
    };
    return colorMap[type] || '#1976d2';
  };

  // 规划路线
  const handlePlanRoute = async () => {
    if (routePoints.length < 2) {
      setSnackbar({
        open: true,
        message: '至少需要两个地点才能规划路线',
        severity: 'warning'
      });
      return;
    }

    setIsLoadingRoute(true);
    try {
      const sortedPoints = [...routePoints].sort((a, b) => a.order - b.order);
      const origin = { lng: sortedPoints[0].longitude, lat: sortedPoints[0].latitude };
      const destination = { 
        lng: sortedPoints[sortedPoints.length - 1].longitude, 
        lat: sortedPoints[sortedPoints.length - 1].latitude 
      };
      
      const waypoints = sortedPoints.slice(1, -1).map(point => ({
        lng: point.longitude,
        lat: point.latitude
      }));

      const route = await MapService.planRoute(origin, destination, waypoints, routeSettings.strategy);
      
      if (route) {
        setRouteData(route);
        setSnackbar({
          open: true,
          message: `路线规划成功！总距离：${MapService.formatDistance(route.distance)}，预计时间：${MapService.formatDuration(route.duration)}`,
          severity: 'success'
        });
      } else {
        setSnackbar({
          open: true,
          message: '路线规划失败，请稍后重试',
          severity: 'error'
        });
      }
    } catch (error) {
      console.error('路线规划失败:', error);
      setSnackbar({
        open: true,
        message: '路线规划失败，请稍后重试',
        severity: 'error'
      });
    } finally {
      setIsLoadingRoute(false);
    }
  };

  // 处理搜索结果选择
  const handleSelectSearchResult = async (result: POIResult) => {
    const location: Partial<MapLocation> = {
      latitude: result.lat,
      longitude: result.lng,
      name: result.name,
      address: result.address
    };
    
    setNewLocation(location);
    setShowAddDialog(true);
    setSearchResults([]);
    setSearchQuery('');
  };

  // 处理路线设置变化
  const handleRouteSettingsChange = (newSettings: RouteSettings) => {
    setRouteSettings(newSettings);
    // 如果已有路线数据，重新规划路线
    if (routeData) {
      handlePlanRoute();
    }
  };

  // 处理导航开始
  const handleNavigationStart = (route: any) => {
    onNavigationStart?.(route);
    setSnackbar({
      open: true,
      message: '导航已开始',
      severity: 'success'
    });
  };

  return (
    <Box sx={{ position: 'relative', height, width: '100%' }}>
      {/* 搜索栏 */}
      {editable && (
        <Paper
          sx={{
            position: 'absolute',
            top: 10,
            left: 10,
            right: 120,
            zIndex: 1000,
            p: 1,
            display: 'flex',
            gap: 1,
          }}
        >
          <TextField
            size="small"
            placeholder="搜索地点..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            sx={{ flex: 1 }}
          />
          <IconButton onClick={handleSearch} disabled={isSearching}>
            {isSearching ? <CircularProgress size={20} /> : <Search />}
          </IconButton>
        </Paper>
      )}

      {/* 路线规划按钮 */}
      {editable && routePoints.length >= 2 && (
        <Fab
          size="small"
          color="secondary"
          onClick={handlePlanRoute}
          disabled={isLoadingRoute}
          sx={{
            position: 'absolute',
            top: 70,
            right: 10,
            zIndex: 1000,
          }}
        >
          {isLoadingRoute ? <CircularProgress size={20} /> : <Route />}
        </Fab>
      )}

      {/* 搜索结果 */}
      {searchResults.length > 0 && (
        <Paper
          sx={{
            position: 'absolute',
            top: 60,
            left: 10,
            right: 120,
            zIndex: 1000,
            maxHeight: 300,
            overflow: 'auto',
          }}
        >
          <List dense>
            {searchResults.map((result, index) => (
              <ListItem
                key={index}
                component="div"
                sx={{ cursor: 'pointer', '&:hover': { backgroundColor: 'action.hover' } }}
                onClick={() => handleSelectSearchResult(result)}
              >
                <ListItemIcon>
                  <AttractionsOutlined />
                </ListItemIcon>
                <ListItemText
                  primary={result.name}
                  secondary={
                    <Box>
                      <Typography variant="caption" display="block">
                        {result.address}
                      </Typography>
                      {result.type && (
                        <Chip 
                          label={result.type} 
                          size="small" 
                          variant="outlined"
                          sx={{ mt: 0.5, fontSize: '0.7rem', height: 20 }}
                        />
                      )}
                      {result.distance && (
                        <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                          距离: {result.distance}
                        </Typography>
                      )}
                    </Box>
                  }
                />
              </ListItem>
            ))}
          </List>
        </Paper>
      )}

      {/* 地图容器 */}
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ 
          height: '100%', 
          width: '100%',
          minHeight: typeof height === 'number' ? `${height}px` : height,
          zIndex: 1
        }}
        zoomControl={true}
        whenReady={() => {
          // 地图准备就绪后刷新尺寸
          setTimeout(() => {
            if (mapRef.current) {
              mapRef.current.invalidateSize();
            }
          }, 50);
        }}
        ref={(map) => {
          if (map) {
            mapRef.current = map;
          }
        }}
      >
        {/* 使用可靠的瓦片服务 */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          subdomains={['a', 'b', 'c']}
          maxZoom={19}
          tileSize={256}
          zoomOffset={0}
          detectRetina={true}
          crossOrigin=""
          errorTileUrl="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
        />

        {/* 地图刷新控制 */}
        <MapRefreshControl />
        
        {/* 地图事件处理 */}
        <MapEventHandler onMapClick={handleMapClick} editable={editable} />

        {/* 定位控制 */}
        <LocationControl />

        {/* 路线点标记 */}
        {routePoints.map((point, index) => (
          <Marker
            key={index}
            position={[point.latitude, point.longitude]}
            icon={createCustomIcon(point.type, getPointColor(point.type))}
          >
            <Popup>
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  {point.name}
                </Typography>
                {point.address && (
                  <Typography variant="caption" color="text.secondary" display="block">
                    {point.address}
                  </Typography>
                )}
                <Chip
                  label={point.type}
                  size="small"
                  sx={{ mt: 1 }}
                  color="primary"
                />
                {editable && (
                  <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
                    <IconButton
                      size="small"
                      onClick={() => onLocationEdit?.(point)}
                    >
                      <Edit fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => onLocationDelete?.(point)}
                    >
                      <Delete fontSize="small" />
                    </IconButton>
                  </Box>
                )}
              </Box>
            </Popup>
          </Marker>
        ))}

        {/* 路线 */}
        {showRoute && generateRoute().length > 1 && (
          <Polyline
            positions={generateRoute()}
            color="#1976d2"
            weight={3}
            opacity={0.7}
            dashArray="5, 10"
          />
        )}

        {/* 规划的详细路线 */}
        {routeData && routeData.polyline && (
          <Polyline
            positions={MapService.parsePolyline(routeData.polyline)}
            color="#ff5722"
            weight={4}
            opacity={0.8}
          />
        )}
      </MapContainer>

      {/* 添加位置对话框 */}
      <Dialog
        open={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          添加新位置
          <IconButton
            onClick={() => setShowAddDialog(false)}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="位置名称"
              value={newLocation.name || ''}
              onChange={(e) => setNewLocation(prev => ({ ...prev, name: e.target.value }))}
              required
              fullWidth
            />
            <TextField
              label="地址"
              value={newLocation.address || ''}
              onChange={(e) => setNewLocation(prev => ({ ...prev, address: e.target.value }))}
              fullWidth
            />
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="纬度"
                type="number"
                value={newLocation.latitude || ''}
                onChange={(e) => setNewLocation(prev => ({ ...prev, latitude: parseFloat(e.target.value) }))}
                required
                fullWidth
              />
              <TextField
                label="经度"
                type="number"
                value={newLocation.longitude || ''}
                onChange={(e) => setNewLocation(prev => ({ ...prev, longitude: parseFloat(e.target.value) }))}
                required
                fullWidth
              />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAddDialog(false)}>
            取消
          </Button>
          <Button
            onClick={handleAddLocation}
            variant="contained"
            disabled={!newLocation.name || !newLocation.latitude || !newLocation.longitude}
          >
            添加
          </Button>
        </DialogActions>
      </Dialog>

      {/* 消息提示 */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))} 
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>

      {/* 地图工具栏 */}
      {showToolbar && (
        <MapToolbar
          routeData={routeData}
          onRouteSettingsChange={handleRouteSettingsChange}
          onNavigationStart={handleNavigationStart}
        />
      )}
    </Box>
  );
};

export default TravelMap;