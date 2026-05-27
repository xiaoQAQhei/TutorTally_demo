## [2026-05-27] Slide-out + Collapse 闪烁修复（最终方案）

**问题**：slide-out 完成后卡片在原位置闪烁一下才进入 collapse。反复修了多次，每次都在不同层次打补丁（0-duration reset、RAF 延迟、render override），但都没解决根本原因。

**根因**：slide 回调里 `slideX.setValue(0)` 把 translateX 从 400 拉回 0，但 React 还没重渲染应用 collapse 的 `backgroundColor: 'transparent'`。这一两帧里卡片 translateX=0 + 全尺寸 + cardBg → 闪。

**正确解法**：slide 完成后**不 reset slideX/slideOp**，让卡片保持在 translateX=400（屏幕外）。collapse 块本身已设 `backgroundColor: 'transparent'` + animated height，卡片在屏幕外透明坍缩，下方卡片通过 LayoutAnimation 上移——用户完全看不到 flashing card。

**经验教训**：不要在半路上把动画值归零再等 React 接棒。应该让前一阶段的残留值（x=400）自然延续到下一阶段，下一阶段的样式（transparent + collapse）自己盖掉视觉效果。

- 将 slide-out 从 `useNativeDriver: true` 改回 `false`（消除 JS/原生双侧值不一致，回归老版本稳定架构）
- 去掉 slide 回调中的 `slideX.setValue(0)` / `slideOp.setValue(1)`（闪烁根因）
- 去掉 0-duration native driver reset（无效补丁）
- 去掉 RAF 延迟（无效补丁）
- 去掉 render 层 collapse override（不再需要）
- 文件: src/screens/LessonScreen.tsx

## [2026-05-22] [01:52] 修复平板状态流转动画右侧闪烁

- 将 translateX toValue 从 400 改为 SCREEN_W + 200，确保平板卡片完全滑出屏幕
- setMorphing(null) 后透明度跳回 1 时卡片已不可见，消除右侧闪烁
  - 文件: src/screens/LessonScreen.tsx

## [2026-05-22] [00:09] 学生删除：关联设置开关 + 渐隐动画

- 删除学生弹窗由设置页「状态变更前提醒」控制，关闭时直接删除，开启时弹窗确认
- 删除时卡片渐隐 500ms（原生驱动）
  - 文件: src/screens/StudentScreen.tsx

## [2026-05-22] [00:04] 修复取消动画和删除动画：渐隐 + 高度收缩

- 取消动画：删除线展开 (600ms) → 停留 (800ms) → 卡片渐隐 (500ms, 原生驱动)
- 删除动画：碎纸同步高度收缩 (400ms)，消除空白占位
- 修复 LayoutAnimation 在安卓不生效的问题
  - 文件: src/screens/LessonScreen.tsx

## [2026-05-21] Animated -> Reanimated 迁移 + Tab 滑块修复 + 碎纸删除定位修复

- Animated -> Reanimated 迁移：animations.ts、animationHooks.ts、StatusBadge、Toast、DropdownSelect、TimeRangePicker、StatCard、EmptyState、GradientFAB、BottomSheet、HomeScreen、StudentScreen、RecurringRulesScreen、LessonScreen
- Tab 滑块修复（从 reFilterAnim 改回 scrollX 驱动）
- 碎纸删除定位修复（从缓存改实时 measureInWindow）和移除 height 折叠
- APK 构建
  - 文件: animations.ts, animationHooks.ts, StatusBadge.tsx, Toast.tsx, DropdownSelect.tsx, TimeRangePicker.tsx, StatCard.tsx, EmptyState.tsx, GradientFAB.tsx, BottomSheet.tsx, HomeScreen.tsx, StudentScreen.tsx, RecurringRulesScreen.tsx, LessonScreen.tsx, ShredderStrip.tsx, SettingsScreen.tsx

## [2026-05-18 01:01] 性能优化 + Tab 闪退修复 + 循环依赖修复

- xlsx-js-style 懒加载，不阻塞 App 启动

- BottomSheet 拆分双层 Animated.View（translateY 原生驱动 / height JS 驱动）

- 批量按钮视图拆分（外层原生、内层 JS），恢复原生驱动

- 修复 Tab 滑动 width 属性冲突导致的闪退（scrollX useNativeDriver: false）

- Android 下 LayoutAnimation 跳过

- 修复状态转变后卡片不显示（batchCollapseAnims 清理）

- 修复循环依赖：抽取 scale.ts，theme ↔ responsive 不再互相导入

- web 端 LinearGradient mock 告警修复

- cloud-upload-outline 图标名修正

  - 文件: src/components/BottomSheet.tsx, src/screens/LessonScreen.tsx, src/screens/SettingsScreen.tsx, src/styles/theme.ts, src/utils/LinearGradientMock.js, src/utils/export.ts, src/utils/scale.ts, webpack.config.js

