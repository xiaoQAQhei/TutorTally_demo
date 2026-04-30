# 项目进程记录

> 家教课程账单应用 (React Native / Expo)
> 最后更新：2026-05-01

## 当前状态

**分支**：`modern-ui-redesign`
**编译**：`npx tsc --noEmit` 零错误
**提交**：未提交（工作区有大量未提交改动）

## 已完成功能

### 核心架构
- [x] Expo + TypeScript 项目搭建
- [x] SQLite 数据库（expo-sqlite），带 web 端 mock 数据兜底
- [x] 底部 Tab 导航（首页 / 学生 / 课程记录 / 账单统计）
- [x] 数据模型：Student、Lesson、Payment
- [x] 3 个 mock 学生 + 9 条 mock 课程数据

### UI 体系
- [x] 主题 tokens：`src/styles/theme.ts`（Colors / FontSize / Spacing / BorderRadius / Shadows）
- [x] 动画 hooks：`src/styles/animations.ts`（useFadeIn / useBounce / useScale）
- [x] 8 个通用组件：StatCard、GradientFAB、EmptyState、BottomSheet、StatusBadge、StudentAvatar、Toast、CalendarPicker

### 四个页面

#### HomeScreen（首页）
- 问候语 + 日期 + 刷新按钮
- 3 个快捷操作按钮（添加学生/记录课程/查看统计），垂直图标+文字布局
- 待上课程 FlatList（仅未来日期，独立滚动）
- 底部统计卡片：待收款总额（全局）+ 今日课程总额
- 金额统一使用 `元` 后缀

#### StudentScreen（学生管理）
- 学生卡片列表（头像、姓名、科目、单价、电话、地址）
- BottomSheet 添加/编辑表单（姓名、科目选择、课时费、电话、地址）
- 必填校验 + Toast 提示

#### LessonScreen（课程记录）
- 四分类筛选：待上课（蓝）→ 待收款（黄）/ 已收款（绿）→ 全部
- 课程卡片（头像、日期、时长、金额、备注、状态徽章）
- CalendarPicker 日期选择器
- 新增默认明天、自动填充学生单价
- 表单必填校验、点击 StatusBadge 切换收付状态

#### StatsScreen（账单统计）
- 4 个全局统计卡片（学生数/总课时/总时长/总收入）
- 本月收款概览（进度条 + 本月已收/待收）
- 学生账单汇总表格（zebra 条纹 + 待收高亮行）
- **点击学生行** → 全屏 Modal 详情页

#### StudentBillingDetailScreen（学生账单详情·新增）
- 全屏 Modal + 自定义 Header
- 三列汇总（总收入/已收款/待收款）
- 按月分组展示，含课时数、时长、金额
- 每月下展开详细账单列表

## 待办工作

### 1. 首页各按键界面合理跳转
- 三个快捷按钮目前各自导航到对应 Tab 页面
- 待讨论：是否需要带参数跳转（如"记录课程"直接打开新建表单）？

### 2. 账目详细内容板块
- StatsScreen 可扩展，或独立页面
- 方向：按月筛选、图表可视化、收款明细（Payment 表已建未用）
- 待讨论具体需求

### 3. 待上课 → 待收款的转变进程
- 当前逻辑：日期 > 今天 = 待上课，日期 ≤ 今天 = 待收款
- 状态切换靠手动点击 StatusBadge
- 待讨论：自动到期提醒？批量标记已收？过期提醒机制？

## 新增文件（未跟踪）
```
src/styles/theme.ts
src/styles/animations.ts
src/components/StatCard.tsx
src/components/GradientFAB.tsx
src/components/EmptyState.tsx
src/components/BottomSheet.tsx
src/components/StatusBadge.tsx
src/components/StudentAvatar.tsx
src/components/Toast.tsx
src/components/CalendarPicker.tsx
src/screens/StudentBillingDetailScreen.tsx
logs/CHANGELOG.md
```

## 修改文件（未提交）
```
README.md
src/App.tsx
src/database/index.ts
src/models/index.ts
src/screens/HomeScreen.tsx
src/screens/LessonScreen.tsx
src/screens/StatsScreen.tsx
src/screens/StudentScreen.tsx
```

## 下次继续注意事项
1. `npx tsc --noEmit` 确认编译通过
2. 所有改动在 `modern-ui-redesign` 分支，未提交
3. 以上 3 项待办需讨论确认方向后再动手
