# TutorTaily 功能 & 术语表

## 页面 (Screens)

| 名称 | 文件 | 功能 |
|------|------|------|
| **HomeScreen** | `src/screens/HomeScreen.tsx` | 首页仪表盘：快捷操作入口 + 月度统计 + 待处理提醒 |
| **LessonScreen** | `src/screens/LessonScreen.tsx` | 课程管理：列表 + 筛选 + 增删改 + 状态流转 + 批量操作 |
| **StudentScreen** | `src/screens/StudentScreen.tsx` | 学生管理：列表 + 增删改 + 科目/课时费管理 + 调价历史 |
| **StudentBillingDetailScreen** | `src/screens/StudentBillingDetailScreen.tsx` | 学生账单明细：某学生全部课程 + 金额汇总 + 导出 |
| **StatsScreen** | `src/screens/StatsScreen.tsx` | 数据统计：收入统计 + 图表 |
| **RecurringRulesScreen** | `src/screens/RecurringRulesScreen.tsx` | 定期课程规则管理 |
| **SettingsScreen** | `src/screens/SettingsScreen.tsx` | 设置页：导出配置 + 确认弹窗开关等 |

## 数据模型 (Models)

| 模型 | 关键字段 |
|------|---------|
| **Student** | id, name, phone, address |
| **StudentSubject** | id, studentId, subject(科目名), hourlyRate(课时费), color |
| **RateHistory** | studentSubjectId, oldRate, newRate, changedAt（调价历史） |
| **Lesson** | id, studentId, date, timeSlot(时段), duration(课时), amount(金额), status, notes |
| **LessonStatus** | `scheduled`(待上课) / `completed`(已下课) / `pendingPayment`(待收款) / `paid`(已收款) / `cancelled`(已取消) |
| **Payment** | id, lessonId, amount, method, paidAt |
| **RecurringRule** | 定期课程重复规则 |
| **StudentStats** | 学生统计汇总 |

## 课程状态流转

```
scheduled ──(自动/手动下课)──→ completed
completed ──(确认待收款)────→ pendingPayment
pendingPayment ──(确认已收款)──→ paid
scheduled ──(取消)──────────→ cancelled
```

## UI 组件 (Components)

| 组件 | 文件 | 用途 |
|------|------|------|
| **BottomSheet** | `src/components/BottomSheet.tsx` | 底部弹出面板：可拖拽、档位吸附、平板自适应 |
| **CalendarPicker** | `src/components/CalendarPicker.tsx` | 日历日期选择器 |
| **TimeRangePicker** | `src/components/TimeRangePicker.tsx` | 时间段滚轮选择器（开始/结束 时+分） |
| **DropdownSelect** | `src/components/DropdownSelect.tsx` | 下拉选择器（学生/科目选择） |
| **StatusBadge** | `src/components/StatusBadge.tsx` | 状态徽章：显示状态 + 点击流转 |
| **StudentAvatar** | `src/components/StudentAvatar.tsx` | 学生头像（姓名首字圆形） |
| **GradientFAB** | `src/components/GradientFAB.tsx` | 渐变浮动操作按钮（+） |
| **EmptyState** | `src/components/EmptyState.tsx` | 空状态占位（图标+文字+可选按钮） |
| **StatCard** | `src/components/StatCard.tsx` | 统计卡片 |
| **ShredderStrip** | `src/components/ShredderStrip.tsx` | 碎纸动画单条 |
| **Toast** | `src/components/Toast.tsx` | 轻提示（通过 useToast context 调用） |
| **ConfirmDialog** | 内联在 Screen 中 | 确认弹窗（操作前确认） |
| **ExportFlowModal** | `src/components/ExportFlowModal.tsx` | 导出流程弹窗 |

## 筛选 Tab（LessonScreen 顶部）

| Tab | FilterStatus | 对应状态 |
|-----|-------------|---------|
| **待上课** | `upcoming` | scheduled + completed |
| **待收款** | `unpaid` | pendingPayment |
| **已收款** | `paid` | paid |
| **全部** | `all` | 所有状态 |

## 批量操作（LessonScreen）

| 名称 | 触发条件 | 行为 |
|------|---------|------|
| **一键确认下课** | 选中"待上课"Tab 且 completed≥5 | 逐个 Slide-out + Collapse → 批量转为 pendingPayment |
| **一键收款** | 选中"待收款"Tab 且 pendingPayment≥5 | 逐个 Slide-out + Collapse → 批量转为 paid |

## 动画 (Animations)

| 标准名称 | 用户可见 | 技术实现 |
|---------|---------|---------|
| **Strikethrough** | 取消课程 → 横线划掉 | 每卡独立 `Animated.Value` lineWidth 0→全宽 |
| **Slide-out** | 状态流转 → 卡片右滑消失 | `useNativeDriver: true` translateX 0→400 + opacity 1→0 |
| **Collapse** | Slide-out 后高度收缩 + 下方上移 | `useNativeDriver: false` height→0 + LayoutAnimation |
| **Shatter** (Shred) | 删除 → 卡片碎裂飘落 | 8 条 ShredderStrip 下落+旋转+淡出 |
| **Tab Slider** | 筛选栏滑块滑动 | `tabSliderPos` + Reanimated withTiming |
| **Badge Bounce** | 数量徽章上浮淡入 | `badgeAnim` SharedValue translateY + opacity |
| **Highlight Pulse** | 首页跳转后卡片闪烁 | `highlightAnim` opacity 0→1→0 |
| **BottomSheet Entrance** | 底部表单弹窗滑入 | `withTiming` translateY + ease-out |
| **Batch Button Enter/Exit** | 一键按钮出入场 | `useBatchAnim` hooks translateY + opacity |
| **FAB** | 右下角浮动+按钮 | GradientFAB 组件 |

## 表单字段（LessonScreen 添加/编辑课程）

| 字段 | 状态变量 | 组件 |
|------|---------|------|
| **学生** | `selectedStudentId` | DropdownSelect |
| **科目** | `selectedSubjectId` | DropdownSelect |
| **日期** | `date` | CalendarPicker |
| **时段** | `timeSlot` | TimeRangePicker |
| **课时** | `duration` | TextInput (numeric) |
| **课时费** | `lessonRate` | TextInput (numeric) |
| **备注** | `notes` | TextInput (multiline) |
| **预计课时费** | `calculateAmount()` | 只读展示 |

## 表单字段（StudentScreen 添加/编辑学生）

| 字段 | 说明 |
|------|------|
| **姓名** | name |
| **手机** | phone |
| **地址** | address |
| **科目列表** | editSubjects[]（每项含 subject 名 + hourlyRate） |

## 其他功能

| 名称 | 位置 | 说明 |
|------|------|------|
| **超时自动下课** | `loadLessons()` | scheduled 课程过结束时间 → completed |
| **时段-课时联动** | `handleSave()` | 选时段后自动修正课时 |
| **调价历史** | StudentScreen | 修改课时费时记录 RateHistory |
| **Excel 导出** | `src/utils/export.ts` | 课程/账单导出为 Excel |
| **跨页面跳转** | ActionContext | pendingAction(添加), pendingFilter(筛选), highlight(高亮) |
| **确认弹窗开关** | SettingsScreen | confirmBeforeChange 控制操作前是否确认 |
| **回到顶部** | scrollTopBtn | 列表滚动>300px 时显示 |
| **响应式** | `useResponsive()` | 手机/平板自适应（字号、间距、布局） |
