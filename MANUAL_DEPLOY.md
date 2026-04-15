# 手动部署 / Manual Deployment

无 Docker 的裸机部署方式，适合单服务器自托管或需要精细控制的场景。
假设目标系统为 Ubuntu 22.04 / 24.04，其他发行版命令略有差异。

Bare-metal deployment without Docker, suitable for single-host
self-hosting. Instructions target Ubuntu 22.04 / 24.04.

---

## 1. 系统依赖 / System Dependencies

```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 基础工具
sudo apt install -y git curl build-essential nginx certbot python3-certbot-nginx

# PostgreSQL 16
sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable --now postgresql

# Redis 7
sudo apt install -y redis-server
sudo systemctl enable --now redis-server

# Go 1.26+（系统包通常过旧，建议官方安装）
curl -LO https://go.dev/dl/go1.26.1.linux-amd64.tar.gz
sudo rm -rf /usr/local/go
sudo tar -C /usr/local -xzf go1.26.1.linux-amd64.tar.gz
rm go1.26.1.linux-amd64.tar.gz
echo 'export PATH=$PATH:/usr/local/go/bin' | sudo tee /etc/profile.d/go.sh
export PATH=$PATH:/usr/local/go/bin
go version   # 确认 1.26+

# Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v      # v20.x
```

---

## 2. 专用系统用户 / Service User

所有进程以非 root 身份运行。Run everything as a dedicated non-root user.

```bash
sudo useradd --system --create-home --shell /bin/bash redup
sudo mkdir -p /srv/redup
sudo chown redup:redup /srv/redup
```

---

## 3. 数据库初始化 / Database Setup

```bash
sudo -u postgres psql <<'SQL'
CREATE USER redup WITH PASSWORD '这里替换成强密码';
CREATE DATABASE redup OWNER redup;
GRANT ALL PRIVILEGES ON DATABASE redup TO redup;
SQL
```

首次启动时 `GORM AutoMigrate` 会自动建表，无需手动 migrate。

On first boot `GORM AutoMigrate` creates all tables automatically.

### Redis（可选：设置密码）

生产环境建议给 Redis 加密码：

```bash
sudo sed -i 's/^# requirepass .*/requirepass 这里替换成强密码/' /etc/redis/redis.conf
sudo systemctl restart redis-server
```

之后后端配置里的 `REDIS_URL` 写成 `redis://:<密码>@127.0.0.1:6379/0`。

---

## 4. 拉取源码 / Clone Source

```bash
sudo -u redup -i
cd /srv/redup
git clone git@github.com:Zeroshcat/Redup.sh.git .
# 或 https：git clone https://github.com/Zeroshcat/Redup.sh.git .
```

---

## 5. 构建后端 / Build Backend

```bash
cd /srv/redup/backend

# 环境配置
cp .env.example .env
vi .env
# 必改项：
#   DATABASE_URL=postgres://redup:密码@127.0.0.1:5432/redup?sslmode=disable
#   REDIS_URL=redis://:密码@127.0.0.1:6379/0
#   JWT_ACCESS_SECRET / JWT_REFRESH_SECRET（openssl rand -hex 32 生成两份）
#   CORS_ALLOW_ORIGIN=https://你的域名
#   GIN_MODE=release
#   LOG_FORMAT=json

# 编译静态二进制
CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o bin/server ./cmd/server
ls -lh bin/server   # 几 MB
```

---

## 6. 构建前端 / Build Frontend

```bash
cd /srv/redup/frontend

# 环境配置
echo "NEXT_PUBLIC_API_URL=https://你的域名" > .env.production

npm ci
npm run build
```

`next.config.ts` 已开启 `output: 'standalone'`，构建产物在 `frontend/.next/standalone/`，启动入口是 `server.js`。

The standalone output lives at `frontend/.next/standalone/`. Static
assets need to be copied alongside it because standalone doesn't pull
them automatically:

```bash
# 把 .next/static 和 public/ 复制到 standalone 旁边，否则静态资源 404
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public
```

---

## 7. systemd 服务单元 / systemd Units

### 7.1 后端

`/etc/systemd/system/redup-backend.service`：

```ini
[Unit]
Description=Redup backend (Go + Gin)
After=network-online.target postgresql.service redis-server.service
Wants=network-online.target
Requires=postgresql.service redis-server.service

[Service]
Type=simple
User=redup
Group=redup
WorkingDirectory=/srv/redup/backend
EnvironmentFile=/srv/redup/backend/.env
ExecStart=/srv/redup/backend/bin/server
Restart=on-failure
RestartSec=3
# 优雅关闭：后端自带 SIGTERM 处理，最多等 30s 排空在飞请求
KillSignal=SIGTERM
TimeoutStopSec=35
# 基本加固
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/srv/redup/backend

[Install]
WantedBy=multi-user.target
```

### 7.2 前端

`/etc/systemd/system/redup-frontend.service`：

```ini
[Unit]
Description=Redup frontend (Next.js standalone)
After=network-online.target redup-backend.service
Wants=network-online.target

[Service]
Type=simple
User=redup
Group=redup
WorkingDirectory=/srv/redup/frontend/.next/standalone
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=HOSTNAME=127.0.0.1
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=3
KillSignal=SIGTERM
TimeoutStopSec=15
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadOnlyPaths=/srv/redup/frontend

[Install]
WantedBy=multi-user.target
```

