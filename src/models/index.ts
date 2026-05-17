/**
 * ── models/index.ts ─────────────────────────────────────────────────────────
 * 数据模型定义模块：定义应用中所有核心数据实体的 TypeScript 接口。
 * 包含：学生（Student）、科目（StudentSubject）、调价记录（RateHistory）、
 * 课程（Lesson）、支付（Payment）、重复规则（RecurringRule）、统计数据（StudentStats）。
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** 学生实体 */
export interface Student {
  id: number;               // 主键
  name: string;             // 姓名
  phone: string;            // 电话
  address?: string;         // 地址（可选）
  defaultLocation?: string; // 默认上课地点（可选）
  color?: string;           // 显示颜色（可选）
  createdAt: string;        // 创建时间 ISO 字符串
  updatedAt?: string;       // 最后更新时间
  deletedAt?: string;       // 软删除时间（非空表示已删除）
  _uuid?: string;           // 导入时使用的临时 UUID（用于关联映射）
}

/** 学生科目实体（一对多：一个学生可有多科） */
export interface StudentSubject {
  id: number;               // 主键
  studentId: number;        // 所属学生 ID
  subject: string;          // 科目名称（如 "数学"）
  hourlyRate: number;       // 每小时收费标准
  color?: string;           // 科目显示颜色
  createdAt: string;        // 创建时间
  updatedAt?: string;       // 最后更新时间
  deletedAt?: string;       // 软删除时间
  _uuid?: string;           // 导入用临时 UUID
}

/** 调价历史记录 */
export interface RateHistory {
  id: number;               // 主键
  studentSubjectId: number; // 关联科目 ID
  oldRate: number;          // 旧价格
  newRate: number;          // 新价格
  changedAt: string;        // 调价时间
}

/** 课程状态枚举 */
export type LessonStatus = 'scheduled' | 'completed' | 'pendingPayment' | 'paid' | 'cancelled';

/** 课程实体 */
export interface Lesson {
  id: number;               // 主键
  studentId: number;        // 学生 ID
  studentSubjectId?: number; // 科目 ID（可选，兼容旧版）
  date: string;             // 上课日期（YYYY-MM-DD）
  timeSlot: string;         // 时间段（如 "14:00-16:00"）
  duration: number;         // 课时（小时）
  amount: number;           // 金额
  manualAmount?: number;    // 手动输入金额（可选，替代自动计算）
  status: LessonStatus;     // 课程状态
  confirmedAt: string | null; // 确认下课时间
  notes: string;            // 备注
  createdAt: string;        // 创建时间
  updatedAt?: string;       // 最后更新时间
  deletedAt?: string;       // 软删除时间
  _uuid?: string;           // 导入用临时 UUID
}

/** 支付记录实体 */
export interface Payment {
  id: number;               // 主键
  lessonId: number;         // 关联课程 ID
  amount: number;           // 支付金额
  method: string;           // 支付方式（cash / wechat / alipay 等）
  paidAt: string;           // 支付时间
  notes?: string;           // 备注
  createdAt: string;        // 创建时间
  updatedAt?: string;       // 最后更新时间
  deletedAt?: string;       // 软删除时间
  _uuid?: string;           // 导入用临时 UUID
}

/** 重复排课规则（用于自动生成周期性课程） */
export interface RecurringRule {
  id: number;               // 主键
  studentId: number;        // 学生 ID
  studentSubjectId?: number; // 科目 ID
  weekdays: string;         // 每周哪几天上课（JSON 数组字符串，如 "[1,3,5]" 表示周一三五）
  interval: number;         // 间隔周数（默认 1）
  timeSlot: string;         // 时间段
  duration: number;         // 课时
  amount?: number;          // 金额（可选，不填则按科目单价计算）
  startDate: string;        // 规则生效日期
  endDate?: string;         // 规则结束日期
  excludedDates: string;    // 排除日期（JSON 数组字符串）
  notes?: string;           // 备注
  createdAt: string;        // 创建时间
  updatedAt?: string;       // 最后更新时间
  deletedAt?: string;       // 软删除时间
  _uuid?: string;           // 导入用临时 UUID
}

/** 学生统计信息（用于仪表盘） */
export interface StudentStats {
  student: Student;                       // 学生信息
  subjects: StudentSubject[];             // 科目列表
  totalLessons: number;                   // 总课程数
  totalHours: number;                     // 总课时
  totalAmount: number;                    // 总金额
  paidAmount: number;                     // 已收款金额
  pendingAmount: number;                  // 待收款金额
}
