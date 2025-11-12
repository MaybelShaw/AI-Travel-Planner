"""
健康检查视图
"""
from django.http import JsonResponse
from django.db import connection
from django.core.cache import cache
import logging

logger = logging.getLogger(__name__)

def health_check(request):
    """
    健康检查端点
    检查数据库连接和基本服务状态
    """
    try:
        # 检查数据库连接
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            db_status = "healthy"
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        db_status = "unhealthy"
    
    # 检查缓存（如果配置了Redis）
    try:
        cache.set('health_check', 'ok', 10)
        cache_result = cache.get('health_check')
        cache_status = "healthy" if cache_result == 'ok' else "unhealthy"
    except Exception as e:
        logger.warning(f"Cache health check failed: {e}")
        cache_status = "unavailable"
    
    # 整体状态
    overall_status = "healthy" if db_status == "healthy" else "unhealthy"
    
    response_data = {
        "status": overall_status,
        "database": db_status,
        "cache": cache_status,
        "timestamp": "2024-12-07T10:00:00Z"  # 可以使用 timezone.now()
    }
    
    status_code = 200 if overall_status == "healthy" else 503
    
    return JsonResponse(response_data, status=status_code)