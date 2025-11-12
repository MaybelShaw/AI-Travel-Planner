import MapService, { RouteResult, DistanceResult } from './mapService';
import { RoutePoint } from '../types';

export interface OptimizedRoute {
  originalOrder: RoutePoint[];
  optimizedOrder: RoutePoint[];
  totalDistance: number;
  totalDuration: number;
  savings: {
    distance: number;
    duration: number;
    percentage: number;
  };
  routes: RouteResult[];
}

export interface RouteOptimizationOptions {
  strategy: 'shortest' | 'fastest' | 'balanced';
  travelMode: 'driving' | 'walking' | 'transit';
  maxWaypoints?: number;
  preserveStartEnd?: boolean;
  timeWindows?: Array<{
    pointIndex: number;
    earliestTime: string;
    latestTime: string;
  }>;
}

export class RouteOptimizer {
  /**
   * 优化路线顺序
   * 使用贪心算法和距离矩阵来优化访问顺序
   */
  static async optimizeRoute(
    routePoints: RoutePoint[],
    options: RouteOptimizationOptions = { strategy: 'balanced', travelMode: 'driving' }
  ): Promise<OptimizedRoute | null> {
    if (routePoints.length < 2) {
      throw new Error('至少需要2个路线点才能进行优化');
    }

    try {
      // 1. 计算所有点之间的距离矩阵
      const distanceMatrix = await this.calculateDistanceMatrix(routePoints, options.travelMode);
      if (!distanceMatrix) {
        throw new Error('无法获取距离矩阵');
      }

      // 2. 使用优化算法计算最佳顺序
      const optimizedOrder = this.findOptimalOrder(
        routePoints,
        distanceMatrix,
        options
      );

      // 3. 计算原始路线和优化路线的总距离/时间
      const originalStats = this.calculateRouteStats(routePoints, distanceMatrix);
      const optimizedStats = this.calculateRouteStats(optimizedOrder, distanceMatrix);

      // 4. 计算节省的距离和时间
      const savings = {
        distance: originalStats.totalDistance - optimizedStats.totalDistance,
        duration: originalStats.totalDuration - optimizedStats.totalDuration,
        percentage: ((originalStats.totalDistance - optimizedStats.totalDistance) / originalStats.totalDistance) * 100
      };

      // 5. 生成详细路线信息
      const routes = await this.generateDetailedRoutes(optimizedOrder, options.travelMode);

      return {
        originalOrder: routePoints,
        optimizedOrder,
        totalDistance: optimizedStats.totalDistance,
        totalDuration: optimizedStats.totalDuration,
        savings,
        routes
      };

    } catch (error) {
      console.error('路线优化失败:', error);
      return null;
    }
  }

