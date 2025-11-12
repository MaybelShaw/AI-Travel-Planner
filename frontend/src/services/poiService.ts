import MapService, { POIResult } from './mapService';
import { mapAPI } from './api';

export interface POICategory {
  code: string;
  name: string;
  icon: string;
  color: string;
  subcategories?: POISubcategory[];
}

export interface POISubcategory {
  code: string;
  name: string;
  keywords: string[];
}

export interface POIFilter {
  category?: string;
  subcategory?: string;
  priceRange?: 'budget' | 'mid' | 'luxury' | 'all';
  rating?: number;
  distance?: number;
  openNow?: boolean;
  hasParking?: boolean;
  wheelchairAccessible?: boolean;
}

export interface EnhancedPOI extends POIResult {
  category: string;
  subcategory?: string;
  rating?: number;
  priceLevel?: number;
  openingHours?: string[];
  photos?: string[];
  reviews?: POIReview[];
  features?: string[];
  website?: string;
  phone?: string;
  businessStatus?: 'OPERATIONAL' | 'CLOSED_TEMPORARILY' | 'CLOSED_PERMANENTLY';
}

export interface POIReview {
  author: string;
  rating: number;
  text: string;
  time: string;
}

export interface POISearchOptions {
  location?: { lng: number; lat: number };
  radius?: number;
  limit?: number;
  filter?: POIFilter;
  sortBy?: 'distance' | 'rating' | 'popularity' | 'price';
  language?: string;
}

export class POIService {
  // POI分类定义
  private static readonly POI_CATEGORIES: POICategory[] = [
    {
      code: 'accommodation',
      name: '住宿',
      icon: '🏨',
      color: '#4caf50',
      subcategories: [
        { code: 'hotel', name: '酒店', keywords: ['酒店', '宾馆', 'hotel'] },
        { code: 'hostel', name: '青年旅社', keywords: ['青年旅社', '客栈', 'hostel'] },
        { code: 'resort', name: '度假村', keywords: ['度假村', '度假酒店', 'resort'] },
        { code: 'apartment', name: '公寓', keywords: ['公寓', '民宿', 'apartment', 'airbnb'] },
        { code: 'guesthouse', name: '民宿', keywords: ['民宿', '家庭旅馆', 'guesthouse'] }
      ]
    },
    {
      code: 'restaurant',
      name: '餐饮',
      icon: '🍽️',
      color: '#ff9800',
      subcategories: [
        { code: 'chinese', name: '中餐', keywords: ['中餐', '中式', '川菜', '粤菜', '湘菜'] },
        { code: 'western', name: '西餐', keywords: ['西餐', '意大利', '法式', '美式'] },
        { code: 'japanese', name: '日料', keywords: ['日料', '日式', '寿司', '拉面'] },
        { code: 'korean', name: '韩料', keywords: ['韩料', '韩式', '烤肉', '泡菜'] },
        { code: 'fastfood', name: '快餐', keywords: ['快餐', '麦当劳', '肯德基', '汉堡'] },
        { code: 'cafe', name: '咖啡厅', keywords: ['咖啡', '咖啡厅', 'cafe', '星巴克'] },
        { code: 'bar', name: '酒吧', keywords: ['酒吧', '夜店', 'bar', 'pub'] }
      ]
    },
    {
      code: 'attraction',
      name: '景点',
      icon: '🎯',
      color: '#2196f3',
      subcategories: [
        { code: 'historical', name: '历史古迹', keywords: ['古迹', '历史', '文物', '遗址'] },
        { code: 'museum', name: '博物馆', keywords: ['博物馆', '展览馆', '美术馆'] },
        { code: 'park', name: '公园', keywords: ['公园', '花园', '植物园', '动物园'] },
        { code: 'temple', name: '寺庙', keywords: ['寺庙', '教堂', '清真寺', '道观'] },
        { code: 'landmark', name: '地标', keywords: ['地标', '标志性', '著名'] },
        { code: 'nature', name: '自然景观', keywords: ['山', '湖', '海', '瀑布', '森林'] },
        { code: 'entertainment', name: '娱乐场所', keywords: ['游乐园', '主题公园', 'KTV', '电影院'] }
      ]
    },
    {
      code: 'shopping',
      name: '购物',
      icon: '🛍️',
      color: '#e91e63',
      subcategories: [
        { code: 'mall', name: '购物中心', keywords: ['购物中心', '商场', 'mall'] },
        { code: 'market', name: '市场', keywords: ['市场', '集市', '夜市'] },
        { code: 'boutique', name: '精品店', keywords: ['精品店', '专卖店', '品牌店'] },
        { code: 'souvenir', name: '纪念品店', keywords: ['纪念品', '特产', '手工艺品'] }
      ]
    },
    {
      code: 'transportation',
      name: '交通',
      icon: '🚌',
      color: '#9c27b0',
      subcategories: [
        { code: 'airport', name: '机场', keywords: ['机场', 'airport'] },
        { code: 'station', name: '车站', keywords: ['火车站', '汽车站', '地铁站'] },
        { code: 'port', name: '港口', keywords: ['港口', '码头', '渡口'] },
        { code: 'parking', name: '停车场', keywords: ['停车场', '停车位'] }
      ]
    },
    {
      code: 'service',
      name: '服务',
      icon: '🏥',
      color: '#607d8b',
      subcategories: [
        { code: 'hospital', name: '医院', keywords: ['医院', '诊所', '药店'] },
        { code: 'bank', name: '银行', keywords: ['银行', 'ATM', '取款机'] },
        { code: 'police', name: '警察局', keywords: ['警察局', '派出所'] },
        { code: 'embassy', name: '领事馆', keywords: ['领事馆', '大使馆'] },
        { code: 'post', name: '邮局', keywords: ['邮局', '快递'] }
      ]
    }
  ];

