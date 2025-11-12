# 移除默认配置依赖，现在完全依赖用户配置
from openai import OpenAI
import logging

logger = logging.getLogger(__name__)


class OpenAICompatibelAPI:
    def __init__(self, api_key: str, base_url: str):
        self.client = OpenAI(api_key=api_key, base_url=base_url.rstrip("/"))
        self.base_url = base_url.rstrip("/")
        self.system_prompt = ""

    def get_models(self):
        return self.client.models.list()

    def chat(
        self,
        model: str,
        messages: list,
        temperature: float = 0.7,
        max_tokens: int = 2048,
    ):
        try:
            response = self.client.chat.completions.create(
                model=model,
                messages=self._build_messages(messages),
                temperature=temperature,
                max_tokens=max_tokens,
            )
            return response.choices[0].message.content
        except Exception as e:
            logger.error(f"LLM chat failed: {e}")
            # propagate or return empty string to let callers handle
            return ""

    def set_system_prompt(self, prompt: str):
        self.system_prompt = prompt

    def _build_messages(self, messages: list):
        full_messages = []

        # 检查传入的消息中是否已经有system消息
        has_system = any(msg.get("role") == "system" for msg in messages)
        
        # 只有在没有system消息时才添加默认的system prompt
        if self.system_prompt and not has_system:
            full_messages.append({"role": "system", "content": self.system_prompt})

        full_messages.extend(messages)

        return full_messages


class LLMService:
    def __init__(
        self, api_key: str = None, base_url: str = None, model: str = None, user=None
    ):
        # 如果提供了用户对象，从用户配置中获取API密钥
        if user and not api_key:
            from .api_key_service import APIKeyService
            
            config = APIKeyService.get_llm_config(user)
            if config:
                api_key = config['api_key']
                base_url = config['base_url'] or base_url
                model = config['model'] or model
            else:
                raise ValueError("用户未配置LLM API密钥")
        
        # 如果仍然没有API密钥，抛出错误
        if not api_key:
            raise ValueError("未提供API密钥")
        
        self.client = OpenAICompatibelAPI(api_key, base_url or "https://api.openai.com/v1")
        self.model = model or "gpt-3.5-turbo"
        base_prompt = """
你是一个专业的旅行规划AI助手。对于每次用户输入，仅返回严格符合以下结构的JSON对象，不要输出任何其他文本。

输出JSON必须包含的字段结构：
{
"title": "行程标题",
"summary": "行程概要",
"basic_info": {
"destination": "目的地",
"start_date": "开始日期", // ISO 8601格式
"end_date": "结束日期", // ISO 8601格式
"duration_days": 天数,
"user_budget": 用户输入的预算金额, // 数字类型，必须与用户输入一致
"estimated_cost": 预计实际花费, // 数字类型，根据行程计算
"currency": "货币",
"participants": { "adults": 成人, "children": 儿童, "total": 总人数 },
"travel_pace": "节奏", // 休闲/紧凑/适中
"main_theme": "主题"
},
"preferences_used": ["偏好1", "偏好2"],
"itinerary": [
{
"day": 1,
"date": "日期",
"theme": "当日主题",
"overview": "当日概览",
"accommodation": { "name": "酒店名", "coordinates": { "latitude": 纬度, "longitude": 经度 }, "map_api_id": "id" },
"transportation": [
{ "from": "起点", "to": "终点", "route_details": { "line": "线路", "cost": 费用 }, "map_api_route_id": "route-id" }
],
"activities": [
{ "name": "活动名", "location": { "coordinates": { "latitude": 纬度, "longitude": 经度 }, "map_api_poi_id": "poi-id" }, "cost": 费用 }
],
"daily_summary": { "total_cost": 当日总花费 }
}
// 数组长度必须等于duration_days
],
"budget_breakdown": { 
"user_budget": 用户输入的预算,
"estimated_total": 预计总花费,
"accommodation": 住宿费用,
"transportation": 交通费用,
"food": 餐饮费用,
"activities": 活动费用,
"shopping": 购物费用,
"other": 其他费用,
"budget_status": "充足/紧张/超支", // 预算状态评估
"savings_tips": ["节省建议1", "节省建议2"] // 如果预算紧张时提供
}
}

⚠️ 关键规则：
仅返回JSON：不要包含任何其他文本、注释或```json标记
数据类型：
金额必须是数字（10000.00），不是字符串
日期必须是ISO 8601格式（"2025-11-15"）
坐标必须是数字（35.6945）
必填验证：
itinerary数组长度必须等于basic_info.duration_days
每个地点必须包含coordinates.latitude/longitude和map_api_xxx_id字段
地图API预备：
所有地点必须有精确经纬度
必须包含map_api_id, map_api_route_id, map_api_poi_id字段
格式：map_api_id="hotel-xxx", map_api_route_id="route-xxx", map_api_poi_id="poi-xxx"
语言：所有文本必须使用简体中文
生成策略：
天数完整性：用户要求N天，itinerary必须有N个元素
从用户输入提取：目的地、天数、预算、偏好、同行人数
推断缺失：日期用当前+7天，具体城市用主要城市（日本→东京）
地图友好：选择知名景点，使用标准交通线路名称
用户输入示例："我想去日本，5天，预算1万元，喜欢美食和动漫，带孩子"
"""
        self.client.set_system_prompt(base_prompt)

    def chat(self, messages):
        return self.client.chat(model=self.model, messages=messages)
    
    def _decrypt_key(self, encrypted_key: str) -> str:
        """解密API密钥"""
        from django.conf import settings
        from cryptography.fernet import Fernet
        
        try:
            fernet = Fernet(settings.API_KEY_ENCRYPTION_KEY)
            return fernet.decrypt(encrypted_key.encode()).decode()
        except Exception as e:
            raise ValueError(f"解密API密钥失败: {e}")
if __name__ == "__main__":
    llm = LLMService()
    messages = [{"role": "user", "content": "我想去海南，5天，预算10000，喜欢游泳和海鲜"}]
    context = llm.chat(messages)
    print(context)
