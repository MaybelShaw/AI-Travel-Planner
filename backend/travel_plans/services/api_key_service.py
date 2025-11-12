"""
API密钥验证服务
"""
import logging
from typing import Dict, List, Optional
from django.contrib.auth.models import User
from ..models import UserAPIKey, LLMAPIKey, VoiceAPIKey, MapAPIKey

logger = logging.getLogger(__name__)


class APIKeyService:
    """API密钥管理和验证服务"""
    
    # 创建旅行计划所需的必要服务
    REQUIRED_SERVICES = ['llm']
    
    # 可选服务（不影响基本功能）
    OPTIONAL_SERVICES = ['voice', 'maps']
    
    @classmethod
    def check_required_api_keys(cls, user: User) -> Dict:
        """
        检查用户是否配置了创建旅行计划所需的API密钥
        
        Args:
            user: 用户对象
            
        Returns:
            Dict: 检查结果
            {
                'has_required': bool,  # 是否有必需的API密钥
                'missing_services': List[str],  # 缺失的服务
                'configured_services': List[str],  # 已配置的服务
                'message': str  # 提示信息
            }
        """
        try:
            configured_services = []
            
            # 检查LLM服务（必需）
            llm_key = LLMAPIKey.objects.filter(user=user, is_active=True).first()
            if llm_key:
                configured_services.append('llm')
            
            # 检查语音服务（可选）
            voice_key = VoiceAPIKey.objects.filter(user=user, is_active=True).first()
            if voice_key:
                configured_services.append('voice')
            
            # 检查地图服务（可选）
            map_key = MapAPIKey.objects.filter(user=user, is_active=True).first()
            if map_key:
                configured_services.append('maps')
            
            # 检查旧版API密钥（向后兼容）
            old_keys = UserAPIKey.objects.filter(user=user, is_active=True).values_list('service', flat=True)
            configured_services.extend(list(old_keys))
            
            # 去重
            configured_services = list(set(configured_services))
            
            # 检查必需服务
            missing_services = []
            for service in cls.REQUIRED_SERVICES:
                if service not in configured_services:
                    missing_services.append(service)
            
            has_required = len(missing_services) == 0
            
            # 生成提示信息
            if has_required:
                message = "API密钥配置完整，可以创建旅行计划"
            else:
                service_names = cls._get_service_names(missing_services)
                message = f"请先配置以下API密钥：{', '.join(service_names)}"
            
            return {
                'has_required': has_required,
                'missing_services': missing_services,
                'configured_services': configured_services,
                'message': message
            }
            
        except Exception as e:
            logger.error(f"检查API密钥失败: {e}")
            return {
                'has_required': False,
                'missing_services': cls.REQUIRED_SERVICES,
                'configured_services': [],
                'message': '检查API密钥配置时出错，请稍后重试'
            }
    
    @classmethod
    def get_user_api_key(cls, user: User, service: str) -> Optional[UserAPIKey]:
        """
        获取用户指定服务的API密钥
        
        Args:
            user: 用户对象
            service: 服务类型
            
        Returns:
            UserAPIKey对象或None
        """
        try:
            return UserAPIKey.objects.get(
                user=user,
                service=service,
                is_active=True
            )
        except UserAPIKey.DoesNotExist:
            return None
    
    @classmethod
    def validate_api_key(cls, user: User, service: str) -> bool:
        """
        验证用户的API密钥是否有效
        
        Args:
            user: 用户对象
            service: 服务类型
            
        Returns:
            bool: 是否有效
        """
        api_key = cls.get_user_api_key(user, service)
        if not api_key:
            return False
        
        # 这里可以添加实际的API密钥验证逻辑
        # 比如调用对应的API服务进行验证
        
        return api_key.is_valid
    
    @classmethod
    def _get_service_names(cls, services: List[str]) -> List[str]:
        """
        获取服务的中文名称
        
        Args:
            services: 服务代码列表
            
        Returns:
            List[str]: 服务名称列表
        """
        service_map = {
            'llm': 'LLM服务',
            'voice': '语音识别',
            'maps': '地图服务',
        }
        
        return [service_map.get(service, service) for service in services]
    
    @classmethod
    def get_service_status(cls, user: User) -> Dict:
        """
        获取用户所有服务的配置状态
        
        Args:
            user: 用户对象
            
        Returns:
            Dict: 服务状态信息
        """
        all_services = cls.REQUIRED_SERVICES + cls.OPTIONAL_SERVICES
        status = {}
        
        for service in all_services:
            api_key = cls.get_user_api_key(user, service)
            status[service] = {
                'configured': api_key is not None,
                'valid': api_key.is_valid if api_key else False,
                'required': service in cls.REQUIRED_SERVICES,
                'name': cls._get_service_names([service])[0]
            }
        
        return status
    
    @classmethod
    def get_llm_config(cls, user: User) -> Optional[Dict]:
        """获取用户的LLM配置"""
        try:
            llm_key = LLMAPIKey.objects.get(user=user, is_active=True)
            return {
                'api_key': llm_key.decrypt_api_key(),
                'base_url': llm_key.base_url,
                'model': llm_key.model,
                'max_tokens': llm_key.max_tokens,
                'temperature': llm_key.temperature
            }
        except LLMAPIKey.DoesNotExist:
            # 回退到旧版API密钥
            old_key = cls.get_user_api_key(user, 'llm')
            if old_key:
                return {
                    'api_key': old_key.decrypt_api_key(),
                    'base_url': old_key.base_url,
                    'model': old_key.model_name,  # 旧模型使用model_name字段
                    'max_tokens': 2048,
                    'temperature': 0.7
                }
            return None
        except Exception as e:
            logger.error(f"获取LLM配置失败: {e}")
            return None
    
    @classmethod
    def get_voice_config(cls, user: User) -> Optional[Dict]:
        """获取用户的语音识别配置"""
        try:
            voice_key = VoiceAPIKey.objects.get(user=user, is_active=True)
            return {
                'api_key': voice_key.decrypt_api_key(),
                'app_id': voice_key.appid,
                'api_secret': voice_key.api_secret,
                'language': voice_key.language,
                'accent': voice_key.accent
            }
        except VoiceAPIKey.DoesNotExist:
            # 回退到旧版API密钥
            old_key = cls.get_user_api_key(user, 'voice')
            if old_key:
                extra_config = old_key.extra_config or {}
                return {
                    'api_key': old_key.decrypt_api_key(),
                    'app_id': extra_config.get('app_id', ''),
                    'api_secret': extra_config.get('api_secret', ''),
                    'language': 'zh_cn',
                    'accent': 'mandarin'
                }
            return None
        except Exception as e:
            logger.error(f"获取语音识别配置失败: {e}")
            return None
    
    @classmethod
    def get_map_config(cls, user: User) -> Optional[Dict]:
        """获取用户的地图服务配置"""
        try:
            map_key = MapAPIKey.objects.get(user=user, is_active=True)
            return {
                'api_key': map_key.decrypt_api_key(),
                'provider': map_key.provider,
                'base_url': map_key.base_url,
                'daily_quota': map_key.daily_quota
            }
        except MapAPIKey.DoesNotExist:
            # 回退到旧版API密钥
            old_key = cls.get_user_api_key(user, 'maps')
            if old_key:
                return {
                    'api_key': old_key.decrypt_api_key(),
                    'provider': 'amap',
                    'base_url': old_key.base_url,
                    'daily_quota': 10000
                }
            return None
        except Exception as e:
            logger.error(f"获取地图服务配置失败: {e}")
            return None