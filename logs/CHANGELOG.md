# 改动日志

记录项目所有功能改动、UI 优化和 Bug 修复。

## 格式说明

每条记录包含：
- **日期** — 改动日期
- **类型** — `feat`(新功能) / `style`(UI 样式) / `fix`(修复) / `refactor`(重构) / `docs`(文档)
- **描述** — 改了什么
- **文件** — 涉及的文件列表
- **备注** — 可选说明

---

## 2026-04-30

### 项目初始化
- **类型**: feat
- **描述**: 家教课程账单 React Native (Expo) 应用初始化
- **文件**: 全部初始文件

### 整体 UI 重新设计
- **类型**: style
- **描述**: 现代化 UI 改造，统一设计语言（主题色、间距、圆角、阴影体系），重写所有屏幕和组件
- **涉及改动**:
  - 创建主题 tokens 系统 `src/styles/theme.ts`
  - 创建动画 hooks `src/styles/animations.ts`
  - 重写全部 6 个通用组件（StatCard, GradientFAB, EmptyState, BottomSheet, StatusBadge, StudentAvatar）
  - 重写全部 4 个页面（HomeScreen, StudentScreen, LessonScreen, StatsScreen）
  - 重写 App.tsx 底部导航栏
- **文件**:
  - `src/styles/theme.ts` (新增)
  - `src/styles/animations.ts` (新增)
  - `src/components/StatCard.tsx` (新增)
  - `src/components/GradientFAB.tsx` (新增)
  - `src/components/EmptyState.tsx` (新增)
  - `src/components/BottomSheet.tsx` (新增)
  - `src/components/StatusBadge.tsx` (新增)
  - `src/components/StudentAvatar.tsx` (新增)
  - `src/screens/HomeScreen.tsx` (重写)
  - `src/screens/StudentScreen.tsx` (重写)
  - `src/screens/LessonScreen.tsx` (重写)
  - `src/screens/StatsScreen.tsx` (重写)
  - `src/App.tsx` (重写)

### LessonScreen 筛选标签改造
- **类型**: feat
- **描述**: 在课程记录页新增"待上课"筛选分类，重新排列为**待上课 → 待收款 → 已收款 → 全部**，其中待收款和已收款用 segmented control 样式框在一起
- **文件**: `src/screens/LessonScreen.tsx`
- **备注**: FilterStatus = 'upcoming' | 'unpaid' | 'paid' | 'all'

### HomeScreen 布局调整
- **类型**: style
- **描述**: 
  1. 最近课程只显示未来日期（待上课）
  2. 待上课程放到最上方，待收款总额和今日收入放到最下方
- **文件**: `src/screens/HomeScreen.tsx`

### HomeScreen 全页固定布局
- **类型**: style
- **描述**: 
  1. 首页刚好占满一屏，移除 ScrollView 整体滚动
  2. 仅"待上课程"区域用 FlatList 独立滚动
  3. 新增 3 个 mock 学生数据和 5 条未来日期课程数据
- **文件**:
  - `src/screens/HomeScreen.tsx`
  - `src/database/index.ts`
- **备注**: 新增学生王五（物理，¥180/h），mock 课程数从 4 条增至 9 条

### 账单统计板块优化
- **类型**: feat
- **描述**: 
  1. HomeScreen "今日收入" → "今日课程"（今日全部课程总额）
  2. StatsScreen 收款概览改为本月数据（本月已收/待收）
  3. 新增 StudentBillingDetailScreen：点击学生行 → 全屏 Modal，含总收入/已收/待收汇总、月度分布、详细账单
- **文件**: `src/screens/HomeScreen.tsx`, `src/screens/StatsScreen.tsx`, `src/screens/StudentBillingDetailScreen.tsx` (新增)

### 首页快捷按钮改为水平布局 + 整体紧凑化
- **类型**: style
- **描述**: 
  1. QuickActionButton 内部结构从垂直堆叠改为水平排列（图标左、文字右），节省垂直空间
  2. 图标容器 28×28、图标 size 16
  3. 整体间距系统性收紧（container padding、按钮间隙、列表项内边距、底部卡片边距）
- **文件**: `src/screens/HomeScreen.tsx`

### LessonScreen 日期选择器
- **类型**: feat
- **描述**: 日历选择器组件替代纯文本日期输入；居中弹窗式，支持月份切换、6×7 网格、今天标记、选中高亮
- **文件**:
  - `src/components/CalendarPicker.tsx` (新增)
  - `src/screens/LessonScreen.tsx`
- **备注**: 跨平台纯 RN 实现，无原生依赖

### LessonScreen 默认待上课 + 可编辑课时费
- **类型**: feat
- **描述**: 
  1. 新建课程默认日期为明天（自动待上课状态）
  2. 课时费改为可编辑 TextInput，默认 75 元/小时，选择学生后自动填充该学生单价
- **文件**: `src/screens/LessonScreen.tsx`

### 底部 Toast 提示 + 学生地址
- **类型**: feat
- **描述**: 
  1. 新增 Toast 组件，表单必填项校验失败时弹出底部提示
  2. Student 接口新增选填 address 字段，学生表单和卡片支持显示
- **文件**:
  - `src/components/Toast.tsx` (新增)
  - `src/screens/LessonScreen.tsx`
  - `src/models/index.ts`
  - `src/database/index.ts`
  - `src/screens/StudentScreen.tsx`

### Toast 提示位置调整
- **类型**: fix
- **描述**: Toast 提示从屏幕底部移到顶部（导航栏下方），确保用户可见
- **文件**: `src/screens/LessonScreen.tsx`

### StudentScreen 添加 Toast 校验提示
- **类型**: feat
- **描述**: 学生管理页添加表单校验 Toast，必填项缺失时提示"请填写学生姓名、科目和课时费"，添加/更新成功后提示
- **文件**: `src/screens/StudentScreen.tsx`

### LessonScreen 课时费加入必填校验
- **类型**: fix
- **描述**: 添加课程表单中课时费也标记为必填项，缺失时 Toast 提示
- **文件**: `src/screens/LessonScreen.tsx`
