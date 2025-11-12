import { mapAPI } from './api';
import { RoutePoint } from '../types';

export interface GeocodeResult {
  address: string;
  formatted_address: string;
  lng: number;
  lat: number;
  province: string;
  city: string;
  district: string;
  adcode: string;
}

export interface POIResult {
  name: string;
  address: string;
  lng: number;
  lat: number;
  type: string;
  tel: string;
  distance: string;
  adcode: string;
}

export interface RouteResult {
  distance: number; // 总距离（米）
  duration: number; // 总时间（秒）
  tolls: number; // 过路费（元）
  traffic_lights: number; // 红绿灯数量
  polyline: string; // 路线坐标串
  steps: RouteStep[];
  origin: { lng: number; lat: number };
  destination: { lng: number; lat: number };
  waypoints: Array<{ lng: number; lat: number }>;
}

export interface RouteStep {
  instruction: string;
  distance: number;
  duration: number;
  polyline: string;
  action: string;
  road: string;
}

export interface DistanceResult {
  distance: number; // 距离（米）
  duration: number; // 时间（秒）
  origin_index: number;
  destination_index: number;
}

export class MapService {
  /**
   * 地理编码：地址转坐标
   */
  static async geocode(address: string, travelPlanId?: number): Promise<GeocodeResult | null> {
    try {
      const response = await mapAPI.geocode({ 
        address, 
        travel_plan_id: travelPlanId 
      });
      
      if (response.data.success) {
        return response.data.data;
      } else {
        console.error('地理编码失败:', response.data.error);
        return null;
      }
    } catch (error) {
      console.error('地理编码请求失败:', error);
      return null;
    }
  }

  /**
   * 逆地理编码：坐标转地址
   */
  static async reverseGeocode(lng: number, lat: number): Promise<GeocodeResult | null> {
    try {
      const response = await mapAPI.reverseGeocode({ lng, lat });
      
      if (response.data.success) {
        return response.data.data;
      } else {
        console.error('逆地理编码失败:', response.data.error);
        return null;
      }
    } catch (error) {
      console.error('逆地理编码请求失败:', error);
      return null;
    }
  }

  /**
   * POI搜索
   */
  static async searchPOI(keyword: string, city?: string, limit: number = 10): Promise<POIResult[]> {
    try {
      const response = await mapAPI.searchPOI({ keyword, city, limit });
      
      if (response.data.success) {
        return response.data.data || [];
      } else {
        console.error('POI搜索失败:', response.data.error);
        return [];
      }
    } catch (error) {
      console.error('POI搜索请求失败:', error);
      return [];
    }
  }

  /**
   * 批量地理编码
   */
  static async batchGeocode(addresses: string[]): Promise<Array<{
    address: string;
    result: GeocodeResult | null;
    success: boolean;
  }>> {
    try {
      const response = await mapAPI.batchGeocode({ addresses });
      
      if (response.data.success) {
        return response.data.data || [];
      } else {
        console.error('批量地理编码失败:', response.data.error);
        return [];
      }
    } catch (error) {
      console.error('批量地理编码请求失败:', error);
      return [];
    }
  }

  /**
   * 路线规划
   */
  static async planRoute(
    origin: { lng: number; lat: number },
    destination: { lng: number; lat: number },
    waypoints?: Array<{ lng: number; lat: number }>,
    strategy: string = 'fastest'
  ): Promise<RouteResult | null> {
    try {
      const response = await mapAPI.planRoute({
        origin,
        destination,
        waypoints,
        strategy
      });
      
      if (response.data.success) {
        return response.data.data;
      } else {
        console.error('路线规划失败:', response.data.error);
        return null;
      }
    } catch (error) {
      console.error('路线规划请求失败:', error);
      return null;
    }
  }

  /**
   * 获取距离和时间
   */
  static async getDistance(
    origins: Array<{ lng: number; lat: number }>,
    destinations: Array<{ lng: number; lat: number }>,
    type: string = 'driving'
  ): Promise<{
    origins: Array<{ lng: number; lat: number }>;
    destinations: Array<{ lng: number; lat: number }>;
    results: DistanceResult[];
    travel_mode: string;
  } | null> {
    try {
      const response = await mapAPI.getDistance({
        origins,
        destinations,
        type
      });
      
      if (response.data.success) {
        return response.data.data;
      } else {
        console.error('距离计算失败:', response.data.error);
        return null;
      }
    } catch (error) {
      console.error('距离计算请求失败:', error);
      return null;
    }
  }

