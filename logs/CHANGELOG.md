## [2026-05-06 21:51] chore: final changelog sync & permissions update (all 15 feature tasks committed)
## 2026-05-06 21:51 | auto: 05-06 21:51 | logs/CHANGELOG.md 
- logs/CHANGELOG.md

- Restructured CHANGELOG.md to unify feature entries under proper format
- Added allowed commands to .claude/settings.local.json (Select-String, Test-Path, findstr, etc.)
  - files: logs/CHANGELOG.md, .claude/settings.local.json

## [2026-05-06 21:49] feat: adapt remaining screens to v2 data model — status/subjects/rate history
- HomeScreen: replaced `paid`/`confirmedAt` logic with `status` enum for filtering and pending amount calculation; replaced `confirmLesson` with `setLessonStatus(id, 'completed')`
- StatsScreen: replaced all `l.paid` references with `l.status === 'paid'`; load subjects per student via `getSubjectsByStudentId`; display subject name/rate from `StudentSubject` instead of `Student.subject`/`Student.hourlyRate`
- StudentBillingDetailScreen: load subjects for the student; use `subjects[0]` for subject info display; replaced `l.paid` with `l.status === 'paid'` in summary and lesson row badge
  - file: src/screens/HomeScreen.tsx, src/screens/StatsScreen.tsx, src/screens/StudentBillingDetailScreen.tsx

## [2026-05-06 21:42] feat: local notifications — pre-lesson 30min + post-lesson 2h payment reminders
- Created notifications.ts with notification handler, permission request, and scheduleAllReminders()
- Pre-lesson reminders: 30 min before scheduled lesson start time
- Post-lesson reminders: 2h after end time for completed lessons (payment reminder)
- Integrated into App.tsx useEffect after database init
  - file: src/utils/notifications.ts, src/App.tsx

## [2026-05-06 21:25] feat: LessonScreen v2 -- 4-status filter, manual amount, subject picker
- Rewrote filter/count logic from `paid`/`confirmedAt` booleans to `status` enum (scheduled/completed/paid)
- Removed `getEndPassed`, `handleTogglePaid`, `handleConfirmLesson` functions
- Added subject picker in lesson form (loads from `student_subjects` table based on selected student)
- Added manual amount toggle (Switch) -- when enabled, hides rate/duration auto-calc and shows manual amount input
- Added lessonRate auto-fill when subject changes (from subject.hourlyRate)
- Updated StatusBadge usage to new v2 API (status, showNextAction, onToggle, allowPaid)
- Updated `handleSave` to write `studentSubjectId`, `manualAmount`, `status: 'scheduled'`
- Updated `handleEdit`/`openAddModal` to load subjects and set selected subject/rate
- Removed student.subject / student.hourlyRate references (no longer in Student model)
  - file: src/screens/LessonScreen.tsx

## [2026-05-06 21:02] feat: StatusBadge v2 -- 4 statuses + next-action buttons with animation
- Rewrote StatusBadge to use single status prop instead of isPaid/isUpcoming/confirmMode booleans
- Added next-action buttons (completed/paid/cancelled) with spring animation
- Icon mapping per status: scheduled=book, completed=time, paid=checkmark-circle, cancelled=close-circle
- Status transitions driven by StatusTransitions from theme
  - file: src/components/StatusBadge.tsx

# 鏀瑰姩鏃ュ織
## 2026-05-06 20:43 | auto: 05-06 20:43 | logs/CHANGELOG.md 
- logs/CHANGELOG.md

