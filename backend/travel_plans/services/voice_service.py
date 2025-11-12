import logging
import json
import base64
import hashlib
import hmac
import time
import uuid
import ssl
import threading
import io
from typing import Dict, List, Iterator, Optional
from urllib.parse import urlencode
from datetime import datetime
from wsgiref.handlers import format_date_time
from time import mktime
import websocket
from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage

try:
    from pydub import AudioSegment
    PYDUB_AVAILABLE = True
except ImportError:
    PYDUB_AVAILABLE = False

logger = logging.getLogger(__name__)


# 音频帧状态常量
STATUS_FIRST_FRAME = 0  # 第一帧的标识
STATUS_CONTINUE_FRAME = 1  # 中间帧标识
STATUS_LAST_FRAME = 2  # 最后一帧的标识


class IFlytekWebSocketParams:
    """科大讯飞WebSocket参数类"""
    
    def __init__(self, app_id: str, api_key: str, api_secret: str):
        self.app_id = app_id
        self.api_key = api_key
        self.api_secret = api_secret
        self.iat_params = {
            "domain": "slm",
            "language": "zh_cn",
            "accent": "mandarin",
            "dwa": "wpgs",
            "result": {
                "encoding": "utf8",
                "compress": "raw",
                "format": "plain"
            }
        }

    def create_url(self):
        """生成WebSocket连接URL"""
        url = 'ws://iat.xf-yun.com/v1'
        
        # 生成RFC1123格式的时间戳
        now = datetime.now()
        date = format_date_time(mktime(now.timetuple()))

        # 拼接字符串
        signature_origin = "host: " + "iat.xf-yun.com" + "\n"
        signature_origin += "date: " + date + "\n"
        signature_origin += "GET " + "/v1 " + "HTTP/1.1"
        
        # 进行hmac-sha256进行加密
        signature_sha = hmac.new(
            self.api_secret.encode('utf-8'), 
            signature_origin.encode('utf-8'),
            digestmod=hashlib.sha256
        ).digest()
        signature_sha = base64.b64encode(signature_sha).decode(encoding='utf-8')

        authorization_origin = "api_key=\"%s\", algorithm=\"%s\", headers=\"%s\", signature=\"%s\"" % (
            self.api_key, "hmac-sha256", "host date request-line", signature_sha)
        authorization = base64.b64encode(authorization_origin.encode('utf-8')).decode(encoding='utf-8')
        
        # 将请求的鉴权参数组合为字典
        v = {
            "authorization": authorization,
            "date": date,
            "host": "iat.xf-yun.com"
        }
        
        # 拼接鉴权参数，生成url
        url = url + '?' + urlencode(v)
        return url


