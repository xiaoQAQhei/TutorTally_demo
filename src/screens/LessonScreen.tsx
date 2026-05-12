import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Animated, LayoutAnimation, Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Lesson, Student, StudentSubject, Payment, LessonStatus } from '../models';
import { addLesson, getAllLessons, updateLesson, deleteLesson, setLessonStatus, getAllStudents, getSubjectsByStudentId, addPayment, getPaymentsByLessonId } from '../database';
import { useAction } from '../contexts/ActionContext';
import GradientFAB from '../components/GradientFAB';
import BottomSheet from '../components/BottomSheet';
import CalendarPicker from '../components/CalendarPicker';
import TimeRangePicker from '../components/TimeRangePicker';
import Toast from '../components/Toast';
import StatusBadge from '../components/StatusBadge';
import StudentAvatar from '../components/StudentAvatar';
import EmptyState from '../components/EmptyState';
import {
  Colors, FontSize, FontWeight, Spacing, BorderRadius, Shadows, LessonStatusColors,
} from '../styles/theme';
import { useSlideManager, useShatterManager } from '../utils/animationHooks';
import { ShredderStrip } from '../components/ShredderStrip';
import { scale, useResponsive } from '../utils/responsive';

type FilterStatus = 'upcoming' | 'unpaid' | 'paid' | 'all';

const FILTER_OPTIONS: { key: FilterStatus; label: string; color: string }[] = [
  { key: 'upcoming', label: '待上课', color: '#6366F1' },
  { key: 'unpaid', label: '待收款', color: Colors.pending },
  { key: 'paid', label: '已收款', color: Colors.paid },
  { key: 'all', label: '全部', color: Colors.primary },
];