  /**
   * 计算距离矩阵
   */
  private static async calculateDistanceMatrix(
    points: RoutePoint[],
    travelMode: string
  ): Promise<DistanceResult[][] | null> {
    try {
      const coordinates = points.map(p => ({ lng: p.longitude, lat: p.latitude }));
      
      // 分批处理大量点位（高德API限制）
      const batchSize = 10;
      const matrix: DistanceResult[][] = [];
      
      for (let i = 0; i < points.length; i += batchSize) {
        const originBatch = coordinates.slice(i, Math.min(i + batchSize, points.length));
        const matrixRow: DistanceResult[][] = [];
        
        for (let j = 0; j < points.length; j += batchSize) {
          const destBatch = coordinates.slice(j, Math.min(j + batchSize, points.length));
          
          const result = await MapService.getDistance(originBatch, destBatch, travelMode);
          if (result) {
            matrixRow.push(result.results);
          }
          
          // 添加延迟避免API限制
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        matrix.push(...matrixRow);
      }
      
      // 重新组织矩阵结构
      const organizedMatrix: DistanceResult[][] = [];
      for (let i = 0; i < points.length; i++) {
        organizedMatrix[i] = [];
        for (let j = 0; j < points.length; j++) {
          if (i === j) {
            organizedMatrix[i][j] = {
              distance: 0,
              duration: 0,
              origin_index: i,
              destination_index: j
            };
          } else {
            // 从API结果中找到对应的距离数据
            const found = matrix.flat().find(
              result => result.origin_index === i && result.destination_index === j
            );
            organizedMatrix[i][j] = found || {
              distance: Infinity,
              duration: Infinity,
              origin_index: i,
              destination_index: j
            };
          }
        }
      }
      
      return organizedMatrix;
    } catch (error) {
      console.error('计算距离矩阵失败:', error);
      return null;
    }
  }

  /**
   * 使用贪心算法找到最优顺序
   */
  private static findOptimalOrder(
    points: RoutePoint[],
    distanceMatrix: DistanceResult[][],
    options: RouteOptimizationOptions
  ): RoutePoint[] {
    const n = points.length;
    
    // 如果只有2个点，直接返回
    if (n <= 2) {
      return [...points];
    }

    // 如果需要保持起点和终点
    if (options.preserveStartEnd && n > 2) {
      const start = points[0];
      const end = points[n - 1];
      const middle = points.slice(1, n - 1);
      
      const optimizedMiddle = this.optimizeMiddlePoints(
        middle,
        distanceMatrix,
        0, // 起点索引
        n - 1, // 终点索引
        options
      );
      
      return [start, ...optimizedMiddle, end];
    }

    // 使用最近邻算法
    return this.nearestNeighborAlgorithm(points, distanceMatrix, options);
  }

  /**
   * 最近邻算法
   */
  private static nearestNeighborAlgorithm(
    points: RoutePoint[],
    distanceMatrix: DistanceResult[][],
    options: RouteOptimizationOptions
  ): RoutePoint[] {
    const n = points.length;
    const visited = new Array(n).fill(false);
    const result: RoutePoint[] = [];
    
    // 从第一个点开始
    let currentIndex = 0;
    visited[currentIndex] = true;
    result.push(points[currentIndex]);
    
    // 依次选择最近的未访问点
    for (let i = 1; i < n; i++) {
      let nearestIndex = -1;
      let nearestValue = Infinity;
      
      for (let j = 0; j < n; j++) {
        if (!visited[j]) {
          const value = this.getOptimizationValue(
            distanceMatrix[currentIndex][j],
            options.strategy
          );
          
          if (value < nearestValue) {
            nearestValue = value;
            nearestIndex = j;
          }
        }
      }
      
      if (nearestIndex !== -1) {
        visited[nearestIndex] = true;
        result.push(points[nearestIndex]);
        currentIndex = nearestIndex;
      }
    }
    
    return result;
  }

  /**
   * 优化中间点的顺序
   */
  private static optimizeMiddlePoints(
    middlePoints: RoutePoint[],
    distanceMatrix: DistanceResult[][],
    startIndex: number,
    endIndex: number,
    options: RouteOptimizationOptions
  ): RoutePoint[] {
    if (middlePoints.length <= 1) {
      return middlePoints;
    }

    // 对中间点使用最近邻算法
    const middleIndices = middlePoints.map((_, i) => i + 1); // 调整索引
    const optimized = this.nearestNeighborAlgorithm(middlePoints, distanceMatrix, options);
    
    return optimized;
  }

  /**
   * 根据策略获取优化值
   */
  private static getOptimizationValue(
    distanceResult: DistanceResult,
    strategy: 'shortest' | 'fastest' | 'balanced'
  ): number {
    switch (strategy) {
      case 'shortest':
        return distanceResult.distance;
      case 'fastest':
        return distanceResult.duration;
      case 'balanced':
        // 平衡距离和时间（归一化后加权）
        const normalizedDistance = distanceResult.distance / 1000; // 转换为公里
        const normalizedDuration = distanceResult.duration / 60; // 转换为分钟
        return normalizedDistance * 0.6 + normalizedDuration * 0.4;
      default:
        return distanceResult.distance;
    }
  }

  /**
   * 计算路线统计信息
   */
  private static calculateRouteStats(
    points: RoutePoint[],
    distanceMatrix: DistanceResult[][]
  ): { totalDistance: number; totalDuration: number } {
    let totalDistance = 0;
    let totalDuration = 0;
    
    for (let i = 0; i < points.length - 1; i++) {
      const currentIndex = points.findIndex(p => p === points[i]);
      const nextIndex = points.findIndex(p => p === points[i + 1]);
      
      if (currentIndex !== -1 && nextIndex !== -1 && distanceMatrix[currentIndex]) {
        const distance = distanceMatrix[currentIndex][nextIndex];
        if (distance) {
          totalDistance += distance.distance;
          totalDuration += distance.duration;
        }
      }
    }
    
    return { totalDistance, totalDuration };
  }

  /**
   * 生成详细路线信息
   */
  private static async generateDetailedRoutes(
    optimizedPoints: RoutePoint[],
    travelMode: string
  ): Promise<RouteResult[]> {
    const routes: RouteResult[] = [];
    
    for (let i = 0; i < optimizedPoints.length - 1; i++) {
      const origin = {
        lng: optimizedPoints[i].longitude,
        lat: optimizedPoints[i].latitude
      };
      const destination = {
        lng: optimizedPoints[i + 1].longitude,
        lat: optimizedPoints[i + 1].latitude
      };
      
      try {
        const route = await MapService.planRoute(origin, destination, [], 'fastest');
        if (route) {
          routes.push(route);
        }
        
        // 添加延迟避免API限制
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`生成路线失败 ${i} -> ${i + 1}:`, error);
      }
    }
    
    return routes;
  }