### 7.3 启动并开机自启

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now redup-backend redup-frontend
sudo systemctl status redup-backend redup-frontend

# 看日志
sudo journalctl -u redup-backend -f
sudo journalctl -u redup-frontend -f
```

---

## 8. nginx 反向代理 + TLS

`/etc/nginx/sites-available/redup`：

```nginx
upstream redup_backend  { server 127.0.0.1:8080; }
upstream redup_frontend { server 127.0.0.1:3000; }

server {
    listen 80;
    server_name your.domain.com;
    # Let's Encrypt challenge
    location /.well-known/acme-challenge/ { root /var/www/html; }
    location / { return 301 https://$host$request_uri; }
}

server {
    listen 443 ssl http2;
    server_name your.domain.com;

    # ssl_certificate / ssl_certificate_key will be written by certbot

    # 请求体 1MB，与后端 BodyLimit 中间件保持一致
    client_max_body_size 1m;

    # 前端
    location / {
        proxy_pass http://redup_frontend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For  $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # 后端 API
    location /api/ {
        proxy_pass http://redup_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For  $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Real-IP $remote_addr;

        # SSE 流：禁用缓冲，超长读超时
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 3600s;
    }

    # 健康探针
    location = /healthz { proxy_pass http://redup_backend/healthz; }
    location = /readyz  { proxy_pass http://redup_backend/readyz;  }

    # Prometheus 指标：仅允许内网抓取
    location = /metrics {
        allow 10.0.0.0/8;
        allow 172.16.0.0/12;
        allow 192.168.0.0/16;
        deny all;
        proxy_pass http://redup_backend/metrics;
    }
}
```

启用 + 签 TLS：

```bash
sudo ln -s /etc/nginx/sites-available/redup /etc/nginx/sites-enabled/redup
sudo nginx -t
sudo systemctl reload nginx

# Let's Encrypt（把 your.domain.com 换成真实域名）
sudo certbot --nginx -d your.domain.com
```

certbot 会自动改 nginx 配置并注入证书。续期由 certbot 自带 timer 处理。

---

## 9. 第一个管理员 / First Admin

第一个完成注册的账号会被自动提升为 admin。用浏览器访问 `https://your.domain.com`，注册完直接进 `/admin`。

The first account to register is auto-promoted to admin. Open
`https://your.domain.com`, register, then visit `/admin`.

---

## 10. 数据备份 / Backup

### Postgres

```bash
# 手动一次
sudo -u postgres pg_dump redup | gzip > /var/backups/redup-$(date +%F).sql.gz

# 每日 cron：/etc/cron.daily/redup-backup
#!/bin/bash
set -e
mkdir -p /var/backups/redup
sudo -u postgres pg_dump redup | gzip > /var/backups/redup/redup-$(date +\%F).sql.gz
find /var/backups/redup -name 'redup-*.sql.gz' -mtime +14 -delete
```

建议再把 `/var/backups/redup/` rsync/rclone 到异机或对象存储，避免单机故障全丢。

### Redis

Redis 只承载 rate-limit / JWT 吊销 / 登录失败计数这类短期状态，**无需备份**——全部丢失只会造成一次性：所有登出的 token 可在剩余 TTL 内再次使用、已生效的限流计数重置。可以接受。

Redis only carries short-lived state (rate limit, JWT revocation,
login-failure counters). Losing it all is acceptable.

---

## 11. 更新部署 / Update

```bash
sudo -u redup -i
cd /srv/redup
git pull

# 后端重新构建 + 重启
cd backend
CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o bin/server ./cmd/server
exit
sudo systemctl restart redup-backend

# 前端重新构建 + 重启
sudo -u redup -i
cd /srv/redup/frontend
npm ci
npm run build
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public
exit
sudo systemctl restart redup-frontend
```

后端自带优雅关闭，`systemctl restart` 会给 30 秒排空在飞请求才真正杀掉进程。

---

## 12. 常见故障 / Troubleshooting

| 现象 | 排查顺序 |
|---|---|
| 502 Bad Gateway | `systemctl status redup-backend redup-frontend` → `journalctl -u redup-backend -n 200` |
| 502 只在前端，API 正常 | 前端 standalone 少拷了 `static/` 或 `public/`，重新执行第 6 步末尾的 `cp` |
| 登录接口 429 | 被登录失败锁住了，15 分钟后自动解 |
| SSE 事件不推 | nginx 少了 `proxy_buffering off` 和 `proxy_read_timeout` |
| AutoMigrate 失败 | 数据库账号无建表权限，重跑第 3 步的 GRANT |
| GIN_MODE 还是 debug | 检查 `/srv/redup/backend/.env` 是否写了 `GIN_MODE=release`，然后 `systemctl restart redup-backend` |

---

## 与 Docker 部署的区别

- **优势**：资源更省、依赖版本可单独控制、日志走 journald 统一管理
- **劣势**：Node 和 Go 版本升级要手动处理、多机扩容需要自己写脚本
- **适用**：单机 / 小规模自托管、对运维节奏有完全掌控需求的场景

大规模或多机建议回归 `DEPLOY.md` 里的 Docker Compose 方案。
