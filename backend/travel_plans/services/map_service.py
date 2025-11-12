import logging
import requests
from typing import Dict, Optional, List
from django.conf import settings

logger = logging.getLogger(__name__)


class AmapService:
    """高德地图API服务"""
    
    def __init__(self, api_key: str = None):
        self.api_key = api_key
        self.base_url = "https://restapi.amap.com/v3"
    
    def test_connection(self) -> Dict:
        """测试API连接"""
        if not self.api_key:
            return {
                'success': False,
                'message': 'API密钥未配置'
            }
        
        try:
            # 使用地理编码API测试连接
            url = f"{self.base_url}/geocode/geo"
            params = {
                'key': self.api_key,
                'address': '北京市天安门',
                'output': 'json'
            }
            
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            
            data = response.json()
            
            if data.get('status') == '1' and data.get('geocodes'):
                return {
                    'success': True,
                    'message': '高德地图API连接成功'
                }
            else:
                error_info = data.get('info', '未知错误')
                return {
                    'success': False,
                    'message': f'高德地图API错误: {error_info}'
                }
                
        except requests.exceptions.RequestException as e:
            logger.error(f"高德地图API连接测试失败: {e}")
            return {
                'success': False,
                'message': f'网络连接失败: {str(e)}'
            }
        except Exception as e:
            logger.error(f"高德地图API测试异常: {e}")
            return {
                'success': False,
                'message': f'测试失败: {str(e)}'
            }
    
    def geocode(self, address: str) -> Optional[Dict]:
        """地理编码：地址转坐标"""
        if not address or not self.api_key:
            return None
        
        try:
            url = f"{self.base_url}/geocode/geo"
            params = {
                'key': self.api_key,
                'address': address,
                'output': 'json'
            }
            
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            
            data = response.json()
            
            if data.get('status') == '1' and data.get('geocodes'):
                geocode = data['geocodes'][0]
                location = geocode.get('location', '').split(',')
                
                if len(location) == 2:
                    return {
                        'address': address,
                        'formatted_address': geocode.get('formatted_address', address),
                        'lng': float(location[0]),
                        'lat': float(location[1]),
                        'province': geocode.get('province', ''),
                        'city': geocode.get('city', ''),
                        'district': geocode.get('district', ''),
                        'adcode': geocode.get('adcode', '')
                    }
            
            logger.warning(f"高德地图地理编码失败: {data.get('info', '未知错误')}")
            return None
            
        except Exception as e:
            logger.error(f"高德地图地理编码异常: {e}")
            return None
    
    def reverse_geocode(self, lng: float, lat: float) -> Optional[Dict]:
        """逆地理编码：坐标转地址"""
        if not self.api_key:
            return None
        
        try:
            url = f"{self.base_url}/geocode/regeo"
            params = {
                'key': self.api_key,
                'location': f"{lng},{lat}",
                'output': 'json',
                'extensions': 'base'
            }
            
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            
            data = response.json()
            
            if data.get('status') == '1' and data.get('regeocode'):
                regeocode = data['regeocode']
                return {
                    'lng': lng,
                    'lat': lat,
                    'formatted_address': regeocode.get('formatted_address', ''),
                    'province': regeocode.get('addressComponent', {}).get('province', ''),
                    'city': regeocode.get('addressComponent', {}).get('city', ''),
                    'district': regeocode.get('addressComponent', {}).get('district', ''),
                    'adcode': regeocode.get('addressComponent', {}).get('adcode', '')
                }
            
            logger.warning(f"高德地图逆地理编码失败: {data.get('info', '未知错误')}")
            return None
            
        except Exception as e:
            logger.error(f"高德地图逆地理编码异常: {e}")
            return None
    
    def search_poi(self, keyword: str, city: str = None, limit: int = 10) -> List[Dict]:
        """POI搜索"""
        if not keyword or not self.api_key:
            return []
        
        try:
            url = f"{self.base_url}/place/text"
            params = {
                'key': self.api_key,
                'keywords': keyword,
                'output': 'json',
                'offset': limit
            }
            
            if city:
                params['city'] = city
            
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            
            data = response.json()
            
            if data.get('status') == '1' and data.get('pois'):
                results = []
                for poi in data['pois']:
                    location = poi.get('location', '').split(',')
                    if len(location) == 2:
                        results.append({
                            'name': poi.get('name', ''),
                            'address': poi.get('address', ''),
                            'lng': float(location[0]),
                            'lat': float(location[1]),
                            'type': poi.get('type', ''),
                            'tel': poi.get('tel', ''),
                            'distance': poi.get('distance', ''),
                            'adcode': poi.get('adcode', '')
                        })
                return results
            
            logger.warning(f"高德地图POI搜索失败: {data.get('info', '未知错误')}")
            return []
            
        except Exception as e:
            logger.error(f"高德地图POI搜索异常: {e}")
            return []
    
    def plan_route(self, origin: Dict, destination: Dict, waypoints: List[Dict] = None, strategy: str = 'fastest') -> Optional[Dict]:
        """路线规划"""
        if not self.api_key:
            return None
        
        try:
            url = f"{self.base_url}/direction/driving"
            
            # 构建起点和终点
            origin_str = f"{origin['lng']},{origin['lat']}"
            destination_str = f"{destination['lng']},{destination['lat']}"
            
            params = {
                'key': self.api_key,
                'origin': origin_str,
                'destination': destination_str,
                'output': 'json',
                'extensions': 'all'
            }
            
            # 添加途经点
            if waypoints:
                waypoints_str = ';'.join([f"{wp['lng']},{wp['lat']}" for wp in waypoints])
                params['waypoints'] = waypoints_str
            
            # 路线策略
            strategy_map = {
                'fastest': '0',  # 速度优先
                'shortest': '1',  # 距离优先
                'avoid_traffic': '2',  # 避免拥堵
                'avoid_highway': '3',  # 不走高速
                'avoid_toll': '4',  # 避免收费
                'highway_first': '5',  # 高速优先
                'avoid_traffic_highway': '6'  # 避免拥堵且不走高速
            }
            params['strategy'] = strategy_map.get(strategy, '0')
            
            response = requests.get(url, params=params, timeout=15)
            response.raise_for_status()
            
            data = response.json()
            
            if data.get('status') == '1' and data.get('route'):
                route = data['route']
                paths = route.get('paths', [])
                
                if paths:
                    path = paths[0]  # 取第一条路线
                    
                    # 解析路线步骤
                    steps = []
                    for step in path.get('steps', []):
                        steps.append({
                            'instruction': step.get('instruction', ''),
                            'distance': int(step.get('distance', 0)),
                            'duration': int(step.get('duration', 0)),
                            'polyline': step.get('polyline', ''),
                            'action': step.get('action', ''),
                            'road': step.get('road', '')
                        })
                    
                    return {
                        'distance': int(path.get('distance', 0)),  # 总距离（米）
                        'duration': int(path.get('duration', 0)),  # 总时间（秒）
                        'tolls': int(path.get('tolls', 0)),  # 过路费（元）
                        'traffic_lights': int(path.get('traffic_lights', 0)),  # 红绿灯数量
                        'polyline': path.get('polyline', ''),  # 路线坐标串
                        'steps': steps,
                        'origin': origin,
                        'destination': destination,
                        'waypoints': waypoints or []
                    }
            
            logger.warning(f"高德地图路线规划失败: {data.get('info', '未知错误')}")
            return None
            
        except Exception as e:
            logger.error(f"高德地图路线规划异常: {e}")
            return None
    
    def get_distance_matrix(self, origins: List[Dict], destinations: List[Dict], travel_mode: str = 'driving') -> Optional[Dict]:
        """距离矩阵计算"""
        if not self.api_key or not origins or not destinations:
            return None
        
        try:
            # 高德地图距离测量API
            url = f"{self.base_url}/distance"
            
            # 构建起点和终点字符串
            origins_str = '|'.join([f"{o['lng']},{o['lat']}" for o in origins])
            destinations_str = '|'.join([f"{d['lng']},{d['lat']}" for d in destinations])
            
            params = {
                'key': self.api_key,
                'origins': origins_str,
                'destination': destinations_str,
                'output': 'json'
            }
            
            # 出行方式
            type_map = {
                'driving': '1',  # 驾车
                'walking': '3'   # 步行
            }
            params['type'] = type_map.get(travel_mode, '1')
            
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            
            data = response.json()
            
            if data.get('status') == '1' and data.get('results'):
                results = []
                for result in data['results']:
                    results.append({
                        'distance': int(result.get('distance', 0)),  # 距离（米）
                        'duration': int(result.get('duration', 0)),  # 时间（秒）
                        'origin_index': int(result.get('origin_id', 0)) - 1,
                        'destination_index': int(result.get('dest_id', 0)) - 1
                    })
                
                return {
                    'origins': origins,
                    'destinations': destinations,
                    'results': results,
                    'travel_mode': travel_mode
                }
            
            logger.warning(f"高德地图距离计算失败: {data.get('info', '未知错误')}")
            return None
            
        except Exception as e:
            logger.error(f"高德地图距离计算异常: {e}")
            return None


# 保持向后兼容
class MapService(AmapService):
    """地图服务（高德地图实现）"""
    pass
