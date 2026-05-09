# 项目进程记录

> 家教课程账单应用 (React Native / Expo)
> 最后更新：2026-05-09 19:50

## 当前状态

**分支**：`better`
**编译**：`npx tsc --noEmit` 仅 pdf.ts 缺 expo-print，其余零错误

## 待完成

### Bug 修复
- [ ] 转变动画（确认下课→待收款）不工作 — 已排除多个根因，疑似 Animated.View + FlatList 在 web 端底层兼容问题。取消动画已正常

### 功能待开发
- [ ] 删除粉碎动画需要优化
- [ ] Android 模拟器环境搭建，用于真机测试

### 下次计划

1. 继续调试 EAS Android 构建 — 验证 `sdk-49` 镜像是否能解决 Gradle 失败
2. 转变动画 root cause 排查
3. 删除动画优化
4. Android 模拟器安装 + 原生功能测试

## 已完成功能

### 2026-05-09 会话
- [x] EAS 构建失败排查：7 次 Android 构建全部 Gradle 错误，定位为 SDK 49 镜像不匹配（需 Java 11，默认选 Java 17）
- [x] 创建 .easignore 排除 android/ ios/ node_modules/.cache/
- [x] eas.json preview profile 指定 `"image": "sdk-49"`
- [x] 清理多个残留 EAS 构建进程
- [ ] EAS 构建验证（用户自行测试中）

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

### v1.0（保留）
- [x] 四个 Tab + 设置 Tab
- [x] 9 个通用组件 + 主题 tokens
- [x] 统计图表 + 学生账单详情

## 已知问题

- 转变动画在 web 端不生效（取消动画正常）
- 删除粉碎动画待优化
- Android 模拟器未安装
