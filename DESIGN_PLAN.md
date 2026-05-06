# 家教课程账单 - 现代化 UI 改造方案

> 最后更新: 2026-05-06
> 关联规格: [离线增强版设计规格](docs/superpowers/specs/2026-05-06-offline-enhanced-design.md)

## 一、当前状态

### 已完成

| ✅ 项目 | 说明 |
|---------|------|
| 核心架构 | Expo + TypeScript + SQLite + 4 Tab 导航 |
| 主题系统 | `src/styles/theme.ts` — Colors / FontSize / Spacing / BorderRadius / Shadows |
| 动画 hooks | `src/styles/animations.ts` — useFadeIn / useBounce / useScale |
| 通用组件 | StatCard, GradientFAB, EmptyState, BottomSheet, StatusBadge, StudentAvatar, Toast, CalendarPicker, TimeRangePicker |
| 四页面 | HomeScreen, StudentScreen, LessonScreen, StatsScreen |
| 学生账单详情 | StudentBillingDetailScreen (全屏 Modal) |
| 自动化 | Stop hook: changelog + commit + push + PR 自动更新 |

### 待做（按优先级）

| 优先级 | 模块 | 设计要点 |
|--------|------|---------|
| **P0** | 数据模型迁移 | 旧数据无损升级 |
| **P0** | Excel 导出/导入 | 新建设置页，选择维度 UI |
| **P1** | 学生多科目 | StudentSubject 表 + 表单 UI |
| **P1** | Lesson 四态流转 | StatusBadge 扩展，状态切换按钮 |
| **P1** | 手动金额 + 部分付款 | Payment 表 UI + 收款进度条 |
| **P1** | PDF 账单 | 学生/月份选择 → 渲染 → 分享 |
| **P2** | 周期规则 | 周期课表单 + 排除日期 + 自动生成 |
| **P2** | 本地提醒通知 | expo-notifications 本地调度 |
| **P2** | 时薪变更记录 | RateHistory 表 + 调价 UI |
| **P2** | 科目颜色系统 | 每科目颜色 → 日历/列表统一使用 |

---

## 二、全局设计系统

### 2.1 色彩体系

```
主色调（Primary）：
  主色:      #5B8DEF  (柔和蓝紫)
  深色:      #3D6FD9
  浅色:      #E8F0FE

辅助色（Accent）：
  暖橙:      #FF8C6B  (用于CTA按钮、重要提示)
  薄荷绿:    #4ECDC4  (用于收入、已完成状态)
  暖黄:      #FFD93D  (用于待处理、提醒)

功能色：
  成功/已收:  #34C759
  警告/待收:  #FF9500
  错误/删除:  #FF3B6E
  取消:       #8E8E93

科目颜色（默认 8 色）：
  数学: #5B8DEF, 英语: #FF8C6B, 物理: #FF9500, 化学: #4ECDC4
  生物: #34C759, 语文: #FF3B6E, 历史: #AF52DE, 其他: #8E8E93

中性色：
  背景:       #F2F4F8
  卡片:       #FFFFFF
  标题:       #1A1A2E
  正文:       #4A4A6A
  辅助文字:   #9A9AB0
  分割线:     #EEEEF2
```

### 2.2 排版规范

| 层级 | 字号 | 字重 | 用途 |
|------|------|------|------|
| H1 | 28px | Bold (700) | 页面大标题 |
| H2 | 22px | Bold (700) | 区块标题 |
| H3 | 18px | SemiBold (600) | 卡片标题 |
| Body | 15px | Regular (400) | 正文内容 |
| Caption | 13px | Medium (500) | 辅助说明 |
| Small | 11px | Medium (500) | 标签、角标 |

### 2.3 圆角与间距

- 卡片圆角：16px（大）/ 12px（小）
- 按钮圆角：12px（常规）/ 24px（胶囊形）
- 图标容器圆角：14px
- 页面内边距：20px
- 卡片间距：16px
- 元素间距：12px（常规）/ 8px（紧凑）

### 2.4 阴影层级

```typescript
shadowSubtle: {
  shadowColor: '#1A1A2E',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
}
shadowStandard: {
  shadowColor: '#1A1A2E',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.08, shadowRadius: 16, elevation: 4,
}
shadowFloating: {
  shadowColor: '#5B8DEF',
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.2, shadowRadius: 24, elevation: 8,
}
```

---

## 三、各页面改造详情

### 3.1 首页 (HomeScreen.tsx)

**已完成**:
- 问候语 + 日期 + 刷新按钮
- 3 个快捷操作按钮
- 待上课程仅显示今日
- 底部统计卡片

**待改造**:
- 快捷操作扩展：`[添加学生] [记录课程] [导出账单] [导入恢复]`
- 快捷操作改为水平滚动的药丸形按钮
- 数值添加数字递增动画
- 今日待上课卡片：左侧用科目颜色竖条

### 3.2 学生管理页 (StudentScreen.tsx)

**已完成**:
- 学生卡片列表
- BottomSheet 添加/编辑表单

