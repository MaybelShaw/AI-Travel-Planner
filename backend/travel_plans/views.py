import logging
from django.shortcuts import render
from django.utils import timezone
from rest_framework import viewsets, status, permissions
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from rest_framework.response import Response

logger = logging.getLogger(__name__)

from .models import TravelPlan, LLMAPIKey, VoiceAPIKey, MapAPIKey
from .serializers import (
    BasicTravelPlanSerializer,
    TravelPlanCreateSerializer,
    TravelPlanDetailSerializer,
    TravelPlanUpdateSerializer,
    LLMAPIKeySerializer,
    VoiceAPIKeySerializer,
)
from .services.map_service import MapService
from .services.voice_service import VoiceService


class TravelPlanViewSet(viewsets.ModelViewSet):
    """ViewSet for TravelPlan.

    - List/retrieve only user's own plans (secure by filtering queryset)
    - Use different serializers for create / retrieve / update
    - Provide small extension hooks for map and voice integrations via custom actions
    """

    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        return TravelPlan.objects.filter(user=user)

    def get_serializer_class(self):
        if self.action == 'create':
            return TravelPlanCreateSerializer
        if self.action in ('retrieve', 'list'):
            return TravelPlanDetailSerializer
        if self.action in ('update', 'partial_update'):
            return TravelPlanUpdateSerializer
        return BasicTravelPlanSerializer

    def perform_create(self, serializer):
        # serializer.create expects request in context and relies on request.user,
        # but we set the user explicitly to be safe.
        serializer.save(user=self.request.user)

    def create(self, request, *args, **kwargs):
        """Handle POST /api/travelplans/ to ensure a 201 Created response.

        This mirrors the behavior of the custom `/create/` action and returns
        the created object serialized with TravelPlanDetailSerializer.
        """
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        instance = serializer.save(user=request.user)
        out = TravelPlanDetailSerializer(instance, context={"request": request})
        headers = self.get_success_headers(out.data)
        return Response(out.data, status=status.HTTP_201_CREATED, headers=headers)

    @action(detail=False, methods=["post"], url_path="create")
    def create_via_action(self, request):
        """Alternate create endpoint: POST /api/travelplans/create/

        Uses the same TravelPlanCreateSerializer flow but exposes a dedicated
        URL path as requested.
        """
        serializer = TravelPlanCreateSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        # pass user explicitly to serializer.create
        instance = serializer.save(user=request.user)
        out = TravelPlanDetailSerializer(instance, context={"request": request})
        return Response(out.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def add_expense(self, request, pk=None):
        """Append an expense to the plan's expenses list.

        Body: {"amount": number, "category": str, "note": optional str}
        """
        plan = self.get_object()
        payload = request.data
        amount = payload.get("amount")
        category = payload.get("category")
        note = payload.get("note", "")

        if amount is None or category is None:
            return Response({"detail": "amount and category are required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            amount = float(amount)
        except (TypeError, ValueError):
            return Response({"detail": "amount must be a number"}, status=status.HTTP_400_BAD_REQUEST)

        expenses = plan.expenses or []
        expenses.append({"amount": amount, "category": category, "note": note})
        plan.expenses = expenses
        plan.save(update_fields=["expenses"])  # minimal write

        serializer = TravelPlanDetailSerializer(plan, context={"request": request})
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=False, methods=["get"], url_path="check-api-keys")
    def check_api_keys(self, request):
        """检查用户API密钥配置状态"""
        try:
            api_check = APIKeyService.check_required_api_keys(request.user)
            service_status = APIKeyService.get_service_status(request.user)
            
            return Response({
                'success': True,
                'has_required': api_check['has_required'],
                'message': api_check['message'],
                'missing_services': api_check['missing_services'],
                'configured_services': api_check['configured_services'],
                'service_status': service_status
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"检查API密钥状态失败: {e}")
            return Response({
                'success': False,
                'error': '检查API密钥状态时出错'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=["post"])
    def geocode(self, request, pk=None):
        """Geocode an address using the MapService stub. Returns lat/lng.

        Body: {"address": "..."}
        """
        address = request.data.get("address")
        if not address:
            return Response({"detail": "address is required"}, status=status.HTTP_400_BAD_REQUEST)

        ms = MapService()
        result = ms.geocode(address)
        if not result:
            return Response({"detail": "geocoding failed"}, status=status.HTTP_502_BAD_GATEWAY)

        return Response(result, status=status.HTTP_200_OK)



# 费用管理相关的视图
from rest_framework.parsers import MultiPartParser, JSONParser
from django.db.models import Q
import logging

from .models import ExpenseEntry
from .serializers import (
    ExpenseEntrySerializer,
    ExpenseCreateSerializer,
    VoiceExpenseSerializer,
    BudgetAnalysisSerializer,
    BudgetBreakdownSerializer,
    ExpensePredictionSerializer,
    BudgetStatusSerializer,
    ExpenseStatisticsSerializer
)
from .services.budget_service import BudgetAnalyzer, ExpenseTracker
from .services.api_key_service import APIKeyService
from .models import UserAPIKey
from cryptography.fernet import Fernet
from django.conf import settings
from django.utils import timezone
from .serializers import UserAPIKeySerializer, UserAPIKeyCreateSerializer

logger = logging.getLogger(__name__)


class ExpenseEntryViewSet(viewsets.ModelViewSet):
    """费用条目视图集"""
    
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, JSONParser]
    
    def get_queryset(self):
        """获取用户的费用条目"""
        user = self.request.user
        queryset = ExpenseEntry.objects.filter(travel_plan__user=user)
        
        # 过滤参数
        travel_plan_id = self.request.query_params.get('travel_plan_id')
        category = self.request.query_params.get('category')
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        
        if travel_plan_id:
            queryset = queryset.filter(travel_plan_id=travel_plan_id)
        if category:
            queryset = queryset.filter(category=category)
        if start_date:
            queryset = queryset.filter(created_at__gte=start_date)
        if end_date:
            queryset = queryset.filter(created_at__lte=end_date)
        
        return queryset.order_by('-created_at')
    
    def get_serializer_class(self):
        """根据动作选择序列化器"""
        if self.action == 'create':
            return ExpenseCreateSerializer
        return ExpenseEntrySerializer
    
    def perform_create(self, serializer):
        """创建费用条目时的额外处理"""
        expense = serializer.save()
        
        # 记录日志
        logger.info(f"User {self.request.user.username} created expense: {expense.description} - ¥{expense.amount}")
        
        return expense
    
    @action(detail=False, methods=['post'], url_path='voice-record')
    def voice_record(self, request):
        """语音记录费用"""
        serializer = VoiceExpenseSerializer(data=request.data, context={'request': request})
        
        if serializer.is_valid():
            try:
                result = serializer.save()
                return Response({
                    'success': True,
                    'message': '语音费用记录成功',
                    'data': result
                }, status=status.HTTP_201_CREATED)
            except Exception as e:
                logger.error(f"Voice expense recording failed: {e}")
                return Response({
                    'success': False,
                    'error': str(e)
                }, status=status.HTTP_400_BAD_REQUEST)
        
        return Response({
            'success': False,
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['get'], url_path='categories')
    def categories(self, request):
        """获取费用类别列表"""
        categories = [
            {'code': choice[0], 'name': choice[1]}
            for choice in ExpenseEntry.CATEGORY_CHOICES
        ]
        return Response(categories)
    
    @action(detail=False, methods=['post'], url_path='batch-create')
    def batch_create(self, request):
        """批量创建费用条目"""
        expenses_data = request.data.get('expenses', [])
        
        if not expenses_data:
            return Response({
                'success': False,
                'error': '没有提供费用数据'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        created_expenses = []
        errors = []
        
        for i, expense_data in enumerate(expenses_data):
            serializer = ExpenseCreateSerializer(data=expense_data, context={'request': request})
            
            if serializer.is_valid():
                try:
                    expense = serializer.save()
                    created_expenses.append(ExpenseEntrySerializer(expense).data)
                except Exception as e:
                    errors.append(f"第{i+1}条记录创建失败: {str(e)}")
            else:
                errors.append(f"第{i+1}条记录验证失败: {serializer.errors}")
        
        return Response({
            'success': len(errors) == 0,
            'created_count': len(created_expenses),
            'created_expenses': created_expenses,
            'errors': errors
        }, status=status.HTTP_201_CREATED if len(errors) == 0 else status.HTTP_207_MULTI_STATUS)
    
    @action(detail=False, methods=['post'], url_path='statistics')
    def statistics(self, request):
        """获取费用统计"""
        serializer = ExpenseStatisticsSerializer(data=request.data, context={'request': request})
        
        if serializer.is_valid():
            stats = serializer.save()
            return Response({
                'success': True,
                'statistics': stats
            })
        
        return Response({
            'success': False,
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)


class BudgetManagementViewSet(viewsets.ViewSet):
    """预算管理视图集"""
    
    permission_classes = [IsAuthenticated]
    
    @action(detail=False, methods=['post'], url_path='analyze')
    def analyze(self, request):
        """分析预算"""
        serializer = BudgetAnalysisSerializer(data=request.data, context={'request': request})
        
        if serializer.is_valid():
            analysis = serializer.save()
            return Response({
                'success': True,
                'analysis': analysis
            })
        
        return Response({
            'success': False,
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['post'], url_path='breakdown')
    def breakdown(self, request):
        """生成预算分解"""
        serializer = BudgetBreakdownSerializer(data=request.data)
        
        if serializer.is_valid():
            breakdown = serializer.save()
            return Response({
                'success': True,
                'breakdown': breakdown
            })
        
        return Response({
            'success': False,
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['post'], url_path='predict-expenses')
    def predict_expenses(self, request):
        """预测费用"""
        serializer = ExpensePredictionSerializer(data=request.data)
        
        if serializer.is_valid():
            predictions = serializer.save()
            return Response({
                'success': True,
                'predictions': predictions
            })
        
        return Response({
            'success': False,
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['get'], url_path='status/(?P<travel_plan_id>[^/.]+)')
    def status(self, request, travel_plan_id=None):
        """获取预算状态"""
        try:
            travel_plan = TravelPlan.objects.get(
                id=travel_plan_id,
                user=request.user
            )
            
            analyzer = BudgetAnalyzer(user=request.user)
            analysis = analyzer.analyze_budget(travel_plan)
            
            return Response({
                'success': True,
                'status': analysis.get('budget_status', {}),
                'suggestions': analysis.get('optimization_suggestions', [])
            })
            
        except TravelPlan.DoesNotExist:
            return Response({
                'success': False,
                'error': '旅行计划不存在或无权限访问'
            }, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"Budget status retrieval failed: {e}")
            return Response({
                'success': False,
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class UserAPIKeyViewSet(viewsets.ModelViewSet):
    """用户API密钥管理视图集"""
    
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        """只返回当前用户的API密钥"""
        return UserAPIKey.objects.filter(user=self.request.user)
    
    def get_serializer_class(self):
        """根据动作选择序列化器"""
        if self.action in ['create', 'update', 'partial_update']:
            return UserAPIKeyCreateSerializer
        return UserAPIKeySerializer
    
    def perform_create(self, serializer):
        """创建时设置用户"""
        serializer.save()
    
    @action(detail=True, methods=['post'])
    def test_connection(self, request, pk=None):
        """测试API密钥连接"""
        api_key = self.get_object()
        
        try:
            if api_key.service == 'llm':
                # 测试LLM连接
                from .services.llm_service import LLMService
                llm = LLMService(user=request.user)
                test_response = llm.chat([{"role": "user", "content": "Hello"}])
                
                if test_response:
                    api_key.is_valid = True
                    api_key.last_validated = timezone.now()
                    api_key.save()
                    
                    return Response({
                        'success': True,
                        'message': 'API密钥测试成功'
                    })
                else:
                    return Response({
                        'success': False,
                        'message': 'API密钥测试失败：无响应'
                    }, status=status.HTTP_400_BAD_REQUEST)
            
            elif api_key.service in ['map', 'maps']:
                # 测试地图API连接
                from .services.map_service import AmapService
                
                # 解密API密钥
                decrypted_key = api_key.decrypt_api_key()
                map_service = AmapService(api_key=decrypted_key)
                
                # 测试连接
                test_result = map_service.test_connection()
                
                if test_result.get('success'):
                    api_key.is_valid = True
                    api_key.last_validated = timezone.now()
                    api_key.save()
                    
                    return Response({
                        'success': True,
                        'message': test_result.get('message', '高德地图API测试成功')
                    })
                else:
                    return Response({
                        'success': False,
                        'message': test_result.get('message', '高德地图API测试失败')
                    }, status=status.HTTP_400_BAD_REQUEST)
            
            else:
                return Response({
                    'success': False,
                    'message': f'暂不支持测试{api_key.service}服务'
                }, status=status.HTTP_400_BAD_REQUEST)
                
        except Exception as e:
            logger.error(f"API密钥测试失败: {e}")
            return Response({
                'success': False,
                'message': f'API密钥测试失败: {str(e)}'
            }, status=status.HTTP_400_BAD_REQUEST)


class LLMAPIKeyViewSet(viewsets.ModelViewSet):
    """LLM API密钥管理视图集"""
    
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = LLMAPIKeySerializer
    
    def get_queryset(self):
        """只返回当前用户的LLM API密钥"""
        return LLMAPIKey.objects.filter(user=self.request.user)
    
    def perform_create(self, serializer):
        """创建时设置用户"""
        serializer.save()
    
    @action(detail=True, methods=['post'])
    def test_connection(self, request, pk=None):
        """测试LLM API密钥连接"""
        api_key = self.get_object()
        
        try:
            # 验证API密钥配置是否完整
            config_errors = api_key.validate_config()
            if config_errors:
                return Response({
                    'success': False,
                    'message': f'API密钥配置错误: {", ".join(config_errors)}'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # 尝试解密密钥以验证加密是否正常
            try:
                decrypted_key = api_key.apikey
                if not decrypted_key:
                    raise ValueError("解密后的密钥为空")
            except Exception as decrypt_error:
                return Response({
                    'success': False,
                    'message': f'API密钥解密失败: {str(decrypt_error)}'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # 可选：尝试实际的API调用（如果用户要求）
            test_api_call = request.data.get('test_api_call', False)
            if test_api_call:
                try:
                    from .services.llm_service import LLMService
                    llm = LLMService(user=request.user)
                    test_response = llm.chat([{"role": "user", "content": "Hello"}])
                    
                    if not test_response:
                        return Response({
                            'success': False,
                            'message': 'LLM API调用测试失败：无响应'
                        }, status=status.HTTP_400_BAD_REQUEST)
                except Exception as api_error:
                    return Response({
                        'success': False,
                        'message': f'LLM API调用测试失败: {str(api_error)}'
                    }, status=status.HTTP_400_BAD_REQUEST)
            
            # 标记为有效并保存
            api_key.is_valid = True
            api_key.last_validated = timezone.now()
            api_key.save()
            
            return Response({
                'success': True,
                'message': 'LLM API密钥配置验证成功'
            })
                
        except Exception as e:
            return Response({
                'success': False,
                'message': f'LLM API密钥测试失败: {str(e)}'
            }, status=status.HTTP_400_BAD_REQUEST)


class VoiceAPIKeyViewSet(viewsets.ModelViewSet):
    """语音识别 API密钥管理视图集"""
    
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = VoiceAPIKeySerializer
    
    def get_queryset(self):
        """只返回当前用户的语音识别 API密钥"""
        return VoiceAPIKey.objects.filter(user=self.request.user)
    
    def perform_create(self, serializer):
        """创建时设置用户"""
        serializer.save()
    
    @action(detail=True, methods=['post'])
    def test_connection(self, request, pk=None):
        """测试语音识别 API密钥连接"""
        api_key = self.get_object()
        
        try:
            # 验证API密钥配置是否完整
            config_errors = api_key.validate_config()
            if config_errors:
                return Response({
                    'success': False,
                    'message': f'API密钥配置错误: {", ".join(config_errors)}'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # 检查API密钥是否有效（基本验证）
            if not api_key.appid or not api_key.encrypted_api_secret or not api_key.encrypted_key:
                return Response({
                    'success': False,
                    'message': 'API密钥配置不完整，请检查APPID、API Secret和API Key'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # 尝试解密密钥以验证加密是否正常
            try:
                decrypted_key = api_key.apikey
                decrypted_secret = api_key.api_secret
                if not decrypted_key or not decrypted_secret:
                    raise ValueError("解密后的密钥为空")
            except Exception as decrypt_error:
                return Response({
                    'success': False,
                    'message': f'API密钥解密失败: {str(decrypt_error)}'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # 简单的格式验证
            if len(api_key.appid) != 8:
                return Response({
                    'success': False,
                    'message': 'APPID格式错误，应为8位字符'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # 标记为有效并保存
            api_key.is_valid = True
            api_key.last_validated = timezone.now()
            api_key.save()
            
            return Response({
                'success': True,
                'message': '语音识别 API密钥配置验证成功'
            })
                
        except Exception as e:
            return Response({
                'success': False,
                'message': f'语音识别 API密钥测试失败: {str(e)}'
            }, status=status.HTTP_400_BAD_REQUEST)


# 语音识别专用视图
class VoiceRecognitionViewSet(viewsets.ViewSet):
    """语音识别专用视图集"""
    
    permission_classes = [permissions.IsAuthenticated]
    
    @action(detail=False, methods=['post'], url_path='transcribe')
    def transcribe(self, request):
        """语音转文字接口"""
        try:
            # 获取音频文件
            audio_file = request.FILES.get('audio_file')
            if not audio_file:
                return Response({
                    'success': False,
                    'error': '未提供音频文件'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # 读取音频数据
            audio_data = audio_file.read()
            
            # 调用语音识别服务
            from .services.voice_service import VoiceRecognitionService
            voice_service = VoiceRecognitionService(user=request.user)
            
            result = voice_service.transcribe_audio(audio_data)
            
            if result.get('success'):
                return Response({
                    'success': True,
                    'transcription': result.get('text', ''),
                    'confidence': result.get('confidence', 0.0),
                    'duration': result.get('duration', 0.0)
                })
            else:
                return Response({
                    'success': False,
                    'error': result.get('error', '语音识别失败')
                }, status=status.HTTP_400_BAD_REQUEST)
                
        except Exception as e:
            logger.error(f"语音识别失败: {e}")
            return Response({
                'success': False,
                'error': f'语音识别失败: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class MapServiceViewSet(viewsets.ViewSet):
    """地图服务专用视图集"""
    
    permission_classes = [permissions.IsAuthenticated]
    
    def _get_map_service(self):
        """获取地图服务实例"""
        try:
            from .services.api_key_service import APIKeyService
            api_key_service = APIKeyService(user=self.request.user)
            map_api_key = api_key_service.get_map_api_key()
            
            if map_api_key:
                from .services.map_service import AmapService
                return AmapService(api_key=map_api_key)
            else:
                # 使用系统默认配置
                from .services.map_service import MapService
                return MapService()
        except Exception as e:
            logger.error(f"获取地图服务失败: {e}")
            return None
    
    @action(detail=False, methods=['post'], url_path='geocode')
    def geocode(self, request):
        """地理编码：地址转坐标"""
        try:
            address = request.data.get('address')
            if not address:
                return Response({
                    'success': False,
                    'error': '地址参数不能为空'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            map_service = self._get_map_service()
            if not map_service:
                return Response({
                    'success': False,
                    'error': '地图服务不可用'
                }, status=status.HTTP_503_SERVICE_UNAVAILABLE)
            
            result = map_service.geocode(address)
            
            if result:
                return Response({
                    'success': True,
                    'data': result
                })
            else:
                return Response({
                    'success': False,
                    'error': '地理编码失败'
                }, status=status.HTTP_400_BAD_REQUEST)
                
        except Exception as e:
            logger.error(f"地理编码失败: {e}")
            return Response({
                'success': False,
                'error': f'地理编码失败: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=False, methods=['post'], url_path='reverse-geocode')
    def reverse_geocode(self, request):
        """逆地理编码：坐标转地址"""
        try:
            lng = request.data.get('lng')
            lat = request.data.get('lat')
            
            if lng is None or lat is None:
                return Response({
                    'success': False,
                    'error': '经纬度参数不能为空'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            map_service = self._get_map_service()
            if not map_service:
                return Response({
                    'success': False,
                    'error': '地图服务不可用'
                }, status=status.HTTP_503_SERVICE_UNAVAILABLE)
            
            result = map_service.reverse_geocode(float(lng), float(lat))
            
            if result:
                return Response({
                    'success': True,
                    'data': result
                })
            else:
                return Response({
                    'success': False,
                    'error': '逆地理编码失败'
                }, status=status.HTTP_400_BAD_REQUEST)
                
        except Exception as e:
            logger.error(f"逆地理编码失败: {e}")
            return Response({
                'success': False,
                'error': f'逆地理编码失败: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=False, methods=['post'], url_path='search-poi')
    def search_poi(self, request):
        """POI搜索"""
        try:
            keyword = request.data.get('keyword')
            if not keyword:
                return Response({
                    'success': False,
                    'error': '搜索关键词不能为空'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            city = request.data.get('city')
            limit = request.data.get('limit', 10)
            
            map_service = self._get_map_service()
            if not map_service:
                return Response({
                    'success': False,
                    'error': '地图服务不可用'
                }, status=status.HTTP_503_SERVICE_UNAVAILABLE)
            
            results = map_service.search_poi(keyword, city, limit)
            
            return Response({
                'success': True,
                'data': results,
                'count': len(results)
            })
                
        except Exception as e:
            logger.error(f"POI搜索失败: {e}")
            return Response({
                'success': False,
                'error': f'POI搜索失败: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=False, methods=['post'], url_path='batch-geocode')
    def batch_geocode(self, request):
        """批量地理编码"""
        try:
            addresses = request.data.get('addresses', [])
            if not addresses or not isinstance(addresses, list):
                return Response({
                    'success': False,
                    'error': '地址列表不能为空'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            if len(addresses) > 50:  # 限制批量处理数量
                return Response({
                    'success': False,
                    'error': '批量地理编码最多支持50个地址'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            map_service = self._get_map_service()
            if not map_service:
                return Response({
                    'success': False,
                    'error': '地图服务不可用'
                }, status=status.HTTP_503_SERVICE_UNAVAILABLE)
            
            results = []
            for address in addresses:
                result = map_service.geocode(address)
                results.append({
                    'address': address,
                    'result': result,
                    'success': result is not None
                })
            
            return Response({
                'success': True,
                'data': results,
                'total': len(results),
                'successful': len([r for r in results if r['success']])
            })
                
        except Exception as e:
            logger.error(f"批量地理编码失败: {e}")
            return Response({
                'success': False,
                'error': f'批量地理编码失败: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=False, methods=['post'], url_path='search-nearby')
    def search_nearby(self, request):
        """周边搜索"""
        try:
            location = request.data.get('location')
            if not location or 'lng' not in location or 'lat' not in location:
                return Response({
                    'success': False,
                    'error': '位置参数不正确'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            keyword = request.data.get('keyword', '')
            poi_type = request.data.get('type', '')
            radius = request.data.get('radius', 1000)  # 默认1000米
            limit = request.data.get('limit', 20)
            
            map_service = self._get_map_service()
            if not map_service:
                return Response({
                    'success': False,
                    'error': '地图服务不可用'
                }, status=status.HTTP_503_SERVICE_UNAVAILABLE)
            
            # 构建搜索关键词
            search_keyword = keyword
            if poi_type:
                search_keyword = f"{poi_type} {keyword}".strip()
            
            # 使用POI搜索功能进行周边搜索
            results = map_service.search_poi(search_keyword, limit=limit)
            
            # 过滤距离范围内的结果
            if results:
                import math
                
                def calculate_distance(lat1, lng1, lat2, lng2):
                    """计算两点间距离（米）"""
                    R = 6371000  # 地球半径（米）
                    lat1_rad = math.radians(lat1)
                    lat2_rad = math.radians(lat2)
                    delta_lat = math.radians(lat2 - lat1)
                    delta_lng = math.radians(lng2 - lng1)
                    
                    a = (math.sin(delta_lat / 2) ** 2 + 
                         math.cos(lat1_rad) * math.cos(lat2_rad) * 
                         math.sin(delta_lng / 2) ** 2)
                    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
                    
                    return R * c
                
                filtered_results = []
                for result in results:
                    distance = calculate_distance(
                        location['lat'], location['lng'],
                        result['lat'], result['lng']
                    )
                    if distance <= radius:
                        result['distance'] = round(distance)
                        filtered_results.append(result)
                
                # 按距离排序
                filtered_results.sort(key=lambda x: x.get('distance', 0))
                results = filtered_results
            
            return Response({
                'success': True,
                'data': results,
                'count': len(results)
            })
                
        except Exception as e:
            logger.error(f"周边搜索失败: {e}")
            return Response({
                'success': False,
                'error': f'周边搜索失败: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=False, methods=['post'], url_path='plan-route')
    def plan_route(self, request):
        """路线规划"""
        try:
            origin = request.data.get('origin')
            destination = request.data.get('destination')
            
            if not origin or not destination:
                return Response({
                    'success': False,
                    'error': '起点和终点不能为空'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            if 'lng' not in origin or 'lat' not in origin:
                return Response({
                    'success': False,
                    'error': '起点坐标格式不正确'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            if 'lng' not in destination or 'lat' not in destination:
                return Response({
                    'success': False,
                    'error': '终点坐标格式不正确'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            waypoints = request.data.get('waypoints', [])
            strategy = request.data.get('strategy', 'fastest')
            
            map_service = self._get_map_service()
            if not map_service:
                return Response({
                    'success': False,
                    'error': '地图服务不可用'
                }, status=status.HTTP_503_SERVICE_UNAVAILABLE)
            
            result = map_service.plan_route(origin, destination, waypoints, strategy)
            
            if result:
                return Response({
                    'success': True,
                    'data': result
                })
            else:
                return Response({
                    'success': False,
                    'error': '路线规划失败'
                }, status=status.HTTP_400_BAD_REQUEST)
                
        except Exception as e:
            logger.error(f"路线规划失败: {e}")
            return Response({
                'success': False,
                'error': f'路线规划失败: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    @action(detail=False, methods=['post'], url_path='distance')
    def get_distance(self, request):
        """获取距离和时间"""
        try:
            origins = request.data.get('origins', [])
            destinations = request.data.get('destinations', [])
            travel_mode = request.data.get('type', 'driving')
            
            if not origins or not destinations:
                return Response({
                    'success': False,
                    'error': '起点和终点列表不能为空'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # 验证坐标格式
            for origin in origins:
                if 'lng' not in origin or 'lat' not in origin:
                    return Response({
                        'success': False,
                        'error': '起点坐标格式不正确'
                    }, status=status.HTTP_400_BAD_REQUEST)
            
            for destination in destinations:
                if 'lng' not in destination or 'lat' not in destination:
                    return Response({
                        'success': False,
                        'error': '终点坐标格式不正确'
                    }, status=status.HTTP_400_BAD_REQUEST)
            
            map_service = self._get_map_service()
            if not map_service:
                return Response({
                    'success': False,
                    'error': '地图服务不可用'
                }, status=status.HTTP_503_SERVICE_UNAVAILABLE)
            
            result = map_service.get_distance_matrix(origins, destinations, travel_mode)
            
            if result:
                return Response({
                    'success': True,
                    'data': result
                })
            else:
                return Response({
                    'success': False,
                    'error': '距离计算失败'
                }, status=status.HTTP_400_BAD_REQUEST)
                
        except Exception as e:
            logger.error(f"距离计算失败: {e}")
            return Response({
                'success': False,
                'error': f'距离计算失败: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)