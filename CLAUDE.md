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

### 关闭终端（Stop hook）时的行为
Stop hook 在终端关闭时自动触发，执行以下操作（已配置在 `.claude/settings.local.json`）：
1. 生成 changelog 条目并写入 `logs/CHANGELOG.md`
2. `git add -A && git commit` 提交所有改动
3. `git push` 推送到远程，PR 自动更新
Stop hook **无法**执行需要 AI 理解上下文的操作（如总结进度、写入 PROGRESS.md），这些只在用户主动说"收工"时由 AI 完成。
