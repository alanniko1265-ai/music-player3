# 音乐播放器

基于 **Electron + Vue 3 + TypeScript** 的第三方音乐播放器，支持 QQ音乐 和 网易云音乐 双平台。

## 功能特性

- 双平台音乐源支持（QQ音乐 / 网易云音乐）
- 扫码登录（QQ音乐 / 网易云）
- 歌曲搜索、播放、收藏
- 歌词同步显示
- 播放列表管理（创建、编辑、删除、拖拽排序）
- 播放模式切换（顺序、随机、单曲循环）
- 系统托盘控制
- 网络状态检测与提示
- 主题切换

## 技术栈

| 技术 | 说明 |
|------|------|
| Electron 28 | 桌面应用框架 |
| Vue 3 | 前端框架 |
| TypeScript | 类型安全 |
| Pinia | 状态管理 |
| Vite | 构建工具 |
| SCSS | 样式 |
| Vitest + fast-check | 测试框架 |

## 项目结构

```
├── electron/          # Electron 主进程
│   ├── main.ts        # 入口
│   ├── preload.ts     # 预加载脚本
│   └── ipc-handler.ts # IPC 通信
├── src/               # Vue 渲染进程
│   ├── components/    # 通用组件
│   ├── views/         # 页面视图
│   ├── stores/        # Pinia 状态
│   ├── services/      # 业务逻辑
│   ├── composables/   # 组合式 API
│   ├── types/         # TypeScript 类型
│   └── styles/        # 全局样式
├── electron-builder.json  # 打包配置
└── vite.config.ts         # Vite 配置
```

## 快速开始

### 环境要求

- Node.js >= 18
- npm >= 9

### 安装依赖

```bash
npm install
```

### 本地开发

```bash
npm run dev
```

### 构建

```bash
npm run build
```

构建产物在 `release/` 目录。

### 运行测试

```bash
npm test
```

## 音乐 API 服务

本项目依赖第三方 API 服务：

- **QQ音乐**：需启动本地 `QQMusicApi` 服务（端口 3300）
- **网易云音乐**：可使用公共实例或本地部署 `NeteaseCloudMusicApi`

API 地址通过 `.env` 文件配置（参考 `.env` 文件中的注释）。

## License

MIT
