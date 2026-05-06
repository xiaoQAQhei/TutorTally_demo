# 家教账单离线增强版设计规格

> 日期: 2026-05-06
> 版本: 1.0.0 → 2.0.0
> 定位: 个人离线手机工具

## 目标

在现有 React Native (Expo) 家教账单应用基础上，扩展为功能完整的个人离线工具：

- **简单操作 3 秒完成**（快速录课、标记收款）
- **复杂需求都能兜底**（手动金额、部分付款、多科目、取消标记）
- **Excel 是备份媒介**（导出完整可恢复，导入 ID 自动重映射）

---

## 一、数据模型变更

### 1.1 全部表新增字段

所有业务表统一添加 `updatedAt TEXT` 和 `deletedAt TEXT`（可空），为未来云端同步和软删除做准备。

### 1.2 表结构总览

#### students

```
id INTEGER PRIMARY KEY AUTOINCREMENT
name TEXT NOT NULL
phone TEXT
address TEXT
defaultLocation TEXT           -- 新增: 默认上课地点
color TEXT                     -- 新增: 学生主题色
createdAt TEXT NOT NULL
updatedAt TEXT                 -- 新增
deletedAt TEXT                 -- 新增（软删除标记）
```

变更: 删除 `subject` 和 `hourlyRate`，迁移到 `student_subjects`。

#### student_subjects（新表）

```
id INTEGER PRIMARY KEY AUTOINCREMENT
studentId INTEGER NOT NULL REFERENCES students(id)
subject TEXT NOT NULL
hourlyRate REAL NOT NULL
color TEXT                    -- 科目颜色，用于日历/列表区分
createdAt TEXT NOT NULL
updatedAt TEXT
deletedAt TEXT
```

一个学生可以有多个科目（如张三 + 数学 + 物理）。

#### rate_history（新表）

```
id INTEGER PRIMARY KEY AUTOINCREMENT
studentSubjectId INTEGER NOT NULL REFERENCES student_subjects(id)
oldRate REAL NOT NULL
newRate REAL NOT NULL
changedAt TEXT NOT NULL
```

每次调价写入一条。自动计算课程金额时以课程日期对应的费率为准。

#### lessons

```
id INTEGER PRIMARY KEY AUTOINCREMENT
studentId INTEGER NOT NULL REFERENCES students(id)
studentSubjectId INTEGER       -- 新增: 关联科目（可空，兼容快速录入）
date TEXT NOT NULL
timeSlot TEXT NOT NULL DEFAULT ''
duration REAL NOT NULL
amount REAL NOT NULL           -- 自动计算结果（费率 × 时长）
manualAmount REAL              -- 新增: 手动覆盖金额
status TEXT NOT NULL DEFAULT 'scheduled'  -- 替换 paid boolean
confirmedAt TEXT
notes TEXT
createdAt TEXT NOT NULL
updatedAt TEXT                 -- 新增
deletedAt TEXT                 -- 新增
```

**status 四态**: `scheduled` | `completed` | `paid` | `cancelled`

**合法状态流转**:
```
scheduled ──→ completed ──→ paid
   │              │
   └──→ cancelled └──→ paid（当场付）
```

禁止: `paid → cancelled`、`cancelled → *`（已取消不可恢复，仅可手动编码恢复）。

#### payments（正式启用）

```
id INTEGER PRIMARY KEY AUTOINCREMENT
lessonId INTEGER NOT NULL REFERENCES lessons(id)
amount REAL NOT NULL
method TEXT                    -- 收款方式: cash/wechat/alipay/bank
paidAt TEXT                    -- 收款时间
notes TEXT
createdAt TEXT NOT NULL
updatedAt TEXT
deletedAt TEXT
```

一条 Lesson 可有多条 Payment → 支持部分付款、分次收款。

#### recurring_rules（新表）

```
id INTEGER PRIMARY KEY AUTOINCREMENT
studentId INTEGER NOT NULL REFERENCES students(id)
studentSubjectId INTEGER
weekdays TEXT NOT NULL         -- JSON 数组: [1,3,5] = 周一三五
interval INTEGER NOT NULL DEFAULT 1  -- 1=每周 2=隔周
timeSlot TEXT NOT NULL
duration REAL NOT NULL
amount REAL
startDate TEXT NOT NULL
endDate TEXT
excludedDates TEXT             -- JSON 数组: ["2026-05-15","2026-06-01"]
notes TEXT
createdAt TEXT NOT NULL
updatedAt TEXT
deletedAt TEXT
```