  /**
   * 获取所有POI分类
   */
  static getCategories(): POICategory[] {
    return this.POI_CATEGORIES;
  }

  /**
   * 根据代码获取分类
   */
  static getCategoryByCode(code: string): POICategory | undefined {
    return this.POI_CATEGORIES.find(cat => cat.code === code);
  }

  /**
   * 根据关键词推断POI分类
   */
  static inferCategory(name: string, type?: string): { category: string; subcategory?: string } {
    const searchText = `${name} ${type || ''}`.toLowerCase();
    
    for (const category of this.POI_CATEGORIES) {
      for (const subcategory of category.subcategories || []) {
        for (const keyword of subcategory.keywords) {
          if (searchText.includes(keyword.toLowerCase())) {
            return {
              category: category.code,
              subcategory: subcategory.code
            };
          }
        }
      }
    }
    
    // 默认分类
    return { category: 'attraction' };
  }

  /**
   * 搜索POI
   */
  static async searchPOI(
    keyword: string,
    options: POISearchOptions = {}
  ): Promise<EnhancedPOI[]> {
    try {
      // 构建搜索关键词
      let searchKeyword = keyword;
      
      if (options.filter?.category) {
        const category = this.getCategoryByCode(options.filter.category);
        if (category) {
          searchKeyword = `${keyword} ${category.name}`;
        }
      }
      
      if (options.filter?.subcategory) {
        const category = this.getCategoryByCode(options.filter.category || '');
        const subcategory = category?.subcategories?.find(sub => sub.code === options.filter?.subcategory);
        if (subcategory) {
          searchKeyword = `${keyword} ${subcategory.name}`;
        }
      }

      // 调用基础搜索API
      const results = await MapService.searchPOI(
        searchKeyword,
        undefined,
        options.limit || 20
      );

      // 增强POI信息
      const enhancedResults = results.map(poi => this.enhancePOI(poi));

      // 应用过滤器
      let filteredResults = this.applyFilters(enhancedResults, options.filter);

      // 排序
      if (options.sortBy) {
        filteredResults = this.sortPOIs(filteredResults, options.sortBy, options.location);
      }

      return filteredResults;
    } catch (error) {
      console.error('POI搜索失败:', error);
      return [];
    }
  }

  /**
   * 周边POI搜索
   */
  static async searchNearbyPOI(
    location: { lng: number; lat: number },
    options: POISearchOptions = {}
  ): Promise<EnhancedPOI[]> {
    try {
      const keyword = options.filter?.category ? 
        this.getCategoryByCode(options.filter.category)?.name || '' : '';
      
      const results = await MapService.searchNearby(
        location,
        keyword,
        options.filter?.subcategory,
        options.radius || 1000,
        options.limit || 20
      );

      const enhancedResults = results.map(poi => this.enhancePOI(poi));
      let filteredResults = this.applyFilters(enhancedResults, options.filter);

      if (options.sortBy) {
        filteredResults = this.sortPOIs(filteredResults, options.sortBy, location);
      }

      return filteredResults;
    } catch (error) {
      console.error('周边POI搜索失败:', error);
      return [];
    }
  }

