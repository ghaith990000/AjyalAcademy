# User guide · دليل المستخدم

A short guide for the people who use Ajyal Academy every day: **coaches** and **admins**. The English guide comes first; the Arabic guide (دليل المستخدم بالعربية) follows it. Button names below are exactly as they appear in the app.

- [English guide](#english-guide)
- [الدليل بالعربية](#الدليل-بالعربية)

---

# English guide

## 1. Getting started

**Open the app** at the academy's web address on your phone (or computer) and sign in with the email and password the academy gave you. Coaches get their account from an admin; nobody can register by themselves. If you forget your password, ask an admin.

**Language.** The button at the top of every screen switches between العربية and English. The app remembers your choice, also on your next sign-in. Arabic reads right-to-left; numbers and money always use the digits 0–9 (for example `20.000 BD`).

**Put it on your home screen** so it opens like any other app:

- _Android (Chrome):_ tap **Install** on the card that appears on the Home screen, or use the browser menu → _Install app_.
- _iPhone (Safari):_ tap the Share button → _Add to Home Screen_.

**Signing out.** On a phone tap **More** (last tab) → **Sign out**. On a computer use **Sign out** at the bottom of the side menu.

**No connection?** The app shows an orange notice, "You're offline". You can look at what is already on the screen, but **nothing you change is saved** until the connection returns — do it again once you are back online.

**"Your session has ended."** For safety the app sometimes asks you to sign in again (for example if an admin turned your account off). Sign in to continue.

### Who can do what

|                                                                           | Coach             | Admin            |
| ------------------------------------------------------------------------- | ----------------- | ---------------- |
| See and edit **their own players**                                        | ✅                | ✅ (all players) |
| Create subscriptions, add payments                                        | ✅ (own players)  | ✅               |
| Schedule sessions and take attendance                                     | ✅ (own sessions) | ✅ (all)         |
| Coaches, Locations, Registrations, Discounts, Expenses, Reports, Settings | —                 | ✅               |
| Assign players to coaches, change prices                                  | —                 | ✅               |
| See the activity feed                                                     | their own actions | everyone's       |

## 2. For coaches

### Home

The Home screen is your daily panel: how many players you have, today's sessions (each with a **Take attendance** button), subscriptions that are about to end (a yellow **Unpaid** tag means money is still owed), and **My recent activity**. The three buttons at the top — **Add player**, **New subscription**, **Schedule session** — are shortcuts.

### Players

**My players** lists your players; type in the search box to find one (name, CPR or phone). Tap a player to see their page: details, subscriptions, and their **attendance rate**.

- **Add player:** fill in name, CPR (9 digits), date of birth and phone; tick _Has a medical condition_ and describe it if needed. The player becomes yours. A CPR that already exists is refused (the app tells you who has it, if it is one of your players).
- **Edit** fixes a detail. **Remove** takes a player off your lists; their payments and attendance history are kept.

### Subscriptions

Tap **New subscription** (on the Home screen, the Billing tab, or a player's page). The steps are: **players** (1–4 players; the plan and price follow the number of players) → **location and period** (the location the money counts for — filled in from the players' location when they share one — then the dates; the end date is filled in for one month; the period can't overlap another subscription of the same player) → **options** (the T-shirt fee applies to a player's first-ever subscription; transport is optional) → **discount** (none, a code such as SIBLING10, or a manual discount with a reason) → **summary** (check the total) → **payment** (paid in full today, part paid, or unpaid). Tap **Create subscription**.

Later, open the subscription and tap **Add payment** for each payment received (cash, Benefit, bank transfer or other). A payment can't be more than the balance and can't be dated in the future. **Cancel subscription** needs a reason; payments already received stay on record.

### Sessions and attendance

**Sessions** shows today and what is coming. **Schedule session** asks for the date, start and end time and the **location** (choose from the list; an admin adds locations); switch on _Repeat weekly_ to create up to 26 weekly sessions at once. If you already have a session at that time the app **warns** you but lets you continue.

To take attendance, open **Sessions**, find today's session and tap **Take attendance** (or **Take attendance** on the Home screen). Every one of your players is listed, all marked _Absent_:

1. Tap a player to mark them _Present_ (tap again to undo). **Mark all present** and **Clear all** are shortcuts.
2. A yellow tag "No active subscription" is only a reminder — you can still mark that player.
3. Tap **Save attendance**. You can open the session again later and correct it.

Attendance can only be taken **from the day of the session** (not for a future session) and never for a cancelled one. **Cancel session** is final — schedule a new one instead of reopening it.

## 3. For admins

Admins have everything coaches have, for **all** players and sessions, plus the pages under **More** on a phone (in the side menu on a computer).

### Home

Four numbers — **Active players**, **Active subscriptions**, **Collected this month**, **Net profit this month** (with the margin) — then today's sessions, subscriptions that are expiring, and the **Recent activity** feed of everything anyone did, with a green **Live** badge: new entries appear by themselves within seconds. Use the chips (Players, Subscriptions, Payments…) to narrow it.

### Coaches

**Add coach** creates an account: name, email, a password of 8 or more characters (tell the coach; they can't choose it themselves), phone, and **monthly salary**. Turn a coach _inactive_ to lock them out (their history stays). You cannot create another admin here — ask whoever manages the Supabase project.

### Players

As a coach, but you see everyone. Select players (checkboxes) and tap **Assign to coach**, or choose no coach to unassign; a single player's edit form also has a Coach field.

### Registration requests

Parents register their children **without an account**: send them the registration link and they fill in one short form (their name and phone, and up to four children). To get the link, open **More → Registrations** and tap **Copy registration link**, then paste it into a WhatsApp message or group. (The sign-in page has a link to the form too.)

When a parent sends the form, **Registrations** shows a pink number on **More** (and a card on the home screen). Open a request to see the child and the parent. If a player with the same CPR already exists, or another waiting request has it, a yellow **Check before accepting** box says so.

- **Accept** adds the child as a player, with the parent's name. Choose a coach now or leave it and assign one later, and confirm the location the parent asked for. A CPR that already belongs to a player cannot be accepted.
- **Reject** keeps the request, with an optional note only admins see.
- Each child is decided on its own, and a decision is final. A parent whose child was rejected can send the form again.

The app does **not** message the parent. After you decide, the request page shows a ready message in the language the parent used, and a **Message on WhatsApp** button that opens WhatsApp with it — you can edit it before you send. If the number can't be used for WhatsApp, call the parent instead. Rejected requests are kept (they cannot be deleted).

### Locations

**More → Locations** lists where the academy trains and collects fees. **Add location:** a name (and, if you like, an address). Tap a location to rename it or **switch it off** when you stop using it — it stays on past sessions, subscriptions and reports, but can't be chosen for new ones. Locations are never deleted. Every session and every new subscription belongs to a location; an older subscription that has none shows **No location yet** and an admin can give it one with **Change location** on its page (all its payments move with it).

### Discounts and Settings

**Discounts → Add discount:** a code (letters and digits), a percentage or a fixed amount, optional dates and a use limit. **Settings:** the prices of the four plans (1, 2, 3 or 4 players), the **T-shirt** and **transport** fees, and how many days before the end a subscription counts as _expiring soon_. Changing a price never changes subscriptions already created.

### Expenses and salaries

**Expenses** lists a month at a time (use the arrows; filter with the category chips). **Add expense:** category, amount (in BD, for example `12.500`), date (not in the future), an optional **location** (leave it empty for costs shared by the whole academy, such as salaries), an optional note; a salary also needs the coach. The list can be filtered by location. Tap an expense to edit or delete it — deletions are recorded in the activity feed.

**Generate salaries** adds one salary expense for every _active_ coach with a monthly salary, dated the 1st of the chosen month. It is safe to press twice: a coach who already has a salary that month is skipped, and the app tells you how many were created and skipped.

### Reports

Choose **Month** or **Year**, and step with the arrows. You see **Collected**, **Expenses**, **Profit** and **Margin** (a loss is shown in red with a minus sign; the margin is "—" when nothing was collected), a chart of the year, expenses by category, and a month-by-month table. Choose a **Location** to see only that location's figures (expenses for the whole academy are not included in them); with all locations a **By location** table splits the period — its "No location" row holds older subscriptions without a location and academy-wide expenses. **Payments (CSV)** and **Expenses (CSV)** download the period as spreadsheet files that open in Excel (Arabic names included).

_Collected_ counts payments **by the date they were received**, including payments on subscriptions that were later cancelled.

## 4. Good habits and small answers

- Enter a payment the day you receive it, with the real date.
- One CPR belongs to one player. If the app says the CPR exists, search for that player instead of adding again.
- A new version of the app shows **"A new version of the app is ready — Update"**: tap **Update** when you are not in the middle of something.
- **"This page couldn't be loaded"** means the app was just updated: tap **Reload**.
- A mistake in a saved attendance list? Open the session and save it again. A wrong payment or subscription? Ask an admin — payments are never deleted, so the history stays honest.

---

# الدليل بالعربية

## ١. البدء

**افتح التطبيق** من عنوان الأكاديمية على هاتفك (أو حاسوبك) وسجّل الدخول بالبريد الإلكتروني وكلمة المرور اللذين أعطتك إياهما الأكاديمية. حسابات المدربين ينشئها المدير، ولا يمكن لأحد التسجيل بنفسه. إذا نسيت كلمة المرور فاطلبها من المدير.

**اللغة.** الزر في أعلى كل شاشة يبدّل بين العربية وEnglish، والتطبيق يتذكّر اختيارك حتى في المرة القادمة. الأرقام والمبالغ تظهر دائماً بالأرقام 0–9 (مثل `20.000 د.ب`).

**أضِفه إلى الشاشة الرئيسية** ليُفتح كأي تطبيق آخر:

- _أندرويد (Chrome):_ اضغط **تثبيت** في البطاقة التي تظهر في الشاشة الرئيسية، أو من قائمة المتصفح ← _تثبيت التطبيق_.
- _آيفون (Safari):_ اضغط زر المشاركة ← _إضافة إلى الشاشة الرئيسية_.

**تسجيل الخروج.** على الهاتف اضغط **المزيد** (آخر تبويب) ← **تسجيل الخروج**. على الحاسوب استخدم **تسجيل الخروج** أسفل القائمة الجانبية.

**لا يوجد اتصال؟** يظهر شريط برتقالي «لا يوجد اتصال بالإنترنت». يمكنك تصفّح ما هو معروض، لكن **لا يُحفظ أي تغيير** حتى يعود الاتصال — أعد العملية بعد عودته.

**«انتهت جلستك».** أحياناً يطلب التطبيق تسجيل الدخول مجدداً حفاظاً على الأمان (مثلاً إذا أوقف المدير حسابك). سجّل الدخول لتتابع.

### من يستطيع فعل ماذا

|                                                                        | المدرب       | المدير           |
| ---------------------------------------------------------------------- | ------------ | ---------------- |
| رؤية وتعديل **لاعبيه**                                                 | ✅           | ✅ (كل اللاعبين) |
| إنشاء الاشتراكات وإضافة الدفعات                                        | ✅ (للاعبيه) | ✅               |
| جدولة الحصص وتسجيل الحضور                                              | ✅ (حصصه)    | ✅ (الكل)        |
| المدربون، المواقع، التسجيلات، الخصومات، المصروفات، التقارير، الإعدادات | —            | ✅               |
| إسناد اللاعبين إلى المدربين وتغيير الأسعار                             | —            | ✅               |
| رؤية سجل النشاطات                                                      | نشاطاته هو   | نشاطات الجميع    |

## ٢. للمدربين

### الرئيسية

شاشتك اليومية: عدد لاعبيك، وحصص اليوم (لكل حصة زر **تسجيل الحضور**)، والاشتراكات التي توشك أن تنتهي (وسم أصفر **غير مسدّد** يعني أن هناك مبلغاً متبقياً)، و**آخر نشاطاتي**. الأزرار الثلاثة في الأعلى — **إضافة لاعب** و**اشتراك جديد** و**جدولة حصة** — اختصارات سريعة.

### اللاعبون

**لاعبيّ** يعرض لاعبيك؛ اكتب في مربع البحث للعثور على لاعب (بالاسم أو الرقم الشخصي CPR أو الهاتف). اضغط على لاعب لترى صفحته: بياناته واشتراكاته و**نسبة حضوره**.

- **إضافة لاعب:** أدخل الاسم والرقم الشخصي (9 أرقام) وتاريخ الميلاد والهاتف؛ وفعّل _لديه حالة طبية_ واشرحها عند الحاجة. يصبح اللاعب لاعبك. الرقم الشخصي المكرر مرفوض (ويخبرك التطبيق بصاحبه إن كان من لاعبيك).
- **تعديل** لتصحيح بيان. **إزالة** تُخرج اللاعب من قوائمك مع بقاء مدفوعاته وسجل حضوره.

### الاشتراكات

اضغط **اشتراك جديد** (من الرئيسية أو تبويب الاشتراكات أو صفحة لاعب). الخطوات: **اللاعبون** (من 1 إلى 4 لاعبين؛ تتحدد الباقة والسعر بعدد اللاعبين) ← **الموقع والفترة** (الموقع الذي تُحتسب له المبالغ، ويُملأ من موقع اللاعبين إذا اشتركوا فيه، ثم التواريخ؛ يُملأ تاريخ الانتهاء بعد شهر؛ ولا يجوز أن تتداخل الفترة مع اشتراك آخر للاعب نفسه) ← **الخيارات** (رسوم القميص لأول اشتراك للاعب فقط؛ والمواصلات اختيارية) ← **الخصم** (بلا خصم، أو كود مثل SIBLING10، أو خصم يدوي مع السبب) ← **الملخص** (راجع الإجمالي) ← **الدفع** (مدفوع بالكامل اليوم، أو جزء منه، أو غير مدفوع). ثم اضغط **إنشاء الاشتراك**.

لاحقاً افتح الاشتراك واضغط **إضافة دفعة** لكل مبلغ يُستلم (نقداً أو بنفت أو تحويل بنكي أو غير ذلك). لا يجوز أن تزيد الدفعة عن المتبقي ولا أن تكون بتاريخ مستقبلي. **إلغاء الاشتراك** يتطلب سبباً، وتبقى الدفعات المستلمة مسجّلة.

### الحصص والحضور

**الحصص** تعرض اليوم وما هو قادم. **جدولة حصة** تطلب التاريخ ووقت البداية والنهاية و**الموقع** (اختره من القائمة؛ والمسؤول هو من يضيف المواقع)؛ فعّل _تكرار أسبوعي_ لإنشاء حتى 26 حصة أسبوعية دفعة واحدة. إذا كان لديك حصة في الوقت نفسه **ينبّهك** التطبيق لكنه يسمح لك بالمتابعة.

لتسجيل الحضور افتح **الحصص** وابحث عن حصة اليوم واضغط **تسجيل الحضور** (أو الزر نفسه في الرئيسية). تظهر قائمة بكل لاعبيك وكلهم _غائب_ في البداية:

1. اضغط على اللاعب لتسجّله _حاضراً_ (اضغط مجدداً للتراجع). **تسجيل الجميع حاضرين** و**مسح الكل** اختصاران.
2. الوسم الأصفر «لا يوجد اشتراك ساري» مجرد تذكير — ما زال بإمكانك تسجيل اللاعب.
3. اضغط **حفظ الحضور**. يمكنك فتح الحصة لاحقاً وتصحيحه.

لا يمكن تسجيل الحضور إلا **ابتداءً من يوم الحصة** (لا لحصة مستقبلية)، ولا لحصة ملغاة. **إلغاء الحصة** نهائي — جدول حصة جديدة بدلاً من إعادة فتحها.

## ٣. للمديرين

للمدير كل ما للمدرب، لـ**جميع** اللاعبين والحصص، إضافة إلى الصفحات تحت **المزيد** على الهاتف (وفي القائمة الجانبية على الحاسوب).

### الرئيسية

أربعة أرقام — **اللاعبون النشطون** و**الاشتراكات السارية** و**المحصّل هذا الشهر** و**صافي الربح هذا الشهر** (مع الهامش) — ثم حصص اليوم والاشتراكات المنتهية قريباً وسجل **آخر النشاطات** لكل ما فعله أي شخص، وعليه وسم أخضر **مباشر**: تظهر الإدخالات الجديدة تلقائياً خلال ثوانٍ. استخدم الأزرار (اللاعبون، الاشتراكات، المدفوعات…) لتضييق العرض.

### المدربون

**إضافة مدرب** تنشئ حساباً: الاسم والبريد وكلمة مرور من 8 أحرف فأكثر (أبلغها للمدرب) والهاتف و**الراتب الشهري**. اجعل المدرب _غير نشط_ لمنعه من الدخول (يبقى سجله). لا يمكن إنشاء مدير آخر من هنا — اطلب ذلك ممن يدير مشروع Supabase.

### اللاعبون

كما للمدرب، لكنك ترى الجميع. حدّد لاعبين بمربعات الاختيار ثم اضغط **تعيين لمدرب**، أو اختر «بلا مدرب» لإلغاء التعيين؛ ولنموذج تعديل اللاعب حقل المدرب أيضاً.

### طلبات التسجيل

يسجّل أولياء الأمور أبناءهم **دون حساب**: أرسل لهم رابط التسجيل فيعبّئون نموذجاً قصيراً واحداً (اسمهم ورقم هاتفهم، وحتى أربعة أطفال). للحصول على الرابط افتح **المزيد ← التسجيلات** واضغط **نسخ رابط التسجيل**، ثم الصقه في رسالة أو مجموعة واتساب. (وفي صفحة تسجيل الدخول رابط إلى النموذج أيضاً.)

عندما يرسل ولي أمر النموذج يظهر رقم وردي على **المزيد** عند **التسجيلات** (وبطاقة في الرئيسية). افتح الطلب لترى الطفل وولي الأمر. وإذا كان هناك لاعب بالرقم الشخصي نفسه، أو طلب آخر قيد الانتظار به، يظهر مربع أصفر **تحقّق قبل القبول** يخبرك بذلك.

- **قبول** يضيف الطفل لاعباً مع اسم ولي الأمر. اختر مدرباً الآن أو اتركه وعيّنه لاحقاً، وأكّد الموقع الذي طلبه ولي الأمر. لا يمكن قبول رقم شخصي يملكه لاعب موجود.
- **رفض** يُبقي الطلب محفوظاً، مع ملاحظة اختيارية يراها المديرون فقط.
- يُبَتّ في كل طفل على حدة، والقرار نهائي. ويستطيع ولي أمر طفل مرفوض إرسال النموذج مرة أخرى.

التطبيق **لا** يراسل ولي الأمر. بعد قرارك تعرض صفحة الطلب رسالة جاهزة بلغة ولي الأمر وزر **مراسلة على واتساب** يفتح واتساب بها — ويمكنك تعديلها قبل الإرسال. وإن تعذّر استخدام الرقم في واتساب فاتصل بولي الأمر. الطلبات المرفوضة تبقى محفوظة (ولا يمكن حذفها).

### المواقع

**المزيد ← المواقع** تعرض الأماكن التي تتدرّب فيها الأكاديمية وتحصّل الرسوم. **إضافة موقع:** الاسم (والعنوان إن شئت). اضغط على موقع لتغيير اسمه أو **إيقافه** عندما تتوقفون عن استخدامه — يبقى ظاهرًا في الحصص والاشتراكات والتقارير السابقة، لكن لا يمكن اختياره لأي جديد. لا تُحذف المواقع أبدًا. كل حصة وكل اشتراك جديد يتبع موقعًا؛ والاشتراك القديم الذي لا موقع له يظهر عليه **لم يُحدَّد موقع بعد**، ويستطيع المسؤول تحديده بزر **تغيير الموقع** في صفحته (وتنتقل معه كل مدفوعاته).

### الخصومات والإعدادات

**الخصومات ← إضافة خصم:** كود (أحرف وأرقام)، ونسبة مئوية أو مبلغ ثابت، وتواريخ اختيارية وحد للاستخدام. **الإعدادات:** أسعار الباقات الأربع (1 أو 2 أو 3 أو 4 لاعبين)، ورسوم **القميص** و**المواصلات**، وعدد الأيام قبل النهاية التي يُعدّ فيها الاشتراك _ينتهي قريباً_. تغيير سعر لا يغيّر اشتراكات أُنشئت سابقاً.

### المصروفات والرواتب

**المصروفات** تعرض شهراً واحداً في كل مرة (استخدم الأسهم، وصفِّ بأزرار الفئات). **إضافة مصروف:** الفئة والمبلغ (بالدينار، مثل `12.500`) والتاريخ (ليس في المستقبل) و**موقع** اختياري (اتركه فارغًا للتكاليف المشتركة بين الأكاديمية كلها، مثل الرواتب) وملاحظة اختيارية؛ وراتب المدرب يتطلب اختيار المدرب. يمكن تصفية القائمة حسب الموقع. اضغط على مصروف لتعديله أو حذفه — يُسجَّل الحذف في سجل النشاطات.

**إنشاء الرواتب** يضيف مصروف راتب لكل مدرب _نشط_ له راتب شهري، بتاريخ اليوم الأول من الشهر المختار. لا ضرر من الضغط مرتين: المدرب الذي لديه راتب في ذلك الشهر يُتخطّى، ويخبرك التطبيق بعدد ما أُنشئ وما تُخطّي.

### التقارير

اختر **شهر** أو **سنة** وتنقّل بالأسهم. تظهر **المحصّل** و**المصروفات** و**الربح** و**الهامش** (الخسارة بالأحمر وبعلامة ناقص، والهامش «—» إذا لم يُحصَّل شيء)، ورسم بياني للسنة، والمصروفات حسب الفئة، وجدول شهراً بشهر. اختر **الموقع** لترى أرقامه وحده (ولا تشمل مصروفات الأكاديمية كلها)؛ وعند عرض كل المواقع يقسّم جدول **حسب الموقع** الفترة — وصفّه «بدون موقع» فيه الاشتراكات القديمة التي لا موقع لها ومصروفات الأكاديمية كلها. **المدفوعات (CSV)** و**المصروفات (CSV)** تنزّلان الفترة كملفات جداول تُفتح في Excel (مع الأسماء العربية).

_المحصّل_ يحسب الدفعات **بتاريخ استلامها**، بما فيها دفعات اشتراكات أُلغيت لاحقاً.

## ٤. عادات جيدة وإجابات قصيرة

- سجّل الدفعة يوم استلامها بتاريخها الحقيقي.
- الرقم الشخصي الواحد للاعب واحد. إذا قال التطبيق إنه موجود فابحث عن ذلك اللاعب بدل إضافته مجدداً.
- عند ظهور **«يتوفر إصدار جديد من التطبيق — تحديث»** اضغط **تحديث** حين لا تكون في منتصف عمل.
- **«تعذّر تحميل هذه الصفحة»** تعني أن التطبيق حُدّث للتو: اضغط **إعادة التحميل**.
- خطأ في قائمة حضور محفوظة؟ افتح الحصة واحفظها من جديد. دفعة أو اشتراك خاطئ؟ اسأل المدير — لا تُحذف الدفعات أبداً كي يبقى السجل أميناً.
