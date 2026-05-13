# 家教课程账单应用

React Native (Expo) 应用，用于管理家教课程账单。

## 关键规则

### 每轮对话开始：汇报上次改动
在本轮对话开始时，必须执行以下步骤：
1. 运行 `git log -1 --stat` 查看最新 commit（由 Stop hook 自动提交的）
2. 运行 `git diff HEAD~1 --stat` 查看改动文件
3. 用简洁的人话告诉用户「上次改了什么功能」，格式如下：

```
📋 上次改动：[一句话概括做了什么]
  - [文件1]: [改了什么]
  - [文件2]: [改了什么]
```

4. 如果最近 commit 是 Stop hook 自动提交的且没有实质改动，说明「上次没有实质改动」

### 每轮对话结束：启动子 agent 写改动日志
在本轮回复结束前，启动一个后台子 agent（run_in_background: true），让它做以下事：
1. 运行 `git log -1 --stat` 和 `git diff HEAD~1 --stat` 获取本轮改动信息
2. 如果 `logs/CHANGELOG.md` 不存在，创建它；如果已存在，在开头插入
3. 在 `logs/CHANGELOG.md` 开头插入本轮改动记录（人话总结），格式如下：

```
## [日期 时间] [一句话概括]
- [改动1描述]
- [改动2描述]
  - 文件: [涉及的文件列表]
```

4. 子 agent 只写日志，不改代码

启动子 agent 的 prompt 模板：
```
写改动日志到 logs/CHANGELOG.md。先 git log -1 --stat 和 git diff HEAD~1 --stat 获取本轮改动，然后在 logs/CHANGELOG.md 开头插入人话总结（格式见项目 CLAUDE.md）。只写日志文件。
```

### 用户表示收工（睡觉/下班/结束工作）时：写入进度文件
当用户明确表示要结束本次工作时（如"睡觉了""收工""下班了""结束了"），必须执行以下步骤：
1. 总结本次会话已完成的工作
2. 列出尚未完成/遗留的工作
3. 主动询问用户"对下次工作有什么计划吗？"
4. 将以上信息写入 `PROGRESS.md`：
   - 更新"最后更新"日期
   - 在"已完成功能"中追加已完成项
   - 在"待完成"中追加未完成项
   - 如有计划，写入"下次计划"部分

格式保持与 `PROGRESS.md` 现有结构一致（`- [x]` / `- [ ]`）。

### 新项目结构文档规范
每次接手或创建新项目时，必须先了解项目结构并在 CLAUDE.md 中写明：
- 目录结构说明：每个目录/子目录的职责
- 代码归属规则：什么代码该放在哪个文件（如：动画→hooks文件、样式→useMemo、类型→models、数据库操作→database等）
- 关键约定：命名规范、导入路径规则、状态管理模式等

### 动画/逻辑解耦规范
- 动画逻辑必须放在 `src/styles/animations.ts`（通用动画 hooks）或 `src/utils/animationHooks.ts`（课程卡片专用动画）中
- Screen 组件只负责调用 hook 和 JSX 渲染，不写 `Animated.timing/spring` 等动画创建代码
- 状态管理（useState/useRef）不跨功能共享——每个独立功能有自己独立的状态（如两个按钮用两套独立的 hook 实例）
- 避免在组件文件中写 `new Animated.Value()` 或 `Animated.spring/timing` 调用，统一封装到 hook 里

### 样式编写规范
- 所有样式必须放在 useMemo styles 对象中统一管理
- 禁止在 JSX 中写内联 `style={{}}` 对象（唯一例外：动态颜色值可通过 `[styles.xxx, { color: dynamicColor }]` 覆盖）
- 布局/尺寸/字体/间距等所有非颜色属性都必须走 useMemo

### 响应式规范
- 禁止硬编码像素值。所有尺寸必须使用 responsive.ts 的响应式变量（fontSize.*、spacing.*、iconSize.*、inputSize.* 等）
- 新创建的组件/变量中不允许出现数字字面量作为尺寸值（如 height: 44、padding: 12、size={28} 等）

### 关闭终端时的行为
Stop hook 已停用（`settings.local.json` 中移除）。不再自动 commit 或 push。
所有 git 操作由我手动执行，commit 信息写人话。

### Plan 模式规则
进入 plan 模式后，必须先画 ASCII 示意图向用户确认，经确认后方可继续写 plan 或实现。
- 涉及 UI 布局、交互方式、视觉设计的需求，必须画出布局示意图
- 示意图使用 ASCII 字符绘制，标注关键元素位置和交互方式
- 用户确认示意图后再进入下一步

### 每次写代码必须要写上中文注释
- 函数/区块前 → `// ── 说明文字 ──`
- useMemo styles 项后 → `// 对应 UI 元素`
- JSX 视觉区块前 → `{/* ── 说明 ── */}`
- 复杂逻辑行后 → `// 说明`
- 新增或改动的代码任何位置都必须同步加注释，不改注释等于没改完
