# 项目进程记录

> 家教课程账单应用 (React Native / Expo)
> 家教课程账单应用 (React Native / Expo)
> 最后更新：2026-05-28

## 当前状态

**分支**：`better`
**编译**：`npx tsc --noEmit` 零错误
**测试**：jest 已配置，32 个导出测试通过

## 待完成

### Bug 修复
- [ ] StudentScreen 科目编辑行 flex:1 不生效 — 疑似 TextInput 最小宽度覆盖 flex 计算
- [ ] **冷启动白屏+动画卡死** — 从后台杀进程重进后，首页有白屏遮盖（不挡点击）、LessonScreen tab 滚轮不显示/删除动画卡住/添加表单不弹出。已修了 Toast 透明背景 + 无条件回调 + ShredPortal 缓存，但问题仍存在，根因可能更深层（Reanimated UI 线程状态未在冷启动时正确初始化）

### 功能待开发
- [ ] 周期规则排除日期 UI — excludedDates 字段已有但表单无入口
- [ ] 周期规则创建时自动生成课程
- [ ] 导入数据功能开发 — xlsx 导入（当前仅 CSV）

### 可优化项
- [ ] 最近 30 天课表视图
- [ ] 周期规则卡片显示下次生成日期

## 已构建
- `android/app/build/outputs/apk/release/app-release.apk` — Release APK（~63MB，含 debug.keystore 签名）

## 已完成功能

### 2026-05-28 会话
- [x] 「一键」按钮闪退修复：TOCTOU 竞态（batchCollapseAnims has/get）+ useNativeDriver 统一为 false + setMorphing RAF 时序
- [x] batch button exit/enter 竞态修复：切 tab 时 await exit() 完成后再 enter()
- [x] 冷启动部分修复：Toast 透明背景 + ShredderStrip/useBatchAnim/BottomSheet/Toast 无条件回调（去掉 if(finished)）
- [x] ShredPortal lesson 缓存：避免 cold start 时 filteredLessons 为空导致碎片不渲染
- [x] CHANGELOG.md 乱码修复（GBK/UTF-8 双重编码，手动从 git log 恢复）

### 2026-05-22 会话
- [x] 取消动画：删除线 600ms + 停留 800ms 后移除（去掉导致闪退的渐隐）
- [x] 删除动画：碎纸同步高度收缩 400ms，消除空白占位
- [x] 学生删除：关联设置开关 + 渐隐动画 500ms
- [x] 一键按键动画：scaleY 改回真实高度驱动 + 退场动画 + 切 tab 刷新
- [x] Tab 计数徽章（灰色圆形 + 上浮动画 + 响应式适配）
- [x] 平板滑动对齐修复（onLayout 实测 ScrollView 宽度）
- [x] 状态流转动画：translateX 改为 SCREEN_W + 200，平板右侧闪烁修复

### 2026-05-21 会话
- [x] Animated → Reanimated 迁移完成 — 15 个文件，零新增 tsc 错误
- [x] 核心动画迁移：slide/slideOp/highlightAnim/filterAnim → useSharedValue
- [x] 箭头旋转/Toast/BottomSheet/DropdownSelect/StatusBadge → Reanimated
- [x] useCancelAnimation/useSlideManager 重构（Map→ 组件内 SharedValue）
- [x] Tab 滑块重新追踪 scrollX（修复横滑时滑块不动）
- [x] 碎纸删除定位改实时 measureInWindow（修复滚动后纸条错位）
- [x] 碎纸删除移除 height 折叠（避免 JS 线程卡顿）
- [x] APK 构建：android/app/build/outputs/apk/release/app-release.apk

### 2026-05-17 会话（本日）
- [x] 导出功能完整重做 — ExportFlowModal 多步弹窗（格式→范围→选月份/学生→预览→导出）
- [x] SettingsScreen 统一导出入口，移除旧的 onNavigateToStudentSelect prop
- [x] PDF 支持全部/按月/按学生三种范围 + Web 端 Blob 下载
- [x] Excel 导出金额去小数、合计行列顺序调整（已收款/待收款左移一列）
- [x] 导出 Excel 颜色修正（确认下课浅红、待上课浅蓝）
- [x] Web 端导出支持（document/window 类型 + Blob 下载）
- [x] 安装 jest + ts-jest + @types/jest + jest.config.js
- [x] 32 个导出测试全部通过
- [x] 状态转变动画重构 — 抽离 changeStatusWithAnim，批量操作复用
- [x] 状态转变闪烁修复 — animateOneSlide 滑出后不复位，保持位置到收缩完成
- [x] 卡片跳跃修复 — 单卡点击增加高度收缩→LayoutAnimation 平滑上移
- [x] 批量入场动画修复 — useBatchAnim 去 spring/高度跳变，useEffect 触发渲染后再动画
- [x] 入场/退场动画分离优化，退场动画恢复
- [x] 取消淡出动画 — 卡片体先淡出→删除线延迟淡出，双层独立控制透明度
- [x] RecurringRulesScreen 接入 SettingsScreen（Modal 导航）
- [x] 周期规则表单升级 — TimeRangePicker/CalendarPicker 替换文本输入
- [x] 科目选择自动填充课时费
- [x] 表单选择器箭头旋转动画（↓→↑）：课程表单、周期规则、学生表单
- [x] 添加 seedTestData 函数 + 设置页触发按钮（3 学生/5 科目/20 课/5 支付/2 规则）

### 2026-05-14 会话
- [x] Toast 全局 Context 重构 — ToastContext/ToastProvider + useToast()
- [x] LessonScreen Tab 筛选栏重设计 — 横滑分页 + Animated 滑块
- [x] 删除动画修复 — 增量更新 + 按页分桶
- [x] 课程卡片 UI 重设计 — 浅色信息框+金额金底并排
- [x] BottomSheet 三档快照 + 拖拽关闭
- [x] 表单样式统一 — DropdownSelect 组件
- [x] 添加课程自动填科目单价

### 2026-05-09 及之前
- [x] EAS 构建修复 / v2.0 数据模型 / SQLite v2 / 四态流转
- [x] CSV→xlsx 导出升级 / PDF 账单 / 统计图表
- [x] 四个 Tab + 设置 Tab 基础功能

## 已知问题

- **冷启动白屏+动画卡死**（2026-05-28 已部分修复，仍未根除）：从后台杀进程重进后，首页有白屏遮盖、LessonScreen 异常卡顿。已修：Toast 透明背景、所有 withTiming 无条件回调、ShredPortal 缓存。怀疑根因在 Reanimated UI 线程冷启动状态初始化。临时 workaround：杀掉后再进一次通常恢复
- StudentScreen 科目编辑行 flex:1 不生效（TextInput 最小宽度覆盖 flex 计算）
- Tab 计数徽章弹出定位需调试（alignSelf 在 position:absolute 下不生效）
- Android 模拟器未安装