## 2026-05-06 20:42 | v2.0 鏁版嵁搴撳眰閲嶅啓 鈥?6琛?杩佺Щ+瀹屾暣CRUD+Mock鏁版嵁
- 閲嶅啓 database/index.ts锛屾浛鎹?v1 涓夎〃缁撴瀯涓?v2.0 鍏〃缁撴瀯锛坰tudents, student_subjects, rate_history, lessons, payments, recurring_rules锛?
- 瀛︾敓鏁版嵁鎷嗗垎锛歴ubject/hourlyRate 绉昏嚦 student_subjects 鐙珛瀹炰綋锛屾敮鎸佸绉戠洰
- Lesson 鏀圭敤 status 鍥涙€佹灇涓撅紙scheduled/completed/paid/cancelled锛夛紝绉婚櫎 paid: boolean
- 鏂板 rate_history 琛ㄨ褰曡鏃惰垂鍙樻洿鍘嗗彶
- 鏂板 recurring_rules 琛ㄦ敮鎸佸懆鏈熸€ц绋嬭鍒?
- Payment 鍗囩骇澧炲姞 paidAt/notes 绛夊瓧娈?
- 鍏ㄥ眬浣跨敤杞垹闄わ紙deletedAt锛夛紝鏇夸唬鐗╃悊鍒犻櫎
- 鏂板 migrateFromV1锛氫粠鏃?tutor_bill.db 杩佺Щ鏁版嵁鍒版柊搴?
- 鏂板 setLessonStatus 鏇夸唬 toggleLessonPaid/confirmLesson
- 鏂板 addSubject/getSubjectsByStudentId/updateSubject/deleteSubject 绉戠洰 CRUD
- 鏂板 addRateHistory/getRateHistoryBySubjectId 璐圭巼鍘嗗彶
- 鏂板 addRecurringRule/getAllRecurringRules/updateRecurringRule/deleteRecurringRule 鍛ㄦ湡瑙勫垯 CRUD
- Mock 鏁版嵁鍗囩骇锛? 瀛︾敓 + 3 绉戠洰 + 15 鏉¤绋嬶紙鐘舵€佹贩鍚堬級
  - 鏂囦欢: src/database/index.ts, package.json, package-lock.json

## 2026-05-06 20:12 | v2.0 鏁版嵁妯″瀷鍗囩骇 鈥?澶氱鐩€佸洓鎬佺姸鎬併€佹敮浠樿褰曘€佸懆鏈熻鍒?
- 鏇挎崲鏁版嵁妯″瀷涓?v2.0 绫诲瀷瀹氫箟锛孲tudent 绉婚櫎 subject/hourlyRate 瀛楁锛屾柊澧?StudentSubject 鐙珛瀹炰綋
- Lesson 鏂板 status 鍥涙€佹灇涓撅紙scheduled/completed/paid/cancelled锛夛紝绉婚櫎 paid: boolean
- 鏂板 RateHistory銆丷ecurringRule 绫诲瀷瀹氫箟
- Payment 鍗囩骇锛屾柊澧?paidAt/notes/updatedAt/deletedAt/_uuid 瀛楁
- 鎵€鏈夊疄浣撴柊澧?_uuid 鐢ㄤ簬瀵煎叆瀵煎嚭
- StudentStats 鏂板 subjects: StudentSubject[] 瀛楁
  - 鏂囦欢: src/models/index.ts

## 2026-05-06 19:38 | auto: 05-06 19:38 | .claude/settings.local.json 
- .claude/settings.local.json

## 2026-05-05 19:45 | auto: 05-05 19:45 | .claude/settings.local.json .playwright-mcp/ 
- .claude/settings.local.json
- .playwright-mcp/

## 2026-05-05 19:40 | auto: 05-05 19:40 | geometry-figure.html geometry-figure.png 
- geometry-figure.html
- geometry-figure.png

## 2026-05-05 18:42 | auto: 05-05 18:42 | .claude/settings.local.json package-lock.json package.json geometry-figure.html geometry-figure.png 
- .claude/settings.local.json
- package-lock.json
- package.json
- geometry-figure.html
- geometry-figure.png