**待改造（多科目支持）**:
- 编辑表单改为两段式：
  - 上半：学生基本信息（姓名、电话、地址、默认地点）
  - 下半：科目标签列表（横向滚动）+ 添加科目按钮
- 科目编辑行：科目名 + 时薪 + 颜色选择（可独立删除）
- 学生卡片左侧显示科目标签列（按科目颜色）
- 删除学生需关联检查并弹窗确认（含科目和课程数量）

### 3.3 课程记录页 (LessonScreen.tsx)

**已完成**:
- 四分类筛选（待上课/待收款/已收款/全部）
- CalendarPicker + TimeRangePicker
- 表单必填校验

**待改造（四态 + 手动金额 + 部分付款）**:
- StatusBadge 四态配色:
  - `scheduled`: 浅蓝底 + 蓝字 "待上课"
  - `completed`: 浅黄底 + 橙字 "待收款"
  - `paid`: 浅绿底 + 绿字 "已收款"
  - `cancelled`: 灰底 + 灰字 "已取消"
- 状态操作按钮：根据当前状态显示合法下一步
- 课程表单增加：
  - 科目选择器（关联 studentSubject，可选）
  - 手动金额开关（关闭=自动计算，开启=手动输入）
- 课程详情底部：收款记录列表 + 添加收款按钮
- 收款进度条：`已收 / 总额`

### 3.4 统计页 (StatsScreen.tsx)

**已完成**:
- 月份选择器
- 近 6 月收入柱状图
- 月度收款概览进度条
- 学生账单卡片
- StudentBillingDetailScreen Modal

**待改造**:
- 学生账单卡片：科目标签 + 科目颜色圆点
- 时薪变更历史入口（某科目的历史调价记录）

### 3.5 新增：设置页 (SettingsScreen)

用于承载 P0 导出/导入入口：
- Excel 导出入口 → 弹窗选维度（全部 / 按月 / 按学生）
- Excel 导入入口 → 文件选择 → 预览 → 确认
- PDF 账单入口 → 选学生 + 月份 → 生成
- 周期规则管理入口（P2）
- 关于 / 版本号

放在 Tab 导航中或从首页齿轮图标进入。

### 3.6 新增：周期规则管理

- 列表页：所有规则（学生名、科目、周几、时间段、状态）
- 表单：
  - 学生 + 科目选择
  - 星期多选（按钮组，点击高亮）
  - 频率（每周/隔周 切换）
  - 时间段 + 时长（复用 TimeRangePicker）
  - 起始/结束日期
  - 排除日期（日历多选或手动输入）
- 编辑规则后提示：「仅影响尚未生成的课程」

---

## 四、底部导航栏

**已完成**:
- 白色背景 + 顶部阴影（iOS 风格）
- 选中态主色调 + 图标填充
- Tab 图标使用 Ionicons

---

## 五、动画与微交互

| 交互场景 | 动画效果 |
|---------|---------|
| 页面进入 | 内容从下往上淡入 |
| 列表项出现 | 依次从右滑入 + 淡入 |
| 按钮按下 | 缩放至 0.95 |
| 付款状态切换 | 弹跳动画 + 颜色渐变 |
| FAB 按钮 | 呼吸脉冲 |
| 数字变化 | 递增计数动画 |
| 模态框弹出 | 从底部滑入 + 背景渐暗 |
| 删除操作 | 卡片向右滑出 + 淡出 |

---

## 六、文件变更清单

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `src/models/index.ts` | 修改 | 新数据模型 + 新增接口 |
| `src/database/index.ts` | 重写 | 新表结构 + migration + 新 CRUD |
| `src/App.tsx` | 修改 | 添加 Settings Tab 或入口 |
| `src/screens/HomeScreen.tsx` | 修改 | 快捷操作扩展 |
| `src/screens/StudentScreen.tsx` | 修改 | 多科目表单 |
| `src/screens/LessonScreen.tsx` | 修改 | 四态 + 手动金额 + 收款 |
| `src/screens/StatsScreen.tsx` | 修改 | 科目颜色 + 时薪历史 |
| `src/screens/SettingsScreen.tsx` | 新建 | 设置页 |
| `src/screens/StudentBillingDetailScreen.tsx` | 修改 | 科目字段适配 |
| `src/components/StatusBadge.tsx` | 修改 | 四态配色 |
| `src/components/StudentAvatar.tsx` | 修改 | 科目颜色支持 |
| `src/styles/theme.ts` | 修改 | 科目颜色 + 四态色 |
| `src/utils/export.ts` | 新建 | Excel 生成 + UUID 附加 |
| `src/utils/import.ts` | 新建 | Excel 解析 + ID 重映射 |
| `src/utils/pdf.ts` | 新建 | PDF 账单生成 |
| `src/utils/notifications.ts` | 新建 | 本地通知调度 |

---

> ⚠️ 注意：此文件仅涉及 UI/交互层设计。数据模型、API、业务逻辑等详见 [规格文档](docs/superpowers/specs/2026-05-06-offline-enhanced-design.md)。
