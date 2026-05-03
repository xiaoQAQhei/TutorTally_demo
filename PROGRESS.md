# 项目进程记录

> 家教课程账单应用 (React Native / Expo)
> 最后更新：2026-05-03

## 当前状态

**分支**：`better`
**编译**：`npx tsc --noEmit` 零错误
**自动化**：Stop hook 已配置（changelog 写入 + commit + push + PR 自动更新）

## 待完成

### Bug 修复
- [ ] TimeRangePicker 顶部横线拖拽交互

### 功能待开发
- [ ] 点击待付款后，是选择弹窗再次确认还是加一个变成打勾的圆再消失的动画？
- [ ] 添加课程："每周如此"批量建日程选项（优先级低）

### 下次计划

1. TimeRangePicker 顶部横线拖拽交互
2. 点击待付款确认方式（弹窗 vs 打勾动画）
3. "每周如此"批量建日程（低优先级）

## 已完成功能

### 核心架构
- [x] Expo + TypeScript 项目搭建
- [x] SQLite 数据库（expo-sqlite），带 web 端 mock 数据兜底
- [x] 底部 Tab 导航（首页 / 学生 / 课程记录 / 账单统计）
- [x] 数据模型：Student、Lesson、Payment
- [x] 30 条 mock 课程数据（含历史 + 未来 + 已确认/未确认）

### UI 体系
- [x] 主题 tokens：`src/styles/theme.ts`（Colors / FontSize / Spacing / BorderRadius / Shadows）
- [x] 动画 hooks：`src/styles/animations.ts`（useFadeIn / useBounce / useScale）
- [x] 9 个通用组件：StatCard、GradientFAB、EmptyState、BottomSheet、StatusBadge、StudentAvatar、Toast、CalendarPicker、TimeRangePicker

### 四个页面

#### HomeScreen（首页）
- [x] 问候语 + 日期 + 刷新按钮
- [x] 3 个快捷操作按钮（添加学生/记录课程/查看统计）
- [x] 待上课程改为仅显示今日待上课
- [x] 底部统计卡片：待收款总额 + 今日课程总额
- [x] 待上课卡片点击 → 跳转 LessonScreen 对应标签 + 高亮定位

#### StudentScreen（学生管理）
- [x] 学生卡片列表
- [x] BottomSheet 添加/编辑表单

#### LessonScreen（课程记录）
- [x] 四分类筛选：待上课 / 待收款 / 已收款 / 全部
- [x] CalendarPicker 日期选择器（响应式适配）
- [x] TimeRangePicker 时间段滚动选择器（时/分四列、底部弹出动画、预览栏）
- [x] 表单必填校验、点击 StatusBadge 切换收付状态
- [x] 时间段醒目显示

#### StatsScreen（账单统计）
- [x] 月份选择器（◀ 月份 ▶ 切换）
- [x] 紧凑行内统计条（学生/课时/时长/收入）
- [x] 近6月收入柱状图（react-native-gifted-charts，自适应宽度，Y轴隐藏）
- [x] 月度收款概览进度条
- [x] 学生账单卡片（彩色圆点 + 学科标签 + 合计/已收/待收）
- [x] 点击学生行 → StudentBillingDetailScreen Modal

#### StudentBillingDetailScreen（学生账单详情）
- [x] 全屏 Modal + 自定义 Header
- [x] 三列汇总 + 按月分组展示

### 自动化工具链
- [x] Stop hook：changelog 写入 + git add/commit/push + PR 自动更新
- [x] GitHub CLI 安装 + PR #1 创建
- [x] CLAUDE.md 行为规则（汇报改动、收工写进度）
- [x] 权限配置（settings.json：git/npx/gh 直接放行）

## 已知问题

- TimeRangePicker 滚动吸附在多次打开/关闭后可能失效
