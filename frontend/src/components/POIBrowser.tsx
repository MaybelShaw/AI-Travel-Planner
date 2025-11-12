import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  InputAdornment,
  IconButton,
  Tabs,
  Tab,
  Card,
  CardContent,
  CardActions,
  CardMedia,
  Button,
  Chip,
  Rating,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Slider,
  Switch,
  FormControlLabel,
  Collapse,
  Alert,
  CircularProgress,
  Fab,
  Badge,
  Tooltip,
} from '@mui/material';
import {
  Search,
  FilterList,
  Favorite,
  FavoriteBorder,
  Add,
  LocationOn,
  Phone,
  Language,
  Schedule,
  AttachMoney,
  Star,
  ExpandMore,
  ExpandLess,
  Close,
  MyLocation,
  Directions,
  Share,
  Info,
} from '@mui/icons-material';
import POIService, { EnhancedPOI, POICategory, POIFilter, POISearchOptions } from '../services/poiService';
import MapService from '../services/mapService';

interface POIBrowserProps {
  location?: { lng: number; lat: number };
  onPOISelect?: (poi: EnhancedPOI) => void;
  onAddToRoute?: (poi: EnhancedPOI) => void;
  selectedCategory?: string;
  showFavorites?: boolean;
}

const POIBrowser: React.FC<POIBrowserProps> = ({
  location,
  onPOISelect,
  onAddToRoute,
  selectedCategory,
  showFavorites = true,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTab, setSelectedTab] = useState(selectedCategory || 'all');
  const [pois, setPois] = useState<EnhancedPOI[]>([]);
  const [favorites, setFavorites] = useState<EnhancedPOI[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedPOI, setSelectedPOI] = useState<EnhancedPOI | null>(null);
  const [showPOIDetails, setShowPOIDetails] = useState(false);
  
  // 过滤器状态
  const [filters, setFilters] = useState<POIFilter>({
    priceRange: 'all',
    rating: 0,
    distance: 5000,
    openNow: false,
  });

  // 搜索选项
  const [searchOptions, setSearchOptions] = useState<POISearchOptions>({
    location,
    radius: 5000,
    limit: 20,
    sortBy: 'distance',
  });

  const categories = POIService.getCategories();

  useEffect(() => {
    loadFavorites();
    if (selectedTab !== 'favorites') {
      handleSearch();
    }
  }, [selectedTab, location]);

  useEffect(() => {
    if (selectedTab === 'favorites') {
      loadFavorites();
    }
  }, [selectedTab]);

  const loadFavorites = () => {
    const favs = POIService.getFavoritePOIs();
    setFavorites(favs);
    if (selectedTab === 'favorites') {
      setPois(favs);
    }
  };

  const handleSearch = async (query?: string) => {
    const searchTerm = query !== undefined ? query : searchQuery;
    
    if (selectedTab === 'favorites') {
      return;
    }

    setIsLoading(true);
    try {
      let results: EnhancedPOI[] = [];
      
      const options: POISearchOptions = {
        ...searchOptions,
        filter: filters,
        location,
      };

      if (selectedTab === 'all') {
        if (searchTerm.trim()) {
          results = await POIService.searchPOI(searchTerm, options);
        } else if (location) {
          // 获取推荐POI
          const recommendations = await POIService.getRecommendedPOIs(location);
          results = recommendations.flatMap(rec => rec.pois);
        }
      } else {
        // 按分类搜索
        results = await POIService.searchByCategory(
          selectedTab,
          location,
          undefined,
          options
        );
      }

      setPois(results);
    } catch (error) {
      console.error('搜索POI失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: string) => {
    setSelectedTab(newValue);
    setSearchQuery('');
  };

  const handleToggleFavorite = async (poi: EnhancedPOI) => {
    const isFav = POIService.isFavorite(poi);
    
    if (isFav) {
      await POIService.removeFavoritePOI(poi);
    } else {
      await POIService.saveFavoritePOI(poi);
    }
    
    loadFavorites();
  };

  const handlePOIClick = (poi: EnhancedPOI) => {
    setSelectedPOI(poi);
    setShowPOIDetails(true);
    onPOISelect?.(poi);
  };

  const handleAddToRoute = (poi: EnhancedPOI) => {
    onAddToRoute?.(poi);
  };

  const handleGetDirections = (poi: EnhancedPOI) => {
    if (location) {
      // 这里可以集成导航功能
      const url = `https://maps.google.com/maps?saddr=${location.lat},${location.lng}&daddr=${poi.lat},${poi.lng}`;
      window.open(url, '_blank');
    }
  };

  const getCategoryIcon = (categoryCode: string) => {
    const category = categories.find(cat => cat.code === categoryCode);
    return category?.icon || '📍';
  };

  const getCategoryColor = (categoryCode: string) => {
    const category = categories.find(cat => cat.code === categoryCode);
    return category?.color || '#1976d2';
  };

  const getPriceDisplay = (priceLevel?: number) => {
    if (!priceLevel) return '';
    return '¥'.repeat(priceLevel);
  };

  const renderPOICard = (poi: EnhancedPOI) => {
    const isFav = POIService.isFavorite(poi);
    const distance = location ? 
      MapService.formatDistance(
        POIService['calculateDistance'](location, { lng: poi.lng, lat: poi.lat })
      ) : '';

    return (
      <Card key={`${poi.lng},${poi.lat}`} sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <CardContent sx={{ flex: 1, cursor: 'pointer' }} onClick={() => handlePOIClick(poi)}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
            <Typography variant="h6" component="h3" sx={{ fontSize: '1rem', fontWeight: 600 }}>
              {poi.name}
            </Typography>
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                handleToggleFavorite(poi);
              }}
              color={isFav ? 'error' : 'default'}
            >
              {isFav ? <Favorite /> : <FavoriteBorder />}
            </IconButton>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <Chip
              label={getCategoryIcon(poi.category)}
              size="small"
              sx={{ 
                bgcolor: getCategoryColor(poi.category),
                color: 'white',
                minWidth: 'auto',
                '& .MuiChip-label': { px: 1 }
              }}
            />
            <Typography variant="caption" color="text.secondary">
              {categories.find(cat => cat.code === poi.category)?.name}
            </Typography>
            {distance && (
              <Typography variant="caption" color="text.secondary">
                • {distance}
              </Typography>
            )}
          </Box>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {poi.address}
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
            {poi.rating && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Rating value={poi.rating} precision={0.1} size="small" readOnly />
                <Typography variant="caption">
                  {poi.rating.toFixed(1)}
                </Typography>
              </Box>
            )}
            {poi.priceLevel && (
              <Typography variant="caption" color="text.secondary">
                {getPriceDisplay(poi.priceLevel)}
              </Typography>
            )}
          </Box>

          {poi.features && poi.features.length > 0 && (
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
              {poi.features.slice(0, 3).map((feature, index) => (
                <Chip
                  key={index}
                  label={feature}
                  size="small"
                  variant="outlined"
                  sx={{ fontSize: '0.7rem', height: 20 }}
                />
              ))}
              {poi.features.length > 3 && (
                <Typography variant="caption" color="text.secondary">
                  +{poi.features.length - 3}
                </Typography>
              )}
            </Box>
          )}
        </CardContent>

        <CardActions sx={{ pt: 0 }}>
          <Button
            size="small"
            startIcon={<Add />}
            onClick={() => handleAddToRoute(poi)}
          >
            添加到路线
          </Button>
          <Button
            size="small"
            startIcon={<Directions />}
            onClick={() => handleGetDirections(poi)}
            disabled={!location}
          >
            导航
          </Button>
        </CardActions>
      </Card>
    );
  };

  const renderFilters = () => (
    <Collapse in={showFilters}>
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          筛选条件
        </Typography>
        
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
          <FormControl fullWidth size="small">
            <InputLabel>价格范围</InputLabel>
            <Select
              value={filters.priceRange || 'all'}
              label="价格范围"
              onChange={(e) => setFilters(prev => ({ ...prev, priceRange: e.target.value as any }))}
            >
              <MenuItem value="all">全部</MenuItem>
              <MenuItem value="budget">经济型 (¥)</MenuItem>
              <MenuItem value="mid">中档 (¥¥)</MenuItem>
              <MenuItem value="luxury">高档 (¥¥¥+)</MenuItem>
            </Select>
          </FormControl>

          <Box>
            <Typography variant="caption" gutterBottom display="block">
              最低评分: {filters.rating || 0}
            </Typography>
            <Slider
              value={filters.rating || 0}
              onChange={(e, value) => setFilters(prev => ({ ...prev, rating: value as number }))}
              min={0}
              max={5}
              step={0.5}
              marks
              valueLabelDisplay="auto"
            />
          </Box>

          {location && (
            <Box>
              <Typography variant="caption" gutterBottom display="block">
                搜索半径: {MapService.formatDistance(filters.distance || 5000)}
              </Typography>
              <Slider
                value={filters.distance || 5000}
                onChange={(e, value) => setFilters(prev => ({ ...prev, distance: value as number }))}
                min={500}
                max={20000}
                step={500}
                valueLabelDisplay="auto"
                valueLabelFormat={(value) => MapService.formatDistance(value)}
              />
            </Box>
          )}

          <FormControlLabel
            control={
              <Switch
                checked={filters.openNow || false}
                onChange={(e) => setFilters(prev => ({ ...prev, openNow: e.target.checked }))}
              />
            }
            label="仅显示营业中"
          />
        </Box>

        <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
          <Button
            variant="contained"
            size="small"
            onClick={() => handleSearch()}
          >
            应用筛选
          </Button>
          <Button
            variant="outlined"
            size="small"
            onClick={() => {
              setFilters({
                priceRange: 'all',
                rating: 0,
                distance: 5000,
                openNow: false,
              });
            }}
          >
            重置
          </Button>
        </Box>
      </Paper>
    </Collapse>
  );

  const renderPOIDetails = () => (
    <Dialog
      open={showPOIDetails}
      onClose={() => setShowPOIDetails(false)}
      maxWidth="sm"
      fullWidth
    >
      {selectedPOI && (
        <>
          <DialogTitle>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="h6">
                  {selectedPOI.name}
                </Typography>
                <Chip
                  label={getCategoryIcon(selectedPOI.category)}
                  size="small"
                  sx={{ 
                    bgcolor: getCategoryColor(selectedPOI.category),
                    color: 'white',
                    minWidth: 'auto'
                  }}
                />
              </Box>
              <IconButton onClick={() => setShowPOIDetails(false)}>
                <Close />
              </IconButton>
            </Box>
          </DialogTitle>

          <DialogContent>
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                <LocationOn sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} />
                {selectedPOI.address}
              </Typography>
              
              {selectedPOI.phone && (
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  <Phone sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} />
                  {selectedPOI.phone}
                </Typography>
              )}
            </Box>

            {selectedPOI.rating && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <Rating value={selectedPOI.rating} precision={0.1} readOnly />
                <Typography variant="body2">
                  {selectedPOI.rating.toFixed(1)} 分
                </Typography>
                {selectedPOI.priceLevel && (
                  <Typography variant="body2" color="text.secondary">
                    • {getPriceDisplay(selectedPOI.priceLevel)}
                  </Typography>
                )}
              </Box>
            )}

            {selectedPOI.features && selectedPOI.features.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  特色服务
                </Typography>
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                  {selectedPOI.features.map((feature, index) => (
                    <Chip
                      key={index}
                      label={feature}
                      size="small"
                      variant="outlined"
                    />
                  ))}
                </Box>
              </Box>
            )}

            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
              <Chip
                label={categories.find(cat => cat.code === selectedPOI.category)?.name}
                color="primary"
                variant="outlined"
              />
              {selectedPOI.businessStatus === 'OPERATIONAL' && (
                <Chip
                  label="营业中"
                  color="success"
                  size="small"
                />
              )}
            </Box>
          </DialogContent>

          <DialogActions>
            <Button
              startIcon={POIService.isFavorite(selectedPOI) ? <Favorite /> : <FavoriteBorder />}
              onClick={() => handleToggleFavorite(selectedPOI)}
              color={POIService.isFavorite(selectedPOI) ? 'error' : 'inherit'}
            >
              {POIService.isFavorite(selectedPOI) ? '取消收藏' : '收藏'}
            </Button>
            <Button
              startIcon={<Add />}
              onClick={() => handleAddToRoute(selectedPOI)}
              variant="outlined"
            >
              添加到路线
            </Button>
            <Button
              startIcon={<Directions />}
              onClick={() => handleGetDirections(selectedPOI)}
              variant="contained"
              disabled={!location}
            >
              导航
            </Button>
          </DialogActions>
        </>
      )}
    </Dialog>
  );

  return (
    <Box>
      {/* 搜索栏 */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
          <TextField
            fullWidth
            placeholder="搜索地点、餐厅、景点..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              ),
            }}
            size="small"
          />
          <IconButton
            onClick={() => handleSearch()}
            disabled={isLoading}
          >
            {isLoading ? <CircularProgress size={20} /> : <Search />}
          </IconButton>
          <IconButton
            onClick={() => setShowFilters(!showFilters)}
            color={showFilters ? 'primary' : 'default'}
          >
            <FilterList />
          </IconButton>
        </Box>

        {/* 分类标签 */}
        <Tabs
          value={selectedTab}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab label="全部" value="all" />
          {categories.map((category) => (
            <Tab
              key={category.code}
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <span>{category.icon}</span>
                  {category.name}
                </Box>
              }
              value={category.code}
            />
          ))}
          {showFavorites && (
            <Tab
              label={
                <Badge badgeContent={favorites.length} color="error">
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Favorite />
                    收藏
                  </Box>
                </Badge>
              }
              value="favorites"
            />
          )}
        </Tabs>
      </Paper>

      {/* 筛选器 */}
      {renderFilters()}

      {/* POI列表 */}
      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : pois.length > 0 ? (
        <Box sx={{ 
          display: 'grid', 
          gridTemplateColumns: { 
            xs: '1fr', 
            sm: 'repeat(2, 1fr)', 
            md: 'repeat(3, 1fr)' 
          }, 
          gap: 2 
        }}>
          {pois.map((poi) => (
            <Box key={`${poi.lng},${poi.lat}`}>
              {renderPOICard(poi)}
            </Box>
          ))}
        </Box>
      ) : (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            {selectedTab === 'favorites' ? '暂无收藏' : '未找到相关地点'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {selectedTab === 'favorites' 
              ? '收藏一些地点，方便下次查看'
              : '尝试调整搜索条件或筛选器'
            }
          </Typography>
        </Paper>
      )}

      {/* POI详情对话框 */}
      {renderPOIDetails()}
    </Box>
  );
};

export default POIBrowser;