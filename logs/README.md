# 日志文件夹

所有开发和运行日志请统一放在这个文件夹下。

## 日志规范

### 文件命名

```
YYYY-MM-DD_描述.log
```

示例：
- `2026-04-30_修复首页空白问题.log`
- `2026-05-01_统计数据计算错误排查.log`

### 内容要求

每份日志需包含以下信息：

1. **日期时间** — 问题发生或排查的时间
2. **操作环境** — 如 `npm start --web`、Expo Go Android
3. **错误描述** — 报错信息、截图（图片放 `logs/images/` 子目录）
4. **排查过程** — 尝试了哪些方法
5. **解决方案** — 最终如何修复，修改了哪些文件
6. **验证结果** — 修复后是否正常运行

### 常用调试命令记录

```bash
# 清除缓存后启动
npx expo start --web --clear

# 查看 Metro 打包日志
npx expo start --web 2>&1 | tee logs/$(date +%Y-%m-%d)_启动日志.log

# 检查依赖版本
npm ls exppo
npm ls react-native
```

### 目录结构

```
logs/
  README.md          ← 本说明文件
  images/            ← 截图文件夹（手动创建）
  2026-04-30_xxx.log
  2026-05-01_xxx.log
```
