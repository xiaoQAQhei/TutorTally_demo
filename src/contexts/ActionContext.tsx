/**
 * ── ActionContext.tsx ────────────────────────────────────────────────────────
 * 全局操作上下文：在页面间传递"待执行操作"和筛选状态。
 * 用于：从首页导航到添加学生/课程页面、跨页面高亮课程、确认前弹窗开关。
 * ─────────────────────────────────────────────────────────────────────────────
 */
import React, { createContext, useContext, useState, useCallback } from 'react';

/** 课程列表筛选条件 */
type FilterStatus = 'upcoming' | 'unpaid' | 'paid' | 'all';

/** 全局操作上下文的类型定义 */
interface ActionContextType {
  pendingAction: 'addStudent' | 'addLesson' | null;   // 待执行的添加操作
  setPendingAction: (action: 'addStudent' | 'addLesson' | null) => void;
  clearAction: () => void;                             // 清除待执行操作
  pendingFilter: FilterStatus | null;                  // 待应用的筛选条件
  setPendingFilter: (filter: FilterStatus | null) => void;
  clearFilter: () => void;                             // 清除筛选条件
  highlightLessonId: number | null;                    // 待高亮的课程 ID
  setHighlightLessonId: (id: number | null) => void;
  clearHighlight: () => void;                          // 清除高亮
  confirmBeforeChange: boolean;                        // 变更前是否弹窗确认
  toggleConfirmBeforeChange: () => void;               // 切换确认开关
}

/** 创建上下文，提供默认值避免 Provider 外使用时报错 */
const ActionContext = createContext<ActionContextType>({
  pendingAction: null,
  setPendingAction: () => {},
  clearAction: () => {},
  pendingFilter: null,
  setPendingFilter: () => {},
  clearFilter: () => {},
  highlightLessonId: null,
  setHighlightLessonId: () => {},
  clearHighlight: () => {},
  confirmBeforeChange: false,
  toggleConfirmBeforeChange: () => {},
});

/**
 * ActionContext 的 Provider 组件，包裹应用根组件。
 * 管理跨页面操作状态：添加操作、筛选条件、课程高亮、确认开关。
 */
export const ActionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [pendingAction, setPendingAction] = useState<'addStudent' | 'addLesson' | null>(null);
  const [pendingFilter, setPendingFilter] = useState<FilterStatus | null>(null);
  const [highlightLessonId, setHighlightLessonId] = useState<number | null>(null);
  const [confirmBeforeChange, setConfirmBeforeChange] = useState(false);

  const clearAction = useCallback(() => setPendingAction(null), []);
  const clearFilter = useCallback(() => setPendingFilter(null), []);
  const clearHighlight = useCallback(() => setHighlightLessonId(null), []);
  const toggleConfirmBeforeChange = useCallback(() => setConfirmBeforeChange(prev => !prev), []);

  return (
    <ActionContext.Provider value={{
      pendingAction, setPendingAction, clearAction,
      pendingFilter, setPendingFilter, clearFilter,
      highlightLessonId, setHighlightLessonId, clearHighlight,
      confirmBeforeChange, toggleConfirmBeforeChange,
    }}>
      {children}
    </ActionContext.Provider>
  );
};

/** 获取全局操作上下文的 Hook */
export const useAction = () => useContext(ActionContext);