## 2026-05-05 13:07 | auto: 05-05 13:07 | .claude/settings.local.json android/app/build.gradle android/app/src/main/AndroidManifest.xml android/app/src/main/java/com/tutorbill/MainActivity.java android/app/src/main/java/com/tutorbill/MainApplication.java android/build.gradle app.json eas.json ios/TutorBill.xcodeproj/project.pbxproj ios/TutorBill/AppDelegate.h ios/TutorBill/AppDelegate.m ios/TutorBill/Info.plist ios/TutorBill/main.m package-lock.json package.json android/.gitignore android/app/debug.keystore android/app/proguard-rules.pro android/app/src/debug/ android/app/src/main/java/com/tutorbill/app/ android/app/src/main/res/ android/app/src/release/ android/gradle.properties android/gradle/ android/gradlew android/gradlew.bat android/settings.gradle 
- .claude/settings.local.json
- android/app/build.gradle
- android/app/src/main/AndroidManifest.xml
- android/app/src/main/java/com/tutorbill/MainActivity.java
- android/app/src/main/java/com/tutorbill/MainApplication.java
- android/build.gradle
- app.json
- eas.json
- ios/TutorBill.xcodeproj/project.pbxproj
- ios/TutorBill/AppDelegate.h
- ios/TutorBill/AppDelegate.m
- ios/TutorBill/Info.plist
- ios/TutorBill/main.m
- package-lock.json
- package.json
- android/.gitignore
- android/app/debug.keystore
- android/app/proguard-rules.pro
- android/app/src/debug/
- android/app/src/main/java/com/tutorbill/app/
- android/app/src/main/res/
- android/app/src/release/
- android/gradle.properties
- android/gradle/
- android/gradlew
- android/gradlew.bat
- android/settings.gradle

## 2026-05-05 02:12 | auto: 05-05 02:12 | eas.json 
- eas.json

## 2026-05-05 02:09 | auto: 05-05 02:09 | .claude/settings.local.json 
- .claude/settings.local.json

## 2026-05-05 01:45 | auto: 05-05 01:45 | .claude/settings.local.json 
- .claude/settings.local.json


璁板綍椤圭洰鎵€鏈夊姛鑳芥敼鍔ㄣ€乁I 浼樺寲鍜?Bug 淇銆?

## 鏍煎紡璇存槑

