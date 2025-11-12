"""
预算管理服务
"""
import logging
from typing import Dict, List, Optional
from decimal import Decimal
from django.db.models import Sum, Q
from django.utils import timezone
from datetime import datetime, timedelta

from ..models import TravelPlan, ExpenseEntry
from .llm_service import LLMService

logger = logging.getLogger(__name__)


class BudgetAnalyzer:
    """
    AI驱动的预算分析器
    """
    
    def __init__(self, user=None):
        self.user = user
        self.llm_service = None  # 延迟初始化
        self.category_weights = {
            'transportation': 0.3,  # 交通占30%
            'accommodation': 0.35,  # 住宿占35%
            'food': 0.25,          # 餐饮占25%
            'entertainment': 0.08,  # 娱乐占8%
            'shopping': 0.02       # 购物占2%
        }
    
    def analyze_budget(self, travel_plan: TravelPlan) -> Dict:
        """
        分析旅行计划的预算
        
        Args:
            travel_plan: 旅行计划对象
            
        Returns:
            预算分析结果
        """
        try:
            # 获取基本信息
            itinerary = travel_plan.itinerary
            if isinstance(itinerary, str):
                import json
                try:
                    itinerary = json.loads(itinerary)
                except:
                    itinerary = {}
            
            basic_info = itinerary.get('basic_info', {})
            destination = basic_info.get('destination', '未知目的地')
            duration_days = basic_info.get('duration_days', 3)
            total_budget = float(basic_info.get('total_budget', travel_plan.budget_limit or 5000))
            
            # 生成预算分解
            budget_breakdown = self.generate_budget_breakdown({
                'destination': destination,
                'days': duration_days,
                'total_budget': total_budget,
                'preferences': travel_plan.preferences
            })
            
            # 获取实际支出
            actual_expenses = self._get_actual_expenses(travel_plan)
            
            # 计算预算状态
            budget_status = self._calculate_budget_status(budget_breakdown, actual_expenses)
            
            # 生成优化建议
            optimization_suggestions = self._generate_optimization_suggestions(
                budget_breakdown, actual_expenses, travel_plan
            )
            
            return {
                'success': True,
                'budget_breakdown': budget_breakdown,
                'actual_expenses': actual_expenses,
                'budget_status': budget_status,
                'optimization_suggestions': optimization_suggestions,
                'analysis_date': timezone.now().isoformat()
            }
            
        except Exception as e:
            logger.error(f"Budget analysis failed: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def generate_budget_breakdown(self, requirements: Dict) -> Dict:
        """
        生成预算分解
        
        Args:
            requirements: 旅行需求
            
        Returns:
            预算分解结果
        """
        destination = requirements.get('destination', '未知')
        days = requirements.get('days', 3)
        total_budget = requirements.get('total_budget', 5000)
        
        # 基于目的地调整权重
        adjusted_weights = self._adjust_weights_by_destination(destination)
        
        # 计算各类别预算
        breakdown = {}
        for category, weight in adjusted_weights.items():
            breakdown[category] = {
                'budget': round(total_budget * weight, 2),
                'percentage': round(weight * 100, 1),
                'daily_average': round(total_budget * weight / days, 2)
            }
        
        # 添加总计
        breakdown['total'] = {
            'budget': total_budget,
            'percentage': 100.0,
            'daily_average': round(total_budget / days, 2)
        }
        
        return breakdown
    
    def predict_expenses(self, itinerary: Dict) -> List[Dict]:
        """
        预测行程费用
        
        Args:
            itinerary: 行程信息
            
        Returns:
            预测的费用列表
        """
        predicted_expenses = []
        
        try:
            daily_schedule = itinerary.get('itinerary', [])
            
            for day_info in daily_schedule:
                day = day_info.get('day', 1)
                activities = day_info.get('activities', [])
                accommodation = day_info.get('accommodation', {})
                transportation = day_info.get('transportation', [])
                
                # 预测住宿费用
                if accommodation:
                    predicted_expenses.append({
                        'day': day,
                        'category': 'accommodation',
                        'description': f"住宿 - {accommodation.get('name', '酒店')}",
                        'estimated_amount': self._estimate_accommodation_cost(accommodation),
                        'confidence': 0.8
                    })
                
                # 预测交通费用
                for transport in transportation:
                    predicted_expenses.append({
                        'day': day,
                        'category': 'transportation',
                        'description': f"交通 - {transport.get('route_details', {}).get('line', '未知线路')}",
                        'estimated_amount': transport.get('route_details', {}).get('cost', 50),
                        'confidence': 0.7
                    })
                
                # 预测活动费用
                for activity in activities:
                    predicted_expenses.append({
                        'day': day,
                        'category': 'entertainment',
                        'description': f"活动 - {activity.get('name', '未知活动')}",
                        'estimated_amount': activity.get('cost', 100),
                        'confidence': 0.6
                    })
                
                # 预测餐饮费用（每天3餐）
                predicted_expenses.extend([
                    {
                        'day': day,
                        'category': 'food',
                        'description': f"第{day}天餐饮",
                        'estimated_amount': self._estimate_daily_food_cost(itinerary),
                        'confidence': 0.7
                    }
                ])
        
        except Exception as e:
            logger.error(f"Expense prediction failed: {e}")
        
        return predicted_expenses
    
    def _adjust_weights_by_destination(self, destination: str) -> Dict:
        """根据目的地调整预算权重"""
        weights = self.category_weights.copy()
        
        # 根据目的地特点调整权重
        if destination in ['北京', '上海', '深圳', '广州']:
            # 一线城市，住宿和餐饮成本较高
            weights['accommodation'] = 0.4
            weights['food'] = 0.3
            weights['transportation'] = 0.25
            weights['entertainment'] = 0.05
        elif destination in ['成都', '西安', '杭州', '南京']:
            # 二线城市，相对平衡
            weights['accommodation'] = 0.35
            weights['food'] = 0.25
            weights['transportation'] = 0.3
            weights['entertainment'] = 0.1
        
        return weights
    
    def _get_actual_expenses(self, travel_plan: TravelPlan) -> Dict:
        """获取实际支出"""
        expenses = travel_plan.expense_entries.all()
        
        actual = {}
        for category in self.category_weights.keys():
            category_expenses = expenses.filter(category=category)
            total = category_expenses.aggregate(Sum('amount'))['amount__sum'] or 0
            
            actual[category] = {
                'spent': float(total),
                'count': category_expenses.count(),
                'items': [
                    {
                        'amount': float(exp.amount),
                        'description': exp.description,
                        'date': exp.created_at.isoformat()
                    }
                    for exp in category_expenses.order_by('-created_at')[:5]
                ]
            }
        
        # 计算总支出
        total_spent = sum(cat['spent'] for cat in actual.values())
        actual['total'] = {
            'spent': total_spent,
            'count': expenses.count()
        }
        
        return actual
    
    def _calculate_budget_status(self, budget_breakdown: Dict, actual_expenses: Dict) -> Dict:
        """计算预算状态"""
        status = {}
        
        for category in self.category_weights.keys():
            budgeted = budget_breakdown.get(category, {}).get('budget', 0)
            spent = actual_expenses.get(category, {}).get('spent', 0)
            remaining = budgeted - spent
            usage_percentage = (spent / budgeted * 100) if budgeted > 0 else 0
            
            status[category] = {
                'budgeted': budgeted,
                'spent': spent,
                'remaining': remaining,
                'usage_percentage': round(usage_percentage, 1),
                'status': self._get_category_status(usage_percentage)
            }
        
        # 总体状态
        total_budgeted = budget_breakdown.get('total', {}).get('budget', 0)
        total_spent = actual_expenses.get('total', {}).get('spent', 0)
        total_remaining = total_budgeted - total_spent
        total_usage = (total_spent / total_budgeted * 100) if total_budgeted > 0 else 0
        
        status['total'] = {
            'budgeted': total_budgeted,
            'spent': total_spent,
            'remaining': total_remaining,
            'usage_percentage': round(total_usage, 1),
            'status': self._get_category_status(total_usage)
        }
        
        return status
    
    def _get_category_status(self, usage_percentage: float) -> str:
        """获取类别状态"""
        if usage_percentage <= 50:
            return 'healthy'
        elif usage_percentage <= 80:
            return 'warning'
        elif usage_percentage <= 100:
            return 'critical'
        else:
            return 'over_budget'
    
    def _generate_optimization_suggestions(self, budget_breakdown: Dict, actual_expenses: Dict, travel_plan: TravelPlan) -> List[Dict]:
        """生成优化建议"""
        suggestions = []
        
        for category in self.category_weights.keys():
            budgeted = budget_breakdown.get(category, {}).get('budget', 0)
            spent = actual_expenses.get(category, {}).get('spent', 0)
            usage_percentage = (spent / budgeted * 100) if budgeted > 0 else 0
            
            if usage_percentage > 80:
                suggestions.append({
                    'category': category,
                    'type': 'warning',
                    'message': f"{self._get_category_name(category)}支出已达预算的{usage_percentage:.1f}%，建议控制后续支出",
                    'priority': 'high' if usage_percentage > 100 else 'medium'
                })
            elif usage_percentage < 30:
                suggestions.append({
                    'category': category,
                    'type': 'opportunity',
                    'message': f"{self._get_category_name(category)}预算使用较少，可以考虑提升体验",
                    'priority': 'low'
                })
        
        # 基于AI生成个性化建议
        try:
            ai_suggestions = self._generate_ai_suggestions(travel_plan, budget_breakdown, actual_expenses)
            suggestions.extend(ai_suggestions)
        except Exception as e:
            logger.error(f"AI suggestion generation failed: {e}")
        
        return suggestions
    
    def _generate_ai_suggestions(self, travel_plan: TravelPlan, budget_breakdown: Dict, actual_expenses: Dict) -> List[Dict]:
        """使用AI生成个性化建议"""
        try:
            # 延迟初始化LLM服务
            if not self.llm_service and self.user:
                try:
                    self.llm_service = LLMService(user=self.user)
                except Exception as e:
                    logger.warning(f"无法初始化LLM服务: {e}")
                    return self._get_default_suggestions()
            
            if not self.llm_service:
                return self._get_default_suggestions()
            
            prompt = f"""
            基于以下旅行预算信息，生成3-5个实用的预算优化建议：
            
            旅行计划：{travel_plan.title}
            预算分配：{budget_breakdown}
            实际支出：{actual_expenses}
            
            请生成简洁实用的建议，每个建议包含类别、类型和具体建议内容。
            """
            
            response = self.llm_service.chat([{"role": "user", "content": prompt}])
            
            # 解析AI响应（这里简化处理）
            return [
                {
                    'category': 'general',
                    'type': 'ai_suggestion',
                    'message': '基于您的消费模式，建议在餐饮方面尝试当地特色小吃，既能节省预算又能体验文化',
                    'priority': 'medium'
                }
            ]
            
        except Exception as e:
            logger.error(f"AI suggestion generation failed: {e}")
            return self._get_default_suggestions()
    
    def _get_default_suggestions(self) -> List[Dict]:
        """获取默认建议（当AI服务不可用时）"""
        return [
            {
                'category': 'food',
                'type': 'cost_saving',
                'message': '尝试当地特色小吃和街边美食，既能节省预算又能体验地道文化',
                'priority': 'medium'
            },
            {
                'category': 'transportation',
                'type': 'optimization',
                'message': '使用公共交通工具，购买交通卡或一日券可以节省费用',
                'priority': 'medium'
            },
            {
                'category': 'accommodation',
                'type': 'planning',
                'message': '提前预订住宿可以获得更好的价格，考虑选择位置便利的经济型酒店',
                'priority': 'low'
            }
        ]
    
    def _get_category_name(self, category: str) -> str:
        """获取类别中文名称"""
        names = {
            'transportation': '交通',
            'accommodation': '住宿',
            'food': '餐饮',
            'entertainment': '娱乐',
            'shopping': '购物'
        }
        return names.get(category, category)
    
    def _estimate_accommodation_cost(self, accommodation: Dict) -> float:
        """估算住宿费用"""
        # 简单的住宿费用估算逻辑
        base_cost = 200  # 基础费用
        
        # 根据酒店名称调整（简化逻辑）
        name = accommodation.get('name', '').lower()
        if '五星' in name or 'luxury' in name:
            return base_cost * 2.5
        elif '四星' in name or 'hotel' in name:
            return base_cost * 1.5
        else:
            return base_cost
    
    def _estimate_daily_food_cost(self, itinerary: Dict) -> float:
        """估算每日餐饮费用"""
        # 基于目的地和偏好估算
        basic_info = itinerary.get('basic_info', {})
        destination = basic_info.get('destination', '')
        
        if destination in ['北京', '上海', '深圳']:
            return 150  # 一线城市
        elif destination in ['成都', '西安', '杭州']:
            return 100  # 二线城市
        else:
            return 80   # 其他城市


class ExpenseTracker:
    """
    费用跟踪器
    """
    
    def __init__(self):
        self.voice_service = None  # 延迟导入避免循环依赖
    
    def add_expense_from_voice(self, audio_data: bytes, plan_id: int, user) -> Dict:
        """
        从语音添加费用
        
        Args:
            audio_data: 音频数据
            plan_id: 旅行计划ID
            user: 用户对象
            
        Returns:
            添加结果
        """
        try:
            # 延迟导入
            if not self.voice_service:
                from .voice_service import VoiceService
                self.voice_service = VoiceService(user=user)
            
            # 处理语音命令
            voice_result = self.voice_service.process_voice_command(audio_data)
            
            if not voice_result.get('success'):
                error_msg = voice_result.get('error', '语音识别失败')
                return {
                    'success': False,
                    'error': error_msg
                }
            
            # 检查意图
            if voice_result.get('intent') != 'add_expense':
                return {
                    'success': False,
                    'error': '未识别到费用记录意图'
                }
            
            # 提取费用信息
            entities = voice_result.get('entities', {})
            amount = entities.get('amount')
            category = entities.get('category', 'other')
            
            if not amount:
                return {
                    'success': False,
                    'error': '未能识别费用金额'
                }
            
            # 获取旅行计划
            try:
                travel_plan = TravelPlan.objects.get(id=plan_id, user=user)
            except TravelPlan.DoesNotExist:
                return {
                    'success': False,
                    'error': '旅行计划不存在'
                }
            
            # 创建费用条目
            expense = ExpenseEntry.objects.create(
                travel_plan=travel_plan,
                amount=Decimal(str(amount)),
                category=category,
                description=f"语音记录：{voice_result.get('transcription', '')}",
                currency=travel_plan.currency
            )
            
            return {
                'success': True,
                'expense_id': expense.id,
                'amount': float(expense.amount),
                'category': expense.category,
                'description': expense.description,
                'transcription': voice_result.get('transcription')
            }
            
        except Exception as e:
            logger.error(f"Voice expense tracking failed: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def categorize_expense(self, description: str, amount: float) -> str:
        """
        自动分类费用
        
        Args:
            description: 费用描述
            amount: 费用金额
            
        Returns:
            费用类别
        """
        description_lower = description.lower()
        
        # 关键词匹配
        category_keywords = {
            'food': ['餐', '饭', '吃', '食', '咖啡', '茶', '小吃', '早餐', '午餐', '晚餐'],
            'transportation': ['车', '票', '地铁', '公交', '出租', '滴滴', '火车', '飞机', '船'],
            'accommodation': ['住', '酒店', '宾馆', '民宿', '旅店', '房间'],
            'entertainment': ['门票', '景点', '游乐', '电影', '演出', '博物馆', '公园'],
            'shopping': ['买', '购', '商店', '超市', '纪念品', '礼品', '衣服']
        }
        
        for category, keywords in category_keywords.items():
            for keyword in keywords:
                if keyword in description_lower:
                    return category
        
        # 基于金额的简单推断
        if amount > 500:
            return 'accommodation'  # 大额可能是住宿
        elif amount > 100:
            return 'entertainment'  # 中等金额可能是娱乐
        else:
            return 'food'  # 小额可能是餐饮
    
    def get_budget_status(self, plan_id: int, user=None) -> Dict:
        """
        获取预算状态
        
        Args:
            plan_id: 旅行计划ID
            user: 用户对象
            
        Returns:
            预算状态
        """
        try:
            if user:
                travel_plan = TravelPlan.objects.get(id=plan_id, user=user)
            else:
                travel_plan = TravelPlan.objects.get(id=plan_id)
            analyzer = BudgetAnalyzer(user=user)
            return analyzer.analyze_budget(travel_plan)
            
        except TravelPlan.DoesNotExist:
            return {
                'success': False,
                'error': '旅行计划不存在'
            }
        except Exception as e:
            logger.error(f"Budget status retrieval failed: {e}")
            return {
                'success': False,
                'error': str(e)
            }