  /**
   * 周边搜索
   */
  static async searchNearby(
    location: { lng: number; lat: number },
    keyword?: string,
    type?: string,
    radius: number = 1000,
    limit: number = 20
  ): Promise<POIResult[]> {
    try {
      const response = await mapAPI.searchNearby({
        location,
        keyword,
        type,
        radius,
        limit
      });
      
      if (response.data.success) {
        return response.data.data || [];
      } else {
        console.error('周边搜索失败:', response.data.error);
        return [];
      }
    } catch (error) {
      console.error('周边搜索请求失败:', error);
      return [];
    }
  }

  /**
   * 格式化距离显示
   */
  static formatDistance(distance: number): string {
    if (distance < 1000) {
      return `${distance}米`;
    } else if (distance < 10000) {
      return `${(distance / 1000).toFixed(1)}公里`;
    } else {
      return `${Math.round(distance / 1000)}公里`;
    }
  }

  /**
   * 格式化时间显示
   */
  static formatDuration(duration: number): string {
    const hours = Math.floor(duration / 3600);
    const minutes = Math.floor((duration % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}小时${minutes}分钟`;
    } else {
      return `${minutes}分钟`;
    }
  }

  /**
   * 将路线点转换为地图标记
   */
  static routePointsToMarkers(routePoints: RoutePoint[]): Array<{
    position: [number, number];
    name: string;
    type: string;
    address?: string;
  }> {
    return routePoints.map(point => ({
      position: [point.latitude, point.longitude] as [number, number],
      name: point.name || '',
      type: point.type,
      address: point.address
    }));
  }

  /**
   * 计算路线点的中心位置
   */
  static calculateCenter(routePoints: RoutePoint[]): [number, number] {
    if (routePoints.length === 0) {
      return [39.9042, 116.4074]; // 默认北京
    }
    
    const totalLat = routePoints.reduce((sum, point) => sum + point.latitude, 0);
    const totalLng = routePoints.reduce((sum, point) => sum + point.longitude, 0);
    
    return [
      totalLat / routePoints.length,
      totalLng / routePoints.length
    ];
  }

  /**
   * 计算合适的缩放级别
   */
  static calculateZoom(routePoints: RoutePoint[]): number {
    if (routePoints.length <= 1) {
      return 15;
    }
    
    const lats = routePoints.map(p => p.latitude);
    const lngs = routePoints.map(p => p.longitude);
    
    const latRange = Math.max(...lats) - Math.min(...lats);
    const lngRange = Math.max(...lngs) - Math.min(...lngs);
    
    const maxRange = Math.max(latRange, lngRange);
    
    if (maxRange > 10) return 6;
    if (maxRange > 5) return 7;
    if (maxRange > 2) return 8;
    if (maxRange > 1) return 9;
    if (maxRange > 0.5) return 10;
    if (maxRange > 0.2) return 11;
    if (maxRange > 0.1) return 12;
    if (maxRange > 0.05) return 13;
    if (maxRange > 0.02) return 14;
    return 15;
  }

  /**
   * 验证坐标是否有效
   */
  static isValidCoordinate(lng: number, lat: number): boolean {
    return (
      typeof lng === 'number' && 
      typeof lat === 'number' &&
      lng >= -180 && lng <= 180 &&
      lat >= -90 && lat <= 90 &&
      !isNaN(lng) && !isNaN(lat)
    );
  }

  /**
   * 解析高德地图polyline坐标串
   */
  static parsePolyline(polyline: string): Array<[number, number]> {
    if (!polyline) return [];
    
    try {
      // 高德地图polyline格式：lng1,lat1;lng2,lat2;...
      return polyline.split(';').map(point => {
        const [lng, lat] = point.split(',').map(Number);
        return [lat, lng] as [number, number]; // Leaflet使用[lat, lng]格式
      }).filter(([lat, lng]) => this.isValidCoordinate(lng, lat));
    } catch (error) {
      console.error('解析polyline失败:', error);
      return [];
    }
  }
}

export default MapService;