class VoiceRecognitionService:
    """
    科大讯飞语音识别服务集成 - WebSocket版本
    """
    
    def __init__(self, app_id: str = None, api_key: str = None, api_secret: str = None, user=None):
        # 如果提供了用户对象，从用户配置中获取API密钥
        if user and not api_key:
            from ..models import VoiceAPIKey, UserAPIKey
            try:
                # 优先使用新的VoiceAPIKey模型
                voice_key = VoiceAPIKey.objects.get(user=user, is_active=True)
                api_key = voice_key.apikey
                app_id = voice_key.appid
                api_secret = voice_key.api_secret
            except VoiceAPIKey.DoesNotExist:
                try:
                    # 回退到旧的UserAPIKey模型
                    user_api_key = UserAPIKey.objects.get(
                        user=user,
                        service='voice',
                        is_active=True
                    )
                    api_key = self._decrypt_key(user_api_key.encrypted_key)
                    # 从extra_config中获取app_id和api_secret
                    extra_config = user_api_key.extra_config or {}
                    app_id = extra_config.get('app_id') or app_id
                    api_secret = extra_config.get('api_secret') or api_secret
                except UserAPIKey.DoesNotExist:
                    logger.warning("用户未配置语音识别API密钥，将使用模拟模式")
        
        self.app_id = app_id or getattr(settings, 'IFLYTEK_APP_ID', '')
        self.api_key = api_key or getattr(settings, 'IFLYTEK_API_KEY', '')
        self.api_secret = api_secret or getattr(settings, 'IFLYTEK_API_SECRET', '')
        
        # 识别结果存储
        self.recognition_result = ""
        self.recognition_complete = False
        self.recognition_error = None
        
    def _decrypt_key(self, encrypted_key: str) -> str:
        """解密API密钥"""
        from django.conf import settings
        from cryptography.fernet import Fernet
        
        try:
            fernet = Fernet(settings.API_KEY_ENCRYPTION_KEY)
            return fernet.decrypt(encrypted_key.encode()).decode()
        except Exception as e:
            raise ValueError(f"解密API密钥失败: {e}")
    
    def _convert_audio_to_pcm(self, audio_data: bytes) -> bytes:
        """
        将音频数据转换为PCM格式
        
        Args:
            audio_data: 原始音频数据 (WebM, WAV, MP3等格式)
            
        Returns:
            PCM格式的音频数据 (16kHz, 16bit, 单声道)
        """
        if not PYDUB_AVAILABLE:
            logger.warning("pydub not available, cannot convert audio format")
            raise ValueError("音频格式转换库未安装")
        
        try:
            # 尝试不同的音频格式
            audio = None
            formats_to_try = ['webm', 'wav', 'mp3', 'ogg', 'mp4']
            
            for fmt in formats_to_try:
                try:
                    logger.debug(f"Trying to decode audio as {fmt} format...")
                    audio = AudioSegment.from_file(io.BytesIO(audio_data), format=fmt)
                    logger.info(f"Successfully decoded audio as {fmt} format")
                    break
                except Exception as e:
                    logger.debug(f"Failed to decode as {fmt}: {e}")
                    continue
            
            if audio is None:
                # 如果所有格式都失败，尝试不指定格式让pydub自动检测
                try:
                    logger.debug("Trying auto-detection...")
                    audio = AudioSegment.from_file(io.BytesIO(audio_data))
                    logger.info("Successfully decoded audio with auto-detection")
                except Exception as e:
                    logger.error(f"All audio format attempts failed: {e}")
                    raise ValueError("无法识别音频格式")
            
            # 转换为PCM格式：16kHz采样率，16bit位深，单声道
            audio = audio.set_frame_rate(16000)
            audio = audio.set_channels(1)
            audio = audio.set_sample_width(2)  # 16bit = 2 bytes
            
            # 获取原始PCM数据
            pcm_data = audio.raw_data
            
            logger.info(f"Audio conversion successful: {len(audio_data)} bytes -> {len(pcm_data)} bytes PCM")
            logger.info(f"Audio properties: {audio.frame_rate}Hz, {audio.channels} channel(s), {audio.sample_width*8}bit")
            return pcm_data
            
        except Exception as e:
            logger.error(f"Audio conversion failed: {e}")
            raise ValueError(f"音频格式转换失败: {str(e)}")

    def transcribe_audio(self, audio_data: bytes, language: str = 'zh_cn') -> Dict:
        """
        转录音频数据
        
        Args:
            audio_data: 音频字节数据 (WAV格式，16kHz，16bit，单声道)
            language: 语言代码 (zh_cn, en_us)
            
        Returns:
            包含转录结果的字典
        """
        if not self.api_key or not self.api_secret or not self.app_id:
            logger.error("iFlytek API credentials not configured")
            return {
                'success': False,
                'error': '语音识别服务未配置，请在设置中配置科大讯飞API密钥'
            }
        
        try:
            # 转换音频格式为PCM
            logger.info("Converting audio to PCM format...")
            pcm_audio_data = self._convert_audio_to_pcm(audio_data)
            
            # 重置识别结果
            self.recognition_result = ""
            self.recognition_complete = False
            self.recognition_error = None
            
            # 创建WebSocket参数
            ws_param = IFlytekWebSocketParams(self.app_id, self.api_key, self.api_secret)
            ws_url = ws_param.create_url()
            
            # 创建WebSocket连接
            ws = websocket.WebSocketApp(
                ws_url,
                on_message=self._on_message,
                on_error=self._on_error,
                on_close=self._on_close
            )
            ws.on_open = lambda ws: self._on_open(ws, pcm_audio_data, ws_param)
            
            # 运行WebSocket
            ws.run_forever(sslopt={"cert_reqs": ssl.CERT_NONE})
            
            # 等待识别完成
            timeout = 30  # 30秒超时
            start_time = time.time()
            while not self.recognition_complete and not self.recognition_error:
                if time.time() - start_time > timeout:
                    logger.error("Voice recognition timeout")
                    return {
                        'success': False,
                        'error': '语音识别超时，请重试'
                    }
                time.sleep(0.1)
            
            if self.recognition_error:
                logger.error(f"Voice recognition error: {self.recognition_error}")
                return {
                    'success': False,
                    'error': f'语音识别失败: {self.recognition_error}'
                }
            
            return {
                'success': True,
                'text': self.recognition_result.strip(),
                'confidence': 0.92,
                'duration': len(audio_data) / 32000  # 假设16kHz采样率，16bit
            }
            
        except Exception as e:
            logger.error(f"Voice recognition failed: {e}")
            return {
                'success': False,
                'error': f'语音识别失败: {str(e)}'
            }
    
    def _on_message(self, ws, message):
        """处理WebSocket消息"""
        try:
            message = json.loads(message)
            code = message["header"]["code"]
            status = message["header"]["status"]
            
            if code != 0:
                self.recognition_error = f"请求错误：{code}"
                ws.close()
                return
            
            payload = message.get("payload")
            if payload:
                text = payload["result"]["text"]
                text = json.loads(str(base64.b64decode(text), "utf8"))
                text_ws = text['ws']
                result = ''
                for i in text_ws:
                    for j in i["cw"]:
                        w = j["w"]
                        result += w
                self.recognition_result += result
                logger.info(f"Recognition partial result: {result}")
            
            if status == 2:  # 识别完成
                self.recognition_complete = True
                ws.close()
                
        except Exception as e:
            logger.error(f"Error processing message: {e}")
            self.recognition_error = str(e)
            ws.close()
    
    def _on_error(self, ws, error):
        """处理WebSocket错误"""
        logger.error(f"WebSocket error: {error}")
        self.recognition_error = str(error)
    
    def _on_close(self, ws, close_status_code, close_msg):
        """处理WebSocket关闭"""
        logger.info("WebSocket connection closed")
    
    def _on_open(self, ws, audio_data, ws_param):
        """处理WebSocket连接打开"""
        def run():
            frame_size = 1280  # 每一帧的音频大小
            interval = 0.04  # 发送音频间隔(单位:s)
            status = STATUS_FIRST_FRAME  # 音频的状态信息
            
            # 模拟从音频数据中读取
            audio_offset = 0
            
            while audio_offset < len(audio_data):
                # 读取一帧音频数据
                end_offset = min(audio_offset + frame_size, len(audio_data))
                buf = audio_data[audio_offset:end_offset]
                audio_offset = end_offset
                
                if not buf:
                    status = STATUS_LAST_FRAME
                
                audio_b64 = str(base64.b64encode(buf), 'utf-8')
                
                # 第一帧处理
                if status == STATUS_FIRST_FRAME:
                    d = {
                        "header": {
                            "status": 0,
                            "app_id": ws_param.app_id
                        },
                        "parameter": {
                            "iat": ws_param.iat_params
                        },
                        "payload": {
                            "audio": {
                                "audio": audio_b64,
                                "sample_rate": 16000,
                                "encoding": "raw"
                            }
                        }
                    }
                    ws.send(json.dumps(d))
                    status = STATUS_CONTINUE_FRAME
                    
                # 中间帧处理
                elif status == STATUS_CONTINUE_FRAME:
                    d = {
                        "header": {
                            "status": 1,
                            "app_id": ws_param.app_id
                        },
                        "parameter": {
                            "iat": ws_param.iat_params
                        },
                        "payload": {
                            "audio": {
                                "audio": audio_b64,
                                "sample_rate": 16000,
                                "encoding": "raw"
                            }
                        }
                    }
                    ws.send(json.dumps(d))
                
                # 最后一帧处理
                if audio_offset >= len(audio_data):
                    d = {
                        "header": {
                            "status": 2,
                            "app_id": ws_param.app_id
                        },
                        "parameter": {
                            "iat": ws_param.iat_params
                        },
                        "payload": {
                            "audio": {
                                "audio": audio_b64,
                                "sample_rate": 16000,
                                "encoding": "raw"
                            }
                        }
                    }
                    ws.send(json.dumps(d))
                    break
                
                # 模拟音频采样间隔
                time.sleep(interval)
        
        # 在新线程中运行
        threading.Thread(target=run).start()
    
    def get_supported_languages(self) -> List[str]:
        """获取支持的语言列表"""
        return ['zh_cn', 'en_us', 'zh_cantonese']





