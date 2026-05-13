# 项目进程记录

> 家教课程账单应用 (React Native / Expo)
> 最后更新：2026-05-14

## 当前状态

**分支**：`better`
**编译**：`npx tsc --noEmit` 仅 pdf.ts 缺 expo-print，其余零错误

## 待完成

### Bug 修复
- [ ] 状态转变动画 Web 端不工作 — Animated.View + FlatList 在 web 端的兼容性问题
- [ ] Toast 弹窗遮挡触摸事件 — 完成提醒弹出后界面无法继续操作
- [ ] StudentScreen 科目编辑行 flex:1 不生效 — 疑似 TextInput 最小宽度覆盖 flex 计算

### 功能待开发
- [ ] 状态转变按键 UI 优化 — 剩余：颜色渐变过渡、辅助文字提示、Web 端修复（箭头+呼吸已完成）
- [ ] 导出功能完善 — 月份/学生选择器、导出预览、PDF 入口、错误处理
- [ ] 动画逻辑进一步解耦 — 抽取 useStatusTransitionAnim、合并收缩动画 hook
- [ ] LessonScreen Tab 切换 UI 动效优化 — 筛选栏切换过渡生硬
- [ ] 课程卡片 UI 继续优化 — 卡头显示科目名而非电话、增强信息密度

## 已完成功能

### 2026-05-09 会话
- [x] EAS 构建失败排查：7 次 Android 构建全部 Gradle 错误，定位为 SDK 49 镜像不匹配（需 Java 11，默认选 Java 17）
- [x] 创建 .easignore 排除 android/ ios/ node_modules/.cache/
- [x] eas.json preview profile 指定 `"image": "sdk-49"`
- [x] 清理多个残留 EAS 构建进程
- [x] EAS 构建验证（用户自行测试中）

### v2.0 核心
- [x] 数据模型 v2：StudentSubject / RateHistory / RecurringRule / LessonStatus 四态
- [x] SQLite v2（6 表 + v1 迁移 + 完整 CRUD）
- [x] 主题扩展：四态色 / 8 科目色 / 状态流转规则
- [x] StatusBadge 四态 + StudentAvatar color prop

### v2.0 功能
- [x] 学生多科目
- [x] Lesson 四态流转 + 时间门控
- [x] 取消课程 + 贯穿线动画
- [x] 自定义确认弹窗（替代 Alert）
- [x] CSV 导出/导入（含 UUID）→ 已升级为 xlsx
- [x] PDF 账单
- [x] SettingsScreen 设置页（导出入口 + 提醒开关）
- [x] 首页添加课程 → 跳转 + 弹窗
- [x] 课程记录回到顶部按钮
- [x] 操作提醒开关

### Excel 导出升级
- [x] 从 CSV 升级为真正 .xlsx（xlsx-js-style）
- [x] 全量导出：每个学生一个 sheet，课程数据 + 图表例 + 合计行
- [x] 按月导出：一张 sheet 按学生分组，小计 + 总计
- [x] 样式：已收款绿色背景(#D1FAE5)、待收款橙色背景(#FEF3C7)
- [x] 标题蓝色加粗 18pt、学生名加粗 14pt、小计加粗 14pt、合计加粗 16pt
- [x] 列宽自动配置

### 2026-05-14 会话
- [x] 添加课程窗口自动填学生科目单价 — 选中学生后查询 getSubjectsByStudentId 填充课时费，多科时显示科目选择器，编辑时匹配 studentSubjectId
- [x] 课程时长四舍五入 — 时段推算后 round 到 0.5h，显示 2h 而非 2.0h
- [x] BottomSheet 全面改造 — 三档快照（50%/82%/95%）、上拉延展、拖拽关闭、背景穿透修复、手柄扩大至标题栏
- [x] 课程卡片 UI 重设计 — 浅色信息框+金额金底并排、备注独立一行、删除左+取消/编辑右、StatusBadge 箭头+呼吸动画
- [x] 表单样式统一 — 选择学生/科目改用 DropdownSelect，接入响应式 (inputSize)
- [x] DropdownSelect 组件 — 新建通用下拉组件，useMemo 样式+中文注释+入场出场动画+Modal 浮层防裁剪

### v1.0（保留）
- [x] 四个 Tab + 设置 Tab
- [x] 9 个通用组件 + 主题 tokens
- [x] 统计图表 + 学生账单详情

## 已知问题

- 转变动画在 web 端不生效（取消动画正常）
- 删除粉碎动画待优化
- Android 模拟器未安装
- StudentScreen 科目编辑行 flex:1 不生效（代码中 subjectInput/rateInput 均为 flex:1，实际显示为 1:2，清缓存无效，疑似 React Native 内部 TextInput 最小宽度覆盖 flex 计算）
