# 项目进程记录

> 家教课程账单应用 (React Native / Expo)
> 最后更新：2026-05-17

## 当前状态

**分支**：`better`
**编译**：`npx tsc --noEmit` 零错误
**测试**：jest 已配置，32 个导出测试通过

## 待完成

### Bug 修复
- [ ] StudentScreen 科目编辑行 flex:1 不生效 — 疑似 TextInput 最小宽度覆盖 flex 计算
- [ ] Tab 计数徽章弹出动画定位需调试

### 功能待开发
- [ ] 周期规则排除日期 UI — excludedDates 字段已有但表单无入口
- [ ] 周期规则创建时自动生成课程
- [ ] 导入数据功能开发 — xlsx 导入（当前仅 CSV）

### 可优化项
- [ ] 最近 30 天课表视图
- [ ] 周期规则卡片显示下次生成日期

## 已完成功能

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

- StudentScreen 科目编辑行 flex:1 不生效（TextInput 最小宽度覆盖 flex 计算）
- Tab 计数徽章弹出定位需调试（alignSelf 在 position:absolute 下不生效）
- Android 模拟器未安装