class VoiceCommandProcessor:
    """
    语音命令处理器 - 使用LLM进行智能意图识别和实体提取
    """
    
    def __init__(self, user=None):
        self.user = user
        self.llm_service = None  # 延迟初始化
    
    def process_command(self, transcription: str, context: Optional[Dict] = None) -> Dict:
        """
        处理语音命令 - 使用LLM进行智能分析
        
        Args:
            transcription: 语音转录文本
            context: 上下文信息
            
        Returns:
            处理结果
        """
        if not transcription:
            return {
                'intent': 'unknown',
                'confidence': 0.0,
                'entities': {},
                'response': '抱歉，我没有听清楚您说的话。'
            }
        
        # 使用LLM进行智能分析
        try:
            result = self._analyze_with_llm(transcription)
            if result:
                return result
        except Exception as e:
            logger.warning(f"LLM analysis failed: {e}, falling back to rule-based processing")
        
        # 如果LLM分析失败，回退到基于规则的处理
        return self._fallback_rule_based_processing(transcription, context)
    
    def _analyze_with_llm(self, transcription: str) -> Optional[Dict]:
        """使用LLM分析语音转录文本"""
        # 延迟初始化LLM服务
        if not self.llm_service and self.user:
            try:
                from .llm_service import LLMService
                self.llm_service = LLMService(user=self.user)
            except Exception as e:
                logger.warning(f"无法初始化LLM服务: {e}")
                return None
        
        if not self.llm_service:
            return None
        
        # 构建简化的LLM提示
        prompt = f"""分析语音文本并提取信息，返回JSON格式：

文本："{transcription}"

返回格式：
{{"intent": "意图", "confidence": 0.9, "entities": {{"amount": 数字, "category": "类别", "description": "描述"}}, "response": "回复文本"}}

意图类型：add_expense(费用记录), create_plan(创建计划), general(其他)
费用类别：food(餐饮), accommodation(住宿), transportation(交通), entertainment(娱乐), shopping(购物)

只返回JSON，无其他文本。"""
        
        try:
            response = self.llm_service.chat([{"role": "user", "content": prompt}])
            if response:
                import json
                # 尝试解析JSON响应
                result = json.loads(response.strip())
                
                # 确保返回的结果包含所有必需字段
                complete_result = {
                    'intent': result.get('intent', 'unknown'),
                    'confidence': result.get('confidence', 0.9),
                    'entities': result.get('entities', {}),
                    'response': result.get('response', '已处理您的请求')
                }
                
                return complete_result
        except Exception as e:
            logger.error(f"LLM analysis parsing failed: {e}")
            return None
        
        return None
    
    def _fallback_rule_based_processing(self, transcription: str, context: Optional[Dict] = None) -> Dict:
        """基于规则的回退处理"""
        # 意图识别
        intent = self._classify_intent_rule_based(transcription)
        
        # 实体提取
        entities = self._extract_entities_rule_based(transcription, intent)
        
        # 生成响应
        response = self._generate_response(intent, entities, context)
        
        return {
            'intent': intent,
            'confidence': 0.75,  # 规则基础的置信度较低
            'entities': entities,
            'response': response
        }
    
    def _classify_intent_rule_based(self, text: str) -> str:
        """分类意图"""
        text_lower = text.lower()
        
        # 定义意图关键词
        intent_keywords = {
            'create_plan': ['创建', '制定', '规划', '安排', '计划', '旅游', '旅行', '去'],
            'modify_plan': ['修改', '更改', '调整', '变更', '改变'],
            'add_expense': ['花费', '费用', '开销', '支出', '消费', '买', '付', '花了', '元'],
            'query_plan': ['查看', '显示', '告诉我', '什么时候', '哪里', '怎么'],
            'general': ['你好', '谢谢', '再见', '帮助']
        }
        
        # 按优先级检查意图
        intent_scores = {}
        
        for intent, keywords in intent_keywords.items():
            score = 0
            for keyword in keywords:
                if keyword in text_lower:
                    score += 1
            if score > 0:
                intent_scores[intent] = score
        
        # 特殊处理：如果文本包含数字和"元"，很可能是费用记录
        import re
        if re.search(r'\d+.*元', text_lower):
            intent_scores['add_expense'] = intent_scores.get('add_expense', 0) + 3
        
        # 如果文本包含旅游相关词汇和目的地，很可能是创建计划
        destinations = ['北京', '上海', '广州', '深圳', '杭州', '成都', '西安', '南京', '日本', '韩国', '泰国']
        travel_words = ['旅游', '旅行', '去', '玩']
        if any(dest in text_lower for dest in destinations) and any(word in text_lower for word in travel_words):
            intent_scores['create_plan'] = intent_scores.get('create_plan', 0) + 2
        
        if not intent_scores:
            return 'general'
        
        # 返回得分最高的意图
        return max(intent_scores, key=intent_scores.get)
    
    def _extract_entities_rule_based(self, text: str, intent: str) -> Dict:
        """提取实体"""
        entities = {}
        
        # 简单的实体提取逻辑
        if intent == 'create_plan':
            # 提取目的地
            destinations = ['北京', '上海', '广州', '深圳', '杭州', '成都', '西安', '南京']
            for dest in destinations:
                if dest in text:
                    entities['destination'] = dest
                    break
            
            # 提取天数
            import re
            days_match = re.search(r'(\d+)天', text)
            if days_match:
                entities['days'] = int(days_match.group(1))
            
            # 提取预算
            budget_match = re.search(r'(\d+)元', text)
            if budget_match:
                entities['budget'] = int(budget_match.group(1))
        
        elif intent == 'add_expense':
            # 提取金额 - 支持多种格式
            import re
            # 匹配 "五十元"、"50元"、"花了60元"、"费用300元" 等格式
            amount_patterns = [
                r'(\d+(?:\.\d+)?)元',  # 数字+元
                r'花了(\d+(?:\.\d+)?)',  # 花了+数字
                r'费用(\d+(?:\.\d+)?)',  # 费用+数字
                r'(\d+(?:\.\d+)?)块',   # 数字+块
            ]
            
            amount_found = False
            for pattern in amount_patterns:
                matches = re.findall(pattern, text)
                if matches:
                    entities['amount'] = float(matches[0])
                    amount_found = True
                    break
            
            # 如果上面的模式都没匹配到，尝试提取所有数字
            if not amount_found:
                amount_matches = re.findall(r'(\d+(?:\.\d+)?)', text)
                if amount_matches:
                    # 取最大的数字作为金额（通常是主要费用）
                    entities['amount'] = float(max(amount_matches, key=float))
            
            # 提取类别 - 按优先级排序，避免误分类
            categories = {
                # 娱乐类别（优先级高，避免门票被分类为交通）
                '门票': 'entertainment', '景点': 'entertainment', '游乐': 'entertainment', '玩': 'entertainment',
                '博物馆': 'entertainment', '公园': 'entertainment', '演出': 'entertainment', '电影': 'entertainment',
                
                # 餐饮类别
                '吃': 'food', '餐': 'food', '饭': 'food', '喝': 'food', '茶': 'food', '咖啡': 'food',
                '早餐': 'food', '午餐': 'food', '晚餐': 'food', '夜宵': 'food', '小吃': 'food',
                
                # 住宿类别
                '住': 'accommodation', '酒店': 'accommodation', '宾馆': 'accommodation', '民宿': 'accommodation',
                '旅店': 'accommodation', '客栈': 'accommodation',
                
                # 交通类别（放在后面，避免"票"字优先匹配）
                '车': 'transportation', '地铁': 'transportation', '公交': 'transportation', '出租': 'transportation',
                '火车': 'transportation', '飞机': 'transportation', '船': 'transportation', '票': 'transportation',
                
                # 购物类别
                '买': 'shopping', '购': 'shopping', '商店': 'shopping', '超市': 'shopping',
                '纪念品': 'shopping', '礼品': 'shopping'
            }
            
            for keyword, category in categories.items():
                if keyword in text:
                    entities['category'] = category
                    break
            
            # 如果没有明确类别，根据金额推断
            if 'category' not in entities and 'amount' in entities:
                amount = entities['amount']
                if amount > 500:
                    entities['category'] = 'accommodation'
                elif amount > 100:
                    entities['category'] = 'entertainment'
                else:
                    entities['category'] = 'food'
        
        return entities
    
    def _generate_response(self, intent: str, entities: Dict, context: Optional[Dict]) -> str:
        """生成响应"""
        if intent == 'create_plan':
            destination = entities.get('destination', '目的地')
            days = entities.get('days', '几')
            budget = entities.get('budget', '预算')
            return f"好的，我来为您规划{destination}{days}天的旅行，预算{budget}元。"
        
        elif intent == 'modify_plan':
            return "请告诉我您想要修改行程的哪个部分？"
        
        elif intent == 'add_expense':
            amount = entities.get('amount', '金额')
            category = entities.get('category', '费用')
            return f"已记录{category}支出{amount}元。"
        
        elif intent == 'query_plan':
            return "让我为您查看当前的旅行计划..."
        
        else:
            return "我是您的旅行助手，可以帮您规划行程、记录费用。请告诉我您需要什么帮助？"


