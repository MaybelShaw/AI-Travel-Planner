# Travel Planner - 旅行规划系统

一个基于 Django + React 的旅行规划系统，支持本地开发和 Docker 容器化部署。

## 演示视频

<video controls src="演示视频.mp4" title="Title"></video>

## 项目结构

```
travel-planner/
├── backend/                 # Django 后端
│   ├── backend/            # 项目配置
│   ├── users/              # 用户模块
│   ├── travel_plans/       # 旅行计划模块
│   ├── manage.py
│   └── pyproject.toml
├── frontend/               # React 前端
│   ├── src/
│   ├── public/
│   └── package.json
├── Dockerfile.backend      # 后端 Docker 配置
├── Dockerfile.frontend     # 前端 Docker 配置
├── docker-compose.yml      # Docker 部署配置
├── nginx.conf             # Nginx 配置
└── build.sh               # Docker 构建脚本
```

## 快速开始

### 本地开发

#### 一键启动开发环境
```bash
chmod +x start-dev.sh
./start-dev.sh
```

#### 手动启动

**后端开发**
```bash
cd backend/
pip install uv
uv sync
source .venv/bin/activate
python manage.py makemigrations
python manage.py migrate
python manage.py runserver 0.0.0.0:8000
```

**前端开发**
```bash
cd frontend/
npm install
npm start
```

#### 访问地址
- 前端: http://localhost:3000
- 后端 API: http://localhost:8000
- 后端管理: http://localhost:8000/admin

### Docker 部署

1. **克隆项目**
   ```bash
   git clone <repository-url>
   cd travel-planner
   ```

2. **一键构建和部署**
   ```bash
   chmod +x build.sh
   ./build.sh
   # 因为网络原因，虽然使用了国内源和代理，自己无法构建image(构建了很久很久没完成)
   ```

3. **访问应用**
   - 前端: http://localhost
   - 后端 API: http://localhost:8000
   - 后端管理: http://localhost:8000/admin

## 技术栈

### 后端
- **框架**: Django 5.2.8
- **数据库**: SQLite (容器化)
- **API**: Django REST Framework
- **认证**: JWT (Simple JWT)
- **包管理**: uv
- **部署**: Gunicorn

### 前端
- **框架**: React 19.2.0
- **语言**: TypeScript
- **UI 库**: Material-UI
- **地图**: Leaflet + React-Leaflet
- **图表**: Recharts
- **HTTP 客户端**: Axios

### 基础设施
- **容器化**: Docker + Docker Compose
- **Web 服务器**: Nginx
- **镜像源**: 阿里云镜像 (中国大陆优化)

## Docker 配置说明

### 镜像源优化
项目使用中国大陆镜像源以提高构建速度：
- Python: 阿里云 PyPI 镜像
- Node.js: npmmirror 镜像
- Alpine: 阿里云镜像

### 数据持久化
- SQLite 数据库文件通过 Docker Volume 持久化
- 静态文件和媒体文件独立存储

## 常用命令

### Docker 操作
```bash
# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f
docker-compose logs -f backend
docker-compose logs -f frontend

# 停止服务
docker-compose down

# 重启服务
docker-compose restart

# 重新构建
docker-compose build --no-cache
```

### 进入容器
```bash
# 进入后端容器
docker-compose exec backend bash

# 进入前端容器
docker-compose exec frontend sh
```

### Django 管理（Docker 环境）
```bash
# 在后端容器中执行 Django 命令
docker-compose exec backend .venv/bin/python manage.py createsuperuser
docker-compose exec backend .venv/bin/python manage.py makemigrations
docker-compose exec backend .venv/bin/python manage.py migrate
```

## 环境变量

主要环境变量配置：

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| DEBUG | False | 调试模式 |
| SECRET_KEY | - | Django 密钥 |
| ALLOWED_HOSTS | localhost,127.0.0.1 | 允许的主机 |
| CORS_ALLOWED_ORIGINS | http://localhost:3000 | CORS 允许的源 |

## 开发指南

### 环境要求
- Python 3.12+
- Node.js 18+
- uv (Python 包管理器)

### 初始化项目

#### 后端初始化
```bash
cd backend/
pip install uv
uv sync
source .venv/bin/activate
python manage.py makemigrations
python manage.py migrate
python manage.py createsuperuser  # 创建管理员账户
```

#### 前端初始化
```bash
cd frontend/
npm install
```

### 日常开发

#### 启动后端服务
```bash
cd backend/
source .venv/bin/activate
python manage.py runserver 0.0.0.0:8000
```

#### 启动前端服务
```bash
cd frontend/
npm start
```

### 添加新功能
1. **后端**：在 `backend/` 目录下创建新的 Django 应用
2. **前端**：在 `frontend/src/` 目录下添加新组件

### 数据库操作
```bash
# 生成迁移文件
python manage.py makemigrations

# 执行迁移
python manage.py migrate

# 创建超级用户
python manage.py createsuperuser
```

## 部署注意事项

### 生产环境
1. 修改 `SECRET_KEY` 为安全的随机字符串
2. 设置 `DEBUG=False`
3. 配置适当的 `ALLOWED_HOSTS`
4. 考虑使用外部数据库（如 PostgreSQL）

### 安全建议
- 定期更新依赖包
- 使用 HTTPS
- 配置防火墙
- 定期备份数据

## 故障排除

### 常见问题
1. **端口冲突**: 修改 docker-compose.yml 中的端口映射
2. **权限问题**: 确保 Docker 有足够权限
3. **构建失败**: 检查网络连接和镜像源

### 日志查看
```bash
# 查看所有服务日志
docker-compose logs

# 查看特定服务日志
docker-compose logs backend
docker-compose logs frontend
```

## 许可证

[添加许可证信息]

## 贡献

欢迎提交 Issue 和 Pull Request！