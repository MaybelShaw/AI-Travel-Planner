#!/bin/bash

# 本地开发环境启动脚本
set -e

echo "🚀 启动本地开发环境..."

# 检查是否在项目根目录
if [ ! -f "README.md" ] || [ ! -d "backend" ] || [ ! -d "frontend" ]; then
    echo "❌ 请在项目根目录运行此脚本"
    exit 1
fi

# 检查 Python 和 uv
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 未安装"
    exit 1
fi

if ! command -v uv &> /dev/null; then
    echo "⚠️  uv 未安装，正在安装..."
    pip install uv
fi

# 检查 Node.js 和 npm
if ! command -v node &> /dev/null; then
    echo "❌ Node.js 未安装"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    echo "❌ npm 未安装"
    exit 1
fi

echo "📦 安装后端依赖..."
cd backend/
if [ ! -d ".venv" ]; then
    echo "🔧 创建虚拟环境..."
    uv sync
fi

echo "🗄️  初始化数据库..."
source .venv/bin/activate
python manage.py makemigrations
python manage.py migrate

echo "📦 安装前端依赖..."
cd ../frontend/
if [ ! -d "node_modules" ]; then
    npm install
fi

echo ""
echo "✅ 环境准备完成！"
echo ""
echo "🚀 启动开发服务器："
echo ""
echo "1. 启动后端服务（新终端）："
echo "   cd backend/"
echo "   source .venv/bin/activate"
echo "   python manage.py runserver 0.0.0.0:8000"
echo ""
echo "2. 启动前端服务（新终端）："
echo "   cd frontend/"
echo "   npm start"
echo ""
echo "📱 访问地址："
echo "   前端: http://localhost:3000"
echo "   后端 API: http://localhost:8000"
echo "   后端管理: http://localhost:8000/admin"
echo ""
echo "🔧 创建管理员账户："
echo "   cd backend/"
echo "   source .venv/bin/activate"
echo "   python manage.py createsuperuser"
echo ""