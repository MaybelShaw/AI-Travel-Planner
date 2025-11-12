#!/bin/bash

# 构建脚本
set -e

echo "🚀 开始构建 Travel Planner 项目..."

# 检查 Docker 是否安装
if ! command -v docker &> /dev/null; then
    echo "❌ Docker 未安装，请先安装 Docker"
    exit 1
fi

# 检查 Docker Compose 是否安装
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose 未安装，请先安装 Docker Compose"
    exit 1
fi

# 清理旧的容器和镜像（可选）
echo "🧹 清理旧的容器和镜像..."
docker-compose down --remove-orphans 2>/dev/null || true

# 构建镜像
echo "🔨 构建 Docker 镜像..."
docker-compose build --no-cache

echo "✅ 构建完成！"

# 启动服务
echo "🚀 启动服务..."
docker-compose up -d

echo "⏳ 等待服务启动..."
sleep 15

# 检查服务状态
echo "📊 检查服务状态..."
docker-compose ps

echo ""
echo "🎉 部署完成！"
echo ""
echo "📱 访问地址："
echo "  前端: http://localhost"
echo "  后端 API: http://localhost:8000"
echo "  后端管理: http://localhost:8000/admin"
echo ""
echo "🗄️ 数据库信息："
echo "  类型: SQLite"
echo "  文件: /app/db.sqlite3 (容器内)"
echo ""
echo "📝 常用命令："
echo "  查看日志: docker-compose logs -f"
echo "  停止服务: docker-compose down"
echo "  重启服务: docker-compose restart"
echo "  进入后端容器: docker-compose exec backend bash"
echo "  查看后端日志: docker-compose logs -f backend"
echo "  查看前端日志: docker-compose logs -f frontend"
echo ""