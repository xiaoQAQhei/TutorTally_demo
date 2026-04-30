# 家教账单 APP

专为家教老师设计的课程账单管理应用，支持学生管理、课程记录、收款标记和图形化账单统计。

## 快速启动

### 环境要求

- Node.js >= 16
- npm >= 8
- 手机安装 [Expo Go](https://expo.dev/client)（真机调试用）

### 安装与运行

```bash
# 1. 安装依赖
npm install

# 2. 启动开发服务器
npx expo start

# 启动后按提示操作：
#   w → 在浏览器中打开 Web 版
#   a → 连接 Android 模拟器
#   i → 连接 iOS 模拟器（仅 macOS）
#   扫码 → 手机端 Expo Go 扫码运行
```

### 各平台启动命令

| 命令 | 说明 |
|------|------|
| `npx expo start` | 启动 Metro 开发服务器（通用） |
| `npx expo start --web` | 直接启动 Web 版 |
| `npx expo start --web --clear` | 清除缓存后启动 Web（排查问题时用） |
| `npx expo start --android` | 直接启动 Android 版 |

> ⚠️ **注意**：Web 版使用内存 Mock 数据库，数据刷新后会丢失。Android/iOS 真机使用 SQLite 持久化存储。

---

## 项目架构

```
家教课程账单_demo/
├── App.tsx                      # 入口文件，指向 src/App
├── index.js                     # RN 注册入口
├── app.json                     # Expo 配置（应用名/图标/包名等）
├── package.json                 # 依赖与脚本
├── tsconfig.json                # TypeScript 配置
├── babel.config.js              # Babel 配置
├── metro.config.js              # Metro 打包器配置
├── webpack.config.js            # Web 端自定义 Webpack 配置
│
├── src/                         # 核心源码
│   ├── App.tsx                  # 主组件：导航容器 + 底部Tab + 数据库初始化
│   ├── declarations.d.ts        # TypeScript 类型声明
│   │
│   ├── models/
│   │   └── index.ts             # 数据模型定义（Student / Lesson / Payment / StudentStats）
│   │
│   ├── database/
│   │   └── index.ts             # 数据层：SQLite（真机） / Mock（Web）双模式
│   │
│   └── screens/
│       ├── HomeScreen.tsx       # 首页：概览卡片 + 快捷操作 + 最近课程列表
│       ├── StudentScreen.tsx    # 学生管理：增删改查
│       ├── LessonScreen.tsx     # 课程记录：增删改 + 收款状态切换
│       └── StatsScreen.tsx      # 账单统计：汇总表格 + 已收/待收概览
│
├── assets/                      # 静态资源（图标、启动画面）
│   ├── icon.png
│   ├── splash.png
│   ├── favicon.png
│   └── adaptive-icon.png
│
├── android/                     # Android 原生工程（Expo 自动生成）
├── ios/                         # iOS 原生工程（Expo 自动生成）
│
├── logs/                        # 日志文件夹
│   ├── README.md                # 日志规范说明
│   └── images/                  # 截图文件夹
│
└── DESIGN_PLAN.md               # UI 改造设计文档（配色/动画/组件方案）
```

---

## 技术栈

| 类别 | 技术 | 版本 |
|------|------|------|
| 框架 | React Native + Expo | ~49.0.0 |
| 语言 | TypeScript | ^5.1 |
| 导航 | @react-navigation/bottom-tabs | ^6.5.7 |
| 数据库 | expo-sqlite（真机）/ 内存Mock（Web） | ~11.3.3 |
| Web 构建 | @expo/webpack-config | ^19.0.0 |
| 图标 | @expo/vector-icons (Ionicons) | — |
| 动画 | react-native-reanimated | ~3.3.0 |

---

## 核心功能

| 页面 | 功能 |
|------|------|
| **首页** | 待收款数量 / 今日收入概览、快捷操作入口、最近课程列表 |
| **学生管理** | 添加 / 编辑 / 删除学生（姓名、科目、课时费、电话） |
| **课程记录** | 添加 / 编辑 / 删除课程，点击徽章切换已收 / 待收状态 |
| **账单统计** | 按学生汇总：课时数、总时长、应交/已交/待交金额 |

---

## 常见问题

### 页面空白 / 白屏

```bash
npx expo start --web --clear
```

### Web 端数据库不可用

Web 版使用内存 Mock 数据。SQLite 仅在 Android/iOS 真机或模拟器上可用。

### 依赖版本冲突

```bash
npx expo install --fix
```

---

## 日志规范

所有开发和问题排查日志请放在 `logs/` 文件夹中，详见 [logs/README.md](logs/README.md)。

---

## 相关文档

- [日志规范](logs/README.md)
- [UI 改造设计方案](DESIGN_PLAN.md)
