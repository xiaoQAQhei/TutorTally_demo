# Animated → Reanimated 迁移计划

> 按 task 顺序逐步执行，每完成一个 task 后确认无 TypeScript 错误。

**目标：** 将项目中所有 `react-native` 内置 `Animated` API 迁移到 `react-native-reanimated`。

**核心收益：** 卡片折叠等布局变化通过 Layout Animations 在 UI 线程运行，不再经 JS 桥。

**架构策略：**
1. Animated.Value → `useSharedValue`，Animated.timing/spring → `withTiming`/`withSpring`
2. `style={{ opacity: val }}` → `useAnimatedStyle(() => ({ opacity: val.value }))`
3. FlatList 卡片 → 提取为 LessonCard 独立组件，使用 `exiting` + `layout` 动画
4. ShredderStrip 已用 Reanimated，跳过

**迁移模式速查：**

| Animated | Reanimated |
|---|---|
| `useRef(new Animated.Value(0)).current` | `useSharedValue(0)` |
| `Animated.timing(val, {toValue, duration, useNativeDriver})` | `val.value = withTiming(toValue, {duration})` |
| `Animated.spring(val, {toValue, speed, bounciness})` | `val.value = withSpring(toValue, {duration, dampingRatio})` |
| `Animated.parallel([a, b])` | `a.value = withTiming(1); b.value = withTiming(1)` |
| `Animated.sequence([a, b])` | `v.value = withSequence(withTiming(1), withTiming(0))` |
| `Animated.loop(Animated.sequence([...]))` | `v.value = withRepeat(withSequence(...), -1)` |
| `val.interpolate({...})` | `interpolate(val.value, inputRange, outputRange)` |
| `.start(callback)` | `withTiming(toValue, {}, (finished) => { runOnJS(callback)() })` |
| `Animated.View` / `Animated.Text` | `Animated.View` / `Animated.Text`（来自 reanimated） |
| `val.setValue(n)` | `val.value = n` |

---

### Task 1: animations.ts

**文件：** `src/styles/animations.ts`

**改动：** 6 个 hook 全部改为 Reanimated。

- `useFadeIn`：opacity/translateY `useSharedValue` + 组件挂载后 `withTiming`
- `useSlideUp`：同上
- `useScale`：`useSharedValue(1)` + `withSpring`
- `usePulse`：`useSharedValue(1)` + `withRepeat(withSequence(...), -1)`
- `useBounce`：`useSharedValue(1)` + `withSequence(withSpring(...), withSpring(...))`
- `useBatchAnim`：anim/height `useSharedValue` + `withTiming`；height 0→1 驱动 scaleY（维持现有逻辑）
  - translateY 用 `useDerivedValue(() => interpolate(...))` 替代 `anim.interpolate()`

返回值从 `Animated.Value` 改为 `SharedValue`，消费者各自创建 `useAnimatedStyle`。

---

### Task 2: animationHooks.ts

**文件：** `src/utils/animationHooks.ts`

**改动：** useCancelAnimation、useSlideManager 迁移。

- `useCancelAnimation`：Map<number, SharedValue>。trigger 用 `withTiming(1, {}, (fin) => runOnJS(onDone)())`
- `useSlideManager`：Map<number, SharedValue>。triggerSlide 用 `withSequence(withTiming(35), withTiming(0))`

---

### Task 3: StatusBadge.tsx

**文件：** `src/components/StatusBadge.tsx`

scale / pulseOpacity → `useSharedValue` + `useAnimatedStyle`。

---

### Task 4: Toast.tsx

**文件：** `src/components/Toast.tsx`

translateY / opacity → `useSharedValue` + `useAnimatedStyle`。滑入回调用 `runOnJS(onDismiss)()`。

---

### Task 5: DropdownSelect.tsx

**文件：** `src/components/DropdownSelect.tsx`

rotateAnim / menuAnim → `useSharedValue` + `useAnimatedStyle`。箭头旋转用 `interpolate`。

---

### Task 6: TimeRangePicker.tsx

**文件：** `src/components/TimeRangePicker.tsx`

translateY / overlayOpacity → `useSharedValue` + `useAnimatedStyle`。

---

### Task 7: StatCard.tsx + EmptyState.tsx + GradientFAB.tsx

**文件：** `src/components/StatCard.tsx`、`src/components/EmptyState.tsx`、`src/components/GradientFAB.tsx`

三个组件都使用 animations.ts 的 hook，添加各自的 `useAnimatedStyle`。
GradientFAB 注意 `Animated.multiply(pulse, scale)` → `{ scale: pulse.value * scale.value }`。

---

### Task 8: StudentScreen.tsx + RecurringRulesScreen.tsx

**文件：** `src/screens/StudentScreen.tsx`、`src/screens/RecurringRulesScreen.tsx`

箭头旋转动画 simple 迁移：`Animated.timing` → `withTiming` + `useAnimatedStyle`。

---

### Task 9: LessonScreen.tsx — 提取 LessonCard 组件

**新文件：** `src/components/LessonCard.tsx`

**核心思路：** FlatList 的 `renderItem` 不能调用 `useAnimatedStyle`（违反 hooks 规则），所以把每张卡片提取为独立组件。

LessonCard 接收所有动画 SharedValue 作为 props，内部创建 `useAnimatedStyle`。

关键特性：
- `exiting={SlideOutRight.springify().duration(350)}` — 卡片移除时自动滑出
- `layout={Layout.springify()}` — 兄弟卡片自动平滑上移
- 动画样式都在 `useAnimatedStyle` 中定义

**卡片移除流程：**
1. 用户触发操作 → 300ms 等待（显示状态变化）
2. `setLessons(prev.filter(...))` → FlatList 更新
3. Reanimated 自动播放 exiting + layout 动画（UI 线程）
4. exiting 结束 → `runOnJS(写入DB)()`

---

### Task 10: LessonScreen.tsx — 迁移动画逻辑

**文件：** `src/screens/LessonScreen.tsx`

改动：
- Animated.Value → SharedValue
- filterAnim、highlightAnim、arrowAnim 等 → useSharedValue
- slideTestAnims / slideOpacityAnims / collapseAnims / batchCollapseAnims → Map<number, SharedValue>
- 移除 renderLesson，用 Animated.FlatList + LessonCard 替代
- tab 栏 animation 用 filterAnim SharedValue + useAnimatedStyle
- 内联 Animated.View → Reanimated 的 Animated.View

---

### Task 11: BottomSheet.tsx

**文件：** `src/components/BottomSheet.tsx`

最高复杂度。translateY / heightOffset / overlayOpacity → SharedValue。
PanResponder 中设 `sv.value = gs.dy`（直接赋值在 JS 线程可行，值会同步到 UI 线程）。
PanResponder 读取当前值用 `_value` 或 JS ref 同步。

---

### 验证

每个任务后运行 `npx tsc --noEmit`，只允许 3 个已有的 test 错误。