姣忔潯璁板綍鍖呭惈锛?
- **鏃ユ湡** 鈥?鏀瑰姩鏃ユ湡
- **绫诲瀷** 鈥?`feat`(鏂板姛鑳? / `style`(UI 鏍峰紡) / `fix`(淇) / `refactor`(閲嶆瀯) / `docs`(鏂囨。)
- **鎻忚堪** 鈥?鏀逛簡浠€涔?
- **鏂囦欢** 鈥?娑夊強鐨勬枃浠跺垪琛?
- **澶囨敞** 鈥?鍙€夎鏄?

---

## 2026-05-03 23:34 StatsScreen 鍥捐〃鑷€傚簲 + 鏈堜唤鍒囨崲淇

### 鍥捐〃瀹藉害 useWindowDimensions 鑷€傚簲 + key 淇鎹㈡湀浠芥覆鏌?
- **绫诲瀷**: fix, style
- **鎻忚堪**:
  1. 缁熻鍥捐〃瀹藉害鏀圭敤 `useWindowDimensions` 鑷€傚簲锛屾浛鎹㈢‖缂栫爜鐨?`Dimensions.get('window')`锛屾棆杞睆骞?绐楀彛鍙樺寲鏃舵纭噸娓叉煋
  2. 楗煎浘鍜屾煴鐘跺浘缁勪欢娣诲姞 `key` 灞炴€х粦瀹氭湀浠斤紝淇鍒囨崲鏈堜唤鏃跺浘琛ㄦ暟鎹笉鏇存柊鐨勯棶棰?
- **鏂囦欢**:
  - `src/screens/StatsScreen.tsx`

## 2026-05-03 21:31 鏃堕棿娈甸啋鐩紭鍖?

### LessonScreen 榛樿鏃堕暱 + FlatList 娓叉煋浼樺寲
- **绫诲瀷**: feat, perf
- **鎻忚堪**:
  1. 鏂板璇剧▼寮圭獥榛樿鏃堕暱璁句负 2 灏忔椂锛屽噺灏戞墜鍔ㄨ緭鍏?
  2. FlatList 娣诲姞 initialNumToRender 鍜?windowSize 鍙傛暟锛屼紭鍖栧垪琛ㄦ覆鏌撴€ц兘锛屽噺灏戞粴鍔ㄧ┖鐧?
- **鏂囦欢**:
  - `src/screens/LessonScreen.tsx`

## 2026-05-03 纭涓嬭浣撻獙 + 鍒楄〃鎬ц兘浼樺寲

### HomeScreen 纭涓嬭蹇嵎鎿嶄綔
- **绫诲瀷**: feat
- **鎻忚堪**:
  1. 棣栭〉璇剧▼鍒楄〃鎷嗗垎涓恒€屽緟纭涓嬭銆嶅拰銆屽緟涓婅銆嶄袱涓垎鍖猴紝宸茶繃涓嬭鏃堕棿鐨勮绋嬭嚜鍔ㄥ綊鍏ョ‘璁ゅ尯
  2. 纭鍖鸿绋嬫樉绀虹孩鑹插乏渚ф潯鍜岀孩鑹层€岀‘璁や笅璇俱€嶆寜閽紝瑙嗚涓婁笌钃濊壊寰呬笂璇惧尯鍒嗘槑鏄?
  3. 鐐瑰嚮纭鎸夐挳鐩存帴璋冪敤 confirmLesson 瀹屾垚涓嬭锛屾棤闇€璺宠浆椤甸潰
  4. 纭鍖烘寜鏃ユ湡鍊掑簭銆佸緟涓婅鍖烘寜鏃ユ湡姝ｅ簭鎺掑垪
- **鏂囦欢**:
  - `src/screens/HomeScreen.tsx`

### LessonScreen 鍒楄〃婊氬姩鎬ц兘浼樺寲
- **绫诲瀷**: perf
- **鎻忚堪**:
  1. 鍗＄墖 onLayout 娴嬮噺楂樺害锛屼负 getItemLayout 鎻愪緵绮惧噯 item 楂樺害
  2. FlatList 鍚敤 getItemLayout 璺宠繃甯冨眬璁＄畻锛屽ぇ骞呮彁鍗囨粴鍔ㄦ€ц兘
  3. initialNumToRender 娓叉煋鍏ㄩ儴鍙椤癸紝windowSize 澧炲ぇ鍒?50锛屽噺灏戠┖鐧介棯鐑?
  4. onScrollToIndexFailed 鍔犲叆閲嶈瘯鏈哄埗锛岄珮浜烦杞け璐ユ椂鑷姩閲嶈瘯
- **鏂囦欢**:
  - `src/screens/LessonScreen.tsx`

### 椤圭洰鏂囨。鏇存柊
- **绫诲瀷**: docs
- **鎻忚堪**: CLAUDE.md銆丳ROGRESS.md銆乻ettings 閰嶇疆鍙婃敼鍔ㄦ棩蹇楀悓姝ユ洿鏂?
- **鏂囦欢**:
  - `CLAUDE.md`
  - `PROGRESS.md`
  - `.claude/settings.local.json`
  - `logs/CHANGELOG.md`

## 2026-05-03 01:39 鏃堕棿娈甸€夋嫨鍣?+ 璇剧▼娴佺▼瀹屽杽

### TimeRangePicker 鏃堕棿娈甸€夋嫨鍣?
- **绫诲瀷**: feat
- **鎻忚堪**:
  1. 鍒涘缓 TimeRangePicker 缁勪欢锛氭椂/鍒嗗洓鍒楁粴鍔ㄩ€夋嫨鍣紝寮€濮?缁撴潫鏃堕棿鑱斿姩
  2. 鍚搁檮浼樺寲锛氭敼鐢?decelerationRate=0 + 鎵嬪姩 scrollTo 鏇夸唬 snapToInterval锛岀簿鍑嗗畾浣?
  3. 瀛椾綋鏀惧ぇ锛氶潪閫変腑椤?FontSize.h3锛岄€変腑椤?FontSize.h1锛岃瑙夊眰绾у垎鏄?
  4. 棰勮鏍忎紭鍖栵細鏃堕棿鑼冨洿+鏃堕暱鍚堝苟鍒板悓涓€琛屾樉绀猴紝淇℃伅瀵嗗害鏇撮珮
  5. 搴曢儴寮瑰嚭鍔ㄧ敾锛欰nimated.spring slide-up + 閬僵娓愬彉锛屼氦浜掓祦鐣?
- **鏂囦欢**:
  - `src/components/TimeRangePicker.tsx` (鏂板)
  - `src/components/BottomSheet.tsx`
  - `src/components/StatusBadge.tsx`
  - `src/contexts/ActionContext.tsx` (鏂板)

### LessonScreen 闆嗘垚鏃堕棿娈甸€夋嫨 + 璇剧▼娴佺▼瀹屽杽
- **绫诲瀷**: feat
- **鎻忚堪**:
  1. LessonScreen 闆嗘垚 TimeRangePicker锛岃绋嬭〃鍗曟敮鎸侀€夋嫨鏃舵
  2. 寰呬笂璇剧姸鎬佸彲纭涓嬭锛屽畬鍠勮绋嬬敓鍛藉懆鏈?
  3. HomeScreen 寰呬笂璇剧偣鍑昏烦杞畬鍠?
- **鏂囦欢**:
  - `src/screens/LessonScreen.tsx`
  - `src/screens/HomeScreen.tsx`
  - `src/database/index.ts`
  - `src/models/index.ts`
  - `src/App.tsx`

### CalendarPicker 鍝嶅簲寮忎慨澶?
- **绫诲瀷**: fix
- **鎻忚堪**: 浣跨敤 useWindowDimensions + maxWidth 400 闄愬埗鏃ュ巻瀹藉害锛岄€傞厤涓嶅悓灞忓箷灏哄
- **鏂囦欢**: `src/components/CalendarPicker.tsx`

### 鑷姩鍖栧伐鍏烽摼
- **绫诲瀷**: feat
- **鎻忚堪**:
  1. Stop hook 鏀逛负鑷姩 git push锛屾瘡杞璇濈粨鏉熻嚜鍔ㄦ彁浜ゅ苟鎺ㄩ€?
  2. 椤圭洰鎸囦护 CLAUDE.md 瀹屽杽
- **鏂囦欢**:
  - `.claude/settings.local.json`
  - `CLAUDE.md`

## 2026-05-02

### Claude Code 鑷姩鍖栭厤缃?
- **绫诲瀷**: feat
- **鎻忚堪**:
  1. 閰嶇疆 Stop hook锛屾瘡杞璇濈粨鏉熷悗鑷姩 `git add -A && git commit`
  2. 鍒涘缓 CLAUDE.md锛岀害鏉?Claude Code 琛屼负锛堟瘡杞紑濮嬫眹鎶ユ敼鍔ㄣ€佹瘡杞粨鏉熷啓鏃ュ織锛?
  3. 鏃ュ織瀛?agent锛氭瘡杞璇濈粨鏉熷悗鑷姩鍦?`logs/CHANGELOG.md` 鍐欏叆浜鸿瘽鏀瑰姩璁板綍
- **鏂囦欢**:
  - `CLAUDE.md` (鏂板)
  - `.claude/settings.local.json` (淇敼锛屾柊澧?Stop hook + git 鏉冮檺)

## 2026-04-30

### 椤圭洰鍒濆鍖?
- **绫诲瀷**: feat
- **鎻忚堪**: 瀹舵暀璇剧▼璐﹀崟 React Native (Expo) 搴旂敤鍒濆鍖?
- **鏂囦欢**: 鍏ㄩ儴鍒濆鏂囦欢

### 鏁翠綋 UI 閲嶆柊璁捐
- **绫诲瀷**: style
- **鎻忚堪**: 鐜颁唬鍖?UI 鏀归€狅紝缁熶竴璁捐璇█锛堜富棰樿壊銆侀棿璺濄€佸渾瑙掋€侀槾褰变綋绯伙級锛岄噸鍐欐墍鏈夊睆骞曞拰缁勪欢
- **娑夊強鏀瑰姩**:
  - 鍒涘缓涓婚 tokens 绯荤粺 `src/styles/theme.ts`
  - 鍒涘缓鍔ㄧ敾 hooks `src/styles/animations.ts`
  - 閲嶅啓鍏ㄩ儴 6 涓€氱敤缁勪欢锛圫tatCard, GradientFAB, EmptyState, BottomSheet, StatusBadge, StudentAvatar锛?
  - 閲嶅啓鍏ㄩ儴 4 涓〉闈紙HomeScreen, StudentScreen, LessonScreen, StatsScreen锛?
  - 閲嶅啓 App.tsx 搴曢儴瀵艰埅鏍?
- **鏂囦欢**:
  - `src/styles/theme.ts` (鏂板)
  - `src/styles/animations.ts` (鏂板)
  - `src/components/StatCard.tsx` (鏂板)
  - `src/components/GradientFAB.tsx` (鏂板)
  - `src/components/EmptyState.tsx` (鏂板)
  - `src/components/BottomSheet.tsx` (鏂板)
  - `src/components/StatusBadge.tsx` (鏂板)
  - `src/components/StudentAvatar.tsx` (鏂板)
  - `src/screens/HomeScreen.tsx` (閲嶅啓)
  - `src/screens/StudentScreen.tsx` (閲嶅啓)
  - `src/screens/LessonScreen.tsx` (閲嶅啓)
  - `src/screens/StatsScreen.tsx` (閲嶅啓)
  - `src/App.tsx` (閲嶅啓)

### LessonScreen 绛涢€夋爣绛炬敼閫?
- **绫诲瀷**: feat
- **鎻忚堪**: 鍦ㄨ绋嬭褰曢〉鏂板"寰呬笂璇?绛涢€夊垎绫伙紝閲嶆柊鎺掑垪涓?*寰呬笂璇?鈫?寰呮敹娆?鈫?宸叉敹娆?鈫?鍏ㄩ儴**锛屽叾涓緟鏀舵鍜屽凡鏀舵鐢?segmented control 鏍峰紡妗嗗湪涓€璧?
- **鏂囦欢**: `src/screens/LessonScreen.tsx`
- **澶囨敞**: FilterStatus = 'upcoming' | 'unpaid' | 'paid' | 'all'

### HomeScreen 甯冨眬璋冩暣
- **绫诲瀷**: style
- **鎻忚堪**: 
  1. 鏈€杩戣绋嬪彧鏄剧ず鏈潵鏃ユ湡锛堝緟涓婅锛?
  2. 寰呬笂璇剧▼鏀惧埌鏈€涓婃柟锛屽緟鏀舵鎬婚鍜屼粖鏃ユ敹鍏ユ斁鍒版渶涓嬫柟
- **鏂囦欢**: `src/screens/HomeScreen.tsx`

### HomeScreen 鍏ㄩ〉鍥哄畾甯冨眬
- **绫诲瀷**: style
- **鎻忚堪**: 
  1. 棣栭〉鍒氬ソ鍗犳弧涓€灞忥紝绉婚櫎 ScrollView 鏁翠綋婊氬姩
  2. 浠?寰呬笂璇剧▼"鍖哄煙鐢?FlatList 鐙珛婊氬姩
  3. 鏂板 3 涓?mock 瀛︾敓鏁版嵁鍜?5 鏉℃湭鏉ユ棩鏈熻绋嬫暟鎹?
- **鏂囦欢**:
  - `src/screens/HomeScreen.tsx`
  - `src/database/index.ts`
- **澶囨敞**: 鏂板瀛︾敓鐜嬩簲锛堢墿鐞嗭紝楼180/h锛夛紝mock 璇剧▼鏁颁粠 4 鏉″鑷?9 鏉?

### 璐﹀崟缁熻鏉垮潡浼樺寲
- **绫诲瀷**: feat
- **鎻忚堪**: 
  1. HomeScreen "浠婃棩鏀跺叆" 鈫?"浠婃棩璇剧▼"锛堜粖鏃ュ叏閮ㄨ绋嬫€婚锛?
  2. StatsScreen 鏀舵姒傝鏀逛负鏈湀鏁版嵁锛堟湰鏈堝凡鏀?寰呮敹锛?
  3. 鏂板 StudentBillingDetailScreen锛氱偣鍑诲鐢熻 鈫?鍏ㄥ睆 Modal锛屽惈鎬绘敹鍏?宸叉敹/寰呮敹姹囨€汇€佹湀搴﹀垎甯冦€佽缁嗚处鍗?
- **鏂囦欢**: `src/screens/HomeScreen.tsx`, `src/screens/StatsScreen.tsx`, `src/screens/StudentBillingDetailScreen.tsx` (鏂板)

### 棣栭〉蹇嵎鎸夐挳鏀逛负姘村钩甯冨眬 + 鏁翠綋绱у噾鍖?
- **绫诲瀷**: style
- **鎻忚堪**: 
  1. QuickActionButton 鍐呴儴缁撴瀯浠庡瀭鐩村爢鍙犳敼涓烘按骞虫帓鍒楋紙鍥炬爣宸︺€佹枃瀛楀彸锛夛紝鑺傜渷鍨傜洿绌洪棿
  2. 鍥炬爣瀹瑰櫒 28脳28銆佸浘鏍?size 16
  3. 鏁翠綋闂磋窛绯荤粺鎬ф敹绱э紙container padding銆佹寜閽棿闅欍€佸垪琛ㄩ」鍐呰竟璺濄€佸簳閮ㄥ崱鐗囪竟璺濓級
- **鏂囦欢**: `src/screens/HomeScreen.tsx`

### LessonScreen 鏃ユ湡閫夋嫨鍣?
- **绫诲瀷**: feat
- **鎻忚堪**: 鏃ュ巻閫夋嫨鍣ㄧ粍浠舵浛浠ｇ函鏂囨湰鏃ユ湡杈撳叆锛涘眳涓脊绐楀紡锛屾敮鎸佹湀浠藉垏鎹€?脳7 缃戞牸銆佷粖澶╂爣璁般€侀€変腑楂樹寒
- **鏂囦欢**:
  - `src/components/CalendarPicker.tsx` (鏂板)
  - `src/screens/LessonScreen.tsx`
- **澶囨敞**: 璺ㄥ钩鍙扮函 RN 瀹炵幇锛屾棤鍘熺敓渚濊禆

### LessonScreen 榛樿寰呬笂璇?+ 鍙紪杈戣鏃惰垂
- **绫诲瀷**: feat
- **鎻忚堪**: 
  1. 鏂板缓璇剧▼榛樿鏃ユ湡涓烘槑澶╋紙鑷姩寰呬笂璇剧姸鎬侊級
  2. 璇炬椂璐规敼涓哄彲缂栬緫 TextInput锛岄粯璁?75 鍏?灏忔椂锛岄€夋嫨瀛︾敓鍚庤嚜鍔ㄥ～鍏呰瀛︾敓鍗曚环
- **鏂囦欢**: `src/screens/LessonScreen.tsx`

### 搴曢儴 Toast 鎻愮ず + 瀛︾敓鍦板潃
- **绫诲瀷**: feat
- **鎻忚堪**: 
  1. 鏂板 Toast 缁勪欢锛岃〃鍗曞繀濉」鏍￠獙澶辫触鏃跺脊鍑哄簳閮ㄦ彁绀?
  2. Student 鎺ュ彛鏂板閫夊～ address 瀛楁锛屽鐢熻〃鍗曞拰鍗＄墖鏀寔鏄剧ず
- **鏂囦欢**:
  - `src/components/Toast.tsx` (鏂板)
  - `src/screens/LessonScreen.tsx`
  - `src/models/index.ts`
  - `src/database/index.ts`
  - `src/screens/StudentScreen.tsx`

### Toast 鎻愮ず浣嶇疆璋冩暣
- **绫诲瀷**: fix
- **鎻忚堪**: Toast 鎻愮ず浠庡睆骞曞簳閮ㄧЩ鍒伴《閮紙瀵艰埅鏍忎笅鏂癸級锛岀‘淇濈敤鎴峰彲瑙?
- **鏂囦欢**: `src/screens/LessonScreen.tsx`

### StudentScreen 娣诲姞 Toast 鏍￠獙鎻愮ず
- **绫诲瀷**: feat
- **鎻忚堪**: 瀛︾敓绠＄悊椤垫坊鍔犺〃鍗曟牎楠?Toast锛屽繀濉」缂哄け鏃舵彁绀?璇峰～鍐欏鐢熷鍚嶃€佺鐩拰璇炬椂璐?锛屾坊鍔?鏇存柊鎴愬姛鍚庢彁绀?
- **鏂囦欢**: `src/screens/StudentScreen.tsx`

### LessonScreen 璇炬椂璐瑰姞鍏ュ繀濉牎楠?
- **绫诲瀷**: fix
- **鎻忚堪**: 娣诲姞璇剧▼琛ㄥ崟涓鏃惰垂涔熸爣璁颁负蹇呭～椤癸紝缂哄け鏃?Toast 鎻愮ず
- **鏂囦欢**: `src/screens/LessonScreen.tsx`