  /**
   * 按分类搜索POI
   */
  static async searchByCategory(
    category: string,
    location?: { lng: number; lat: number },
    city?: string,
    options: POISearchOptions = {}
  ): Promise<EnhancedPOI[]> {
    const categoryInfo = this.getCategoryByCode(category);
    if (!categoryInfo) {
      throw new Error(`未知的POI分类: ${category}`);
    }

    const searchOptions = {
      ...options,
      filter: {
        ...options.filter,
        category
      }
    };

    if (location) {
      return this.searchNearbyPOI(location, searchOptions);
    } else {
      return this.searchPOI(categoryInfo.name, searchOptions);
    }
  }

  /**
   * 获取POI详细信息
   */
  static async getPOIDetails(poi: POIResult): Promise<EnhancedPOI> {
    // 这里可以调用更详细的API获取POI信息
    // 目前先返回增强的基础信息
    return this.enhancePOI(poi);
  }

  /**
   * 增强POI信息
   */
  private static enhancePOI(poi: POIResult): EnhancedPOI {
    const categoryInfo = this.inferCategory(poi.name, poi.type);
    
    return {
      ...poi,
      category: categoryInfo.category,
      subcategory: categoryInfo.subcategory,
      rating: this.generateMockRating(),
      priceLevel: this.generateMockPriceLevel(categoryInfo.category),
      businessStatus: 'OPERATIONAL',
      features: this.generateMockFeatures(categoryInfo.category),
      phone: poi.tel || undefined
    };
  }

  /**
   * 应用过滤器
   */
  private static applyFilters(pois: EnhancedPOI[], filter?: POIFilter): EnhancedPOI[] {
    if (!filter) return pois;

    return pois.filter(poi => {
      // 分类过滤
      if (filter.category && poi.category !== filter.category) {
        return false;
      }

      // 子分类过滤
      if (filter.subcategory && poi.subcategory !== filter.subcategory) {
        return false;
      }

      // 评分过滤
      if (filter.rating && (poi.rating || 0) < filter.rating) {
        return false;
      }

      // 价格范围过滤
      if (filter.priceRange && filter.priceRange !== 'all') {
        const priceLevel = poi.priceLevel || 2;
        switch (filter.priceRange) {
          case 'budget':
            if (priceLevel > 2) return false;
            break;
          case 'mid':
            if (priceLevel < 2 || priceLevel > 3) return false;
            break;
          case 'luxury':
            if (priceLevel < 4) return false;
            break;
        }
      }

      // 营业状态过滤
      if (filter.openNow && poi.businessStatus !== 'OPERATIONAL') {
        return false;
      }

      return true;
    });
  }

  /**
   * 排序POI
   */
  private static sortPOIs(
    pois: EnhancedPOI[],
    sortBy: string,
    location?: { lng: number; lat: number }
  ): EnhancedPOI[] {
    return [...pois].sort((a, b) => {
      switch (sortBy) {
        case 'distance':
          if (location) {
            const distanceA = this.calculateDistance(location, { lng: a.lng, lat: a.lat });
            const distanceB = this.calculateDistance(location, { lng: b.lng, lat: b.lat });
            return distanceA - distanceB;
          }
          return 0;
        
        case 'rating':
          return (b.rating || 0) - (a.rating || 0);
        
        case 'price':
          return (a.priceLevel || 0) - (b.priceLevel || 0);
        
        case 'popularity':
          // 基于评分和评论数的综合排序
          const scoreA = (a.rating || 0) * Math.log((a.reviews?.length || 1) + 1);
          const scoreB = (b.rating || 0) * Math.log((b.reviews?.length || 1) + 1);
          return scoreB - scoreA;
        
        default:
          return 0;
      }
    });
  }

