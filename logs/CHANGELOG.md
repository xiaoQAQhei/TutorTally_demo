# 改动日志
## 2026-05-05 02:12 | auto: 05-05 02:12 | eas.json 
- eas.json

## 2026-05-05 02:09 | auto: 05-05 02:09 | .claude/settings.local.json 
- .claude/settings.local.json

## 2026-05-05 01:45 | auto: 05-05 01:45 | .claude/settings.local.json 
- .claude/settings.local.json


记录项目所有功能改动、UI 优化和 Bug 修复。

## 格式说明

每条记录包含：
- **日期** — 改动日期
- **类型** — `feat`(新功能) / `style`(UI 样式) / `fix`(修复) / `refactor`(重构) / `docs`(文档)
- **描述** — 改了什么
- **文件** — 涉及的文件列表
- **备注** — 可选说明

---

## 2026-05-03 23:34 StatsScreen 图表自适应 + 月份切换修复

### 图表宽度 useWindowDimensions 自适应 + key 修复换月份渲染
- **类型**: fix, style
- **描述**:
  1. 统计图表宽度改用 `useWindowDimensions` 自适应，替换硬编码的 `Dimensions.get('window')`，旋转屏幕/窗口变化时正确重渲染
  2. 饼图和柱状图组件添加 `key` 属性绑定月份，修复切换月份时图表数据不更新的问题
- **文件**:
  - `src/screens/StatsScreen.tsx`

## 2026-05-03 21:31 时间段醒目优化

### LessonScreen 默认时长 + FlatList 渲染优化
- **类型**: feat, perf
- **描述**:
  1. 新增课程弹窗默认时长设为 2 小时，减少手动输入
  2. FlatList 添加 initialNumToRender 和 windowSize 参数，优化列表渲染性能，减少滚动空白
- **文件**:
  - `src/screens/LessonScreen.tsx`

## 2026-05-03 确认下课体验 + 列表性能优化

### HomeScreen 确认下课快捷操作
- **类型**: feat
- **描述**:
  1. 首页课程列表拆分为「待确认下课」和「待上课」两个分区，已过下课时间的课程自动归入确认区
  2. 确认区课程显示红色左侧条和红色「确认下课」按钮，视觉上与蓝色待上课区分明显
  3. 点击确认按钮直接调用 confirmLesson 完成下课，无需跳转页面
  4. 确认区按日期倒序、待上课区按日期正序排列
- **文件**:
  - `src/screens/HomeScreen.tsx`

### LessonScreen 列表滚动性能优化
- **类型**: perf
- **描述**:
  1. 卡片 onLayout 测量高度，为 getItemLayout 提供精准 item 高度
  2. FlatList 启用 getItemLayout 跳过布局计算，大幅提升滚动性能
  3. initialNumToRender 渲染全部可见项，windowSize 增大到 50，减少空白闪烁
  4. onScrollToIndexFailed 加入重试机制，高亮跳转失败时自动重试
- **文件**:
  - `src/screens/LessonScreen.tsx`

### 项目文档更新
- **类型**: docs
- **描述**: CLAUDE.md、PROGRESS.md、settings 配置及改动日志同步更新
- **文件**:
  - `CLAUDE.md`
  - `PROGRESS.md`
  - `.claude/settings.local.json`
  - `logs/CHANGELOG.md`

## 2026-05-03 01:39 时间段选择器 + 课程流程完善

### TimeRangePicker 时间段选择器
- **类型**: feat
- **描述**:
  1. 创建 TimeRangePicker 组件：时/分四列滚动选择器，开始/结束时间联动
  2. 吸附优化：改用 decelerationRate=0 + 手动 scrollTo 替代 snapToInterval，精准定位
  3. 字体放大：非选中项 FontSize.h3，选中项 FontSize.h1，视觉层级分明
  4. 预览栏优化：时间范围+时长合并到同一行显示，信息密度更高
  5. 底部弹出动画：Animated.spring slide-up + 遮罩渐变，交互流畅
- **文件**:
  - `src/components/TimeRangePicker.tsx` (新增)
  - `src/components/BottomSheet.tsx`
  - `src/components/StatusBadge.tsx`
  - `src/contexts/ActionContext.tsx` (新增)

### LessonScreen 集成时间段选择 + 课程流程完善
- **类型**: feat
- **描述**:
  1. LessonScreen 集成 TimeRangePicker，课程表单支持选择时段
  2. 待上课状态可确认下课，完善课程生命周期
  3. HomeScreen 待上课点击跳转完善
- **文件**:
  - `src/screens/LessonScreen.tsx`
  - `src/screens/HomeScreen.tsx`
  - `src/database/index.ts`
  - `src/models/index.ts`
  - `src/App.tsx`

### CalendarPicker 响应式修复
- **类型**: fix
- **描述**: 使用 useWindowDimensions + maxWidth 400 限制日历宽度，适配不同屏幕尺寸
- **文件**: `src/components/CalendarPicker.tsx`

### 自动化工具链
- **类型**: feat
- **描述**:
  1. Stop hook 改为自动 git push，每轮对话结束自动提交并推送
  2. 项目指令 CLAUDE.md 完善
- **文件**:
  - `.claude/settings.local.json`
  - `CLAUDE.md`

## 2026-05-02

### Claude Code 自动化配置
- **类型**: feat
- **描述**:
  1. 配置 Stop hook，每轮对话结束后自动 `git add -A && git commit`
  2. 创建 CLAUDE.md，约束 Claude Code 行为（每轮开始汇报改动、每轮结束写日志）
  3. 日志子 agent：每轮对话结束后自动在 `logs/CHANGELOG.md` 写入人话改动记录
- **文件**:
  - `CLAUDE.md` (新增)
  - `.claude/settings.local.json` (修改，新增 Stop hook + git 权限)

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