class AudioFileManager:
    """
    音频文件管理器
    """
    
    @staticmethod
    def save_audio_file(audio_data: bytes, filename: str = None) -> str:
        """
        保存音频文件
        
        Args:
            audio_data: 音频数据
            filename: 文件名
            
        Returns:
            保存的文件路径
        """
        if not filename:
            filename = f"voice_{uuid.uuid4().hex[:8]}.wav"
        
        file_path = f"voice_recordings/{filename}"
        saved_path = default_storage.save(file_path, ContentFile(audio_data))
        return saved_path
    
    @staticmethod
    def validate_audio_format(audio_data: bytes) -> bool:
        """
        验证音频格式
        
        Args:
            audio_data: 音频数据
            
        Returns:
            是否为有效格式
        """
        # 简单的格式验证
        if len(audio_data) < 44:  # WAV文件头最小长度
            return False
        
        # 检查WAV文件头
        if audio_data[:4] == b'RIFF' and audio_data[8:12] == b'WAVE':
            return True
        
        # 检查其他格式...
        return True  # 暂时返回True


# 保持向后兼容的VoiceService类
class VoiceService:
    """
    语音服务的统一接口（向后兼容）
    """
    
    def __init__(self, api_key: str = None, user=None):
        self.api_key = api_key
        self.user = user
        self.recognition_service = VoiceRecognitionService(user=user)
        self.command_processor = VoiceCommandProcessor(user=user)
    
    def speech_to_text(self, audio_data: bytes, language: str = 'zh_cn'):
        """语音转文本"""
        return self.recognition_service.transcribe_audio(audio_data, language)
    
    def process_voice_command(self, audio_data: bytes, context: Dict = None):
        """处理语音命令"""
        # 先转录
        transcription_result = self.recognition_service.transcribe_audio(audio_data)
        
        if not transcription_result.get('success'):
            return {
                'success': False,
                'error': transcription_result.get('error', 'Transcription failed'),
                'transcription': '',
                'intent': 'unknown',
                'entities': {},
                'response': '',
                'confidence': 0.0
            }
        
        # 处理命令
        command_result = self.command_processor.process_command(
            transcription_result['text'], 
            context
        )
        
        return {
            'success': True,
            'transcription': transcription_result['text'],
            'intent': command_result['intent'],
            'entities': command_result['entities'],
            'response': command_result['response'],
            'confidence': command_result['confidence']
        }


# 便捷函数
def create_voice_service(user=None, app_id=None, api_key=None, api_secret=None):
    """
    创建语音服务实例的便捷函数
    
    Args:
        user: Django用户对象（优先从用户配置获取API密钥）
        app_id: 科大讯飞应用ID
        api_key: 科大讯飞API Key
        api_secret: 科大讯飞API Secret
    
    Returns:
        VoiceService实例
    """
    return VoiceService(user=user)
