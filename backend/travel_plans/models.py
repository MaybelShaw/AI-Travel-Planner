from datetime import datetime
from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone
from cryptography.fernet import Fernet
from django.conf import settings
import os


# Create your models here.
class TravelPlan(models.Model):
    STATUS_CHOICES = [
        ('draft', '草稿'),
        ('active', '进行中'),
        ('completed', '已完成'),
        ('cancelled', '已取消'),
    ]
    
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    title = models.CharField(max_length=200)  # 增加长度限制
    
    # 核心行程数据（AI一次性生成）
    itinerary = models.JSONField()  # 完整行程JSON
    
    # 费用记录（简单数组）
    expenses = models.JSONField(default=list)  # [{"amount": 350, "category": "餐饮"}]
    
    # 新增字段
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    budget_limit = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    currency = models.CharField(max_length=3, default='CNY')
    preferences = models.JSONField(default=dict, blank=True)
    voice_notes = models.JSONField(default=list, blank=True)
    sync_version = models.IntegerField(default=1)
    is_synced = models.BooleanField(default=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "旅行计划"
        verbose_name_plural = "旅行计划"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.title} ({self.user.username})"


class UserProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    travel_preferences = models.JSONField(default=dict, blank=True)
    voice_settings = models.JSONField(default=dict, blank=True)
    sync_settings = models.JSONField(default=dict, blank=True)
    last_sync = models.DateTimeField(null=True, blank=True)
    preferred_currency = models.CharField(max_length=3, default='CNY')
    preferred_language = models.CharField(max_length=10, default='zh-CN')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "用户配置"
        verbose_name_plural = "用户配置"

    def __str__(self):
        return f"{self.user.username} 的配置"


class VoiceInteraction(models.Model):
    INTENT_CHOICES = [
        ('create_plan', '创建行程'),
        ('modify_plan', '修改行程'),
        ('add_expense', '添加费用'),
        ('query_plan', '查询行程'),
        ('general', '一般对话'),
    ]
    
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    travel_plan = models.ForeignKey(TravelPlan, on_delete=models.CASCADE, null=True, blank=True)
    audio_file = models.FileField(upload_to='voice_recordings/', null=True, blank=True)
    transcription = models.TextField()
    intent = models.CharField(max_length=50, choices=INTENT_CHOICES, default='general')
    response = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    processing_time = models.FloatField(default=0.0)

    class Meta:
        verbose_name = "语音交互"
        verbose_name_plural = "语音交互"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user.username} - {self.intent} - {self.created_at.strftime('%Y-%m-%d %H:%M')}"


class ExpenseEntry(models.Model):
    CATEGORY_CHOICES = [
        ('transportation', '交通'),
        ('accommodation', '住宿'),
        ('food', '餐饮'),
        ('entertainment', '娱乐'),
        ('shopping', '购物'),
        ('other', '其他'),
    ]
    
    travel_plan = models.ForeignKey(TravelPlan, on_delete=models.CASCADE, related_name='expense_entries')
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(max_length=3, default='CNY')
    category = models.CharField(max_length=50, choices=CATEGORY_CHOICES, default='other')
    description = models.TextField()
    location = models.JSONField(null=True, blank=True)  # GPS坐标
    receipt_image = models.ImageField(upload_to='receipts/', null=True, blank=True)
    voice_note = models.FileField(upload_to='expense_notes/', null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    is_synced = models.BooleanField(default=True)

    class Meta:
        verbose_name = "费用条目"
        verbose_name_plural = "费用条目"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.travel_plan.title} - {self.category} - ¥{self.amount}"


