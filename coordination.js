(function initCoordination(global) {
  "use strict";
  const D = Object.freeze({
    ...global.AZXDemoData,
    STORAGE_KEY: "anezx-coordination-demo-v1",
    SESSION_KEY: "anezx-coordination-demo-session-v1",
    save(db) {
      db.meta.updatedAt = `${db.meta.businessDate} ${new Date().toTimeString().slice(0, 5)}`;
      global.localStorage.setItem("anezx-coordination-demo-v1", JSON.stringify(db));
    },
  });
  const collections = ["plans", "budgets", "packs", "templates", "tasks", "reports", "issues", "acceptances", "settlements", "payments", "batches", "history"];
  const scenarios = [{ id: "co-story", name: "统筹履约完整故事", description: "独立恢复：费用、服务包、手机巡检、整改验收与报告接入。" }];
  const statuses = {
    tasks: ["待接单", "执行中", "待审核", "退回补充", "整改中", "待验收", "已验收"],
    reports: ["待人工审核", "退回补充", "审核通过"],
    issues: ["待整改", "待复查", "复查未通过", "已闭环"],
  };
  const item = (list, id) => {
    const value = list.find(x => x.id === id);
    if (!value) throw new Error(`找不到记录 ${id}`);
    return value;
  };
  const ensure = (condition, message) => { if (!condition) throw new Error(message); };
  function inspectionTemplate() {
    return {
      id: "TPL-INSPECT-1", name: "第三方现场巡检示例", version: "1.0", effective: "2026-01-01",
      status: "可用", industryId: "I07", basis: "Demo示范检查清单，非正式强制标准",
      items: [
        { id: "Q1", title: "疏散通道及安全出口是否保持畅通？", method: "现场观察通道、出口及占用情况", riskAnswer: "否", photoRequired: true, evidence: "至少1张现场照片（合成示意）" },
        { id: "Q2", title: "设备检查记录是否齐全并能对应现场设备？", method: "核对当期点检记录与现场设备标识", riskAnswer: "否", photoRequired: false, evidence: "现场简述必填；照片选填" },
        { id: "Q3", title: "现场防护装置是否完整且有效？", method: "现场观察适用设备及防护装置状态", riskAnswer: "否", photoRequired: true, evidence: "至少1张现场照片（合成示意）" },
      ],
    };
  }
  function seed() {
    const db = D.createSeed("baseline");
    db.meta.profile = "coordination";
    db.meta.coVersion = 1;
    db.meta.scenarioId = "co-story";
    db.meta.scenarioName = scenarios[0].name;
    db.meta.eventSequence = 0;
    db.enterprises = db.enterprises.slice(0, 3);
    db.enterprises.forEach((x, i) => { x.name = `示例企业 ${["甲 · 新材料", "乙 · 精密制造", "丙 · 仓储"][i]}`; x.regionId = "R01"; x.industryId = "I07"; });
    db.insurers = db.insurers.slice(0, 2);
    db.serviceProviders = db.serviceProviders.slice(0, 2);
    db.serviceProviders.forEach((x, i) => { x.name = `示例巡检机构 ${i ? "乙" : "甲"}`; x.shortName = x.name; });
    db.products = db.products.filter(x => db.insurers.some(i => i.id === x.insurerId));
    ["applications", "policies", "serviceTasks", "serviceRecords", "hazards", "rectifications", "reviews", "archives", "claims", "claimProgress", "complaints", "evaluations", "auditLogs", "notifications", "dataConnections", "ingestionBatches", "sourceRecords", "qualityIssues", "reportJobs", "inspections", "assignments"].forEach(k => { db[k] = []; });
    const associations = [["ENT-001", "INS-01"], ["ENT-001", "INS-02"], ["ENT-002", "INS-01"], ["ENT-003", "INS-02"]];
    db.policies = associations.map(([enterpriseId, insurerId], i) => ({
      id: `CP-${i + 1}`, policyNo: `DEMO-CO-2026-${i + 1}`, enterpriseId, insurerId, origin: "external",
      applicationId: null, productId: null, startDate: "2026-01-01", endDate: "2026-12-31",
      premium: 30000, sumInsured: 1000000, status: "生效中",
    }));
    db.accounts = [
      { id: "CO-REG", role: "regulator", username: "regulator", name: "统筹监管员", organization: "省级统筹（示例合同指定审核／验收人）", orgId: "REG-01", level: "province" },
      ...db.insurers.map((x, i) => ({ id: `CO-INS-${i + 1}`, role: "insurer", username: i ? "insurer-b" : "insurer", name: `保司${i ? "B" : "A"}履责经理`, organization: x.name, orgId: x.id })),
      ...db.serviceProviders.map((x, i) => ({ id: `CO-SP-${i + 1}`, role: "service", username: i ? "service-b" : "service", name: `巡检机构${i ? "乙" : "甲"}项目经理`, organization: x.name, orgId: x.id })),
      ...db.enterprises.map((x, i) => ({ id: i ? `CO-ENT-${i + 1}` : "CO-ENT", role: "enterprise", username: i ? `enterprise-${i + 1}` : "enterprise", name: `企业${["甲", "乙", "丙"][i]}安全员`, organization: x.name, orgId: x.id })),
    ].map(x => ({ ...x, password: "demo123" }));
    const template = { id: "TPL-1", name: "现场隐患排查示例", version: "1.0", effective: "2026-01-01", status: "可用", industryId: "I07", basis: "Demo示范检查清单，非正式强制标准", items: [
      { id: "Q1", title: "疏散通道是否保持畅通", method: "现场观察通道及出口", evidence: "现场照片", majorCandidate: true },
      { id: "Q2", title: "设备检查记录是否完整", method: "查看当期示例设备点检记录", evidence: "记录页面", majorCandidate: false },
      { id: "Q3", title: "特殊作业设施适用性核对", method: "确认本场所是否涉及此类设施", evidence: "适用性记录", majorCandidate: false },
    ] };
    db.co = {
      plans: db.enterprises.map((x, i) => ({ id: `PLAN-${i + 1}`, enterpriseId: x.id, site: "主厂区", service: "隐患排查", period: "2026-09", deadline: i ? "2026-09-05" : "2026-09-15", providerId: "SP-01", source: "预置合成计划样例（非监管派单）", policyIds: db.policies.filter(p => p.enterpriseId === x.id).map(p => p.id) })),
      budgets: db.insurers.map((x, i) => ({ id: x.id, period: "2026-09", receivedCents: 10000000, budgetCents: 1000000, status: "待确认", adjustments: [], basis: "录入的示例预算，未应用政策费率", source: `DEMO-RECEIPT-${i + 1} v1` })),
      packs: [
        { id: "PACK-01", name: "广州示例巡检服务包", providerId: "SP-01", contract: "DEMO-CONTRACT-01", authorized: true, unitCents: 120000, capacity: 3, period: "2026-09", buyer: "监管公开招标（用户业务设定；制度待确认）", reviewer: "CO-REG", payer: "示例合同付款主体", milestone: "报告、责任保司覆核、企业确认及约定复查全部完成", scope: ["PLAN-1", "PLAN-2", "PLAN-3"] },
        { id: "PACK-02", name: "补充服务包 · 合同待完善", providerId: "SP-02", contract: "", authorized: false, unitCents: 120000, capacity: 3, period: "2026-09", buyer: "待确认", reviewer: "CO-REG", payer: "待确认", milestone: "待合同确定", scope: ["PLAN-1", "PLAN-2", "PLAN-3"] },
      ],
      templates: [template, { ...D.clone(template), id: "TPL-2", version: "2.0", effective: "2027-01-01", status: "待生效", basis: "Demo升版示例，非政策发布日期" }, inspectionTemplate()],
      tasks: [], reports: [], issues: [], riskReviews: [], acceptances: [], settlements: [], payments: [], batches: [], history: [],
    };
    for (const n of [2, 3]) db.co.tasks.push(makeTask(db, `PLAN-${n}`, "PACK-01", `CT-API-${n}`, "执行中", "预置接口接入任务"));
    return db;
  }
  function makeTask(db, planId, packId, id, status = "待接单", source = "依据既有计划建立任务") {
    const c = db.co, p = item(c.plans, planId), pack = packId ? item(c.packs, packId) : null;
    return { id, planId, packId: pack?.id || null, enterpriseId: p.enterpriseId, policyIds: [...p.policyIds], providerId: pack?.providerId || planProviderId(db, p),
      templateId: pack ? "TPL-1" : inspectionTemplate().id, status, source, draft: null, receipt: "未确认", insurerChecks: [], history: [], assignedAt: db.meta.businessDate };
  }
  function planProviderId(db, plan) {
    return plan.providerId || db.co.tasks.find(task => task.planId === plan.id)?.providerId
      || db.co.packs.find(pack => (pack.scope || []).includes(plan.id))?.providerId || "";
  }
  function taskVisible(db, account, t) {
    if (account.role === "regulator") return true;
    if (account.role === "service") return t.providerId === account.orgId;
    if (account.role === "enterprise") return t.enterpriseId === account.orgId;
    return t.policyIds.some(id => item(db.policies, id).insurerId === account.orgId);
  }
  function plansFor(db, account, insurerId = "") {
    return db.co.plans.filter(p => {
      if (account.role === "enterprise" && p.enterpriseId !== account.orgId) return false;
      if (account.role === "service" && planProviderId(db, p) !== account.orgId) return false;
      const insurer = account.role === "insurer" ? account.orgId : insurerId;
      return !insurer || p.policyIds.some(id => item(db.policies, id).insurerId === insurer);
    });
  }
  function latest(db, taskId) { return db.co.reports.filter(r => r.taskId === taskId).at(-1) || null; }
  function sampleAnswers() {
    return [
      { id: "Q1", result: "不符合", note: "合成示例：疏散通道局部堆放物品", evidence: true, reason: "" },
      { id: "Q2", result: "符合", note: "合成示例：设备检查记录齐全", evidence: true, reason: "" },
      { id: "Q3", result: "不适用", note: "", evidence: false, reason: "本次示例场所无此类设施" },
    ];
  }
  function sampleReport(db, task) {
    return {
      address: "合成地址：广州示例园区主厂区", startedAt: `${db.meta.businessDate}T09:00`, endedAt: `${db.meta.businessDate}T11:00`,
      inspectors: "合成巡检员甲／安全工程专业", escort: "合成企业安全员",
      scope: "主厂区通道及设备记录抽查", excludedScope: "未检查其他车间", exclusionReason: "本次合同示例范围限主厂区",
      summary: "合成示例：逐项记录现场事实，问题按报告清单跟进。", limitations: "抽样检查，仅反映本次范围与时点，不构成企业整体安全认证。",
      taskId: task.id,
    };
  }
  const reportFields = {
    address: ["实际检查地址", 300], startedAt: ["检查开始时间", 16], endedAt: ["检查结束时间", 16],
    inspectors: ["检查人员及专业", 300], escort: ["企业陪同人员", 200], scope: ["检查范围", 500],
    summary: ["主要发现", 1000], limitations: ["检查限制／待核事项", 500],
  };
  const textValid = (value, limit) => typeof value === "string" && value.trim().length > 0 && value.length <= limit;
  const dateValid = value => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
  const timeValid = value => typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) && dateValid(value.slice(0, 10)) && Number(value.slice(11, 13)) < 24 && Number(value.slice(14)) < 60;
  function sampleDetailedAnswers() {
    return sampleAnswers().map(x => ({ ...x, location: "主厂区示例检查点", risk: x.result === "不符合" ? "合成示例：可能影响人员通行" : "", recommendation: x.result === "不符合" ? "清理占用物品并复核同类位置" : "" }));
  }
  function sampleInspectionAnswers() {
    return [
      { id: "Q1", result: "否", note: "合成示例：通道一处有物品占用，已记录位置", reason: "", photoCount: 1 },
      { id: "Q2", result: "是", note: "合成示例：点检记录与现场设备标识对应", reason: "", photoCount: 0 },
      { id: "Q3", result: "不适用", note: "", reason: "合成示例：本计划检查范围内无此类防护装置适用设备", photoCount: 0 },
    ];
  }
  function evidenceFor(task, answers, meta) {
    return answers.flatMap(x => {
      const photoCount = Number.isSafeInteger(x.photoCount) ? x.photoCount : x.evidence ? 1 : 0;
      return Array.from({ length: photoCount }, (_, index) => ({
        id: `DEMO-${task.id}-${x.id}-${index + 1}`, itemId: x.id,
        type: Number.isSafeInteger(x.photoCount) ? "合成照片示意" : "合成示意",
        collector: meta.inspectors, capturedAt: meta.startedAt,
      }));
    });
  }
  function reportMetaErrors(task, input) {
    const errors = [], m = input.meta || {};
    for (const [key, [label, limit]] of Object.entries(reportFields)) if (!textValid(m[key], limit)) errors.push(`${label}必填且不得超过${limit}字`);
    if (!timeValid(m.startedAt) || !timeValid(m.endedAt) || m.endedAt < m.startedAt) errors.push("检查起止时间无效或结束早于开始");
    for (const key of ["excludedScope", "exclusionReason"]) if (typeof m[key] !== "string" || m[key].length > 500) errors.push("未检查范围及理由须为不超过500字的文字");
    if (m.excludedScope?.trim() && !m.exclusionReason?.trim()) errors.push("请说明未检查范围的理由");
    if (m.taskId !== task.id) errors.push("现场信息任务关联不一致");
    return errors;
  }
  function detailedErrors(db, task, input) {
    if (!input || input.reportSchemaVersion !== 2) return ["请使用新版报告结构并补齐现场信息"];
    const errors = reportErrors(db, task, input.answers);
    errors.push(...reportMetaErrors(task, input));
    const m = input.meta || {};
    for (const x of Array.isArray(input.answers) ? input.answers : []) {
      if (!x || typeof x.id !== "string") continue;
      if (typeof x.evidence !== "boolean" || ["location", "risk", "recommendation"].some(key => typeof x[key] !== "string" || x[key].length > (key === "location" ? 200 : 500))) errors.push(`${x.id} 位置／风险／建议或证据类型无效`);
      if (x.result !== "不适用" && !textValid(x.location, 200)) errors.push(`${x.id} 请填写检查位置／对象`);
      if (x.result === "不符合" && (!textValid(x.risk, 500) || !textValid(x.recommendation, 500))) errors.push(`${x.id} 请填写风险说明及整改建议`);
      if (typeof x.note !== "string" || x.note.length > 500 || typeof x.reason !== "string" || x.reason.length > 200) errors.push(`${x.id} 现场记录／理由超出长度或类型错误`);
    }
    const refs = input.evidence;
    if (!Array.isArray(refs) || refs.some(x => !x || !textValid(x.id, 200)) || new Set(refs.map(x => x.id)).size !== refs.length) errors.push("证据引用结构无效");
    else {
      if (refs.some(x => !Array.isArray(input.answers) || !input.answers.some(a => a?.id === x.itemId && a.evidence === true) || x.type !== "合成示意" || x.collector !== m.inspectors || !timeValid(x.capturedAt) || x.capturedAt < m.startedAt || x.capturedAt > m.endedAt)) errors.push("证据关联、采集人或时间不一致");
      if (Array.isArray(input.answers) && input.answers.some(a => a?.evidence === true && !refs.some(x => x.itemId === a.id))) errors.push("缺少检查项合成证据引用");
    }
    return errors;
  }
  function inspectionErrors(db, task, input) {
    if (!input || input.reportSchemaVersion !== 3) return ["请使用现场巡检新版报告结构"];
    const template = input.templateSnapshot || db.co.templates.find(x => x.id === task.templateId), errors = reportMetaErrors(task, input);
    if (!template || template.id !== task.templateId || !Array.isArray(template.items)) return [...errors, "巡检模板快照无效"];
    const answers = input.answers;
    if (!Array.isArray(answers) || answers.length !== template.items.length || answers.some(x => !x || typeof x.id !== "string") || new Set(answers.map(x => x.id)).size !== answers.length || JSON.stringify(template.items.map(x => x.id)) !== JSON.stringify(answers.map(x => x.id))) return [...errors, "报告检查项结构不合法，请按锁定模板逐项填报"];
    template.items.forEach(q => {
      const a = answers.find(x => x.id === q.id);
      if (!["是", "否", "不适用", "无法检查"].includes(a.result)) { errors.push(`${q.id} 请选择检查结果`); return; }
      if (a.result === "不适用" || a.result === "无法检查") {
        if (!textValid(a.reason, 500)) errors.push(`${q.id} 请填写例外原因`);
      } else {
        if (!textValid(a.note, 500)) errors.push(`${q.id} 请填写现场简述`);
        if (q.photoRequired && (!Number.isSafeInteger(a.photoCount) || a.photoCount < 1 || a.photoCount > 3)) errors.push(`${q.id} 至少需要1张照片（合成示意）`);
      }
      if (typeof a.note !== "string" || a.note.length > 500 || typeof a.reason !== "string" || a.reason.length > 500 || !Number.isSafeInteger(a.photoCount) || a.photoCount < 0 || a.photoCount > 3) errors.push(`${q.id} 现场简述、例外原因或照片数量无效`);
    });
    const refs = input.evidence;
    if (!Array.isArray(refs) || refs.some(x => !x || !textValid(x.id, 200)) || new Set(refs.map(x => x.id)).size !== refs.length) errors.push("照片引用结构无效");
    else {
      const photos = answers.flatMap(a => Array.from({ length: a.photoCount || 0 }, () => a.id));
      if (refs.length !== photos.length || refs.some((x, i) => x.itemId !== photos[i] || x.type !== "合成照片示意" || x.collector !== input.meta?.inspectors || !timeValid(x.capturedAt) || x.capturedAt < input.meta.startedAt || x.capturedAt > input.meta.endedAt)) errors.push("照片引用、检查项、采集人或时间不一致");
    }
    return errors;
  }
  function reportErrors(db, task, answers) {
    const template = item(db.co.templates, task.templateId), errors = [];
    if (!Array.isArray(answers) || answers.length !== template.items.length || answers.some(x => !x || typeof x.id !== "string") || new Set(answers.map(x => x.id)).size !== answers.length) return ["报告检查项结构不合法，请按锁定模板逐项填报"];
    template.items.forEach(q => {
      const a = (answers || []).find(x => x.id === q.id);
      if (!a || !["符合", "不符合", "不适用", "无法确认"].includes(a.result)) { errors.push(`${q.id} 请选择检查结果`); return; }
      if (a.result === "不适用") {
        if (typeof a.reason !== "string" || !a.reason.trim()) errors.push(`${q.id} 请填写不适用理由`);
      } else {
        if (typeof a.note !== "string" || !a.note.trim()) errors.push(`${q.id} 请填写现场记录／补查说明`);
        if (a.evidence !== true) errors.push(`${q.id} 缺少必填证据：${q.evidence}`);
      }
    });
    return errors;
  }
  function addReport(db, t, answers, source, key = "", raw = null, details = null) {
    ensure(!latest(db, t.id) || latest(db, t.id).status === "退回补充", "已有待审或通过报告，不能重复提交");
    const errors = details?.reportSchemaVersion === 3 ? inspectionErrors(db, t, details) : reportErrors(db, t, answers);
    ensure(!errors.length, errors.join("；"));
    const version = db.co.reports.filter(r => r.taskId === t.id).length + 1;
    const r = { id: `REP-${t.id}-${version}`, taskId: t.id, templateId: t.templateId, version, status: "待人工审核", source, key,
      answers: D.clone(answers), raw: raw ? D.clone(raw) : null, submittedAt: db.meta.businessDate, reviewer: null, returned: false };
    if (details) {
      const errors = details.reportSchemaVersion === 3 ? inspectionErrors(db, t, details) : detailedErrors(db, t, details);
      ensure(!errors.length, errors.join("；"));
      Object.assign(r, { reportSchemaVersion: details.reportSchemaVersion, meta: D.clone(details.meta), evidence: D.clone(details.evidence),
        templateSnapshot: D.clone(item(db.co.templates, t.templateId)), submittedBy: details.submittedBy });
    }
    db.co.reports.push(r); t.status = "待审核"; t.draft = null; t.insurerChecks = []; t.receipt = "未确认";
    return r;
  }
  function validate(db) {
    const errors = D.validate(db);
    if (db.meta?.profile !== "coordination" || db.meta.coVersion !== 1 || db.meta.schemaVersion !== D.SCHEMA_VERSION) errors.push("统筹资料版本不兼容");
    const c = db.co;
    if (!c) return [...errors, "缺少统筹资料"];
    collections.forEach(k => {
      if (!Array.isArray(c[k])) errors.push(`缺少统筹集合 ${k}`);
      else if (new Set(c[k].map(x => x.id)).size !== c[k].length) errors.push(`${k} ID重复`);
    });
    if (errors.length) return errors;
    const has = (k, id) => c[k].some(x => x.id === id);
    c.plans.forEach(p => {
      if (!db.enterprises.some(x => x.id === p.enterpriseId) || !db.serviceProviders.some(x => x.id === planProviderId(db, p)) || !p.policyIds.length || p.policyIds.some(id => !db.policies.some(x => x.id === id && x.enterpriseId === p.enterpriseId))) errors.push(`计划 ${p.id} 责任关联无效`);
    });
    c.budgets.forEach(b => {
      if (!db.insurers.some(x => x.id === b.id) || !["待确认", "已确认"].includes(b.status)
        || ![b.receivedCents, b.budgetCents, ...b.adjustments.flatMap(x => [x.deltaCents, x.receivedDeltaCents])].every(Number.isSafeInteger)
        || b.budgetCents + b.adjustments.reduce((n, x) => n + x.deltaCents, 0) < 0
        || b.receivedCents + b.adjustments.reduce((n, x) => n + x.receivedDeltaCents, 0) < 0) errors.push(`费用台账 ${b.id} 无效`);
    });
    c.packs.forEach(p => {
      if (!db.serviceProviders.some(x => x.id === p.providerId) || !Number.isSafeInteger(p.unitCents) || p.unitCents <= 0 || !db.accounts.some(x => x.id === p.reviewer && x.role === "regulator") || p.scope.some(id => !has("plans", id))) errors.push(`服务包 ${p.id} 无效`);
    });
    c.tasks.forEach(t => {
      const p = c.plans.find(x => x.id === t.planId), pack = c.packs.find(x => x.id === t.packId);
      if (!p || (t.packId ? !pack || pack.providerId !== t.providerId : planProviderId(db, p) !== t.providerId) || !has("templates", t.templateId) || p.enterpriseId !== t.enterpriseId || JSON.stringify(p.policyIds) !== JSON.stringify(t.policyIds) || !statuses.tasks.includes(t.status)) errors.push(`任务 ${t.id} 关联或状态无效`);
    });
    if (new Set(c.tasks.map(t => t.planId)).size !== c.tasks.length) errors.push("同一服务计划只能有一笔执行记录");
    c.reports.forEach(r => {
      const t = c.tasks.find(x => x.id === r.taskId);
      if (!t || r.templateId !== t.templateId || !statuses.reports.includes(r.status) || (r.reportSchemaVersion === 3 ? inspectionErrors(db, t, r).length : reportErrors(db, t, r.answers).length)) errors.push(`报告 ${r.id} 无效`);
      if (r.reportSchemaVersion !== undefined && ![2, 3].includes(r.reportSchemaVersion)) errors.push(`报告 ${r.id} 结构版本不支持`);
      if (t && r.reportSchemaVersion === 2) {
        if (detailedErrors(db, t, r).length || r.templateSnapshot?.id !== t.templateId
          || !textValid(r.templateSnapshot?.version, 100) || !textValid(r.templateSnapshot?.basis, 1000)
          || !Array.isArray(r.templateSnapshot?.items) || !Array.isArray(r.answers) || r.templateSnapshot.items.some(x => !x || !textValid(x.title, 500) || !textValid(x.method, 500)) || JSON.stringify(r.templateSnapshot.items.map(x => x.id)) !== JSON.stringify(r.answers.map(x => x?.id))
          || !db.accounts.some(a => a.id === r.submittedBy && (a.role === "regulator" || a.role === "service" && a.orgId === t.providerId))) errors.push(`报告 ${r.id} 新版信息或快照无效`);
      }
      if (t && r.reportSchemaVersion === 3) {
        const snapshotItems = r.templateSnapshot?.items;
        if (inspectionErrors(db, t, r).length || !textValid(r.templateSnapshot?.version, 100) || !textValid(r.templateSnapshot?.basis, 1000)
          || !Array.isArray(snapshotItems) || snapshotItems.some(x => !x || !textValid(x.title, 500) || !textValid(x.method, 500) || !["是", "否"].includes(x.riskAnswer) || typeof x.photoRequired !== "boolean")
          || JSON.stringify(snapshotItems.map(x => x.id)) !== JSON.stringify(r.answers.map(x => x.id))
          || !db.accounts.some(a => a.id === r.submittedBy && a.role === "service" && a.orgId === t.providerId)) errors.push(`报告 ${r.id} 巡检快照或提交身份无效`);
        const exceptions = r.answers.filter(a => a.result === "不适用").map(a => a.id);
        if (r.status === "审核通过" && (!Array.isArray(r.exceptionReviews) || JSON.stringify(r.exceptionReviews.map(x => x.itemId)) !== JSON.stringify(exceptions)
          || r.exceptionReviews.some(x => x.reviewer !== r.reviewer || !textValid(x.reason, 500)))) errors.push(`报告 ${r.id} 不适用项审核记录无效`);
      }
    });
    c.issues.forEach(i => {
      if (!has("tasks", i.taskId) || !has("reports", i.reportId) || !statuses.issues.includes(i.status)) errors.push(`隐患 ${i.id} 无效`);
      if (i.submissions !== undefined && (!Array.isArray(i.submissions) || i.submissions.some(s => s.reportId !== i.reportId || !textValid(s.owner, 200) || !textValid(s.measures, 1000) || !dateValid(s.date) || s.evidence !== "DEMO-RECTIFICATION" || !db.accounts.some(a => a.id === s.actor && a.role === "enterprise" && c.tasks.find(t => t.id === i.taskId)?.enterpriseId === a.orgId)))) errors.push(`隐患 ${i.id} 整改提交无效`);
      if (i.reviewRecords !== undefined && (!Array.isArray(i.reviewRecords) || i.reviewRecords.some(r => !["材料复核", "现场复查"].includes(r.method) || !textValid(r.findings, 1000) || !dateValid(r.date) || !["通过", "未通过"].includes(r.result) || !db.accounts.some(a => a.id === r.actor && a.role === "service" && c.tasks.find(t => t.id === i.taskId)?.providerId === a.orgId) || (r.legacySubmission ? r.submissionId !== null : !i.submissions?.some(s => s.id === r.submissionId && s.date <= r.date))))) errors.push(`隐患 ${i.id} 复查记录无效`);
    });
    if (c.riskReviews !== undefined && (!Array.isArray(c.riskReviews) || c.riskReviews.some(review => {
      const region = db.regions.some(x => x.id === review.regionId);
      const reviewer = db.accounts.some(x => x.id === review.reviewer && x.role === "regulator");
      const reports = Array.isArray(review.reportIds) && review.reportIds.every(id => {
        const report = c.reports.find(x => x.id === id), task = report && c.tasks.find(x => x.id === report.taskId);
        return report?.status === "审核通过" && task && db.enterprises.find(x => x.id === task.enterpriseId)?.regionId === review.regionId;
      });
      if (!region || !reviewer || !["red", "orange", "yellow", "blue"].includes(review.demoColor)
        || !textValid(review.basis, 1000) || !dateValid(review.at) || !reports || !review.reportIds.length
        || new Set(review.reportIds).size !== review.reportIds.length) return true;
      return false;
    }))) errors.push("地区风险Demo研判记录无效");
    c.acceptances.forEach(a => { if (!has("tasks", a.taskId) || !has("reports", a.reportId) || !Number.isSafeInteger(a.cents) || a.cents <= 0) errors.push(`验收 ${a.id} 无效`); });
    c.settlements.forEach(s => {
      const a = c.acceptances.find(x => x.id === s.acceptanceId), t = a && c.tasks.find(x => x.id === a.taskId);
      if (!a || !t || s.cents !== a.cents || s.allocations.reduce((n, x) => n + x.cents, 0) !== s.cents || s.allocations.some(x => !Number.isSafeInteger(x.cents) || x.cents <= 0 || !t.policyIds.some(id => db.policies.find(p => p.id === id)?.insurerId === x.insurerId))) errors.push(`结算 ${s.id} 分摊无效`);
    });
    c.payments.forEach(p => { const s = c.settlements.find(x => x.id === p.settlementId); if (!s || s.cents !== p.cents || !p.voucher) errors.push(`付款凭证 ${p.id} 无效`); });
    for (const [name, key] of [["acceptances", "taskId"], ["settlements", "acceptanceId"], ["payments", "settlementId"]]) {
      if (new Set(c[name].map(x => x[key])).size !== c[name].length) errors.push(`${name} 重复计费`);
    }
    return errors;
  }
  function load() {
    try {
      const raw = global.localStorage.getItem(D.STORAGE_KEY);
      if (!raw) return { db: seed(), warning: null };
      const db = JSON.parse(raw), errors = validate(db);
      ensure(!errors.length, errors.join("；"));
      return { db, warning: null };
    } catch (error) {
      return { db: seed(), blocked: true, warning: `统筹资料无法载入：${error.message}。未覆盖原存档，请在演示设置明确重置本模式。` };
    }
  }
  function run(db, accountId, action, id, payload = {}) {
    try {
      ensure(db.meta.profile === "coordination", "不是统筹模式");
      const next = D.clone(db), c = next.co, a = item(next.accounts, accountId);
      const role = (...roles) => ensure(roles.includes(a.role), "请使用对应责任主体账号");
      const owned = t => ensure(taskVisible(next, a, t), "不能操作其他机构任务");
      const t = c.tasks.find(x => x.id === id);
      let message = "";
      switch (action) {
        case "confirmBudget": {
          role("insurer"); ensure(a.orgId === id, "只能确认本机构费用");
          const b = item(c.budgets, id); ensure(b.status !== "已确认", "台账已确认");
          b.status = "已确认"; b.confirmedBy = a.id; message = "预算已确认；未产生实际付款"; break;
        }
        case "adjustBudget": {
          role("insurer"); ensure(a.orgId === id, "只能调整本机构费用");
          const b = item(c.budgets, id); ensure(b.status === "已确认" && !b.adjustments.length, "请先确认台账；示例调整仅执行一次");
          b.adjustments.push({ id: "ADJ-01", deltaCents: -100000, receivedDeltaCents: -500000, reason: "示例退款／批改差额，非政策费率计算", source: "DEMO-ADJUSTMENT-01", actor: a.id, at: next.meta.businessDate });
          message = "已追加费用调整记录，原预算及已验收服务未被覆盖"; break;
        }
        case "dispatch": {
          throw new Error("此统筹演示不由监管编制或派发巡检任务；巡检机构应从已存在的合成计划开始");
        }
        case "startInspection": {
          role("service");
          const p = item(c.plans, id);
          ensure(planProviderId(next, p) === a.orgId, "此计划不属于当前巡检机构");
          let existing = c.tasks.find(x => x.planId === p.id);
          if (existing) {
            message = `${existing.id} 已存在，已为你保留原任务与报告`;
          } else {
            if (!c.templates.some(template => template.id === inspectionTemplate().id)) c.templates.push(inspectionTemplate());
            const taskId = `CT-${p.id}`;
            c.tasks.push(makeTask(next, p.id, null, taskId, "待接单", "依据预置合成计划开始（非监管派单）"));
            existing = c.tasks[c.tasks.length - 1];
            message = "已从既有合成计划建立巡检执行记录；请在任务页接单";
          }
          next.meta.navigateTo = `/service/co-tasks?task=${existing.id}`;
          break;
        }
        case "acceptTask":
          role("service"); ensure(t, "请选择任务"); owned(t); ensure(t.status === "待接单", "当前不能接单");
          t.status = "执行中"; message = "已接单，请按锁定模板逐项填报"; break;
        case "submitReport":
          role("service"); ensure(t, "请选择任务"); owned(t); ensure(["执行中", "退回补充"].includes(t.status), "当前不能提交报告");
          addReport(next, t, payload.answers, "手机式填报", "", null, { ...payload, submittedBy: a.id }); message = "报告已提交，等待人工审核，不代表验收通过"; break;
        case "returnReport": {
          role("regulator"); ensure(t, "请选择任务");
          const r = latest(next, t.id); ensure(r?.status === "待人工审核", "没有待审核报告");
          r.status = "退回补充"; r.returned = true; r.reviewNote = "示例退回：补充现场记录中的范围与日期"; r.reviewer = a.id;
          t.status = "退回补充"; message = "已退回补充，旧报告版本保留；原报告内容可供巡检机构接续补正"; break;
        }
        case "approveReport": {
          role("regulator"); ensure(t, "请选择任务");
          const r = latest(next, t.id); ensure(r?.status === "待人工审核", "没有待审核报告");
          ensure(!r.answers.some(x => ["无法确认", "无法检查"].includes(x.result)), "仍有无法确认／无法检查项，请退回补查，不能直接审核通过");
          r.status = "审核通过"; r.reviewer = a.id; r.reviewNote = "示例人工审核：证据与逐项记录已核对";
          const template = r.templateSnapshot || item(c.templates, r.templateId);
          r.answers.filter(x => x.result === (template.items.find(q => q.id === x.id)?.riskAnswer || "不符合")).forEach((x, i) => {
            const question = template.items.find(q => q.id === x.id);
            c.issues.push({ id: `ISS-${r.id}-${i + 1}`, taskId: t.id, reportId: r.id, itemId: x.id, note: x.note, location: x.location || "", risk: x.risk || "", recommendation: x.recommendation || "", classification: r.reportSchemaVersion === 3 ? "待人工研判" : question.majorCandidate ? "疑似重大 · 待人工判定" : "一般问题（示例）", status: "待整改", deadline: "2026-09-12", history: [] });
          });
          if (r.reportSchemaVersion === 3) r.exceptionReviews = r.answers.filter(x => x.result === "不适用").map(x => ({ itemId: x.id, reason: x.reason, reviewer: a.id, at: next.meta.businessDate }));
          t.status = c.issues.some(x => x.taskId === t.id) ? "整改中" : "待验收";
          message = "报告审核通过；整改及服务验收保持独立"; break;
        }
        case "classify": {
          role("regulator"); const issue = item(c.issues, id);
          ensure(issue.classification.includes("待人工"), "已完成人工判定");
          const demoColor = payload.demoColor || "yellow";
          ensure(["red", "orange", "yellow"].includes(demoColor), "请选择红／橙／黄的Demo示例研判颜色");
          const labels = { red: "红色 · 高关注", orange: "橙色 · 重点关注", yellow: "黄色 · 一般关注" };
          issue.classification = `${labels[demoColor]}（Demo人工示例）`;
          issue.judgement = { actor: a.id, basis: "Demo示例：监管人员结合该报告版本、现场记录及适用范围人工研判；非正式标准或执法结论", at: next.meta.businessDate, demoColor };
          message = "已记录示例人工判定及依据，非系统自动认定"; break;
        }
        case "assessRegion": {
          role("regulator");
          const region = item(next.regions, id), analysis = riskAnalysis(next, a).find(x => x.id === region.id);
          const demoColor = payload.demoColor;
          ensure(["red", "orange", "yellow", "blue"].includes(demoColor), "请选择红／橙／黄／蓝的Demo示例颜色");
          ensure(textValid(payload.basis, 1000), "请填写地区Demo研判依据");
          ensure(analysis.verifiedReports.length > 0, "暂无已审核报告，不能记录地区示例研判");
          ensure(demoColor !== "blue" || !analysis.riskClues.length, "当前已审核报告含模板标记风险线索，不适用蓝色示例；请记录其他有依据的地区研判");
          ensure(demoColor !== "blue" || (!analysis.unknownItems.length && !analysis.exceptionReviewPending.length && !analysis.uncoloredJudgements.length), "仍有未知项或无法追溯的例外／人工研判，不能示意蓝色");
          c.riskReviews ||= [];
          c.riskReviews.push({
            id: `RISK-${region.id}-${c.riskReviews.filter(x => x.regionId === region.id).length + 1}`,
            regionId: region.id, demoColor, basis: payload.basis.trim(), reviewer: a.id,
            at: next.meta.businessDate,
            reportIds: analysis.verifiedReports.map(report => report.id).sort(),
          });
          message = "已追加地区Demo人工研判记录；不是官方风险结论"; break;
        }
        case "insurerCheck":
          role("insurer"); ensure(t, "请选择任务"); owned(t); ensure(latest(next, t.id)?.status === "审核通过", "请先完成报告审核");
          ensure(!t.insurerChecks.includes(a.orgId), "本保司已覆核");
          t.insurerChecks.push(a.orgId); message = "本保司已覆核服务成果；费用投入不代替服务责任"; break;
        case "confirmReceipt":
        case "dispute":
          role("enterprise"); ensure(t, "请选择任务"); owned(t); ensure(latest(next, t.id)?.status === "审核通过", "请先完成报告审核");
          ensure(t.status !== "已验收", "已验收阶段不可改写确认，请另行处理争议");
          if (action === "dispute") { ensure(t.receipt !== "有异议", "异议已登记"); t.receipt = "有异议"; message = "企业异议已登记，按示例合同暂停验收"; }
          else { ensure(t.receipt !== "已确认", "已确认收到"); t.receipt = "已确认"; message = "已确认收到并撤回未解决异议（如有），不等于认定全部安全责任"; }
          break;
        case "rectify": {
          role("enterprise"); const issue = item(c.issues, id); owned(item(c.tasks, issue.taskId));
          ensure(!issue.classification.includes("待人工"), "请先由审核人确认隐患性质");
          ensure(["待整改", "复查未通过"].includes(issue.status), "当前不能提交整改");
          ensure(textValid(payload.owner, 200) && textValid(payload.measures, 1000) && dateValid(payload.date) && payload.evidence === true, "请填写整改责任人、措施、有效日期并附上合成证据");
          issue.submissions ||= [];
          const submission = { id: `RECT-${issue.id}-${issue.submissions.length + 1}`, actor: a.id, owner: payload.owner, measures: payload.measures, date: payload.date, evidence: "DEMO-RECTIFICATION", reportId: issue.reportId };
          issue.submissions.push(submission);
          issue.status = "待复查"; issue.history.push({ actor: a.id, at: payload.date, text: `整改提交 ${submission.id}：${payload.measures}`, evidence: "DEMO-RECTIFICATION" });
          message = "整改材料已提交，等待第三方复查"; break;
        }
        case "failReview":
        case "passReview": {
          role("service"); const issue = item(c.issues, id); owned(item(c.tasks, issue.taskId)); ensure(issue.status === "待复查", "没有待复查整改");
          ensure(["材料复核", "现场复查"].includes(payload.method) && textValid(payload.findings, 1000) && dateValid(payload.date), "请填写复查方式、有效日期和核验事实／补充要求");
          const submission = issue.submissions?.at(-1);
          ensure(!submission || payload.date >= submission.date, "复查日期不能早于整改提交");
          issue.reviewRecords ||= [];
          issue.reviewRecords.push({ id: `REVIEW-${issue.id}-${issue.reviewRecords.length + 1}`, submissionId: submission?.id || null, legacySubmission: !submission, actor: a.id, method: payload.method, findings: payload.findings, date: payload.date, result: action === "passReview" ? "通过" : "未通过" });
          issue.status = action === "passReview" ? "已闭环" : "复查未通过";
          issue.history.push({ actor: a.id, at: payload.date, text: `${issue.status}：${payload.findings}` });
          const task = item(c.tasks, issue.taskId);
          task.status = c.issues.filter(x => x.taskId === task.id).every(x => x.status === "已闭环") ? "待验收" : "整改中";
          message = issue.status === "已闭环" ? "复查通过；服务验收仍待独立确认" : "复查未通过，已退回企业"; break;
        }
        case "acceptService": {
          role("regulator"); ensure(t, "请选择任务"); const pack = item(c.packs, t.packId), r = latest(next, t.id);
          ensure(pack.reviewer === a.id, "不是合同指定验收人");
          ensure(!c.acceptances.some(x => x.taskId === t.id), "该阶段已验收，不能重复计费");
          ensure(r?.status === "审核通过", "报告尚未审核通过");
          ensure(t.receipt === "已确认", "企业尚未确认或存在未解决异议");
          ensure(t.policyIds.every(pid => t.insurerChecks.includes(item(next.policies, pid).insurerId)), "仍有责任保司未覆核");
          ensure(c.issues.filter(x => x.taskId === t.id).every(x => x.status === "已闭环" && !x.classification.includes("待人工")), "示例合同约定的复查尚未完成");
          c.acceptances.push({ id: `AC-${t.id}`, taskId: t.id, reportId: r.id, cents: pack.unitCents, actor: a.id, at: next.meta.businessDate, basis: pack.milestone });
          t.status = "已验收"; message = "合同阶段已验收，尚未结算或付款"; break;
        }
        case "settle": {
          role("regulator"); const acceptance = item(c.acceptances, id), task = item(c.tasks, acceptance.taskId);
          ensure(!c.settlements.some(x => x.acceptanceId === id), "已经确认结算");
          const insurerIds = [...new Set(task.policyIds.map(pid => item(next.policies, pid).insurerId))];
          ensure(insurerIds.every(ins => item(c.budgets, ins).status === "已确认"), "请先由各保司确认费用台账");
          // The sample contract defines these fixed allocations, not a policy formula.
          const allocations = insurerIds.length === 2 ? insurerIds.map(insurerId => ({ insurerId, cents: 60000 })) : [{ insurerId: insurerIds[0], cents: acceptance.cents }];
          ensure(allocations.every(x => {
            const budget = item(c.budgets, x.insurerId);
            const prior = c.settlements.flatMap(s => s.allocations).filter(y => y.insurerId === x.insurerId).reduce((n, y) => n + y.cents, 0);
            return prior + x.cents <= budget.budgetCents + budget.adjustments.reduce((n, y) => n + y.deltaCents, 0);
          }), "示例分摊超过本期已确认预算，需先核对费用安排");
          c.settlements.push({ id: `ST-${id}`, acceptanceId: id, cents: acceptance.cents, allocations, actor: a.id, basis: "示例合同分摊确认单：双保司各600元，单保司1200元；非政策", at: next.meta.businessDate });
          message = "已确认一次服务结算及示例分摊，未执行付款"; break;
        }
        case "payment": {
          role("regulator"); const s = item(c.settlements, id);
          ensure(!c.payments.some(x => x.settlementId === id), "已登记付款凭证");
          c.payments.push({ id: `PAY-${id}`, settlementId: id, cents: s.cents, voucher: "DEMO-PAYMENT-001（合成）", actor: a.id, at: next.meta.businessDate, status: "合成凭证已登记，未连接银行" });
          message = "仅登记合成付款凭证，没有发起真实支付"; break;
        }
        case "ingest":
          role("regulator"); message = ingest(next); break;
        case "fixApi": {
          role("regulator"); const row = item(item(c.batches, "BATCH-CO-1").rows, id || "SRC-2");
          ensure(row.status === "校验失败", "当前记录不需要补正");
          row.correction = D.clone(row.raw); row.correction.answers = sampleDetailedAnswers().map(x => ({ ...x, result: x.id === "Q1" ? "符合" : x.result }));
          row.correction.version = Math.max(row.raw.version || 1, row.correction.version || 1) + 1; row.correction.reportSchemaVersion = 2;
          row.correction.meta = sampleReport(next, item(c.tasks, row.raw.taskId));
          row.correction.evidence = evidenceFor(item(c.tasks, row.raw.taskId), row.correction.answers, row.correction.meta);
          message = "已另存补正版本，原始缺证据报告保持不变；请重新校验接入"; break;
        }
        case "apiConflict": {
          role("regulator"); const batch = item(c.batches, "BATCH-CO-1");
          ensure(batch.rows.some(x => x.status === "已接收待审核"), "请先成功接收一次");
          ensure(!batch.rows.some(x => x.id === "SRC-CONFLICT"), "冲突示例已存在");
          const raw = D.clone(batch.rows[0].raw); raw.answers[0].note += "：不同内容";
          batch.rows.push({ id: "SRC-CONFLICT", raw, status: "待校验", error: "" });
          message = "已加入同来源键异内容示例，请重新校验接入"; break;
        }
        default: throw new Error("操作不可用");
      }
      next.meta.eventSequence++;
      const log = { id: `CO-EVT-${next.meta.eventSequence}`, actor: a.name, role: a.role, orgId: a.orgId, action, entityId: id || payload.planId || "统筹", text: message, at: next.meta.businessDate };
      c.history.push(log);
      if (t) t.history.push(D.clone(log));
      next.auditLogs.unshift({ ...log, actorId: a.id, entityType: "coordination" });
      const errors = validate(next); ensure(!errors.length, errors.join("；"));
      const navigateTo = next.meta.navigateTo;
      delete next.meta.navigateTo;
      D.save(next); Object.assign(db, next);
      return { ok: true, message, navigateTo, warning: action === "ingest" && c.batches[0]?.status === "传输失败" };
    } catch (error) { return { ok: false, message: error.message }; }
  }
  function ingest(db) {
    const c = db.co;
    if (!c.batches.length) {
      const raw = n => {
        const t = item(c.tasks, `CT-API-${n}`), meta = sampleReport(db, t), answers = sampleDetailedAnswers().map(a => ({ ...a, result: a.id === "Q1" ? "符合" : a.result }));
        return { providerId: "SP-01", sourceReportNo: `DEMO-API-${n}`, version: 1, taskId: t.id, enterpriseId: t.enterpriseId, templateId: t.templateId, reportSchemaVersion: 2, meta, answers, evidence: evidenceFor(t, answers, meta) };
      };
      const a = raw(2), b = raw(3); b.answers[0].evidence = false;
      c.batches.push({ id: "BATCH-CO-1", status: "传输失败", attempts: [{ at: db.meta.businessDate, result: "模拟超时，未接收业务报告" }], rows: [
        { id: "SRC-1", raw: a, status: "待校验", error: "" }, { id: "SRC-2", raw: b, status: "待校验", error: "" }, { id: "SRC-3", raw: D.clone(a), status: "待校验", error: "" },
      ] });
      return "模拟传输超时，未写入报告；批次已保留，可重试";
    }
    const batch = c.batches[0];
    for (const row of batch.rows) {
      if (["已接收待审核", "重复忽略", "内容冲突"].includes(row.status)) continue;
      const input = row.correction || row.raw, key = `${input.providerId}|${input.sourceReportNo}|${input.version}`;
      if (!textValid(input.providerId, 100) || !textValid(input.sourceReportNo, 200) || !Number.isSafeInteger(input.version) || input.version < 1) {
        row.status = "校验失败"; row.error = "来源机构、报告号或版本无效"; continue;
      }
      const previous = c.reports.find(r => r.key === key);
      if (previous) {
        row.status = JSON.stringify(previous.raw) === JSON.stringify(input) ? "重复忽略" : "内容冲突";
        row.error = row.status === "内容冲突" ? "相同来源键内容不同，保留原版本，需人工处理" : "相同报告重送，不增加报告或费用"; continue;
      }
      const t = c.tasks.find(x => x.id === input.taskId);
      const errors = !t ? ["任务映射失败"] : [
        ...(t.providerId !== input.providerId || t.enterpriseId !== input.enterpriseId || t.templateId !== input.templateId ? ["机构／企业／模板映射不一致"] : []),
        ...detailedErrors(db, t, input),
        ...(latest(db, t.id) && latest(db, t.id).status !== "退回补充" ? ["当前任务已有有效报告"] : []),
      ];
      if (errors.length) { row.status = "校验失败"; row.error = errors.join("；"); continue; }
      row.reportId = addReport(db, t, input.answers, "模拟API", key, input, { ...input, submittedBy: db.accounts.find(a => a.role === "service" && a.orgId === input.providerId)?.id }).id;
      row.status = "已接收待审核"; row.error = "";
    }
    batch.status = "校验完成";
    batch.attempts.push({ at: db.meta.businessDate, result: "接入校验完成；接收不等于审核或验收" });
    return "批次已校验，合格报告进入人工审核；重复未新增，问题保留";
  }
  function metrics(db, account, insurerId = "") {
    const c = db.co, plans = plansFor(db, account, insurerId), planIds = new Set(plans.map(x => x.id));
    const tasks = c.tasks.filter(t => planIds.has(t.planId) && taskVisible(db, account, t));
    const ids = new Set(tasks.map(x => x.id)), reports = c.reports.filter(r => ids.has(r.taskId) && latest(db, r.taskId).id === r.id);
    const issues = c.issues.filter(i => ids.has(i.taskId)), accepted = c.acceptances.filter(a => ids.has(a.taskId));
    const settlements = c.settlements.filter(s => accepted.some(a => a.id === s.acceptanceId));
    const ins = account.role === "insurer" ? account.orgId : insurerId;
    const budgets = c.budgets.filter(b => !ins || b.id === ins);
    const amount = s => ins ? s.allocations.filter(x => x.insurerId === ins).reduce((n, x) => n + x.cents, 0) : s.cents;
    return { plans, tasks, reports, issues, accepted, settlements,
      required: new Set(plans.map(p => p.enterpriseId)).size,
      assigned: new Set(tasks.map(t => t.enterpriseId)).size,
      completed: new Set(tasks.filter(t => latest(db, t.id)?.status === "审核通过").map(t => t.enterpriseId)).size,
      verified: new Set(accepted.map(a => item(c.tasks, a.taskId).enterpriseId)).size,
      budget: budgets.filter(b => b.status === "已确认").reduce((n, b) => n + b.budgetCents + b.adjustments.reduce((sum, x) => sum + x.deltaCents, 0), 0),
      acceptedCents: ins ? accepted.reduce((n, a) => n + (settlements.find(s => s.acceptanceId === a.id)?.allocations.filter(x => x.insurerId === ins).reduce((sum, x) => sum + x.cents, 0) || 0), 0) : accepted.reduce((n, a) => n + a.cents, 0),
      settledCents: settlements.reduce((n, s) => n + amount(s), 0),
      paidCents: c.payments.filter(p => settlements.some(s => s.id === p.settlementId)).reduce((n, p) => n + amount(item(settlements, p.settlementId)), 0),
      overdue: plans.filter(p => p.deadline < db.meta.businessDate && !accepted.some(a => item(c.tasks, a.taskId).planId === p.id)).length,
      evidenceRate: (() => { const all = reports.flatMap(r => r.answers).filter(a => a.result !== "不适用"); return all.length ? all.filter(a => a.evidence).length / all.length : null; })(),
      returnRate: (() => { const reviewedTasks = tasks.filter(t => c.reports.some(r => r.taskId === t.id && r.reviewer)); return reviewedTasks.length ? reviewedTasks.filter(t => c.reports.some(r => r.taskId === t.id && r.returned)).length / reviewedTasks.length : null; })(),
    };
  }
  function riskAnalysis(db, account) {
    if (account.role !== "regulator") return [];
    const c = db.co, plans = plansFor(db, account);
    const rank = { yellow: 1, orange: 2, red: 3 };
    return db.regions.map(region => {
      const regionPlans = plans.filter(plan => item(db.enterprises, plan.enterpriseId).regionId === region.id);
      const enterprises = [...new Set(regionPlans.map(plan => plan.enterpriseId))].map(id => item(db.enterprises, id));
      const projects = regionPlans.map(plan => {
        const task = c.tasks.find(x => x.planId === plan.id) || null;
        const reports = task ? c.reports.filter(report => report.taskId === task.id).sort((a, b) => a.version - b.version) : [];
        return { plan, enterprise: item(db.enterprises, plan.enterpriseId), task, reports, currentReport: task ? latest(db, task.id) : null };
      });
      const currentReports = projects.map(x => x.currentReport).filter(Boolean);
      const verifiedReports = currentReports.filter(report => report.status === "审核通过");
      const riskClues = verifiedReports.flatMap(report => {
        const template = report.templateSnapshot || item(c.templates, report.templateId);
        return report.answers.filter(answer => {
          const question = template.items.find(x => x.id === answer.id);
          return answer.result === (question?.riskAnswer || "不符合");
        }).map(answer => ({
          reportId: report.id, taskId: report.taskId, itemId: answer.id,
          issue: c.issues.find(x => x.reportId === report.id && x.itemId === answer.id) || null,
        }));
      });
      const judged = riskClues.filter(x => rank[x.issue?.judgement?.demoColor]);
      const unjudged = riskClues.filter(x => !x.issue?.judgement);
      const uncoloredJudgements = riskClues.filter(x => x.issue?.judgement && !rank[x.issue.judgement.demoColor]);
      const colors = judged.map(x => x.issue.judgement.demoColor).sort((a, b) => rank[b] - rank[a]);
      const unknownItems = currentReports.flatMap(report => report.answers
        .filter(answer => ["无法检查", "无法确认"].includes(answer.result))
        .map(answer => ({ reportId: report.id, itemId: answer.id })));
      const reviewedItems = verifiedReports.flatMap(report => report.answers.filter(answer => {
        if (["不适用", "无法检查", "无法确认"].includes(answer.result)) return false;
        return true;
      }));
      const approvedExceptions = verifiedReports.flatMap(report => report.answers
        .filter(answer => answer.result === "不适用")
        .map(answer => ({
          reportId: report.id,
          itemId: answer.id,
          independentlyReviewed: report.reportSchemaVersion === 3
            && report.exceptionReviews?.some(review => review.itemId === answer.id),
        })));
      const exceptionReviewPending = approvedExceptions.filter(x => !x.independentlyReviewed);
      const currentColor = colors[0] || "";
      const currentReportIds = verifiedReports.map(report => report.id).sort();
      const latestRiskReview = (c.riskReviews || []).filter(review => review.regionId === region.id).at(-1) || null;
      const riskReviewCurrent = Boolean(latestRiskReview)
        && JSON.stringify(latestRiskReview.reportIds) === JSON.stringify(currentReportIds);
      const colorLabels = { red: "红色 · 高关注", orange: "橙色 · 重点关注", yellow: "黄色 · 一般关注", blue: "蓝色 · 本次已审核样本未见模板标记风险项" };
      const assessment = riskReviewCurrent
        ? `${colorLabels[latestRiskReview.demoColor]} · Demo人工研判`
        : currentColor
          ? `${colorLabels[currentColor]} · 已判线索，非完整地区评估`
          : riskClues.length ? "待风险线索人工研判"
            : verifiedReports.length && reviewedItems.length && !unknownItems.length && !exceptionReviewPending.length && !uncoloredJudgements.length
              ? "待地区人工研判"
              : "数据不足／尚无已核验结论";
      const submittedEnterpriseIds = new Set(projects.filter(x => x.reports.length).map(x => x.enterprise.id));
      return {
        id: region.id, name: region.name, plans: regionPlans, enterprises, projects,
        requiredEnterprises: enterprises.length,
        receivedEnterprises: submittedEnterpriseIds.size,
        submittedReports: projects.reduce((n, x) => n + x.reports.length, 0),
        currentReportCount: currentReports.length,
        pendingReports: currentReports.filter(x => x.status === "待人工审核").length,
        returnedReports: currentReports.filter(x => x.status === "退回补充").length,
        verifiedReports, unsubmittedProjects: projects.filter(x => !x.reports.length).length,
        riskClues, judgedFindings: judged, unjudgedFindings: unjudged,
        uncoloredJudgements, unknownItems, reviewedItems, approvedExceptions, exceptionReviewPending,
        latestRiskReview, riskReviewCurrent, currentReportIds,
        assessment,
        assessmentBasis: riskReviewCurrent
          ? `${latestRiskReview.basis} 记录 ${latestRiskReview.id} · ${latestRiskReview.reviewer} · ${latestRiskReview.at}；依据版本 ${latestRiskReview.reportIds.join("、")}。`
          : currentColor
            ? "此颜色只概述已有风险线索的人工判定，尚未形成地区整体研判；未研判线索和数据限制另列。"
            : assessment.startsWith("待地区")
              ? "已存在可解释的已审核样本，但没有依据充分性阈值自动评蓝；由监管员记录地区Demo结论及依据。"
              : "没有足够的已审核、可解释样本或仍有未研判线索；不按低风险处理。",
      };
    });
  }
  const data = Object.freeze({ ...D, SCENARIOS: scenarios, createSeed: seed, validate, load, reset() { const db = seed(); D.save(db); return db; } });
  global.Coordination = Object.freeze({ data, seed, validate, run, metrics, riskAnalysis, plansFor, taskVisible, latest, sampleAnswers, sampleReport, sampleDetailedAnswers, sampleInspectionAnswers, evidenceFor, reportFields });
})(globalThis);