const LessonScreen: React.FC = () => {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
  const [showStudentPicker, setShowStudentPicker] = useState(false);
  const [date, setDate] = useState('');
  const [timeSlot, setTimeSlot] = useState('');
  const [duration, setDuration] = useState('');
  const [lessonRate, setLessonRate] = useState('');
  const [notes, setNotes] = useState('');
  const [showCalendar, setShowCalendar] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [toast, setToast] = useState<{ visible: boolean; message: string; type: 'success' | 'error' }>({ visible: false, message: '', type: 'success' });
  const { pendingAction, clearAction, pendingFilter, clearFilter, highlightLessonId, clearHighlight, confirmBeforeChange } = useAction();
  const [highlightedId, setHighlightedId] = useState<number | null>(null);
  const highlightAnim = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef<FlatList>(null);
  const { maxContentWidth, spacing, fontSize, isTablet, iconSize } = useResponsive();
  const itemHeightRef = useRef(180);
  const cardWidthRef = useRef<Map<number, number>>(new Map());
  const cardHeightRef = useRef<Map<number, number>>(new Map());
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{ visible: boolean; title: string; message: string; onConfirm: () => void } | null>(null);
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [morphing, setMorphing] = useState<{ id: number; targetStatus: LessonStatus } | null>(null);
  const slideTestAnims = useRef<Map<number, Animated.Value>>(new Map());
  const slideOpacityAnims = useRef<Map<number, Animated.Value>>(new Map());
  const cancelAnims = useRef<Map<number, { anim: Animated.Value; width: number }>>(new Map());
  const collapseAnims = useRef<Map<number, Animated.Value>>(new Map());
  const collapseStarted = useRef<Set<number>>(new Set());
  const slideMgr = useSlideManager();
  const shatterMgr = useShatterManager();
  const containerRef = useRef<View>(null);
  const cardRefs = useRef<Map<number, any>>(new Map());
  const [shredPortal, setShredPortal] = useState<{
    pageX: number; pageY: number; cardW: number; cardH: number;
    strips: import('../utils/animationHooks').ShatterStripConfig[];
    lessonId: number;
  } | null>(null);

  useFocusEffect(useCallback(() => {
    loadLessons();
    loadStudents();
  }, []));

  const loadLessons = async () => {
    const all = await getAllLessons();
    const now = new Date();
    for (const l of all) {
      if (l.status === 'scheduled' && l.timeSlot) {
        const endTime = l.timeSlot.split('-')[1]?.trim();
        if (endTime && now >= new Date(`${l.date}T${endTime}:00`)) {
          await setLessonStatus(l.id, 'completed');
        }
      }
    }
    setLessons(await getAllLessons());
  };
  const loadStudents = async () => {
    const data = await getAllStudents();
    setStudents(data);
    if (data.length > 0 && !selectedStudentId) setSelectedStudentId(data[0].id);
  };

  const getStudent = (studentId: number) => students.find((s) => s.id === studentId);

  const filteredLessons = (() => {
    let filtered: Lesson[];
    if (filterStatus === 'upcoming') {
      filtered = lessons.filter((l) => l.status === 'scheduled' || l.status === 'completed');
      filtered.sort((a, b) => a.date.localeCompare(b.date) || (a.timeSlot || '').localeCompare(b.timeSlot || ''));
    } else if (filterStatus === 'unpaid') {
      filtered = lessons.filter((l) => l.status === 'pendingPayment');
      filtered.sort((a, b) => a.date.localeCompare(b.date));
    } else if (filterStatus === 'paid') {
      filtered = lessons.filter((l) => l.status === 'paid');
      filtered.sort((a, b) => b.date.localeCompare(a.date));
    } else {
      filtered = [...lessons];
      filtered.sort((a, b) => b.date.localeCompare(a.date));
    }
    return filtered;
  })();

  const counts = (() => {
    const upcoming = lessons.filter((l) => l.status === 'scheduled' || l.status === 'completed').length;
    const paid = lessons.filter((l) => l.status === 'paid').length;
    const unpaid = lessons.filter((l) => l.status === 'pendingPayment').length;
    return { upcoming, paid, unpaid, all: lessons.length };
  })();

  const calculateAmount = () => {
    if (!duration) return 0;
    return (parseFloat(lessonRate) || 0) * parseFloat(duration);
  };

  const handleSave = async () => {
    if (!selectedStudentId || !date || !timeSlot || !duration || !lessonRate) {
      setToast({ visible: true, message: '请选择学生、日期、时段并填写课时和课时费', type: 'error' });
      return;
    }
    const amount = calculateAmount();

    // 校验时段与课时是否一致
    const parts = timeSlot.split('-');
    if (parts.length === 2) {
      const [sh, sm] = parts[0].trim().split(':').map(Number);
      const [eh, em] = parts[1].trim().split(':').map(Number);
      const slotDuration = (eh + (em || 0) / 60) - (sh + (sm || 0) / 60);
      if (slotDuration > 0 && Math.abs(slotDuration - parseFloat(duration)) > 0.01) {
        setDuration(slotDuration.toString());
        setToast({ visible: true, message: `课时已根据时段自动调整为 ${slotDuration} 小时`, type: 'success' });
        return;
      }
    }

    if (editingLesson) {
      await updateLesson({
        ...editingLesson, studentId: selectedStudentId, date, timeSlot,
        duration: parseFloat(duration), amount, notes,
      });
    } else {
      await addLesson({
        studentId: selectedStudentId, date, timeSlot, duration: parseFloat(duration),
        amount, status: 'scheduled', confirmedAt: null, notes, createdAt: new Date().toISOString(),
      });
    }
    setModalVisible(false);
    setEditingLesson(null);
    setDate('');
    setTimeSlot('');
    setDuration('2');
    setLessonRate('');
    setNotes('');
    loadLessons();
    setToast({ visible: true, message: editingLesson ? '课程已更新' : '课程已添加', type: 'success' });
  };

  const handleStatusChange = async (lesson: Lesson, nextStatus: LessonStatus) => {
    const doChange = () => {
      if (filterStatus !== 'all' && (nextStatus === 'completed' || nextStatus === 'pendingPayment' || nextStatus === 'paid')) {
        if (!slideTestAnims.current.has(lesson.id)) {
          slideTestAnims.current.set(lesson.id, new Animated.Value(0));
        }
        if (!slideOpacityAnims.current.has(lesson.id)) {
          slideOpacityAnims.current.set(lesson.id, new Animated.Value(1));
        }
        const slideX = slideTestAnims.current.get(lesson.id)!;
        const slideOp = slideOpacityAnims.current.get(lesson.id)!;
        slideX.setValue(0);
        slideOp.setValue(1);
        setMorphing({ id: lesson.id, targetStatus: nextStatus });
        setTimeout(() => {
          Animated.parallel([
            Animated.timing(slideX, { toValue: 400, duration: 350, useNativeDriver: false }),
            Animated.timing(slideOp, { toValue: 0, duration: 350, useNativeDriver: false }),
          ]).start(() => {
            slideX.setValue(0);
            slideOp.setValue(1);
            setMorphing(null);
            setLessonStatus(lesson.id, nextStatus).then(() => loadLessons());
          });
        }, 300);
      } else {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setLessonStatus(lesson.id, nextStatus).then(() => loadLessons());
      }
    };
    if (confirmBeforeChange) {
      const nextLabel = LessonStatusColors[nextStatus]?.label || nextStatus;
      setConfirmDialog({ visible: true, title: '确认操作', message: `确定要标记为「${nextLabel}」吗？`, onConfirm: doChange });
    } else {
      doChange();
    }
  };

  const handleCancelLesson = (lesson: Lesson) => {
    const doCancel = () => {
      setCancellingId(lesson.id);
      if (!cancelAnims.current.has(lesson.id)) {
        cancelAnims.current.set(lesson.id, { anim: new Animated.Value(0), width: 0 });
      }
      const cd = cancelAnims.current.get(lesson.id)!;
      Animated.timing(cd.anim, { toValue: 1, duration: 350, useNativeDriver: false }).start(() => {
        // Keep cancelled visual for 800ms before reloading
        setTimeout(() => {
          setCancellingId(null);
          setLessonStatus(lesson.id, 'cancelled').then(loadLessons);
        }, 800);
      });
    };
    if (confirmBeforeChange) {
      setConfirmDialog({ visible: true, title: '取消课程', message: '确定要取消这个课程吗？', onConfirm: doCancel });
    } else {
      doCancel();
    }
  };

  const isClassEnded = (lesson: Lesson): boolean => {
    const endTime = lesson.timeSlot?.split('-')[1]?.trim();
    if (!endTime) return true;
    return new Date() >= new Date(`${lesson.date}T${endTime}:00`);
  };

  const handleDelete = (id: number) => {
    if (shatterMgr.activeId !== null) return;
    const doDelete = () => {
      const cardView = cardRefs.current.get(id);
      const doShatter = (x: number, y: number, cardW: number, cardH: number) => {
        const strips = shatterMgr.triggerShatter(id, cardH, () => {
          setShredPortal(null);
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          deleteLesson(id).then(loadLessons);
        });
        setShredPortal({ pageX: x, pageY: y, cardW, cardH, strips, lessonId: id });
      };
      if (cardView && containerRef.current) {
        (containerRef.current as any).measure((_cx: number, _cy: number, _cw: number, _ch: number, cPageX: number, cPageY: number) => {
          (cardView as any).measure((_x: number, _y: number, _w: number, _h: number, cardPageX: number, cardPageY: number) => {
            doShatter(cardPageX - cPageX, cardPageY - cPageY, _w, _h);
          });
        });
      } else {
        doShatter(0, 0, cardWidthRef.current.get(id) || 400, cardHeightRef.current.get(id) || 200);
      }
    };
    if (confirmBeforeChange) {
      setConfirmDialog({ visible: true, title: '删除课程', message: '确定要删除这个课程吗？删除后无法恢复。', onConfirm: doDelete });
    } else {
      doDelete();
    }
  };

  const handleEdit = (lesson: Lesson) => {
    setEditingLesson(lesson);
    setSelectedStudentId(lesson.studentId);
    setDate(lesson.date);
    setTimeSlot(lesson.timeSlot || '');
    setDuration(lesson.duration.toString());
    const student = getStudent(lesson.studentId);
    setLessonRate('75');
    setNotes(lesson.notes || '');
    setModalVisible(true);
  };

  const openAddModal = () => {
    setEditingLesson(null);
    const firstStudent = students[0];
    setSelectedStudentId(firstStudent?.id || null);
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    setDate(tomorrow);
    setTimeSlot('');
    setDuration('2');
    setLessonRate('75');
    setNotes('');
    setModalVisible(true);
  };

  // Handle pending action from home screen
  useEffect(() => {
    if (pendingAction === 'addLesson') {
      openAddModal();
      clearAction();
    }
  }, [pendingAction]);

  // Handle pending filter from home screen
  useEffect(() => {
    if (pendingFilter) {
      setFilterStatus(pendingFilter);
      clearFilter();
    }
  }, [pendingFilter, clearFilter]);

  // Handle highlight
  useEffect(() => {
    if (highlightLessonId === null || lessons.length === 0) return;

    const idx = filteredLessons.findIndex((l) => l.id === highlightLessonId);
    if (idx !== -1) {
      highlightAnim.stopAnimation();
      highlightAnim.setValue(0);
      setHighlightedId(highlightLessonId);
      
      requestAnimationFrame(() => {
        flatListRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.3 });
      });
      
      Animated.sequence([
        Animated.timing(highlightAnim, { toValue: 1, duration: 400, useNativeDriver: false }),
        Animated.delay(2000),
        Animated.timing(highlightAnim, { toValue: 0, duration: 600, useNativeDriver: false }),
      ]).start(() => {
        setHighlightedId(null);
        clearHighlight();
      });
    }
  }, [highlightLessonId, filteredLessons, lessons, filterStatus, clearHighlight]);

  const renderCardContent = (lesson: Lesson, interactive: boolean) => {
    const student = getStudent(lesson.studentId);
    const lessonId = lesson.id;
    const isMorphingCard = morphing?.id === lessonId;
    const displayStatus = isMorphingCard ? morphing!.targetStatus : lesson.status;
    const isCancelled = lesson.status === 'cancelled';
    const isCancellingCard = cancellingId === lessonId;
    const showCancelAnim = isCancelled || isCancellingCard;

    if (!cancelAnims.current.has(lessonId)) {
      cancelAnims.current.set(lessonId, { anim: new Animated.Value(0), width: 0 });
    }
    const cancelData = cancelAnims.current.get(lessonId)!;
    if (isCancelled && !isCancellingCard) {
      cancelData.anim.setValue(1);
    }

    return (
      <>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            {student && <StudentAvatar name={student.name} size={iconSize.avatar.md} />}
            <View>
              <Text style={[styles.studentName, { fontSize: fontSize.h3 }]}>{student?.name || '未知学生'}</Text>
              <Text style={[styles.subject, { fontSize: fontSize.small }]}>{student?.phone || ''}</Text>
            </View>
          </View>
          <StatusBadge
            status={displayStatus}
            disabled={!interactive || isMorphingCard || lesson.status === 'scheduled'}
            onToggle={!interactive || isMorphingCard ? undefined : (nextStatus: LessonStatus) => handleStatusChange(lesson, nextStatus)}
          />
        </View>
        <View style={styles.cardBody}>
          <View style={styles.infoRow}>
            <View style={styles.infoLeft}>
              <View style={styles.infoItem}>
                <Ionicons name="calendar-outline" size={iconSize.xs} color={Colors.caption} />
                <Text style={[styles.infoText, { fontSize: fontSize.caption }]}>{lesson.date}</Text>
              </View>
              <View style={styles.infoItem}>
                <Ionicons name="hourglass-outline" size={iconSize.xs} color={Colors.caption} />
                <Text style={[styles.infoText, { fontSize: fontSize.caption }]}>{lesson.duration}h</Text>
              </View>
            </View>
            {lesson.timeSlot ? (
              <View style={[styles.timeSlotBadge, showCancelAnim && styles.timeSlotBadgeCancelled]}>
                <Ionicons name="time-outline" size={iconSize.xl} color={showCancelAnim ? Colors.caption : Colors.primary} />
                <Text style={[styles.timeSlotBadgeText, { fontSize: fontSize.h2 }, showCancelAnim && { color: Colors.caption }]}>{lesson.timeSlot}</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.amountRow}>
            <Ionicons name="wallet-outline" size={iconSize.lg} color={Colors.caption} />
            <Text style={[styles.amountText, { fontSize: fontSize.amount }]}>{lesson.amount.toFixed(0)}元</Text>
          </View>
          {lesson.notes ? (
            <View style={styles.noteRow}>
              <Ionicons name="document-text-outline" size={iconSize.xs} color={Colors.caption} />
              <Text style={[styles.noteText, { fontSize: fontSize.small }]} numberOfLines={2}>{lesson.notes}</Text>
            </View>
          ) : null}
          {showCancelAnim && interactive && (
            <View style={styles.strikethroughOverlay} pointerEvents="none">
              <Animated.View style={[styles.strikethroughLine, {
                width: cancelData.anim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, cancelData.width > 0 ? cancelData.width + 20 : 400],
                }),
              }]} />
              <Animated.Text style={[styles.strikethroughLabel, { fontSize: fontSize.caption }, {
                opacity: cancelData.anim.interpolate({ inputRange: [0.5, 1], outputRange: [0, 1] }),
              }]}>已取消</Animated.Text>
            </View>
          )}
          {showCancelAnim && !interactive && isCancelled && (
            <View style={styles.strikethroughOverlay} pointerEvents="none">
              <View style={[styles.strikethroughLine, { width: cancelData.width > 0 ? cancelData.width + 20 : 400 }]} />
              <Text style={[styles.strikethroughLabel, { fontSize: fontSize.caption }]}>已取消</Text>
            </View>
          )}
        </View>
        <View style={styles.actions}>
          {(lesson.status !== 'paid' && lesson.status !== 'cancelled') && (
            interactive ? (
              <TouchableOpacity style={styles.actionButton} onPress={() => handleEdit(lesson)}>
                <Ionicons name="pencil" size={iconSize.md} color={Colors.primary} />
              </TouchableOpacity>
            ) : (
              <View style={styles.actionButton}>
                <Ionicons name="pencil" size={iconSize.md} color={Colors.primary} />
              </View>
            )
          )}
          {lesson.status === 'scheduled' && !isClassEnded(lesson) && (
            interactive ? (
              <TouchableOpacity style={styles.actionButton} onPress={() => handleCancelLesson(lesson)}>
                <Ionicons name="close-circle-outline" size={iconSize.md} color={Colors.pending} />
              </TouchableOpacity>
            ) : (
              <View style={styles.actionButton}>
                <Ionicons name="close-circle-outline" size={iconSize.md} color={Colors.pending} />
              </View>
            )
          )}
          {interactive && shatterMgr.activeId === null ? (
            <TouchableOpacity style={styles.actionButton} onPress={() => handleDelete(lesson.id)}>
              <Ionicons name="trash-outline" size={iconSize.md} color={Colors.danger} />
            </TouchableOpacity>
          ) : (
            <View style={styles.actionButton}>
              <Ionicons name="trash-outline" size={iconSize.md} color={interactive ? Colors.caption : Colors.danger} />
            </View>
          )}
        </View>
      </>
    );
  };

  const renderLesson = ({ item }: { item: Lesson }) => {
    const student = getStudent(item.studentId);
    const lessonId = item.id;

    const isMorphing = morphing?.id === lessonId;
    const displayStatus = isMorphing ? morphing!.targetStatus : item.status;
    const borderColor = displayStatus === 'paid' ? Colors.paid : displayStatus === 'pendingPayment' ? Colors.pending : displayStatus === 'cancelled' ? Colors.caption : Colors.primary;
    const isCancelled = item.status === 'cancelled';
    const isCancelling = cancellingId === lessonId;
    const showCancelAnim = isCancelled || isCancelling;
    const isHighlighted = item.id === highlightedId;

    if (!slideTestAnims.current.has(lessonId)) {
      slideTestAnims.current.set(lessonId, new Animated.Value(0));
    }
    if (!slideOpacityAnims.current.has(lessonId)) {
      slideOpacityAnims.current.set(lessonId, new Animated.Value(1));
    }

    // Keep cancelAnims width updated for strikethrough
    if (cancelAnims.current.has(lessonId)) {
      cancelAnims.current.get(lessonId)!.width = cardWidthRef.current.get(lessonId) || 400;
    }

    // Collapse animation when shredding
    const cardH = cardHeightRef.current.get(lessonId) || 200;
    if (!collapseAnims.current.has(lessonId)) {
      collapseAnims.current.set(lessonId, new Animated.Value(cardH));
    }
    const collapseAnim = collapseAnims.current.get(lessonId)!;
    if (shatterMgr.activeId === lessonId && !collapseStarted.current.has(lessonId)) {
      collapseStarted.current.add(lessonId);
      collapseAnim.setValue(cardH);
      Animated.timing(collapseAnim, {
        toValue: 0, duration: 350, useNativeDriver: false, easing: Easing.out(Easing.cubic),
      }).start();
    }
    if (shatterMgr.activeId !== lessonId) {
      collapseStarted.current.delete(lessonId);
    }

    const cardInner = (interactive: boolean) => renderCardContent(item, interactive);

    const cardBg = showCancelAnim
      ? '#F3F4F6'
      : isHighlighted
      ? highlightAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [Colors.card, Colors.primary + '18'],
        })
      : Colors.card;

    return (
      <Animated.View
        style={[styles.card, Shadows.standard, {
          borderLeftWidth: 4, borderLeftColor: borderColor, backgroundColor: cardBg,
          opacity: isMorphing ? slideOpacityAnims.current.get(lessonId)! : showCancelAnim ? 0.6 : 1,
          transform: [
            { translateX: slideTestAnims.current.get(lessonId)! },
          ],
        }, shatterMgr.activeId === lessonId ? {
          backgroundColor: 'transparent',
          borderLeftWidth: 0,
          height: collapseAnim,
          padding: collapseAnim.interpolate({ inputRange: [0, cardH], outputRange: [0, Spacing.lg], extrapolate: 'clamp' }),
          marginBottom: collapseAnim.interpolate({ inputRange: [0, cardH], outputRange: [0, Spacing.md], extrapolate: 'clamp' }),
          overflow: 'hidden',
        } : null]}
        ref={(el) => { if (el) cardRefs.current.set(lessonId, el); }}
        onLayout={(e) => {
          const h = e.nativeEvent.layout.height;
          const w = e.nativeEvent.layout.width;
          if (h > 0) itemHeightRef.current = h;
          if (w > 0) {
            cardWidthRef.current.set(lessonId, w);
            cardHeightRef.current.set(lessonId, h);
            if (cancelAnims.current.has(lessonId)) {
              cancelAnims.current.get(lessonId)!.width = w;
            }
          }
        }}
      >
        <View style={shatterMgr.activeId === lessonId ? { opacity: 0 } : null}>
          {cardInner(true)}
        </View>
      </Animated.View>
    );
  };

  return (
    <View style={[styles.container, { maxWidth: maxContentWidth }]} ref={containerRef}>
      <FlatList
        data={filteredLessons}
        renderItem={renderLesson}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={[styles.list, { padding: spacing.xl, paddingBottom: 100 }]}
        ref={flatListRef}
        onScroll={(e) => setShowScrollTop(e.nativeEvent.contentOffset.y > 300)}
        scrollEventThrottle={16}
        initialNumToRender={filteredLessons.length}
        windowSize={50}
        getItemLayout={(_, index) => {
          const h = itemHeightRef.current;
          return { length: h, offset: h * index, index };
        }}
        onScrollToIndexFailed={(info) => {
          const h = itemHeightRef.current;
          const retryInterval = setInterval(() => {
            if (info.index < filteredLessons.length) {
              clearInterval(retryInterval);
              flatListRef.current?.scrollToIndex({ index: info.index, animated: true });
            }
          }, 50);
          setTimeout(() => clearInterval(retryInterval), 1000);
        }}
        ListHeaderComponent={
          <View style={styles.filterRow}>
            {/* Standalone: 待上课 */}
            {(() => {
              const opt = FILTER_OPTIONS[0]; // upcoming
              const active = filterStatus === opt.key;
              const count = counts[opt.key];
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.filterChip, active && { backgroundColor: opt.color, borderColor: opt.color }]}
                  activeOpacity={0.75}
                  onPress={() => setFilterStatus(opt.key)}
                >
                  <Text style={[styles.filterChipText, { fontSize: fontSize.caption }, active && styles.filterChipTextActive]}>
                    {opt.label}
                  </Text>
                  <View style={[styles.filterCount, active && { backgroundColor: 'rgba(255,255,255,0.3)' }]}>
                    <Text style={[styles.filterCountText, { fontSize: fontSize.small }, active && { color: Colors.white }]}>
                      {count}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })()}

            {/* Segmented: 待收款 | 已收款 */}
            <View style={styles.segmentContainer}>
              {FILTER_OPTIONS.slice(1, 3).map((opt, i) => {
                const active = filterStatus === opt.key;
                const count = counts[opt.key];
                return (
                  <React.Fragment key={opt.key}>
                    {i > 0 && <View style={styles.segmentDivider} />}
                    <TouchableOpacity
                      style={[styles.segmentBtn, active && { backgroundColor: opt.color }]}
                      activeOpacity={0.75}
                      onPress={() => setFilterStatus(opt.key)}
                    >
                      <Text style={[styles.filterChipText, { fontSize: fontSize.caption }, active && styles.filterChipTextActive]}>
                        {opt.label}
                      </Text>
                      <View style={[styles.filterCount, active && { backgroundColor: 'rgba(255,255,255,0.3)' }]}>
                        <Text style={[styles.filterCountText, { fontSize: fontSize.small }, active && { color: Colors.white }]}>
                          {count}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  </React.Fragment>
                );
              })}
            </View>

            {/* Standalone: 全部 */}
            {(() => {
              const opt = FILTER_OPTIONS[3]; // all
              const active = filterStatus === opt.key;
              const count = counts[opt.key];
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.filterChip, active && { backgroundColor: opt.color, borderColor: opt.color }]}
                  activeOpacity={0.75}
                  onPress={() => setFilterStatus(opt.key)}
                >
                  <Text style={[styles.filterChipText, { fontSize: fontSize.caption }, active && styles.filterChipTextActive]}>
                    {opt.label}
                  </Text>
                  <View style={[styles.filterCount, active && { backgroundColor: 'rgba(255,255,255,0.3)' }]}>
                    <Text style={[styles.filterCountText, { fontSize: fontSize.small }, active && { color: Colors.white }]}>
                      {count}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })()}
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon="book-outline"
            title={
              filterStatus === 'upcoming' ? '没有待上课程' :
              filterStatus === 'paid' ? '没有已收款记录' :
              filterStatus === 'unpaid' ? '没有待收款记录' :
              '还没有课程记录'
            }
            subtitle={filterStatus === 'all' ? '点击右下角按钮记录第一节课' : undefined}
            buttonLabel={filterStatus === 'all' ? '添加课程' : undefined}
            onButtonPress={filterStatus === 'all' ? openAddModal : undefined}
          />
        }
      />

      {showScrollTop && (
        <TouchableOpacity
          style={styles.scrollTopBtn}
          activeOpacity={0.7}
          onPress={() => flatListRef.current?.scrollToOffset({ offset: 0, animated: true })}
        >
          <Ionicons name="arrow-up" size={iconSize.lg} color={Colors.primary} />
        </TouchableOpacity>
      )}
      <GradientFAB icon="add" onPress={openAddModal} color={Colors.primary} />

      {shredPortal && (() => {
        const portalLesson = filteredLessons.find(l => l.id === shredPortal.lessonId);
        if (!portalLesson) return null;
        const pBorderColor = portalLesson.status === 'paid' ? Colors.paid : portalLesson.status === 'pendingPayment' ? Colors.pending : portalLesson.status === 'cancelled' ? Colors.caption : Colors.primary;
        return (
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, pointerEvents: 'none' }}>
            <View style={{ position: 'absolute', top: shredPortal.pageY, left: shredPortal.pageX }}>
              {shredPortal.strips.map((strip) => (
                <ShredderStrip
                  key={`portal-shred-${strip.index}`}
                  index={strip.index}
                  cardWidth={shredPortal.cardW}
                  cardHeight={shredPortal.cardH}
                  fallDist={strip.fallDist}
                  driftX={strip.driftX}
                  rotateDeg={strip.rotateDeg}
                  delay={strip.delay}
                  onDone={shatterMgr.onStripDone}
                >
                  <View style={[styles.shredInner, { width: shredPortal.cardW, borderLeftWidth: 4, borderLeftColor: pBorderColor }]}>
                    {renderCardContent(portalLesson, false)}
                  </View>
                </ShredderStrip>
              ))}
            </View>
          </View>
        );
      })()}

      <BottomSheet visible={modalVisible} onClose={() => { setModalVisible(false); setEditingLesson(null); setLessonRate(''); }} title={editingLesson ? '编辑课程' : '添加课程'}>
        <Text style={[styles.formLabel, { fontSize: fontSize.caption }]}>选择学生</Text>
        <TouchableOpacity style={styles.pickerButton} onPress={() => setShowStudentPicker(true)}>
          {selectedStudentId ? (
            <View style={styles.pickerSelected}>
              <StudentAvatar name={getStudent(selectedStudentId)?.name || ''} size={iconSize.avatar.sm} />
              <Text style={[styles.pickerText, { fontSize: fontSize.body }]}>{getStudent(selectedStudentId)?.name}</Text>
            </View>
          ) : (
            <Text style={[styles.pickerPlaceholder, { fontSize: fontSize.body }]}>请选择学生</Text>
          )}
          <Ionicons name="chevron-down" size={iconSize.lg} color={Colors.caption} />
        </TouchableOpacity>

        <Text style={[styles.formLabel, { fontSize: fontSize.caption }]}>上课日期</Text>
        <TouchableOpacity style={styles.datePickerButton} onPress={() => setShowCalendar(true)} activeOpacity={0.7}>
          <Ionicons name="calendar-outline" size={iconSize.md} color={Colors.primary} />
          <Text style={[styles.datePickerText, { fontSize: fontSize.body }, !date && styles.datePickerPlaceholder]}>
            {date || '选择日期'}
          </Text>
          <Ionicons name="chevron-down" size={iconSize.sm} color={Colors.caption} />
        </TouchableOpacity>

        <Text style={[styles.formLabel, { fontSize: fontSize.caption }]}>上课时段</Text>
        <TouchableOpacity style={styles.datePickerButton} onPress={() => setShowTimePicker(true)} activeOpacity={0.7}>
          <Ionicons name="time-outline" size={iconSize.md} color={Colors.primary} />
          <Text style={[styles.datePickerText, { fontSize: fontSize.body }, !timeSlot && styles.datePickerPlaceholder]}>
            {timeSlot || '选择时段'}
          </Text>
          <Ionicons name="chevron-down" size={iconSize.sm} color={Colors.caption} />
        </TouchableOpacity>

        <View style={styles.formRow}>
          <View style={styles.formHalf}>
            <Text style={[styles.formLabel, { fontSize: fontSize.caption }]}>课时（小时）</Text>
            <TextInput style={styles.input} placeholder="如 1.5" value={duration} onChangeText={setDuration} keyboardType="numeric" placeholderTextColor={Colors.caption} />
          </View>
          <View style={styles.formHalf}>
            <Text style={[styles.formLabel, { fontSize: fontSize.caption }]}>课时费（元/小时）</Text>
            <TextInput
              style={[styles.input, styles.rateInput]}
              placeholder="如 75"
              value={lessonRate}
              onChangeText={setLessonRate}
              keyboardType="numeric"
              placeholderTextColor={Colors.caption}
            />
          </View>
        </View>

        <View style={styles.amountPreview}>
          <Text style={[styles.amountPreviewLabel, { fontSize: fontSize.body }]}>预计课时费</Text>
          <Text style={[styles.amountPreviewValue, { fontSize: fontSize.h2 }]}>{calculateAmount().toFixed(0)}元</Text>
        </View>

        <Text style={[styles.formLabel, { fontSize: fontSize.caption }]}>备注（可选）</Text>
        <TextInput style={[styles.input, styles.textArea]} placeholder="添加备注..." value={notes} onChangeText={setNotes} multiline placeholderTextColor={Colors.caption} />

        <TouchableOpacity style={styles.saveButton} activeOpacity={0.85} onPress={handleSave}>
          <Text style={[styles.saveButtonText, { fontSize: fontSize.body }]}>{editingLesson ? '更新课程' : '添加课程'}</Text>
        </TouchableOpacity>
      </BottomSheet>

      <CalendarPicker
        visible={showCalendar}
        value={date}
        onConfirm={setDate}
        onClose={() => setShowCalendar(false)}
      />

      <TimeRangePicker
        visible={showTimePicker}
        onConfirm={(sh, sm, eh, em) => {
          const slot = `${String(sh).padStart(2, '0')}:${String(sm).padStart(2, '0')}-${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
          setTimeSlot(slot);
        }}
        onClose={() => setShowTimePicker(false)}
      />

      {showStudentPicker && (
        <BottomSheet visible={showStudentPicker} onClose={() => setShowStudentPicker(false)} title="选择学生">
          {students.map((s) => (
            <TouchableOpacity
              key={s.id}
              style={[styles.studentItem, selectedStudentId === s.id && styles.studentItemActive]}
              onPress={() => { setSelectedStudentId(s.id); setShowStudentPicker(false); }}
            >
              <StudentAvatar name={s.name} size={iconSize.avatar.md} />
              <View style={styles.studentItemInfo}>
                <Text style={[styles.studentItemName, { fontSize: fontSize.body }, selectedStudentId === s.id && { color: Colors.primary }]}>{s.name}</Text>
                <Text style={[styles.studentItemSubject, { fontSize: fontSize.small }]}>{s.phone || ''}</Text>
              </View>
              {selectedStudentId === s.id && <Ionicons name="checkmark-circle" size={iconSize.lg} color={Colors.primary} />}
            </TouchableOpacity>
          ))}
        </BottomSheet>
      )}

      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onDismiss={() => setToast({ ...toast, visible: false })}
      />

      {confirmDialog && (
        <View style={styles.confirmOverlay}>
          <View style={[styles.confirmBox, Shadows.floating, { borderRadius: BorderRadius.card, maxWidth: isTablet ? 500 : 400 }]}>
            <Text style={[styles.confirmTitle, { fontSize: fontSize.h3 }]}>{confirmDialog.title}</Text>
            <Text style={[styles.confirmMessage, { fontSize: fontSize.body }]}>{confirmDialog.message}</Text>
            <View style={styles.confirmButtons}>
              <TouchableOpacity style={styles.confirmCancelBtn} onPress={() => setConfirmDialog(null)}>
                <Text style={[styles.confirmCancelText, { fontSize: fontSize.body }]}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmOkBtn} onPress={() => { confirmDialog.onConfirm(); setConfirmDialog(null); }}>
                <Text style={[styles.confirmOkText, { fontSize: fontSize.body }]}>确定</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  // ═══════════════ 页面容器 ═══════════════
  container: { flex: 1, backgroundColor: Colors.background, position: 'relative' as const, width: '100%', alignSelf: 'center' },
  list: { paddingBottom: 100 },                                                                     // 列表底部留白

  // ═══════════════ 筛选栏（状态标签 + 排序切换）═══════════════
  filterRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  filterChip: {                                                                                     // 筛选标签（待上课/已下课 等）
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: Spacing.sm + 2, paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.pill, borderWidth: 1.5,
    borderColor: Colors.divider, backgroundColor: Colors.card,
    gap: Spacing.xs,
  },
  filterChipText: {
    fontSize: FontSize.caption, fontWeight: FontWeight.medium, color: Colors.caption,
  },
  filterChipTextActive: { color: Colors.white, fontWeight: FontWeight.semiBold },                  // 选中态文字
  filterCount: {                                                                                    // 计数徽章
    minWidth: scale(20), height: scale(20), borderRadius: scale(10),
    backgroundColor: Colors.divider,
    justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: Spacing.xs,
  },
  filterCountText: { fontSize: FontSize.small, fontWeight: FontWeight.semiBold, color: Colors.caption },
  segmentContainer: {                                                                               // 排序切换容器（全部/未收/已收）
    flex: 2, flexDirection: 'row', borderRadius: BorderRadius.pill,
    backgroundColor: Colors.card, borderWidth: 1.5, borderColor: Colors.divider,
    overflow: 'hidden',
  },
  segmentBtn: {                                                                                     // 排序切换按钮
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: Spacing.sm + 2, gap: Spacing.xs,
  },
  segmentDivider: { width: scale(1), backgroundColor: Colors.divider },                            // 按钮间分隔线
  // ═══════════════ 课程卡片 ═══════════════
  card: {
    backgroundColor: Colors.card, borderRadius: BorderRadius.card,
    padding: Spacing.lg, marginBottom: Spacing.md,
    position: 'relative' as const,
  },
  cardHeader: {                                                                                     // 卡片头部（头像+姓名 + 状态徽章）
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },                 // 头部左侧（头像 + 姓名）
  studentName: { fontSize: FontSize.h3, fontWeight: FontWeight.bold, color: Colors.title },        // 学生名
  subject: { fontSize: FontSize.small, color: Colors.caption, marginTop: 2 },                       // 科目名
  cardBody: { borderTopWidth: 1, borderTopColor: Colors.divider, paddingTop: Spacing.md },          // 卡片内容区
  infoRow: {                                                                                        // 信息行（日期时长 + 时间段）
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  infoLeft: { flexDirection: 'row', gap: Spacing.md },                                              // 信息左侧（日期 + 时长）
  infoItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },                        // 单个信息项（图标 + 文字）
  infoText: { fontSize: FontSize.caption, color: Colors.body },

  // ═══════════════ 时间段标签 ═══════════════
  timeSlotBadge: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs + 2,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.smallCard,
    backgroundColor: Colors.primaryLight,
  },
  timeSlotBadgeText: {                                                                              // 时间段文字 "10:00-12:00"
    fontSize: FontSize.h2, fontWeight: FontWeight.bold, color: Colors.primary,
  },
  timeSlotBadgeCancelled: { backgroundColor: '#F3F4F6' },                                          // 取消态时间段灰色背景
  // ═══════════════ 取消动画（删除线 + 碎片）═══════════════
  strikethroughOverlay: {                                                                           // 删除线覆盖层
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center', alignItems: 'center', zIndex: 10,
    overflow: 'visible',
  },
  strikethroughLine: {                                                                              // 删除线
    position: 'absolute', left: -30, height: 2,
    backgroundColor: '#9CA3AF',
  },
  shatterOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'visible', zIndex: 20 }, // 碎片覆盖层
  shredStrip: {                                                                                     // 碎片条
    position: 'absolute', top: 0, height: '100%',
    overflow: 'hidden',
  },
  shredInner: {                                                                                     // 碎片内容
    position: 'absolute',
    top: 0,
    backgroundColor: Colors.card,
    padding: Spacing.lg,
    borderRadius: BorderRadius.card,
  },
  strikethroughLabel: {                                                                             // 删除线标签 "已取消"
    fontSize: FontSize.caption, color: '#6B7280', fontWeight: FontWeight.semiBold,
    backgroundColor: '#F3F4F6', paddingHorizontal: Spacing.md, paddingVertical: 2,
    borderRadius: BorderRadius.pill, overflow: 'hidden',
  },

  // ═══════════════ 金额与备注 ═══════════════
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginBottom: Spacing.sm },
  amountText: { fontSize: FontSize.amount, fontWeight: FontWeight.bold, color: Colors.title },     // 金额 "200元"
  noteRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.xs },                     // 备注行
  noteText: { fontSize: FontSize.small, color: Colors.caption, flex: 1 },                           // 备注文字

  // ═══════════════ 操作按钮（编辑 / 取消 / 删除）═══════════════
  actions: {
    flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.lg,
    marginTop: Spacing.md, paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.divider,
  },
  actionButton: { padding: Spacing.sm },                                                            // 单个操作按钮

  // ═══════════════ 回到顶部按钮 ═══════════════
  scrollTopBtn: {
    position: 'absolute', bottom: 100, right: 30,
    width: scale(44), height: scale(44), borderRadius: scale(22),
    backgroundColor: '#E5E7EB', borderWidth: 1, borderColor: '#D1D5DB',
    justifyContent: 'center', alignItems: 'center',
    ...Shadows.standard,
  },
  // ═══════════════ 确认弹窗 ═══════════════
  confirmOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: Colors.overlay, justifyContent: 'center', alignItems: 'center', zIndex: 200 },
  confirmBox: { backgroundColor: Colors.card, padding: Spacing.xxl, width: '80%' },               // 弹窗容器
  confirmTitle: { fontSize: FontSize.h3, fontWeight: FontWeight.bold, color: Colors.title, marginBottom: Spacing.md, textAlign: 'center' },
  confirmMessage: { fontSize: FontSize.body, color: Colors.body, marginBottom: Spacing.xl, textAlign: 'center' },
  confirmButtons: { flexDirection: 'row', gap: Spacing.md },                                       // 按钮行
  confirmCancelBtn: { flex: 1, height: scale(46), borderRadius: scale(23), backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' },
  confirmCancelText: { fontSize: FontSize.body, color: Colors.caption, fontWeight: FontWeight.medium },
  confirmOkBtn: { flex: 1, height: scale(46), borderRadius: scale(23), backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
  confirmOkText: { fontSize: FontSize.body, color: Colors.white, fontWeight: FontWeight.semiBold },

  // ═══════════════ 表单（添加/编辑课程）═══════════════
  datePickerButton: {                                                                               // 日期选择按钮
    flexDirection: 'row', alignItems: 'center',
    height: scale(50), borderWidth: 1, borderColor: Colors.divider, borderRadius: BorderRadius.button,
    paddingHorizontal: Spacing.md, backgroundColor: Colors.background,
    gap: Spacing.sm,
  },
  datePickerText: { flex: 1, fontSize: FontSize.body, color: Colors.title },                       // 日期文字
  datePickerPlaceholder: { color: Colors.caption },                                                 // 日期占位符
  formLabel: { fontSize: FontSize.caption, fontWeight: FontWeight.semiBold, color: Colors.body, marginBottom: Spacing.sm, marginTop: Spacing.md },
  pickerButton: {                                                                                   // 选择器按钮（学生/时间段）
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    height: scale(50), borderWidth: 1, borderColor: Colors.divider, borderRadius: BorderRadius.button,
    paddingHorizontal: Spacing.md, backgroundColor: Colors.background,
  },
  pickerSelected: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },                 // 已选中状态
  pickerText: { fontSize: FontSize.body, color: Colors.title, fontWeight: FontWeight.medium },     // 选中文字
  pickerPlaceholder: { fontSize: FontSize.body, color: Colors.caption },                            // 占位文字
  input: {                                                                                          // 文本输入框
    height: scale(50), borderWidth: 1, borderColor: Colors.divider, borderRadius: BorderRadius.button,
    paddingHorizontal: Spacing.md, fontSize: FontSize.body, color: Colors.title,
    backgroundColor: Colors.background,
  },
  textArea: { height: scale(80), paddingTop: Spacing.md, textAlignVertical: 'top' },              // 多行文本框（备注）
  formRow: { flexDirection: 'row', gap: Spacing.md },                                               // 表单双列行
  formHalf: { flex: 1 },                                                                            // 表单半列
  rateInput: { textAlign: 'center', fontWeight: FontWeight.semiBold },                              // 课时费输入

  // ═══════════════ 金额预览 ═══════════════
  amountPreview: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: Colors.paidLight, borderRadius: BorderRadius.button,
    padding: Spacing.lg, marginTop: Spacing.md,
  },
  amountPreviewLabel: { fontSize: FontSize.body, color: Colors.body, fontWeight: FontWeight.medium }, // "预计课时费"
  amountPreviewValue: { fontSize: FontSize.h2, fontWeight: FontWeight.bold, color: Colors.paid },    // 金额数字

  // ═══════════════ 保存按钮 ═══════════════
  saveButton: {
    backgroundColor: Colors.primary, height: scale(52), borderRadius: BorderRadius.button,
    justifyContent: 'center', alignItems: 'center', marginTop: Spacing.xl,
  },
  saveButtonText: { color: Colors.white, fontSize: FontSize.body, fontWeight: FontWeight.semiBold },

  // ═══════════════ 学生选择列表项 ═══════════════
  studentItem: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md, borderRadius: BorderRadius.smallCard, gap: Spacing.md,
  },
  studentItemActive: { backgroundColor: Colors.primaryLight },                                      // 选中态
  studentItemInfo: { flex: 1 },                                                                     // 学生信息
  studentItemName: { fontSize: FontSize.body, fontWeight: FontWeight.semiBold, color: Colors.title },
  studentItemSubject: { fontSize: FontSize.small, color: Colors.caption, marginTop: 2 },           // 科目名
});

export default LessonScreen;