  /**
   * 计算两点间距离
   */
  private static calculateDistance(
    point1: { lng: number; lat: number },
    point2: { lng: number; lat: number }
  ): number {
    const R = 6371000; // 地球半径（米）
    const lat1Rad = (point1.lat * Math.PI) / 180;
    const lat2Rad = (point2.lat * Math.PI) / 180;
    const deltaLat = ((point2.lat - point1.lat) * Math.PI) / 180;
    const deltaLng = ((point2.lng - point1.lng) * Math.PI) / 180;

    const a =
      Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
      Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  /**
   * 生成模拟评分
   */
  private static generateMockRating(): number {
    return Math.round((Math.random() * 2 + 3) * 10) / 10; // 3.0-5.0
  }

  /**
   * 生成模拟价格等级
   */
  private static generateMockPriceLevel(category: string): number {
    const priceLevels: { [key: string]: number[] } = {
      accommodation: [2, 3, 4, 5],
      restaurant: [1, 2, 3, 4],
      attraction: [1, 2, 3],
      shopping: [2, 3, 4],
      transportation: [1, 2],
      service: [1, 2]
    };
    
    const levels = priceLevels[category] || [2, 3];
    return levels[Math.floor(Math.random() * levels.length)];
  }

  /**
   * 生成模拟特性
   */
  private static generateMockFeatures(category: string): string[] {
    const featuresByCategory: { [key: string]: string[] } = {
      accommodation: ['WiFi', '停车场', '早餐', '健身房', '游泳池', '商务中心'],
      restaurant: ['外卖', '堂食', '包间', '停车位', 'WiFi', '儿童座椅'],
      attraction: ['导游服务', '语音讲解', '轮椅通道', '停车场', '纪念品店'],
      shopping: ['免税', '退税', '停车场', '儿童区', '餐饮区'],
      transportation: ['24小时', '行李寄存', 'WiFi', '充电站'],
      service: ['24小时', '英语服务', '预约服务', '停车场']
    };
    
    const availableFeatures = featuresByCategory[category] || [];
    const featureCount = Math.floor(Math.random() * 3) + 1;
    
    return availableFeatures
      .sort(() => Math.random() - 0.5)
      .slice(0, featureCount);
  }

  /**
   * 获取推荐POI
   */
  static async getRecommendedPOIs(
    location: { lng: number; lat: number },
    userPreferences?: {
      categories: string[];
      priceRange: string;
      radius: number;
    }
  ): Promise<{
    category: string;
    name: string;
    pois: EnhancedPOI[];
  }[]> {
    const recommendations = [];
    const categories = userPreferences?.categories || ['restaurant', 'attraction', 'shopping'];
    
    for (const category of categories) {
      try {
        const pois = await this.searchByCategory(
          category,
          location,
          undefined,
          {
            radius: userPreferences?.radius || 2000,
            limit: 5,
            filter: {
              priceRange: userPreferences?.priceRange as any || 'all'
            },
            sortBy: 'popularity'
          }
        );
        
        if (pois.length > 0) {
          const categoryInfo = this.getCategoryByCode(category);
          recommendations.push({
            category,
            name: categoryInfo?.name || category,
            pois
          });
        }
      } catch (error) {
        console.error(`获取${category}推荐失败:`, error);
      }
    }
    
    return recommendations;
  }

  /**
   * 保存用户收藏的POI
   */
  static async saveFavoritePOI(poi: EnhancedPOI): Promise<boolean> {
    try {
      // 这里应该调用后端API保存收藏
      const favorites = this.getFavoritePOIs();
      const poiId = `${poi.lng},${poi.lat}`;
      
      if (!favorites.find(fav => `${fav.lng},${fav.lat}` === poiId)) {
        favorites.push(poi);
        localStorage.setItem('favoritePOIs', JSON.stringify(favorites));
      }
      
      return true;
    } catch (error) {
      console.error('保存收藏POI失败:', error);
      return false;
    }
  }

  /**
   * 获取用户收藏的POI
   */
  static getFavoritePOIs(): EnhancedPOI[] {
    try {
      const stored = localStorage.getItem('favoritePOIs');
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('获取收藏POI失败:', error);
      return [];
    }
  }

  /**
   * 删除收藏的POI
   */
  static async removeFavoritePOI(poi: EnhancedPOI): Promise<boolean> {
    try {
      const favorites = this.getFavoritePOIs();
      const poiId = `${poi.lng},${poi.lat}`;
      const filtered = favorites.filter(fav => `${fav.lng},${fav.lat}` !== poiId);
      
      localStorage.setItem('favoritePOIs', JSON.stringify(filtered));
      return true;
    } catch (error) {
      console.error('删除收藏POI失败:', error);
      return false;
    }
  }

  /**
   * 检查POI是否已收藏
   */
  static isFavorite(poi: EnhancedPOI): boolean {
    const favorites = this.getFavoritePOIs();
    const poiId = `${poi.lng},${poi.lat}`;
    return favorites.some(fav => `${fav.lng},${fav.lat}` === poiId);
  }
}

export default POIService;