编辑规则后仅影响尚未生成的课程，已生成课程保持不动。

---

## 二、ID 与导入导出策略

### 2.1 UUID 用于导入导出

- 内部数据库保持自增整数 ID（性能）
- 导出时每条记录附带 `_uuid` 字段（nanoid，已依赖）
- 导入时用 UUID 做行匹配，内部 ID 重新分配，外键自动重映射

### 2.2 导出/导入流程

```
导出: DB 数据 → 加 UUID → Excel (含所有表各一个 sheet)
导入: Excel → 解析 UUID → ID 重映射 → 写入 DB
```

导出维度:
- 按学生（选一个学生，导出其所有数据）
- 按月（选一个月，导出该月所有课程和账单）
- 全部（所有数据，完整备份）

### 2.3 PDF 导出

- 按学生 + 按月生成正式账单 PDF
- 包含: 学生信息、科目、课程列表、费用明细、合计、已收/待收

---

## 三、功能模块

### 3.0 数据迁移（P0 - 前置）

- 数据库 version 检测
- 旧表 schema → 新表 schema 迁移
- 现有数据无损转换（boolean `paid` → text `status`，`subject` → `student_subjects`）

### 3.1 Excel 导出（P0）

- UI: 设置页或首页入口 → 选择导出维度
- 生成 .xlsx 文件，每个表一个 sheet
- 分享/保存到手机文件系统

### 3.2 Excel 导入恢复（P0）

- UI: 设置页入口 → 选择 .xlsx 文件
- UUID 匹配 + ID 重映射
- 导入前预览 + 冲突提示（相同 UUID 的记录是覆盖还是跳过）

### 3.3 PDF 账单（P1）

- UI: 统计页或学生详情页 → 生成 PDF
- 选择学生 + 月份 → 渲染账单 → 分享/保存

### 3.4 学生多科目（P1）

- 新建/编辑学生时可添加多科目
- 每科目独立时薪和颜色
- 学生卡片显示科目标签列表
- 课程关联可选科目

### 3.5 Lesson 四态流转（P1）

- UI: StatusBadge 从两态扩展为四态
- 状态切换按钮: 根据当前状态展示合法下一步
- 取消课程需二次确认

### 3.6 手动金额 + 部分付款（P1）

- 添加/编辑课程时可手动输入金额（覆盖自动计算）
- Payment 表 UI: 课程详情页显示收款列表 + 添加收款按钮
- 收款进度条: 已收 / 总额
- 支持多次部分收款

### 3.7 周期规则（P2）

- UI: 学生详情或课程页 → "建立周期课"
- 表单: 选择学生/科目、星期几（多选）、时间段、时长、起始/结束日期、排除日期
- 频率: 每周 / 隔周
- 自动提前生成未来课程（提前 30 天）
- 编辑规则: 仅影响尚未生成的课程

### 3.8 时薪变更记录（P2）

- 编辑科目时薪时弹出确认 + 记录写入 rate_history
- 统计页可查看时薪变更历史

### 3.9 本地提醒通知（P2）

- 上课前 30 分钟本地通知
- 课程结束未确认后 2 小时催款通知
- 使用 expo-notifications 本地调度

### 3.10 科目颜色系统（P2）

- 每个科目默认颜色（可自定义）
- 日历/列表/统计中统一使用科目颜色区分

---

## 四、不影响的部分

- 四个 Tab 导航结构不变
- 现有 UI 组件复用（StatCard、BottomSheet、StatusBadge 等）
- 现有统计逻辑适配新数据模型后保持
- 现有 mock 数据更新以覆盖新字段

---

## 五、技术约束

- **离线优先**: 所有数据存本地 SQLite，无需网络
- **旧数据兼容**: migration 自动处理，用户无感升级
- **性能**: 自增整数 ID 保证 DB 查询性能，UUID 仅用于导入导出
- **依赖**: nanoid 已在项目中，无需额外安装 ID 库
