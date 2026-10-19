# خطة: جعل قاعدة البيانات المصدر الوحيد للأرقام وتصحيح الحسابات

بناءً على الملف المرفوع. لا تغيير على التصميم ولا مسار الرفع ولا بيانات قاعدة البيانات (عدا البند 4-ب بعد عرض نتائجه عليك).

## 1) حذف الأرقام الثابتة من الكود

**يبقى في `src/lib/oid-data.ts`:** ORGS، GAP_AXES، PERSPECTIVES، MATURITY_LABELS، أسماء السياسات (id وname فقط دون values)، POLICY_STATUS_META، PROGRAM_STATUS_META، ORG_FISCAL_YEAR، FISCAL_QUARTERS، quarterMonths/getQuarterLabel، WEIGHT_RULES، validateWeights، computeKPIStatus، isPercentUnit، formatKPIValue، validateKPIValue.

**يُحذف:** orgOverallScores، gapScores، kpiData، q1Data، criticalGaps، financialAssessment، financialProgram، financialTimeline، partnerships، institutions، initiatives، alerts، قيم السياسات (values)، وFIN_SCORES في oid-composite.ts.

**نقل الاستخدامات إلى قاعدة البيانات قبل الحذف:**
- `QuarterlySection`: جدول q1Data → قراءة من `quarterly_reports` (الربع الأول للسنة النشطة).
- `DashboardSection`: بطاقات المؤسسات → من جدول `institutions`؛ الشراكات الاحتياطية → من `partnerships` فقط؛ govPct الاحتياطي → من snapshot؛ التنبيهات الثابتة → قائمة فارغة مؤقتاً (التنبيهات الحية في دفعة لاحقة).
- `GapsSection`: حذف الرجوع لـ gapScores الثابتة — المصدر gap_scores فقط؛ criticalGaps → قائمة فارغة مؤقتاً أو حساب من gap_scores (الأدنى متوسطاً).
- `GovernanceSection`: حذف الرجوع لـ orgOverallScores؛ قيم السياسات من `governance_policies` فقط (السياسة بدون صف = "غير موجود/pending").
- `InstitutionProfileDrawer`: institutions/partnerships/initiatives/financial → من الجداول وadvisor_snapshots؛ gapScores → من gap_scores.
- `NotificationsPanel` و`oid-anomalies` و`oid-report-generator` و`CompositeScoreCard`: إزالة الاعتماد على kpiData/gapScores/institutions الثابتة، والقراءة من snapshot/الجداول.
- `oid-composite.ts`: حذف computeProfile وcomputeAllProfiles وكل الرجوع للثوابت؛ إبقاء computeProfileFromLive وحدها — عند غياب المصدر: null → "لا توجد بيانات".

## 2) أوزان الحوكمة في loadDashboardSnapshot
active=1.0، inactive=0.75، review=0.6، inDev=0.4، missing=0. تُستبعد pending من البسط والمقام؛ إن كانت كل سياسات المؤسسة pending → govScore = null.

## 3) الفجوات
حذف الفلتر الثابت period='Q2-2026'؛ لكل مؤسسة تُؤخذ أحدث فترة (صاحبة أحدث updated_at في gap_scores).

## 4) المؤشرات
- أ) متوسط المؤشرات في اللوحة يُحسب فقط على plan_year = السنة النشطة من `org_active_years`.
- ب) حذف قاعدة "≤1 اضرب ×100" من كل مكان (dashboard.functions، loadKpiAggregates، KPIsSection، kpis.functions، uploads.functions، oid-kpi-engine). عند الاستيراد: إذا كانت صيغة الخلية نسبة مئوية (cell.z يحتوي %) تُحوَّل ×100؛ تُخزَّن النسب دائماً 0–100. **للبيانات الموجودة:** أعرض عليك أولاً لكل upload_id عدد الصفوف وأعلى achievement_pct، وأجهّز ترحيل ×100 للملفات الكسرية ولا أنفذه حتى توافق.
- ج) حذف is_baseline الثابت (planYear === 2026)؛ السنة الأساس = أقدم plan_year موجودة للمؤسسة.

## 5) شارة المصدر والتاريخ
إضافة sourceLabel وupdatedAt لكل مؤسسة وكل مكوّن (gap/governance/kpi/financial) في DashboardSnapshot:
- kpi: اسم الملف وتاريخ الرفع من uploads عبر kpis.upload_id (الأحدث).
- gap: أحدث updated_at في gap_scores (أو اسم ملف المصفوفة من document_extractions).
- governance: أحدث updated_at في governance_policies → "تحديث السياسات".
- financial: أحدث advisor_snapshots أو financial_reports.

عرض سطر صغير تحت كل درجة: "المصدر: … — التاريخ"، يصفرّ مع "بيانات قديمة" بعد 120 يوماً، بالعربية والإنجليزية (مفاتيح i18n جديدة).

## التحقق
- فحص أنه لا يبقى أي استيراد للمحذوفات؛ tsgo + بناء؛ فحص بالمتصفح للوحة القيادة والأقسام المتأثرة.
- تقرير نهائي: قائمة المحذوفات، الأقسام التي أصبحت "لا توجد بيانات"، ونتيجة فحص البند 4-ب.