# API密钥基础抽象模型
class BaseAPIKey(models.Model):
    """API密钥基础抽象模型"""
    
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    encrypted_key = models.TextField()  # 加密存储的API密钥
    is_active = models.BooleanField(default=True)
    is_valid = models.BooleanField(default=False)  # 密钥是否有效
    last_validated = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True

    @staticmethod
    def get_encryption_key():
        """获取加密密钥"""
        key = getattr(settings, 'API_KEY_ENCRYPTION_KEY', None)
        if not key:
            # 如果没有设置，生成一个新的密钥（仅用于开发）
            key = Fernet.generate_key()
        if isinstance(key, str):
            key = key.encode()
        return key

    def encrypt_api_key(self, api_key):
        """加密API密钥"""
        f = Fernet(self.get_encryption_key())
        self.encrypted_key = f.encrypt(api_key.encode()).decode()

    def decrypt_api_key(self):
        """解密API密钥"""
        f = Fernet(self.get_encryption_key())
        return f.decrypt(self.encrypted_key.encode()).decode()

    def set_api_key(self, api_key):
        """设置API密钥（自动加密）"""
        self.encrypt_api_key(api_key)
        self.is_valid = False  # 重置验证状态
        self.last_validated = None


class LLMAPIKey(BaseAPIKey):
    """LLM服务API密钥"""
    
    # 核心三个字段：apikey, base_url, model
    base_url = models.URLField(help_text="API基础URL，如：https://api.openai.com/v1")
    model = models.CharField(max_length=100, help_text="模型名称，如：gpt-3.5-turbo")
    
    # 可选配置字段
    max_tokens = models.IntegerField(default=2048, help_text="最大token数")
    temperature = models.FloatField(default=0.7, help_text="温度参数(0.0-2.0)")
    
    class Meta:
        verbose_name = "LLM API密钥"
        verbose_name_plural = "LLM API密钥"
        unique_together = ['user']

    def __str__(self):
        return f"{self.user.username} - LLM ({self.model})"

    @property
    def apikey(self):
        """获取API密钥（解密）"""
        return self.decrypt_api_key()

    def set_llm_config(self, apikey, base_url, model):
        """设置LLM配置的三个核心字段"""
        self.set_api_key(apikey)
        self.base_url = base_url
        self.model = model

    def validate_config(self):
        """验证LLM配置"""
        errors = []
        
        if not self.encrypted_key:
            errors.append("API Key不能为空")
            
        if not self.base_url:
            errors.append("Base URL不能为空")
        elif not self.base_url.startswith(('http://', 'https://')):
            errors.append("Base URL必须以http://或https://开头")
            
        if not self.model:
            errors.append("模型名称不能为空")
            
        if not (0.0 <= self.temperature <= 2.0):
            errors.append("温度参数必须在0.0-2.0之间")
            
        if self.max_tokens <= 0:
            errors.append("最大token数必须大于0")
            
        return errors


class VoiceAPIKey(BaseAPIKey):
    """语音识别服务API密钥"""
    
    # 核心三个字段：APPID, APISecret, APIKey
    appid = models.CharField(max_length=50, default='', help_text="科大讯飞应用ID (APPID)")
    encrypted_api_secret = models.TextField(default='', help_text="科大讯飞API Secret（加密存储）")
    
    # 可选配置字段
    language = models.CharField(
        max_length=20, 
        default='zh_cn',
        choices=[
            ('zh_cn', '中文普通话'),
            ('en_us', '英语'),
            ('zh_cantonese', '粤语'),
        ],
        help_text="识别语言"
    )
    accent = models.CharField(
        max_length=20,
        default='mandarin',
        help_text="口音设置"
    )
    
    class Meta:
        verbose_name = "语音识别 API密钥"
        verbose_name_plural = "语音识别 API密钥"
        unique_together = ['user']

    def __str__(self):
        return f"{self.user.username} - Voice ({self.language})"

    @property
    def apikey(self):
        """获取API Key（解密）"""
        return self.decrypt_api_key()

    @property
    def api_secret(self):
        """获取API Secret（解密）"""
        return self.decrypt_api_secret()

    def encrypt_api_secret(self, api_secret):
        """加密API Secret"""
        f = Fernet(self.get_encryption_key())
        self.encrypted_api_secret = f.encrypt(api_secret.encode()).decode()

    def decrypt_api_secret(self):
        """解密API Secret"""
        f = Fernet(self.get_encryption_key())
        return f.decrypt(self.encrypted_api_secret.encode()).decode()

    def set_voice_config(self, appid, api_secret, api_key):
        """设置语音识别配置的三个核心字段"""
        self.appid = appid
        self.encrypt_api_secret(api_secret)
        self.set_api_key(api_key)

    def validate_config(self):
        """验证语音识别配置"""
        errors = []
        
        if not self.appid:
            errors.append("APPID不能为空")
        elif len(self.appid) != 8:
            errors.append("APPID长度应为8位")
            
        if not self.encrypted_api_secret:
            errors.append("API Secret不能为空")
            
        if not self.encrypted_key:
            errors.append("API Key不能为空")
            
        return errors