- ## [2026-05-17 20:43] 添加种子数据功能 + 周期规则导航栏 + 移除浮动按钮

  - seedTestData: 插入 3 学生 / 5 科目 / 20 课 / 5 支付 / 2 周期规则
  - SettingsScreen 添加「生成测试数据」按钮
  - RecurringRulesScreen 顶部导航栏添加关闭 (✕) 按钮
  - 移除 SettingsScreen 浮动关闭按钮，改用 onClose prop
    - 文件: src/database/index.ts, src/screens/SettingsScreen.tsx, src/screens/RecurringRulesScreen.tsx, PROGRESS.md

  ## [2026-05-17 20:15] 周期规则表单 UI 升级 + 箭头旋转动画 + 学生表单箭头

  - RecurringRulesScreen: TimeRangePicker/CalendarPicker 替换为原生选择器
  - 选择科目时自动填充课时费
  - 所有表单选择器箭头添加旋转动画 (↓→↑)
  - SettingsScreen 接入 RecurringRulesScreen (Modal)
  - StudentScreen 科目选择器加箭头+旋转动画
    - 文件: src/screens/LessonScreen.tsx, src/screens/RecurringRulesScreen.tsx, src/screens/SettingsScreen.tsx, src/screens/StudentScreen.tsx

  ## [2026-05-17 18:24] 导出流程重设计 + 状态转变动画重构 + 批量入场动画修复 + Web 导出支持

  - ExportFlowModal 多步导出弹窗（选格式→选范围→选月份/学生→预览→导出）
  - SettingsScreen 统一导出入口，移除旧的 onNavigateToStudentSelect
  - PDF 支持全部/按月/按学生三种范围 + Web 端 Blob 下载
  - Excel 导出金额去小数、合计行列顺序调整、Web 端下载
  - 抽离 changeStatusWithAnim，批量操作复用（animateOneSlide 删除）
  - 状态转变卡片高度收缩→LayoutAnimation，消除下方卡片跳跃
  - useBatchAnim 入场去 spring/高度跳变，改为 useEffect 触发+同步展开
  - 安装 jest + ts-jest 测试框架，32 个导出测试全部通过
  - tsconfig 加 dom lib（支持 document/window 类型）
    - 文件: jest.config.js, package.json, src/components/ExportFlowModal.tsx, src/screens/SettingsScreen.tsx, src/styles/animations.ts, src/utils/__tests__/export.test.ts, src/utils/export.ts, src/utils/pdf.ts, tsconfig.json

  ## [2026-05-14 01:09] Toast 上下文化 + 横滑 Tab 分页 + 碎纸删除优化 + 停用 Stop hook

  - Toast 组件全局上下文化：创建 ToastContext/ToastProvider，所有 screen 统一使用 `useToast()` 替代各自维护的 toast state
  - Toast 组件改为绝对定位浮层（高 zIndex），不再使用 Modal，不阻挡触摸事件；图标尺寸改用 iconSize.md 响应式变量
  - LessonScreen 筛选栏重构：从下拉筛选芯片改为横滑 Tab 分页栏（左三一组 + 右侧"全部"），带跟随滑动插值的颜色/位置动画滑块
  - LessonScreen 列表改为 4 页横向 ScrollView 分页（待上课/待收款/已收款/全部），每页独立 FlatList 惰性加载，切换 Tab 与横滑联动吸附
  - 删除操作优化为本地立即移除（UI 先更新），后台 DB 删除失败时回滚恢复；容器偏移量 onLayout 缓存，避免碎纸定位时二次 measure
  - App.tsx 包裹 ToastProvider，CLAUDE.md 新增对话开始时读取 PROGRESS.md 的步骤
    - 文件: .claude/settings.local.json, CLAUDE.md, logs/CHANGELOG.md, src/App.tsx, src/components/Toast.tsx, src/screens/LessonScreen.tsx, src/screens/RecurringRulesScreen.tsx, src/screens/SettingsScreen.tsx, src/screens/StudentScreen.tsx

  ## [2026-05-14 01:09] 停用 Stop hook 自动提交 + 补充历史改动日志

  - `.claude/settings.local.json`: 移除 Stop hook 配置，不再每轮对话结束后自动 git commit/push
  - `logs/CHANGELOG.md`: 补全之前会话的功能改动日志（课程卡片重设计、响应式重构等）
  - `CLAUDE.md`: 更新说明——Stop hook 已停用，所有 git 操作手动执行
  - 多屏幕代码清理：移除 Toast 内联样式、简化 LessonScreen/StudentScreen/SettingsScreen/RecurringRulesScreen 冗余逻辑
    - 文件: .claude/settings.local.json, logs/CHANGELOG.md, CLAUDE.md, src/App.tsx, src/components/Toast.tsx, src/screens/LessonScreen.tsx, src/screens/RecurringRulesScreen.tsx, src/screens/SettingsScreen.tsx, src/screens/StudentScreen.tsx

  ## 课程卡片 UI 现状（待优化）

  当前排版：

  ```
  ┌──────────────────────────────────────┐
  │ 🧑 张三              ┌──────────┐   │
  │    13812345678       │ 待上课 🔵 │   │
  │                      └──────────┘   │
  ├──────────────────────────────────────┤
  │ 📅 05-14  ⏰ 2h      ┌──────────┐   │
  │                      │🕐14-16:00│   │  ← 时段独立 badge
  │                      └──────────┘   │
  │ 💰 200元                            │
  │ 📝 备注...                          │
  ├──────────────────────────────────────┤
  │              ✏️  ❌  🗑️             │
  └──────────────────────────────────────┘
  ```

  可优化方向：

  1. 去掉卡头电话号码，改为显示科目名
  2. 日期/时段/时长/金额合并为一行
  3. 时段不用大号蓝底 badge，用普通字号
  4. 备注和操作按钮同行排列
  5. 卡片信息密度提升

  ---

  ## [2026-05-12 21:33] 全部 screen 转换为 useMemo 响应式样式 + 科目选择器 + FAB 常量导出

  - 7 个 screen 全部从 StyleSheet.create 改为 useMemo 响应式样式模式，Spacing/FontSize 替代为 spacing/fontSize
  - StudentScreen: 科目输入从 TextInput 改为预设科目选择面板 + 删除确认弹窗 + BorderRadius 适配
  - LessonScreen: scrollTopBtn 相对 FAB 居中 + contentPaddingH 同步右侧对齐
  - GradientFAB: 导出 FAB_BASE_SIZE/BOTTOM_PHONE/BOTTOM_TABLET 常量供 scrollTopBtn 同步定位
  - BottomSheet: 平板模式下圆角适配
  - database: 增加模拟课程数据
  - theme: 清理无用 import，图标分层注释
    - 文件: src/screens/HomeScreen.tsx, src/screens/LessonScreen.tsx, src/screens/RecurringRulesScreen.tsx, src/screens/SettingsScreen.tsx, src/screens/StatsScreen.tsx, src/screens/StudentBillingDetailScreen.tsx, src/screens/StudentScreen.tsx, src/components/BottomSheet.tsx, src/components/GradientFAB.tsx, src/components/StatCard.tsx, src/components/StatusBadge.tsx, src/database/index.ts, src/styles/theme.ts

  ## [2026-05-12 18:38] LessonScreen StyleSheet.create → useMemo 响应式样式转换

  - 移除 StyleSheet.create，改用 useMemo 封装响应式样式（跟随 spacing/fontSize/iconSize 变化）
  - 样式定义移至组件函数内部以调用 useResponsive() hook
  - Spacing.* 替换为 spacing.*，FontSize.* 替换为 fontSize.*
  - 导入：添加 useMemo，移除 StyleSheet/FontSize/Spacing
  - 移除 JSX 中所有冗余的 inline `{ fontSize: fontSize.xxx }` 覆写
    - 文件: src/screens/LessonScreen.tsx

  ## [2026-05-12 18:31] StatsScreen StyleSheet.create → useMemo 响应式样式转换

  - 移除 StyleSheet.create，改用 useMemo 封装响应式样式（跟随 spacing/fontSize 变化）
  - Spacing.* 替换为 spacing.*，FontSize.* 替换为 fontSize.*，字符串值添加 as const
  - 移除 JSX 中所有冗余的 inline `{ fontSize: fontSize.xxx }` 覆盖
  - progressTrack/progressFill 硬编码尺寸改为 scale() 响应式
    - 文件: src/screens/StatsScreen.tsx

  ## [2026-05-12 17:43] 响应式系统重构 + 图标尺寸体系统一 + 全屏幕自适应收官

  ## 2026-05-12 18:03 | auto: 05-12 18:03 | .claude/settings.local.json 

  - .claude/settings.local.json

  ## 2026-05-12 18:01 | auto: 05-12 18:01 | src/screens/LessonScreen.tsx src/styles/theme.ts 

  - src/screens/LessonScreen.tsx
  - src/styles/theme.ts

  ## 2026-05-12 17:59 | auto: 05-12 17:59 | src/screens/LessonScreen.tsx src/screens/StudentScreen.tsx src/styles/theme.ts 

  - src/screens/LessonScreen.tsx
  - src/screens/StudentScreen.tsx
  - src/styles/theme.ts

  ## 2026-05-12 17:54 | auto: 05-12 17:54 | src/screens/HomeScreen.tsx src/screens/LessonScreen.tsx src/screens/RecurringRulesScreen.tsx src/screens/StatsScreen.tsx 

  - src/screens/HomeScreen.tsx
  - src/screens/LessonScreen.tsx
  - src/screens/RecurringRulesScreen.tsx
  - src/screens/StatsScreen.tsx

  ## 2026-05-12 17:50 | auto: 05-12 17:50 | src/styles/theme.ts 

  - src/styles/theme.ts

  ## 2026-05-12 17:50 | auto: 05-12 17:50 | src/styles/theme.ts 

  - src/styles/theme.ts

  ## 2026-05-12 17:47 | auto: 05-12 17:47 | logs/CHANGELOG.md 

  - logs/CHANGELOG.md

  - **theme.ts 全面重构**：移除 `getSpacing()` / `getFontSize()` 等断点感知函数，改为导出静态 `TabletSpacing` / `TabletFontSize` 常量；新增 `IconSize` / `TabletIconSize` 图标尺寸体系；平板 TabletSpacing 整体缩小（比手机更紧凑），TabletFontSize 整体缩小以适配平板视觉密度；移除 `as const` 断言使常量可变导出
  - **responsive.ts 精简**：移除 `buildSpacing()` / `buildFontSize()` 中基于宽高比加权的动态缩放算法，改为直接从 theme.ts 引用静态常量；移除已废弃的 `ResponsiveSpacing` / `ResponsiveFontSize` 接口，新增 `iconSize: typeof IconSize` 字段；`maxContentWidth` 改为直接等于屏幕宽度，不再对平板做 75% 宽度限制
  - **全屏幕统一 iconSize 体系**：HomeScreen / LessonScreen / StatsScreen / RecurringRulesScreen / StudentScreen / StudentBillingDetailScreen / SettingsScreen 所有 Ionicons 图标 size 从硬编码数值（14/18/20/22/25 等）切换为 `iconSize.xs/md/lg/xl`
  - **组件图标统一**：GradientFAB 移除 isTablet/isUltraNarrow 条件判断，统一使用 `iconSize.xl`；StatCard 图标容器/图标尺寸改用 `iconSize.container.md` / `iconSize.lg`，label/value 字号改为响应式 `fontSize.caption` / `fontSize.h2`；App.tsx TabBar 图标改用 `iconSize.lg`
  - **HomeScreen 结构重构**：移除 container 的 maxWidth/paddingHorizontal inline 样式，全部走 StyleSheet；待确认下课和待上课卡片统一为色条 + 可点击内容区 + 金额和状态徽章的结构；timeSlotBadge padding 从 Spacing.md 缩小为 Spacing.xs；QuickActionButton 不再接收 fontSize prop 改用内联 useResponsive()
  - **BottomSheet 平板居中**：平板上 BottomSheet 宽度限制为 `maxContentWidth` 并 `alignSelf: 'center'`，不再全屏宽度
  - **StatsScreen 图表自适应改进**：柱状图 barW/gap/initial 计算移至 useMemo 内使用响应式 `spacing.lg`；平板高度改为 `Math.max(chartBarW * 8, 120)` 动态计算
  - **全屏幕添加 StyleSheet 注释**：所有 7 个屏幕统一用 ═ 分隔区块、// 描述每段样式作用，提升代码可读性
    - 文件: src/styles/theme.ts, src/utils/responsive.ts, src/App.tsx, src/screens/HomeScreen.tsx, src/screens/LessonScreen.tsx, src/screens/StatsScreen.tsx, src/screens/RecurringRulesScreen.tsx, src/screens/SettingsScreen.tsx, src/screens/StudentBillingDetailScreen.tsx, src/screens/StudentScreen.tsx, src/components/BottomSheet.tsx, src/components/GradientFAB.tsx, src/components/StatCard.tsx

  ## [2026-05-11 16:42] Excel 导出添加行高设置，根据字体大小分类配置

  ## 2026-05-11 18:24 | auto: 05-11 18:24 | "export_example_全量.xlsx" scripts/gen_sample_xlsx.js "export_example_按学生_李小明.xlsx" "export_example_按学生_王雨涵.xlsx" "export_example_按学生_陈子豪.xlsx" 

  - "export_example_全量.xlsx"
  - scripts/gen_sample_xlsx.js
  - "export_example_按学生_李小明.xlsx"
  - "export_example_按学生_王雨涵.xlsx"
  - "export_example_按学生_陈子豪.xlsx"

  ## 2026-05-11 16:44 | auto: 05-11 16:44 | logs/CHANGELOG.md 

  - logs/CHANGELOG.md

  - 为 Excel 导出表格添加行高配置：标题行和汇总行使用较大行高（26），数据行使用较小行高（22），提升导出表格的可读性
    - 文件: src/utils/export.ts

  ## [2026-05-11 16:30] 全面适配平板设备响应式布局（better 分支汇总）

  ## 2026-05-11 16:43 | auto: 05-11 16:43 | app.json "export_example_全量.xlsx" "export_example_按月_2026-05.xlsx" 

  - app.json
  - "export_example_全量.xlsx"
  - "export_example_按月_2026-05.xlsx"

  ## 2026-05-11 16:28 | auto: 05-11 16:28 | logs/CHANGELOG.md 

  - logs/CHANGELOG.md


  本轮在 better 分支上对全应用进行了平板设备响应式布局适配，覆盖核心工具层、主题系统、所有组件和所有页面。

  - 新增 `src/utils/responsive.ts`：断点系统（sm/md/lg）、`scale/verticalScale/moderateScale/rem/vw/vh` 缩放工具、`useResponsive` Hook（响应维度变化）、`useScaleHelpers` 绑定缩放辅助、`bpValue` 断点取值、平板自动放大间距与字号
  - 增强 `src/styles/theme.ts`：Spacing/FontSize/BorderRadius 改用 scale/rem/moderateScale 缩放、新增 `getSpacing/getFontSize` 断点感知函数（平板下间距和字号自动放大 1.5x 左右）
  - 所有组件适配：GradientFAB（平板下按钮放大、位置调整）、BottomSheet（动态高度响应窗口变化）、CalendarPicker（平板更大弹窗宽度）、TimeRangePicker/StatCard/EmptyState/Toast（尺寸动态缩放）
  - 所有 8 个页面适配：HomeScreen、LessonScreen、SettingsScreen、StatsScreen、StudentScreen、StudentBillingDetailScreen、RecurringRulesScreen 均添加 `maxContentWidth` 居中约束，filterRow 支持换行防溢出，弹窗添加 `maxWidth`，StatsScreen 图表宽度改用 `onLayout` 实测
  - App.tsx：平板下 TabBar 高度调整
  - `src/utils/export.ts`：导出尺寸适配响应式
    - 文件: src/App.tsx, src/components/BottomSheet.tsx, src/components/CalendarPicker.tsx, src/components/EmptyState.tsx, src/components/GradientFAB.tsx, src/components/StatCard.tsx, src/components/TimeRangePicker.tsx, src/components/Toast.tsx, src/screens/HomeScreen.tsx, src/screens/LessonScreen.tsx, src/screens/RecurringRulesScreen.tsx, src/screens/SettingsScreen.tsx, src/screens/StatsScreen.tsx, src/screens/StudentBillingDetailScreen.tsx, src/screens/StudentScreen.tsx, src/styles/theme.ts, src/utils/export.ts, src/utils/responsive.ts

  ## [2026-05-11 16:04] 子元素硬编码尺寸改用响应式单位

  ## 2026-05-11 16:23 | auto: 05-11 16:23 | src/screens/HomeScreen.tsx src/screens/LessonScreen.tsx src/screens/StatsScreen.tsx 

  - src/screens/HomeScreen.tsx
  - src/screens/LessonScreen.tsx
  - src/screens/StatsScreen.tsx

  ## 2026-05-11 16:22 | auto: 05-11 16:22 | src/App.tsx src/screens/StatsScreen.tsx 

  - src/App.tsx
  - src/screens/StatsScreen.tsx

  ## 2026-05-11 16:20 | auto: 05-11 16:20 | src/screens/LessonScreen.tsx src/screens/RecurringRulesScreen.tsx src/screens/SettingsScreen.tsx src/screens/StatsScreen.tsx src/screens/StudentBillingDetailScreen.tsx src/screens/StudentScreen.tsx 

  - src/screens/LessonScreen.tsx
  - src/screens/RecurringRulesScreen.tsx
  - src/screens/SettingsScreen.tsx
  - src/screens/StatsScreen.tsx
  - src/screens/StudentBillingDetailScreen.tsx
  - src/screens/StudentScreen.tsx

  ## 2026-05-11 16:17 | auto: 05-11 16:17 | src/screens/HomeScreen.tsx src/screens/LessonScreen.tsx src/screens/RecurringRulesScreen.tsx src/screens/SettingsScreen.tsx src/screens/StatsScreen.tsx src/screens/StudentBillingDetailScreen.tsx src/screens/StudentScreen.tsx src/utils/export.ts src/utils/responsive.ts 

  - src/screens/HomeScreen.tsx
  - src/screens/LessonScreen.tsx
  - src/screens/RecurringRulesScreen.tsx
  - src/screens/SettingsScreen.tsx
  - src/screens/StatsScreen.tsx
  - src/screens/StudentBillingDetailScreen.tsx
  - src/screens/StudentScreen.tsx
  - src/utils/export.ts
  - src/utils/responsive.ts

  ## 2026-05-11 16:05 | auto: 05-11 16:05 | logs/CHANGELOG.md 

  - logs/CHANGELOG.md

  - HomeScreen: recentTimeSlot 的 padding/borderRadius 改用 Spacing/BorderRadius，miniBadge/confirmBadge 的 fontSize 改用 FontSize.small，gap 改用 Spacing.xs
  - LessonScreen: filterCount 尺寸改用 scale()，timeSlotBadge 的 gap 改用 Spacing
  - TimeRangePicker: colGap 改用 Spacing.sm，confirmBtn 高度改用 scale(50) 内联样式
  - Toast: paddingBottom 改用 verticalScale(70)
    - 文件: src/components/TimeRangePicker.tsx, src/components/Toast.tsx, src/screens/HomeScreen.tsx, src/screens/LessonScreen.tsx

  ## [2026-05-11 15:45] HomeScreen 和 LessonScreen 统一响应式 maxContentWidth 模式

  ## 2026-05-11 15:45 | auto: 05-11 15:45 | logs/CHANGELOG.md 

  - logs/CHANGELOG.md

  - 将 HomeScreen 和 LessonScreen 的 container maxWidth 从静态 StyleSheet 常量改为 useResponsive().maxContentWidth 内联样式
  - 其余 5 个 Screen 此前已完成此改动，本次补齐遗漏，保证所有屏幕响应式方案一致
    - 文件: src/screens/HomeScreen.tsx, src/screens/LessonScreen.tsx

  ## [2026-05-11 15:30] 全面实现响应式布局：自适应不同设备屏幕尺寸和比例

  ## 2026-05-11 15:31 | auto: 05-11 15:31 | logs/CHANGELOG.md 

  - logs/CHANGELOG.md

  - 重构 responsive.ts：新增断点系统(sm/md/lg)、useResponsive Hook 响应维度变化、useContentInsets、reactive isTablet
  - 增强 theme.ts：添加 getSpacing/getFontSize 断点感知函数、移除未使用的 helper
  - 所有组件适配响应式：GradientFAB/BottomSheet/CalendarPicker/TimeRangePicker/StatCard/EmptyState/Toast 均根据屏幕尺寸动态调整
  - 所有屏幕添加 MAX_CONTENT_WIDTH 居中约束，防止平板上内容被无限拉长
  - HomeScreen: 平板下快捷操作按钮放大、确认弹窗添加 maxWidth
  - LessonScreen: filterRow 支持换行以防窄屏溢出、确认弹窗 maxWidth
  - StatsScreen: chart 宽度改用 onLayout 实测、statsBar/overviewRow 支持 wrap
  - App.tsx: 平板下 TabBar 高度调整
    - 文件: src/App.tsx, src/components/BottomSheet.tsx, src/components/CalendarPicker.tsx, src/components/EmptyState.tsx, src/components/GradientFAB.tsx, src/components/StatCard.tsx, src/components/TimeRangePicker.tsx, src/components/Toast.tsx, src/screens/HomeScreen.tsx, src/screens/LessonScreen.tsx, src/screens/RecurringRulesScreen.tsx, src/screens/SettingsScreen.tsx, src/screens/StatsScreen.tsx, src/screens/StudentBillingDetailScreen.tsx, src/screens/StudentScreen.tsx, src/styles/theme.ts, src/utils/responsive.ts

  ## [2026-05-11 14:45] 替换硬编码的像素尺寸为响应式尺寸，并限制内容最大宽度

  ## 2026-05-11 15:09 | auto: 05-11 15:09 | logs/CHANGELOG.md src/screens/HomeScreen.tsx src/screens/LessonScreen.tsx src/styles/theme.ts src/utils/responsive.ts 

  - logs/CHANGELOG.md
  - src/screens/HomeScreen.tsx
  - src/screens/LessonScreen.tsx
  - src/styles/theme.ts
  - src/utils/responsive.ts

  - 在 HomeScreen 和 LessonScreen 中替换写死的 width/height/borderRadius 为 scale 包装的值
  - 在根容器添加 maxWidth: MAX_CONTENT_WIDTH 防止在平板等大屏设备上过度拉伸
    - 文件: src/screens/HomeScreen.tsx, src/screens/LessonScreen.tsx

  # 改动日志

  ## 2026-05-11 14:39 | auto: 05-11 14:39 | app.json eas.json package-lock.json package.json src/utils/notifications.ts 

  - app.json
  - eas.json
  - package-lock.json
  - package.json
  - src/utils/notifications.ts


  ## [2026-05-09 19:42] EAS 构建配置和项目清理

  - 新增 .easignore 文件，忽略 android/、ios/ 和 node_modules/.cache/，加速 EAS 构建上传
  - eas.json preview 配置指定 Android SDK 49 镜像
  - package.json start 脚本改为 `expo run:android/ios`，新增 expo-splash-screen 依赖
  - 删除 android/.idea/workspace.xml（IDE 本地配置，无需入库）
  - .claude/settings.local.json 添加 storage.googleapis.com 的 WebFetch 权限
    - 文件: .easignore, eas.json, package.json, package-lock.json, android/.idea/workspace.xml, .claude/settings.local.json, .playwright-mcp/console-2026-05-09T09-16-20-114Z.log

  ## 2026-05-09 17:17 | auto: 05-09 17:17 | .playwright-mcp/console-2026-05-09T09-05-40-267Z.log .playwright-mcp/console-2026-05-09T09-16-20-114Z.log .playwright-mcp/page-2026-05-09T09-16-21-310Z.yml 

  - .playwright-mcp/console-2026-05-09T09-05-40-267Z.log
  - .playwright-mcp/console-2026-05-09T09-16-20-114Z.log
  - .playwright-mcp/page-2026-05-09T09-16-21-310Z.yml

  ## 2026-05-09 17:08 | auto: 05-09 17:08 | .playwright-mcp/console-2026-05-09T09-05-40-267Z.log 

  - .playwright-mcp/console-2026-05-09T09-05-40-267Z.log

  ## 2026-05-09 17:05 | auto: 05-09 17:05 | .playwright-mcp/console-2026-05-09T09-05-40-267Z.log .playwright-mcp/page-2026-05-09T09-05-41-477Z.yml .playwright-mcp/page-2026-05-09T09-05-47-647Z.png 

  - .playwright-mcp/console-2026-05-09T09-05-40-267Z.log
  - .playwright-mcp/page-2026-05-09T09-05-41-477Z.yml
  - .playwright-mcp/page-2026-05-09T09-05-47-647Z.png

  ## 2026-05-09 16:52 | auto: 05-09 16:52 | .playwright-mcp/ 

  - .playwright-mcp/

  ## 2026-05-09 15:00 | auto: 05-09 15:00 | package-lock.json package.json 

  - package-lock.json
  - package.json

  ## 2026-05-09 14:56 | auto: 05-09 14:56 | package-lock.json 

  - package-lock.json

  ## 2026-05-09 14:09 | auto: 05-09 14:09 | .claude/settings.local.json android/ 

  - .claude/settings.local.json
  - android/

  ## 2026-05-09 13:17 | auto: 05-09 13:17 | app.json eas.json "export_example_全量.xlsx" "export_example_按月_2026-05.xlsx" 

  - app.json
  - eas.json
  - "export_example_全量.xlsx"
  - "export_example_按月_2026-05.xlsx"

  ## 2026-05-09 01:55 | auto: 05-09 01:55 | PROGRESS.md 

  - PROGRESS.md

  ## 2026-05-09 01:51 | auto: 05-09 01:51 | "export_example_全量.xlsx" "export_example_按月_2026-05.xlsx" scripts/gen_sample_xlsx.js src/utils/export.ts 

  - "export_example_全量.xlsx"
  - "export_example_按月_2026-05.xlsx"
  - scripts/gen_sample_xlsx.js
  - src/utils/export.ts

  ## 2026-05-09 01:35 | auto: 05-09 01:35 | "export_example_按月_2026-05.xlsx" scripts/gen_sample_xlsx.js src/utils/export.ts 

  - "export_example_按月_2026-05.xlsx"
  - scripts/gen_sample_xlsx.js
  - src/utils/export.ts

  ## 2026-05-09 01:31 | auto: 05-09 01:31 | "export_example_全量.xlsx" scripts/gen_sample_xlsx.js src/utils/export.ts 

  - "export_example_全量.xlsx"
  - scripts/gen_sample_xlsx.js
  - src/utils/export.ts

  ## 2026-05-09 01:28 | auto: 05-09 01:28 | "export_example_全量.xlsx" "export_example_按月_2026-05.xlsx" scripts/gen_sample_xlsx.js src/utils/export.ts 

  - "export_example_全量.xlsx"
  - "export_example_按月_2026-05.xlsx"
  - scripts/gen_sample_xlsx.js
  - src/utils/export.ts

  ## 2026-05-09 01:24 | auto: 05-09 01:24 | scripts/gen_sample_xlsx.js src/utils/export.ts "~$export_example_按月_2026-05.xlsx" 

  - scripts/gen_sample_xlsx.js
  - src/utils/export.ts
  - "~$export_example_按月_2026-05.xlsx"

  ## 2026-05-09 01:21 | auto: 05-09 01:21 | "~$export_example_按月_2026-05.xlsx" 

  - "~$export_example_按月_2026-05.xlsx"

  ## 2026-05-09 01:15 | auto: 05-09 01:15 | "export_example_按月_2026-05.xlsx" "~$export_example_全量.xlsx" 

  - "export_example_按月_2026-05.xlsx"
  - "~$export_example_全量.xlsx"

  ## 2026-05-09 01:02 | auto: 05-09 01:02 | "~$export_example_全量.xlsx" 

  - "~$export_example_全量.xlsx"

  ## 2026-05-09 01:01 | auto: 05-09 01:01 | "export_example_全量.xlsx" scripts/gen_sample_xlsx.js src/utils/export.ts 

  - "export_example_全量.xlsx"
  - scripts/gen_sample_xlsx.js
  - src/utils/export.ts

  ## 2026-05-09 00:55 | auto: 05-09 00:55 | "export_example_全量.xlsx" 

  - "export_example_全量.xlsx"

  ## 2026-05-09 00:46 | auto: 05-09 00:46 | scripts/gen_sample_xlsx.js 

  - scripts/gen_sample_xlsx.js

  ## 2026-05-09 00:44 | auto: 05-09 00:44 | "export_example_按月_2026-05.xlsx" scripts/gen_sample_xlsx.js 

  - "export_example_按月_2026-05.xlsx"
  - scripts/gen_sample_xlsx.js

  ## 2026-05-09 00:38 | auto: 05-09 00:38 | "export_example_全量.xlsx" "export_example_按月_2026-05.xlsx" scripts/gen_sample_xlsx.js "~$export_example_按月_2026-05.xlsx" 

  - "export_example_全量.xlsx"
  - "export_example_按月_2026-05.xlsx"
  - scripts/gen_sample_xlsx.js
  - "~$export_example_按月_2026-05.xlsx"

  ## 2026-05-09 00:35 | auto: 05-09 00:35 | scripts/gen_sample_xlsx.js 

  - scripts/gen_sample_xlsx.js

  ## 2026-05-09 00:26 | auto: 05-09 00:26 | "~$export_example_按月_2026-05.xlsx" 

  - "~$export_example_按月_2026-05.xlsx"

  ## 2026-05-09 00:24 | auto: 05-09 00:24 | .claude/settings.local.json "export_example_全量.xlsx" "export_example_按月_2026-05.xlsx" package-lock.json package.json scripts/gen_sample_xlsx.js src/utils/export.ts 

  - .claude/settings.local.json
  - "export_example_全量.xlsx"
  - "export_example_按月_2026-05.xlsx"
  - package-lock.json
  - package.json
  - scripts/gen_sample_xlsx.js
  - src/utils/export.ts

  ## 2026-05-09 00:12 | auto: 05-09 00:12 | .claude/settings.local.json "export_example_全量.xlsx" "export_example_按月_2026-05.xlsx" package-lock.json package.json scripts/gen_sample_xlsx.js src/utils/export.ts 

  - .claude/settings.local.json
  - "export_example_全量.xlsx"
  - "export_example_按月_2026-05.xlsx"
  - package-lock.json
  - package.json
  - scripts/gen_sample_xlsx.js
  - src/utils/export.ts

  ## 2026-05-08 23:55 | auto: 05-08 23:55 | .claude/settings.local.json "export_example_按月_2026-05.xlsx" "~$export_example_按月_2026-05.xlsx" 

  - .claude/settings.local.json
  - "export_example_按月_2026-05.xlsx"
  - "~$export_example_按月_2026-05.xlsx"

  ## 2026-05-08 23:47 | auto: 05-08 23:47 | "~$export_example_按月_2026-05.xlsx" 

  - "~$export_example_按月_2026-05.xlsx"

  ## 2026-05-08 23:41 | auto: 05-08 23:41 | "~$export_example_按月_2026-05.xlsx" 

  - "~$export_example_按月_2026-05.xlsx"

  ## 2026-05-08 23:31 | auto: 05-08 23:31 | "~$export_example_按月_2026-05.xlsx" 

  - "~$export_example_按月_2026-05.xlsx"

  ## 2026-05-08 23:30 | auto: 05-08 23:30 | .claude/settings.local.json "export_example_全量.xlsx" "export_example_按月_2026-05.xlsx" package-lock.json package.json scripts/gen_sample_xlsx.js src/utils/export.ts 

  - .claude/settings.local.json
  - "export_example_全量.xlsx"
  - "export_example_按月_2026-05.xlsx"
  - package-lock.json
  - package.json
  - scripts/gen_sample_xlsx.js
  - src/utils/export.ts

  ## 2026-05-08 23:08 | auto: 05-08 23:08 | "export_example_全量.xlsx" "export_example_按月_2026-05.xlsx" 

  - "export_example_全量.xlsx"
  - "export_example_按月_2026-05.xlsx"

  ## 2026-05-08 23:05 | auto: 05-08 23:05 | "export_example_全量.xlsx" "export_example_按月_2026-05.xlsx" scripts/gen_sample_xlsx.js src/utils/export.ts 

  - "export_example_全量.xlsx"
  - "export_example_按月_2026-05.xlsx"
  - scripts/gen_sample_xlsx.js
  - src/utils/export.ts

  ## 2026-05-08 22:58 | auto: 05-08 22:58 | "export_example_全量.xlsx" "export_example_按月_2026-05.xlsx" package-lock.json package.json scripts/gen_sample_xlsx.js src/utils/export.ts 

  - "export_example_全量.xlsx"
  - "export_example_按月_2026-05.xlsx"
  - package-lock.json
  - package.json
  - scripts/gen_sample_xlsx.js
  - src/utils/export.ts

  ## 2026-05-08 22:49 | auto: 05-08 22:49 | .claude/settings.local.json "export_example_全量.xlsx" "export_example_按月_2026-05.xlsx" scripts/ 

  - .claude/settings.local.json
  - "export_example_全量.xlsx"
  - "export_example_按月_2026-05.xlsx"
  - scripts/

  ## 2026-05-08 22:45 | auto: 05-08 22:45 | .claude/settings.local.json package-lock.json package.json src/utils/export.ts 

  - .claude/settings.local.json
  - package-lock.json
  - package.json
  - src/utils/export.ts

  ## 2026-05-08 22:33 | auto: 05-08 22:33 | export_example.csv 

  - export_example.csv

  ## 2026-05-08 22:31 | auto: 05-08 22:31 | export_example.csv 

  - export_example.csv

  ## 2026-05-08 22:23 | auto: 05-08 22:23 | package-lock.json package.json "碎纸删除动画.html" 

  - package-lock.json
  - package.json
  - "碎纸删除动画.html"

  ## 2026-05-08 22:19 | auto: 05-08 22:19 | package-lock.json package.json 

  - package-lock.json
  - package.json

  ## 2026-05-08 22:12 | auto: 05-08 22:12 | logs/CHANGELOG.md 

  - logs/CHANGELOG.md


  ## [2026-05-08 22:11] 学生账单卡片小字改为「本月上了X节课，课时为Y小时」

  - 修改 StatsScreen 中学生账单卡片的描述文字，改为显示本月上课节数和课时总数
    - 文件: src/screens/StatsScreen.tsx

  ## 2026-05-08 21:54 | auto: 05-08 21:54 | src/screens/LessonScreen.tsx 

  - src/screens/LessonScreen.tsx

  ## 2026-05-08 21:49 | auto: 05-08 21:49 | src/screens/LessonScreen.tsx 

  - src/screens/LessonScreen.tsx

  ## 2026-05-08 21:40 | auto: 05-08 21:40 | src/screens/LessonScreen.tsx 

  - src/screens/LessonScreen.tsx

  ## 2026-05-08 21:35 | auto: 05-08 21:35 | src/screens/LessonScreen.tsx 

  - src/screens/LessonScreen.tsx

  ## 2026-05-08 21:30 | auto: 05-08 21:30 | src/screens/LessonScreen.tsx 

  - src/screens/LessonScreen.tsx

  ## 2026-05-08 21:27 | auto: 05-08 21:27 | src/screens/LessonScreen.tsx 

  - src/screens/LessonScreen.tsx

  ## 2026-05-08 21:21 | auto: 05-08 21:21 | src/screens/LessonScreen.tsx 

  - src/screens/LessonScreen.tsx

  ## 2026-05-08 21:18 | auto: 05-08 21:18 | src/utils/animationHooks.ts 

  - src/utils/animationHooks.ts

  ## 2026-05-08 21:09 | auto: 05-08 21:09 | src/screens/LessonScreen.tsx src/utils/animationHooks.ts 

  - src/screens/LessonScreen.tsx
  - src/utils/animationHooks.ts

  ## 2026-05-08 20:51 | auto: 05-08 20:51 | src/screens/LessonScreen.tsx 

  - src/screens/LessonScreen.tsx

  ## 2026-05-08 20:49 | auto: 05-08 20:49 | src/screens/LessonScreen.tsx 

  - src/screens/LessonScreen.tsx

  ## 2026-05-08 20:47 | auto: 05-08 20:47 | src/screens/LessonScreen.tsx 

  - src/screens/LessonScreen.tsx

  ## 2026-05-08 20:44 | auto: 05-08 20:44 | src/screens/LessonScreen.tsx 

  - src/screens/LessonScreen.tsx

  ## 2026-05-08 20:40 | auto: 05-08 20:40 | .claude/settings.local.json src/screens/LessonScreen.tsx src/utils/animationHooks.ts src/components/ShredderStrip.tsx 

  - .claude/settings.local.json
  - src/screens/LessonScreen.tsx
  - src/utils/animationHooks.ts
  - src/components/ShredderStrip.tsx

  ## 2026-05-08 18:52 | auto: 05-08 18:52 | src/screens/LessonScreen.tsx src/utils/animationHooks.ts 

  - src/screens/LessonScreen.tsx
  - src/utils/animationHooks.ts

  ## 2026-05-08 18:42 | auto: 05-08 18:42 | src/screens/LessonScreen.tsx src/utils/animationHooks.ts 

  - src/screens/LessonScreen.tsx
  - src/utils/animationHooks.ts

  ## 2026-05-08 18:34 | auto: 05-08 18:34 | logs/CHANGELOG.md 

  - logs/CHANGELOG.md

  ## 2026-05-08 18:33 碎纸动画可见性修复 + 动画序列简化

  - LessonScreen: FlatList 在碎纸动画激活时设置 overflow: 'visible'，修复动画碎片被列表容器裁剪的问题
  - animationHooks: 简化动画序列嵌套，移除冗余的外层 Animated.sequence() 包裹，结构更清晰
    - 文件: src/screens/LessonScreen.tsx, src/utils/animationHooks.ts

  ## 2026-05-08 18:18 | auto: 05-08 18:18 | src/screens/LessonScreen.tsx 

  - src/screens/LessonScreen.tsx

  ## 2026-05-08 16:36 | auto: 05-08 16:36 | .claude/settings.local.json 

  - .claude/settings.local.json

  ## 2026-05-08 16:30 | auto: 05-08 16:30 | src/screens/LessonScreen.tsx src/utils/animationHooks.ts 

  - src/screens/LessonScreen.tsx
  - src/utils/animationHooks.ts

  ## 2026-05-08 16:24 | auto: 05-08 16:24 | .claude/settings.local.json src/screens/LessonScreen.tsx src/utils/animationHooks.ts 

  - .claude/settings.local.json
  - src/screens/LessonScreen.tsx
  - src/utils/animationHooks.ts

  ## 2026-05-08 16:11 | auto: 05-08 16:11 | src/screens/LessonScreen.tsx 

  - src/screens/LessonScreen.tsx

  ## 2026-05-08 00:37 | auto: 05-08 00:37 | src/screens/LessonScreen.tsx src/utils/animationHooks.ts "碎纸删除动画.html" 

  - src/screens/LessonScreen.tsx
  - src/utils/animationHooks.ts
  - "碎纸删除动画.html"

  ## 2026-05-07 21:22 | auto: 05-07 21:22 | src/screens/LessonScreen.tsx src/utils/animationHooks.ts 

  - src/screens/LessonScreen.tsx
  - src/utils/animationHooks.ts

  ## 2026-05-07 21:14 | auto: 05-07 21:14 | src/screens/LessonScreen.tsx src/utils/animationHooks.ts 

  - src/screens/LessonScreen.tsx
  - src/utils/animationHooks.ts

  ## 2026-05-07 21:06 | auto: 05-07 21:06 | src/screens/LessonScreen.tsx 

  - src/screens/LessonScreen.tsx

  ## 2026-05-07 21:00 | auto: 05-07 21:00 | src/screens/LessonScreen.tsx src/utils/animationHooks.ts 

  - src/screens/LessonScreen.tsx
  - src/utils/animationHooks.ts

  ## 2026-05-07 20:52 | auto: 05-07 20:52 | src/contexts/ActionContext.tsx src/screens/SettingsScreen.tsx 

  - src/contexts/ActionContext.tsx
  - src/screens/SettingsScreen.tsx

  ## 2026-05-07 20:48 | auto: 05-07 20:48 | src/screens/HomeScreen.tsx 

  - src/screens/HomeScreen.tsx

  ## 2026-05-07 20:40 | auto: 05-07 20:40 | src/screens/LessonScreen.tsx 

  - src/screens/LessonScreen.tsx

  ## 2026-05-07 20:37 | auto: 05-07 20:37 | src/screens/LessonScreen.tsx 

  - src/screens/LessonScreen.tsx

  ## 2026-05-07 20:35 | auto: 05-07 20:35 | src/screens/LessonScreen.tsx 

  - src/screens/LessonScreen.tsx

  ## 2026-05-07 20:30 | auto: 05-07 20:30 | src/screens/LessonScreen.tsx 

  - src/screens/LessonScreen.tsx

  ## 2026-05-07 20:28 | auto: 05-07 20:28 | src/screens/HomeScreen.tsx 

  - src/screens/HomeScreen.tsx

  ## 2026-05-07 20:19 | auto: 05-07 20:19 | src/screens/HomeScreen.tsx src/styles/theme.ts 

  - src/screens/HomeScreen.tsx
  - src/styles/theme.ts

  ## 2026-05-07 20:18 | auto: 05-07 20:18 | src/styles/theme.ts 

  - src/styles/theme.ts

  ## 2026-05-07 20:16 | auto: 05-07 20:16 | src/components/StatusBadge.tsx src/screens/HomeScreen.tsx src/screens/LessonScreen.tsx 

  - src/components/StatusBadge.tsx
  - src/screens/HomeScreen.tsx
  - src/screens/LessonScreen.tsx

  ## 2026-05-07 20:08 | auto: 05-07 20:08 | src/styles/theme.ts 

  - src/styles/theme.ts

  ## 2026-05-07 20:01 | auto: 05-07 20:01 | src/database/index.ts 

  - src/database/index.ts

  ## 2026-05-07 19:59 | auto: 05-07 19:59 | src/screens/LessonScreen.tsx 

  - src/screens/LessonScreen.tsx

  ## 2026-05-07 19:34 | auto: 05-07 19:34 | src/components/StatusBadge.tsx src/database/index.ts src/models/index.ts src/screens/HomeScreen.tsx src/screens/LessonScreen.tsx src/screens/StudentBillingDetailScreen.tsx src/styles/theme.ts src/utils/notifications.ts 

  - src/components/StatusBadge.tsx
  - src/database/index.ts
  - src/models/index.ts
  - src/screens/HomeScreen.tsx
  - src/screens/LessonScreen.tsx
  - src/screens/StudentBillingDetailScreen.tsx
  - src/styles/theme.ts
  - src/utils/notifications.ts

  ## 2026-05-07 18:42 | auto: 05-07 18:42 | src/screens/HomeScreen.tsx 

  - src/screens/HomeScreen.tsx

  ## 2026-05-07 18:39 | auto: 05-07 18:39 | src/screens/HomeScreen.tsx 

  - src/screens/HomeScreen.tsx

  ## 2026-05-07 18:36 | auto: 05-07 18:36 | src/screens/HomeScreen.tsx 

  - src/screens/HomeScreen.tsx

  ## 2026-05-07 18:31 | auto: 05-07 18:31 | src/screens/HomeScreen.tsx 

  - src/screens/HomeScreen.tsx

  ## 2026-05-07 18:28 | auto: 05-07 18:28 | src/screens/HomeScreen.tsx 

  - src/screens/HomeScreen.tsx

  ## 2026-05-07 18:24 | auto: 05-07 18:24 | src/screens/HomeScreen.tsx 

  - src/screens/HomeScreen.tsx

  ## 2026-05-07 18:13 | auto: 05-07 18:13 | android/.idea/compiler.xml android/.idea/misc.xml src/screens/LessonScreen.tsx android/.idea/deploymentTargetSelector.xml android/.idea/kotlinc.xml 

  - android/.idea/compiler.xml
  - android/.idea/misc.xml
  - src/screens/LessonScreen.tsx
  - android/.idea/deploymentTargetSelector.xml
  - android/.idea/kotlinc.xml

  ## 2026-05-07 18:06 | auto: 05-07 18:06 | android/.gradle/8.2/checksums/checksums.lock android/.gradle/8.2/checksums/md5-checksums.bin android/.gradle/8.2/checksums/sha1-checksums.bin android/.gradle/8.2/fileHashes/fileHashes.bin android/.gradle/8.2/fileHashes/fileHashes.lock android/.gradle/buildOutputCleanup/buildOutputCleanup.lock android/.idea/gradle.xml android/.idea/misc.xml logs/CHANGELOG.md src/screens/LessonScreen.tsx android/.gradle/8.2/executionHistory/ android/.gradle/buildOutputCleanup/outputFiles.bin android/.idea/.name android/.idea/compiler.xml 

  - android/.gradle/8.2/checksums/checksums.lock
  - android/.gradle/8.2/checksums/md5-checksums.bin
  - android/.gradle/8.2/checksums/sha1-checksums.bin
  - android/.gradle/8.2/fileHashes/fileHashes.bin
  - android/.gradle/8.2/fileHashes/fileHashes.lock
  - android/.gradle/buildOutputCleanup/buildOutputCleanup.lock
  - android/.idea/gradle.xml
  - android/.idea/misc.xml
  - logs/CHANGELOG.md
  - src/screens/LessonScreen.tsx
  - android/.gradle/8.2/executionHistory/
  - android/.gradle/buildOutputCleanup/outputFiles.bin
  - android/.idea/.name
  - android/.idea/compiler.xml

  ## 2026-05-07 17:53 | auto: 05-07 17:53 | android/.gradle/8.2/checksums/checksums.lock android/.gradle/8.2/checksums/md5-checksums.bin android/.gradle/8.2/checksums/sha1-checksums.bin android/.gradle/8.2/dependencies-accessors/dependencies-accessors.lock android/.gradle/8.2/fileHashes/fileHashes.lock android/.gradle/buildOutputCleanup/buildOutputCleanup.lock android/.gradle/8.2/executionHistory/ 

  - android/.gradle/8.2/checksums/checksums.lock
  - android/.gradle/8.2/checksums/md5-checksums.bin
  - android/.gradle/8.2/checksums/sha1-checksums.bin
  - android/.gradle/8.2/dependencies-accessors/dependencies-accessors.lock
  - android/.gradle/8.2/fileHashes/fileHashes.lock
  - android/.gradle/buildOutputCleanup/buildOutputCleanup.lock
  - android/.gradle/8.2/executionHistory/

  ## 2026-05-07 17:37 | auto: 05-07 17:37 | android/.gradle/8.2/checksums/checksums.lock android/.gradle/8.2/checksums/sha1-checksums.bin android/app/build.gradle android/.gradle/8.2/checksums/md5-checksums.bin 

  - android/.gradle/8.2/checksums/checksums.lock
  - android/.gradle/8.2/checksums/sha1-checksums.bin
  - android/app/build.gradle
  - android/.gradle/8.2/checksums/md5-checksums.bin

  ## 2026-05-07 17:25 | auto: 05-07 17:25 | android/.gradle/8.2/fileHashes/fileHashes.bin android/.gradle/8.2/fileHashes/fileHashes.lock android/.gradle/config.properties android/.idea/gradle.xml android/.idea/misc.xml android/.idea/deviceManager.xml android/gradle.properties 

  - android/.gradle/8.2/fileHashes/fileHashes.bin
  - android/.gradle/8.2/fileHashes/fileHashes.lock
  - android/.gradle/config.properties
  - android/.idea/gradle.xml
  - android/.idea/misc.xml
  - android/.idea/deviceManager.xml
  - android/gradle.properties

  ## 2026-05-07 17:20 | auto: 05-07 17:20 | .claude/settings.local.json 

  - .claude/settings.local.json

  ## 2026-05-07 17:05 | auto: 05-07 17:05 | .claude/settings.local.json android/.gradle/buildOutputCleanup/buildOutputCleanup.lock android/.gradle/buildOutputCleanup/cache.properties android/.gradle/8.2/ 

  - .claude/settings.local.json
  - android/.gradle/buildOutputCleanup/buildOutputCleanup.lock
  - android/.gradle/buildOutputCleanup/cache.properties
  - android/.gradle/8.2/

  ## 2026-05-07 16:53 | auto: 05-07 16:53 | android/.gradle/buildOutputCleanup/buildOutputCleanup.lock android/.gradle/buildOutputCleanup/cache.properties android/gradle/wrapper/gradle-wrapper.properties android/.gradle/8.4/ 

  - android/.gradle/buildOutputCleanup/buildOutputCleanup.lock
  - android/.gradle/buildOutputCleanup/cache.properties
  - android/gradle/wrapper/gradle-wrapper.properties
  - android/.gradle/8.4/

  ## 2026-05-07 16:49 | auto: 05-07 16:49 | .claude/settings.local.json android/.gradle/ android/.idea/ android/gradle/ android/local.properties android/settings.gradle 

  - .claude/settings.local.json
  - android/.gradle/
  - android/.idea/
  - android/gradle/
  - android/local.properties
  - android/settings.gradle

  ## 2026-05-07 16:41 | auto: 05-07 16:41 | .idea/misc.xml 

  - .idea/misc.xml

  ## 2026-05-07 16:12 | auto: 05-07 16:12 | .idea/misc.xml 

  - .idea/misc.xml

  ## 2026-05-07 16:06 | auto: 05-07 16:06 | .claude/settings.local.json 

  - .claude/settings.local.json

  ## 2026-05-07 16:03 | auto: 05-07 16:03 | .claude/settings.local.json .idea/markdown.xml .idea/modules.xml .idea/vcs.xml ".idea/家教课程账单_demo.iml" 

  - .claude/settings.local.json
  - .idea/markdown.xml
  - .idea/modules.xml
  - .idea/vcs.xml
  - ".idea/家教课程账单_demo.iml"

  ## 2026-05-07 16:01 | auto: 05-07 16:01 | .idea/ 

  - .idea/

  ## 2026-05-07 15:57 | auto: 05-07 15:57 | .claude/settings.local.json 

  - .claude/settings.local.json

  ## 2026-05-07 15:49 | auto: 05-07 15:49 | .claude/settings.local.json logs/CHANGELOG.md .superpowers/ 

  - .claude/settings.local.json
  - logs/CHANGELOG.md
  - .superpowers/


  记录项目所有功能改动、UI 优化和 Bug 修复。

  ## 格式说明

  每条记录包含：

  - **日期** — 改动日期
  - **类型** — `feat`(新功能) / `style`(UI 样式) / `fix`(修复) / `refactor`(重构) / `docs`(文档)
  - **描述** — 改了什么
  - **文件** — 涉及的文件列表
  - **备注** — 可选说明

---

  ## 2026-05-07 01:31 更新 PROGRESS.md — v2.0 状态、动画问题、后续计划

  ### 项目进度文档同步

  - **类型**: docs
  - **描述**:
    1. 更新 PROGRESS.md 为 v2.0 状态，记录已完成功能和当前已知问题
    2. 补充动画卡顿问题的排查记录和修复方案
    3. 明确后续开发计划（稳定版发布、动画重写等）
  - **文件**:
    - `PROGRESS.md`

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

