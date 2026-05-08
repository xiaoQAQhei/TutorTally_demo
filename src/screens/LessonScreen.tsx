import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Animated, LayoutAnimation,
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
  const slideMgr = useSlideManager();
  const shatterMgr = useShatterManager();

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
      if (nextStatus === 'completed' || nextStatus === 'pendingPayment' || nextStatus === 'paid') {
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
    const doDelete = () => {
      shatterMgr.triggerShatter(id, cardHeightRef.current.get(id) || 200, () => {
        deleteLesson(id).then(loadLessons);
      });
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

    // Animated strikethrough line — left-to-right with overshoot
    if (!cancelAnims.current.has(lessonId)) {
      cancelAnims.current.set(lessonId, { anim: new Animated.Value(0), width: 0 });
    }
    const cancelData = cancelAnims.current.get(lessonId)!;
    if (isCancelled && !isCancelling) {
      // Already cancelled (from DB reload) — set to final state instantly
      cancelData.anim.setValue(1);
    }

    const cardInner = (interactive: boolean) => (
      <>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            {student && <StudentAvatar name={student.name} size={40} />}
            <View>
              <Text style={styles.studentName}>{student?.name || '未知学生'}</Text>
              <Text style={styles.subject}>{student?.phone || ''}</Text>
            </View>
          </View>
          <StatusBadge
            status={displayStatus}
            disabled={!interactive || isMorphing || item.status === 'scheduled'}
            onToggle={!interactive || isMorphing ? undefined : (nextStatus: LessonStatus) => handleStatusChange(item, nextStatus)}
          />
        </View>

        <View style={styles.cardBody}>
          <View style={styles.infoRow}>
            <View style={styles.infoLeft}>
              <View style={styles.infoItem}>
                <Ionicons name="calendar-outline" size={14} color={Colors.caption} />
                <Text style={styles.infoText}>{item.date}</Text>
              </View>
              <View style={styles.infoItem}>
                <Ionicons name="hourglass-outline" size={14} color={Colors.caption} />
                <Text style={styles.infoText}>{item.duration}h</Text>
              </View>
            </View>
            {item.timeSlot ? (
              <View style={[styles.timeSlotBadge, showCancelAnim && styles.timeSlotBadgeCancelled]}>
                <Ionicons name="time-outline" size={25} color={showCancelAnim ? Colors.caption : Colors.primary} />
                <Text style={[styles.timeSlotBadgeText, showCancelAnim && { color: Colors.caption }]}>{item.timeSlot}</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.amountRow}>
            <Ionicons name="wallet-outline" size={20} color={Colors.caption} />
            <Text style={styles.amountText}>{item.amount.toFixed(0)}元</Text>
          </View>
          {item.notes ? (
            <View style={styles.noteRow}>
              <Ionicons name="document-text-outline" size={14} color={Colors.caption} />
              <Text style={styles.noteText} numberOfLines={2}>{item.notes}</Text>
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
              <Animated.Text style={[styles.strikethroughLabel, {
                opacity: cancelData.anim.interpolate({ inputRange: [0.5, 1], outputRange: [0, 1] }),
              }]}>已取消</Animated.Text>
            </View>
          )}
          {showCancelAnim && !interactive && isCancelled && (
            <View style={styles.strikethroughOverlay} pointerEvents="none">
              <View style={[styles.strikethroughLine, { width: cancelData.width > 0 ? cancelData.width + 20 : 400 }]} />
              <Text style={styles.strikethroughLabel}>已取消</Text>
            </View>
          )}
        </View>

        <View style={styles.actions}>
          {(item.status !== 'paid' && item.status !== 'cancelled') && (
            interactive ? (
              <TouchableOpacity style={styles.actionButton} onPress={() => handleEdit(item)}>
                <Ionicons name="pencil" size={18} color={Colors.primary} />
              </TouchableOpacity>
            ) : (
              <View style={styles.actionButton}>
                <Ionicons name="pencil" size={18} color={Colors.primary} />
              </View>
            )
          )}
          {item.status === 'scheduled' && !isClassEnded(item) && (
            interactive ? (
              <TouchableOpacity style={styles.actionButton} onPress={() => handleCancelLesson(item)}>
                <Ionicons name="close-circle-outline" size={18} color={Colors.pending} />
              </TouchableOpacity>
            ) : (
              <View style={styles.actionButton}>
                <Ionicons name="close-circle-outline" size={18} color={Colors.pending} />
              </View>
            )
          )}
          {interactive ? (
            <TouchableOpacity style={styles.actionButton} onPress={() => handleDelete(item.id)}>
              <Ionicons name="trash-outline" size={18} color={Colors.danger} />
            </TouchableOpacity>
          ) : (
            <View style={styles.actionButton}>
              <Ionicons name="trash-outline" size={18} color={Colors.danger} />
            </View>
          )}
        </View>
      </>
    );

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
          ...(shatterMgr.activeId === lessonId ? { overflow: 'visible' as const } : {}),
          opacity: isMorphing ? slideOpacityAnims.current.get(lessonId)! : showCancelAnim ? 0.6 : 1,
          transform: [
            { translateX: slideTestAnims.current.get(lessonId)! },
          ],
        }]}
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

        {shatterMgr.activeId === lessonId && shatterMgr.stripsData.length > 0 && (
          <>
            {shatterMgr.stripsData.map((strip) => {
              const cardW = cardWidthRef.current.get(lessonId) || 400;
              const cardH = cardHeightRef.current.get(lessonId) || 200;
              return (
                <ShredderStrip
                  key={`shred-${strip.index}`}
                  index={strip.index}
                  cardWidth={cardW}
                  cardHeight={cardH}
                  fallDist={strip.fallDist}
                  driftX={strip.driftX}
                  rotateDeg={strip.rotateDeg}
                  delay={strip.delay}
                  onDone={shatterMgr.onStripDone}
                >
                  <View style={[styles.shredInner, { width: cardW, borderLeftWidth: 4, borderLeftColor: borderColor }]}>
                    {cardInner(false)}
                  </View>
                </ShredderStrip>
              );
            })}
          </>
        )}
      </Animated.View>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={filteredLessons}
        renderItem={renderLesson}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.list}
        style={shatterMgr.activeId !== null ? { overflow: 'visible' as any } : undefined}
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
                  <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                    {opt.label}
                  </Text>
                  <View style={[styles.filterCount, active && { backgroundColor: 'rgba(255,255,255,0.3)' }]}>
                    <Text style={[styles.filterCountText, active && { color: Colors.white }]}>
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
                      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                        {opt.label}
                      </Text>
                      <View style={[styles.filterCount, active && { backgroundColor: 'rgba(255,255,255,0.3)' }]}>
                        <Text style={[styles.filterCountText, active && { color: Colors.white }]}>
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
                  <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                    {opt.label}
                  </Text>
                  <View style={[styles.filterCount, active && { backgroundColor: 'rgba(255,255,255,0.3)' }]}>
                    <Text style={[styles.filterCountText, active && { color: Colors.white }]}>
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
          <Ionicons name="arrow-up" size={22} color={Colors.primary} />
        </TouchableOpacity>
      )}
      <GradientFAB icon="add" onPress={openAddModal} color={Colors.primary} />

      <BottomSheet visible={modalVisible} onClose={() => { setModalVisible(false); setEditingLesson(null); setLessonRate(''); }} title={editingLesson ? '编辑课程' : '添加课程'}>
        <Text style={styles.formLabel}>选择学生</Text>
        <TouchableOpacity style={styles.pickerButton} onPress={() => setShowStudentPicker(true)}>
          {selectedStudentId ? (
            <View style={styles.pickerSelected}>
              <StudentAvatar name={getStudent(selectedStudentId)?.name || ''} size={28} />
              <Text style={styles.pickerText}>{getStudent(selectedStudentId)?.name}</Text>
            </View>
          ) : (
            <Text style={styles.pickerPlaceholder}>请选择学生</Text>
          )}
          <Ionicons name="chevron-down" size={20} color={Colors.caption} />
        </TouchableOpacity>

        <Text style={styles.formLabel}>上课日期</Text>
        <TouchableOpacity style={styles.datePickerButton} onPress={() => setShowCalendar(true)} activeOpacity={0.7}>
          <Ionicons name="calendar-outline" size={18} color={Colors.primary} />
          <Text style={[styles.datePickerText, !date && styles.datePickerPlaceholder]}>
            {date || '选择日期'}
          </Text>
          <Ionicons name="chevron-down" size={16} color={Colors.caption} />
        </TouchableOpacity>

        <Text style={styles.formLabel}>上课时段</Text>
        <TouchableOpacity style={styles.datePickerButton} onPress={() => setShowTimePicker(true)} activeOpacity={0.7}>
          <Ionicons name="time-outline" size={18} color={Colors.primary} />
          <Text style={[styles.datePickerText, !timeSlot && styles.datePickerPlaceholder]}>
            {timeSlot || '选择时段'}
          </Text>
          <Ionicons name="chevron-down" size={16} color={Colors.caption} />
        </TouchableOpacity>

        <View style={styles.formRow}>
          <View style={styles.formHalf}>
            <Text style={styles.formLabel}>课时（小时）</Text>
            <TextInput style={styles.input} placeholder="如 1.5" value={duration} onChangeText={setDuration} keyboardType="numeric" placeholderTextColor={Colors.caption} />
          </View>
          <View style={styles.formHalf}>
            <Text style={styles.formLabel}>课时费（元/小时）</Text>
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
          <Text style={styles.amountPreviewLabel}>预计课时费</Text>
          <Text style={styles.amountPreviewValue}>{calculateAmount().toFixed(0)}元</Text>
        </View>

        <Text style={styles.formLabel}>备注（可选）</Text>
        <TextInput style={[styles.input, styles.textArea]} placeholder="添加备注..." value={notes} onChangeText={setNotes} multiline placeholderTextColor={Colors.caption} />

        <TouchableOpacity style={styles.saveButton} activeOpacity={0.85} onPress={handleSave}>
          <Text style={styles.saveButtonText}>{editingLesson ? '更新课程' : '添加课程'}</Text>
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
              <StudentAvatar name={s.name} size={40} />
              <View style={styles.studentItemInfo}>
                <Text style={[styles.studentItemName, selectedStudentId === s.id && { color: Colors.primary }]}>{s.name}</Text>
                <Text style={styles.studentItemSubject}>{s.phone || ''}</Text>
              </View>
              {selectedStudentId === s.id && <Ionicons name="checkmark-circle" size={24} color={Colors.primary} />}
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
          <View style={[styles.confirmBox, Shadows.floating]}>
            <Text style={styles.confirmTitle}>{confirmDialog.title}</Text>
            <Text style={styles.confirmMessage}>{confirmDialog.message}</Text>
            <View style={styles.confirmButtons}>
              <TouchableOpacity style={styles.confirmCancelBtn} onPress={() => setConfirmDialog(null)}>
                <Text style={styles.confirmCancelText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmOkBtn} onPress={() => { confirmDialog.onConfirm(); setConfirmDialog(null); }}>
                <Text style={styles.confirmOkText}>确定</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  list: { padding: Spacing.xl, paddingBottom: 100 },
  filterRow: {
    flexDirection: 'row', gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  filterChip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: Spacing.sm + 2, paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.pill, borderWidth: 1.5,
    borderColor: Colors.divider, backgroundColor: Colors.card,
    gap: Spacing.xs,
  },
  filterChipText: {
    fontSize: FontSize.caption, fontWeight: FontWeight.medium, color: Colors.caption,
  },
  filterChipTextActive: { color: Colors.white, fontWeight: FontWeight.semiBold },
  filterCount: {
    minWidth: 20, height: 20, borderRadius: 10,
    backgroundColor: Colors.divider,
    justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: Spacing.xs,
  },
  filterCountText: { fontSize: FontSize.small, fontWeight: FontWeight.semiBold, color: Colors.caption },
  segmentContainer: {
    flex: 2, flexDirection: 'row', borderRadius: BorderRadius.pill,
    backgroundColor: Colors.card, borderWidth: 1.5, borderColor: Colors.divider,
    overflow: 'hidden',
  },
  segmentBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: Spacing.sm + 2, gap: Spacing.xs,
  },
  segmentDivider: { width: 1, backgroundColor: Colors.divider },
  card: {
    backgroundColor: Colors.card, borderRadius: BorderRadius.card,
    padding: Spacing.lg, marginBottom: Spacing.md,
    position: 'relative' as const,
  },
  cardHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  studentName: { fontSize: FontSize.h3, fontWeight: FontWeight.bold, color: Colors.title },
  subject: { fontSize: FontSize.small, color: Colors.caption, marginTop: 2 },
  cardBody: { borderTopWidth: 1, borderTopColor: Colors.divider, paddingTop: Spacing.md },
  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  infoLeft: { flexDirection: 'row', gap: Spacing.md },
  infoItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  infoText: { fontSize: FontSize.caption, color: Colors.body },
  timeSlotBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.smallCard,
    backgroundColor: Colors.primaryLight,
  },
  timeSlotBadgeText: {
    fontSize: FontSize.h2, fontWeight: FontWeight.bold, color: Colors.primary,
  },
  timeSlotBadgeCancelled: { backgroundColor: '#F3F4F6' },
  strikethroughOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center', alignItems: 'center', zIndex: 10,
    overflow: 'visible',
  },
  strikethroughLine: {
    position: 'absolute', left: -30, height: 2,
    backgroundColor: '#9CA3AF',
  },
  shatterOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'visible', zIndex: 20 },
  shredStrip: {
    position: 'absolute', top: 0, height: '100%',
    overflow: 'hidden',
  },
  shredInner: {
    position: 'absolute',
    top: 0,
    backgroundColor: Colors.card,
    padding: Spacing.lg,
    borderRadius: BorderRadius.card,
  },
  strikethroughLabel: {
    fontSize: FontSize.caption, color: '#6B7280', fontWeight: FontWeight.semiBold,
    backgroundColor: '#F3F4F6', paddingHorizontal: Spacing.md, paddingVertical: 2,
    borderRadius: BorderRadius.pill, overflow: 'hidden',
  },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginBottom: Spacing.sm },
  amountText: { fontSize: FontSize.amount, fontWeight: FontWeight.bold, color: Colors.title },
  noteRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.xs },
  noteText: { fontSize: FontSize.small, color: Colors.caption, flex: 1 },
  actions: {
    flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.lg,
    marginTop: Spacing.md, paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.divider,
  },
  actionButton: { padding: Spacing.sm },
  scrollTopBtn: {
    position: 'absolute', bottom: 100, right: 30,
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#E5E7EB', borderWidth: 1, borderColor: '#D1D5DB',
    justifyContent: 'center', alignItems: 'center',
    ...Shadows.standard,
  },
  confirmOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: Colors.overlay, justifyContent: 'center', alignItems: 'center', zIndex: 200 },
  confirmBox: { backgroundColor: Colors.card, borderRadius: 20, padding: Spacing.xxl, width: '80%' },
  confirmTitle: { fontSize: FontSize.h3, fontWeight: FontWeight.bold, color: Colors.title, marginBottom: Spacing.md, textAlign: 'center' },
  confirmMessage: { fontSize: FontSize.body, color: Colors.body, marginBottom: Spacing.xl, textAlign: 'center' },
  confirmButtons: { flexDirection: 'row', gap: Spacing.md },
  confirmCancelBtn: { flex: 1, height: 46, borderRadius: 23, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' },
  confirmCancelText: { fontSize: FontSize.body, color: Colors.caption, fontWeight: FontWeight.medium },
  confirmOkBtn: { flex: 1, height: 46, borderRadius: 23, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
  confirmOkText: { fontSize: FontSize.body, color: Colors.white, fontWeight: FontWeight.semiBold },
  datePickerButton: {
    flexDirection: 'row', alignItems: 'center',
    height: 50, borderWidth: 1, borderColor: Colors.divider, borderRadius: BorderRadius.button,
    paddingHorizontal: Spacing.md, backgroundColor: Colors.background,
    gap: Spacing.sm,
  },
  datePickerText: { flex: 1, fontSize: FontSize.body, color: Colors.title },
  datePickerPlaceholder: { color: Colors.caption },
  formLabel: { fontSize: FontSize.caption, fontWeight: FontWeight.semiBold, color: Colors.body, marginBottom: Spacing.sm, marginTop: Spacing.md },
  pickerButton: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    height: 50, borderWidth: 1, borderColor: Colors.divider, borderRadius: BorderRadius.button,
    paddingHorizontal: Spacing.md, backgroundColor: Colors.background,
  },
  pickerSelected: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  pickerText: { fontSize: FontSize.body, color: Colors.title, fontWeight: FontWeight.medium },
  pickerPlaceholder: { fontSize: FontSize.body, color: Colors.caption },
  input: {
    height: 50, borderWidth: 1, borderColor: Colors.divider, borderRadius: BorderRadius.button,
    paddingHorizontal: Spacing.md, fontSize: FontSize.body, color: Colors.title,
    backgroundColor: Colors.background,
  },
  textArea: { height: 80, paddingTop: Spacing.md, textAlignVertical: 'top' },
  formRow: { flexDirection: 'row', gap: Spacing.md },
  formHalf: { flex: 1 },
  rateInput: { textAlign: 'center', fontWeight: FontWeight.semiBold },
  amountPreview: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: Colors.paidLight, borderRadius: BorderRadius.button,
    padding: Spacing.lg, marginTop: Spacing.md,
  },
  amountPreviewLabel: { fontSize: FontSize.body, color: Colors.body, fontWeight: FontWeight.medium },
  amountPreviewValue: { fontSize: FontSize.h2, fontWeight: FontWeight.bold, color: Colors.paid },
  saveButton: {
    backgroundColor: Colors.primary, height: 52, borderRadius: BorderRadius.button,
    justifyContent: 'center', alignItems: 'center', marginTop: Spacing.xl,
  },
  saveButtonText: { color: Colors.white, fontSize: FontSize.body, fontWeight: FontWeight.semiBold },
  studentItem: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md, borderRadius: BorderRadius.smallCard, gap: Spacing.md,
  },
  studentItemActive: { backgroundColor: Colors.primaryLight },
  studentItemInfo: { flex: 1 },
  studentItemName: { fontSize: FontSize.body, fontWeight: FontWeight.semiBold, color: Colors.title },
  studentItemSubject: { fontSize: FontSize.small, color: Colors.caption, marginTop: 2 },
});

export default LessonScreen;