class MapAPIKey(BaseAPIKey):
    """高德地图API密钥"""
    
    # 固定使用高德地图，不需要选择
    provider = models.CharField(
        max_length=20, 
        default='amap',
        editable=False,
        help_text="地图服务提供商（固定为高德地图）"
    )
    
    class Meta:
        verbose_name = "高德地图 API密钥"
        verbose_name_plural = "高德地图 API密钥"
        unique_together = ['user']
    
    def __str__(self):
        return f"{self.user.username} - 高德地图API"

    def __str__(self):
        return f"{self.user.username} - Maps ({self.get_provider_display()})"

    def validate_config(self):
        """验证地图服务配置"""
        errors = []
        
        if not self.provider:
            errors.append("服务提供商不能为空")
            
        if self.daily_quota <= 0:
            errors.append("每日配额必须大于0")
            
        return errors


# 保持向后兼容的UserAPIKey模型（已弃用，但保留以支持现有代码）
class UserAPIKey(models.Model):
    """用户API密钥（已弃用，请使用具体的服务密钥模型）"""
    
    SERVICE_CHOICES = [
        ('llm', 'LLM服务'),
        ('voice', '语音识别'),
        ('maps', '地图服务'),
    ]
    
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='api_keys')
    service = models.CharField(max_length=20, choices=SERVICE_CHOICES)
    encrypted_key = models.TextField()  # 加密存储的API密钥
    base_url = models.URLField(blank=True, null=True)  # API基础URL（用于LLM服务）
    model_name = models.CharField(max_length=100, blank=True, null=True)  # 模型名称（用于LLM服务）
    extra_config = models.JSONField(default=dict, blank=True)  # 额外配置信息
    is_active = models.BooleanField(default=True)
    is_valid = models.BooleanField(default=False)  # 密钥是否有效
    last_validated = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "用户API密钥（已弃用）"
        verbose_name_plural = "用户API密钥（已弃用）"
        unique_together = ['user', 'service']

    def __str__(self):
        return f"{self.user.username} - {self.service}"

    @staticmethod
    def get_encryption_key():
        """获取加密密钥"""
        key = getattr(settings, 'API_KEY_ENCRYPTION_KEY', None)
        if not key:
            # 如果没有设置，生成一个新的密钥（仅用于开发）
            key = Fernet.generate_key()
        if isinstance(key, str):
            key = key.encode()
        return key

    def encrypt_api_key(self, api_key):
        """加密API密钥"""
        f = Fernet(self.get_encryption_key())
        self.encrypted_key = f.encrypt(api_key.encode()).decode()

    def decrypt_api_key(self):
        """解密API密钥"""
        f = Fernet(self.get_encryption_key())
        return f.decrypt(self.encrypted_key.encode()).decode()

    def set_api_key(self, api_key):
        """设置API密钥（自动加密）"""
        self.encrypt_api_key(api_key)
        self.is_valid = False  # 重置验证状态
        self.last_validated = None
