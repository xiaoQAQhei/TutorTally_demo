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