  /**
   * 多日行程优化
   * 将路线点按天分组并优化每天的路线
   */
  static async optimizeMultiDayItinerary(
    routePoints: RoutePoint[],
    daysCount: number,
    options: RouteOptimizationOptions = { strategy: 'balanced', travelMode: 'driving' }
  ): Promise<{
    days: Array<{
      day: number;
      points: RoutePoint[];
      optimizedRoute: OptimizedRoute | null;
    }>;
    totalOptimization: {
      originalDistance: number;
      optimizedDistance: number;
      savings: number;
    };
  }> {
    if (daysCount <= 0 || routePoints.length === 0) {
      throw new Error('无效的天数或路线点');
    }

    // 按类型和地理位置对点进行聚类分组
    const groupedPoints = this.clusterPointsByDays(routePoints, daysCount);
    
    const days = [];
    let totalOriginalDistance = 0;
    let totalOptimizedDistance = 0;

    for (let day = 0; day < daysCount; day++) {
      const dayPoints = groupedPoints[day] || [];
      let optimizedRoute: OptimizedRoute | null = null;

      if (dayPoints.length >= 2) {
        optimizedRoute = await this.optimizeRoute(dayPoints, options);
        
        if (optimizedRoute) {
          totalOriginalDistance += optimizedRoute.originalOrder.length > 1 ? 
            this.estimateRouteDistance(optimizedRoute.originalOrder) : 0;
          totalOptimizedDistance += optimizedRoute.totalDistance;
        }
      }

      days.push({
        day: day + 1,
        points: dayPoints,
        optimizedRoute
      });

      // 添加延迟避免API限制
      if (day < daysCount - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return {
      days,
      totalOptimization: {
        originalDistance: totalOriginalDistance,
        optimizedDistance: totalOptimizedDistance,
        savings: totalOriginalDistance - totalOptimizedDistance
      }
    };
  }

  /**
   * 按天数对路线点进行聚类
   */
  private static clusterPointsByDays(points: RoutePoint[], daysCount: number): RoutePoint[][] {
    if (daysCount === 1) {
      return [points];
    }

    // 简单的轮询分配策略
    const groups: RoutePoint[][] = Array.from({ length: daysCount }, () => []);
    
    // 按类型分组
    const accommodations = points.filter(p => p.type === 'accommodation');
    const attractions = points.filter(p => p.type === 'attraction');
    const restaurants = points.filter(p => p.type === 'restaurant');
    const transportation = points.filter(p => p.type === 'transportation');

    // 优先分配住宿点（通常每天一个）
    accommodations.forEach((point, index) => {
      const dayIndex = index % daysCount;
      groups[dayIndex].push(point);
    });

    // 分配景点（主要活动）
    attractions.forEach((point, index) => {
      const dayIndex = index % daysCount;
      groups[dayIndex].push(point);
    });

    // 分配餐厅（每天2-3个）
    restaurants.forEach((point, index) => {
      const dayIndex = Math.floor(index / 3) % daysCount;
      groups[dayIndex].push(point);
    });

    // 分配交通点
    transportation.forEach((point, index) => {
      const dayIndex = index % daysCount;
      groups[dayIndex].push(point);
    });

    return groups;
  }

  /**
   * 估算路线距离（用于没有详细路线数据时）
   */
  private static estimateRouteDistance(points: RoutePoint[]): number {
    let totalDistance = 0;
    
    for (let i = 0; i < points.length - 1; i++) {
      const distance = this.calculateHaversineDistance(
        points[i].latitude,
        points[i].longitude,
        points[i + 1].latitude,
        points[i + 1].longitude
      );
      totalDistance += distance;
    }
    
    return totalDistance;
  }

  /**
   * 计算两点间的直线距离（Haversine公式）
   */
  private static calculateHaversineDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
  ): number {
    const R = 6371000; // 地球半径（米）
    const lat1Rad = (lat1 * Math.PI) / 180;
    const lat2Rad = (lat2 * Math.PI) / 180;
    const deltaLat = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLng = ((lng2 - lng1) * Math.PI) / 180;

    const a =
      Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
      Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  /**
   * 验证路线优化结果
   */
  static validateOptimization(optimization: OptimizedRoute): {
    isValid: boolean;
    issues: string[];
  } {
    const issues: string[] = [];

    // 检查点数是否一致
    if (optimization.originalOrder.length !== optimization.optimizedOrder.length) {
      issues.push('优化前后的路线点数量不一致');
    }

    // 检查是否包含所有原始点
    const originalIds = optimization.originalOrder.map(p => `${p.latitude},${p.longitude}`);
    const optimizedIds = optimization.optimizedOrder.map(p => `${p.latitude},${p.longitude}`);
    
    for (const id of originalIds) {
      if (!optimizedIds.includes(id)) {
        issues.push(`缺少原始路线点: ${id}`);
      }
    }

    // 检查距离和时间是否合理
    if (optimization.totalDistance < 0) {
      issues.push('总距离不能为负数');
    }

    if (optimization.totalDuration < 0) {
      issues.push('总时间不能为负数');
    }

    // 检查节省是否合理
    if (optimization.savings.distance < 0 && Math.abs(optimization.savings.percentage) > 50) {
      issues.push('路线优化结果异常，距离增加过多');
    }

    return {
      isValid: issues.length === 0,
      issues
    };
  }
}

export default RouteOptimizer;