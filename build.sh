#!/bin/bash

# 构建脚本
set -e

echo "🚀 开始构建 Travel Planner 项目..."

# 检查 Docker 是否安装
if ! command -v docker &> /dev/null; then
    echo "❌ Docker 未安装，请先安装 Docker"
    echo "   Ubuntu/Debian: sudo apt-get install docker.io docker-compose"
    echo "   CentOS/RHEL: sudo yum install docker docker-compose"
    exit 1
fi

# 检查 Docker Compose 是否安装
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose 未安装，请先安装 Docker Compose"
    echo "   参考: https://docs.docker.com/compose/install/"
    exit 1
fi

# 检查 Docker 服务是否运行
if ! docker info &> /dev/null; then
    echo "❌ Docker 服务未运行，请启动 Docker 服务"
    echo "   sudo systemctl start docker"
    echo "   或者确保你有 Docker 权限: sudo usermod -aG docker $USER"
    exit 1
fi

# 清理旧的容器和镜像（可选）
echo "🧹 清理旧的容器和镜像..."
docker-compose down --remove-orphans 2>/dev/null || true

# 构建镜像
echo "🔨 构建 Docker 镜像..."
echo "   这可能需要几分钟时间，请耐心等待..."

if docker-compose build --no-cache; then
    echo "✅ 镜像构建成功！"
else
    echo "❌ 镜像构建失败，请检查错误信息"
    echo "💡 常见问题："
    echo "   1. 网络连接问题 - 检查网络连接"
    echo "   2. 权限问题 - 确保有 Docker 权限"
    echo "   3. 磁盘空间不足 - 清理磁盘空间"
    exit 1
fi

# 启动服务
echo "🚀 启动服务..."
if docker-compose up -d; then
    echo "✅ 服务启动成功！"
else
    echo "❌ 服务启动失败"
    echo "📋 查看日志: docker-compose logs"
    exit 1
fi

echo "⏳ 等待服务完全启动..."
sleep 20

# 检查服务状态
echo "📊 检查服务状态..."
docker-compose ps

# 检查后端健康状态
echo "🔍 检查后端服务..."
if curl -f http://localhost:8000/health/ &> /dev/null; then
    echo "✅ 后端服务正常"
else
    echo "⚠️  后端服务可能还在启动中，请稍后检查"
fi

echo ""
echo "🎉 部署完成！"
echo ""
echo "📱 访问地址："
echo "  前端: http://localhost"
echo "  后端 API: http://localhost:8000"
echo "  后端管理: http://localhost:8000/admin"
echo "  后端健康检查: http://localhost:8000/health/"
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
echo "🔧 创建管理员账户："
echo "  docker-compose exec backend .venv/bin/python manage.py createsuperuser"
echo ""