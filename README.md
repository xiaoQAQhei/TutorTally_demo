# 家教账单 APP

专为家教老师设计的课程账单管理应用，支持学生管理、课程记录、收款标记、图形化账单统计和数据导出。

## 快速启动

### 环境要求

- Node.js >= 16
- npm >= 8
- Android SDK（本地打包用）

### 安装与运行

```bash
# 1. 安装依赖
npm install

# 2. 启动开发服务器
npx expo start

# 启动后按提示操作：
#   w → 在浏览器中打开 Web 版
#   a → 连接 Android 模拟器
#   扫码 → 手机端 Expo Go 扫码运行
```

### 各平台启动命令

| 命令 | 说明 |
|------|------|
| `npx expo start` | 启动 Metro 开发服务器（通用） |
| `npx expo start --web` | 直接启动 Web 版 |
| `npx expo start --android` | 直接启动 Android 版 |

### 本地打包 APK

```bash
# Debug APK（开发测试用）
cd android && ./gradlew assembleDebug
# 输出：android/app/build/outputs/apk/debug/app-debug.apk

# Release APK（发布用）
cd android && ./gradlew assembleRelease
# 输出：android/app/build/outputs/apk/release/app-release.apk
```

> ⚠️ **注意**：Web 版使用内存 Mock 数据库，数据刷新后会丢失。Android 真机使用 SQLite 持久化存储。

---

## 项目架构

```
TutorTaily_demo/
├── App.tsx                      # 入口文件，指向 src/App
├── index.js                     # RN 注册入口
├── app.json                     # Expo 配置（应用名/图标/包名等）
├── package.json                 # 依赖与脚本
├── tsconfig.json                # TypeScript 配置
├── babel.config.js              # Babel 配置
├── metro.config.js              # Metro 打包器配置
│
├── src/                         # 核心源码
│   ├── App.tsx                  # 主组件：导航容器 + 底部Tab + 数据库初始化
│   ├── declarations.d.ts        # TypeScript 类型声明
│   │
│   ├── models/
│   │   └── index.ts             # 数据模型定义
│   │
│   ├── database/
│   │   └── index.ts             # 数据层：SQLite（真机）/ Mock（Web）双模式
│   │
│   ├── screens/
│   │   ├── HomeScreen.tsx       # 首页：概览卡片 + 快捷操作 + 最近课程列表
│   │   ├── StudentScreen.tsx    # 学生管理：增删改查
│   │   ├── LessonScreen.tsx     # 课程记录：增删改 + 收款状态切换
│   │   ├── StatsScreen.tsx      # 账单统计：汇总表格 + 已收/待收概览
│   │   ├── SettingsScreen.tsx   # 设置：导出数据、周期规则管理
│   │   ├── RecurringRulesScreen.tsx  # 周期课程规则管理
│   │   └── StudentBillingDetailScreen.tsx  # 学生账单详情
│   │
│   ├── components/
│   │   ├── BottomSheet.tsx      # 底部弹出面板
│   │   ├── ExportFlowModal.tsx  # 导出流程弹窗
│   │   ├── DropdownSelect.tsx   # 下拉选择器
│   │   ├── GradientFAB.tsx      # 渐变浮动按钮
│   │   ├── StatusBadge.tsx      # 状态徽章
│   │   └── ...                  # 更多组件
│   │
│   ├── contexts/
│   │   ├── ToastContext.tsx     # Toast 全局状态
│   │   └── ActionContext.tsx    # 操作确认状态
│   │
│   ├── styles/
│   │   ├── theme.ts             # 全局主题（颜色/字体/间距）
│   │   └── animations.ts       # 通用动画 hooks
│   │
│   └── utils/
│       ├── export.ts            # Excel/PDF 导出逻辑
│       ├── responsive.ts        # 响应式适配
│       ├── animationHooks.ts    # 课程卡片专用动画
│       └── pdf.ts               # PDF 生成
│
├── assets/                      # 静态资源（图标、启动画面）
├── android/                     # Android 原生工程
├── logs/                        # 开发日志
└── scripts/                     # 工具脚本
```

---

## 技术栈

| 类别 | 技术 | 版本 |
|------|------|------|
| 框架 | React Native + Expo | ~49.0.0 |
| 语言 | TypeScript | ^5.1 |
| 导航 | @react-navigation/bottom-tabs | ^6.5.7 |
| 数据库 | expo-sqlite（真机）/ 内存Mock（Web） | ~11.3.3 |
| 图标 | @expo/vector-icons (Ionicons) | — |
| 动画 | react-native-reanimated | ~3.3.0 |
| 手势 | react-native-gesture-handler | ~2.12.0 |
| 图表 | react-native-gifted-charts | ^1.4.76 |
| 导出 | xlsx-js-style | ^1.2.0 |

---

## 核心功能

| 页面 | 功能 |
|------|------|
| **首页** | 待收款数量 / 今日收入概览、快捷操作入口、最近课程列表 |
| **学生管理** | 添加 / 编辑 / 删除学生（姓名、科目、课时费、电话） |
| **课程记录** | 添加 / 编辑 / 删除课程，支持批量操作、状态切换动画 |
| **账单统计** | 按学生汇总：课时数、总时长、应交/已交/待交金额 |
| **设置** | Excel/PDF 导出、周期课程规则管理、偏好设置 |
| **周期规则** | 自动排课：按周几、间隔周数生成课程 |

---

## 常见问题

### 页面空白 / 白屏

```bash
npx expo start --web --clear
```

### Web 端数据库不可用

Web 版使用内存 Mock 数据。SQLite 仅在 Android 真机或模拟器上可用。

### 依赖版本冲突

```bash
npx expo install --fix
```

---

## 日志规范

所有开发和问题排查日志请放在 `logs/` 文件夹中，详见 [logs/README.md](logs/README.md)。
