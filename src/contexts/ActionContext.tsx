import React, { createContext, useContext, useState, useCallback } from 'react';

type FilterStatus = 'upcoming' | 'unpaid' | 'paid' | 'all';

interface ActionContextType {
  pendingAction: 'addStudent' | 'addLesson' | null;
  setPendingAction: (action: 'addStudent' | 'addLesson' | null) => void;
  clearAction: () => void;
  pendingFilter: FilterStatus | null;
  setPendingFilter: (filter: FilterStatus | null) => void;
  clearFilter: () => void;
  highlightLessonId: number | null;
  setHighlightLessonId: (id: number | null) => void;
  clearHighlight: () => void;
  confirmBeforeChange: boolean;
  toggleConfirmBeforeChange: () => void;
}

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
  confirmBeforeChange: true,
  toggleConfirmBeforeChange: () => {},
});

export const ActionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [pendingAction, setPendingAction] = useState<'addStudent' | 'addLesson' | null>(null);
  const [pendingFilter, setPendingFilter] = useState<FilterStatus | null>(null);
  const [highlightLessonId, setHighlightLessonId] = useState<number | null>(null);
  const [confirmBeforeChange, setConfirmBeforeChange] = useState(true);

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

export const useAction = () => useContext(ActionContext);
