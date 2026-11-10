(function initGuangdong(global) {
  "use strict";
  const D = global.AZXDemoData;
  const R = global.AZXDemoReports;
  const W = global.AZXDemoWorkflows;
  const scenarios = [
    ["gd-baseline", "广东全景演示", "接入、质量、报送、协同与四方业务的完整故事。"],
    ["gd-data-quality", "保司数据治理", "六笔来源数据，四类问题，修正后重新校验。"],
    ["gd-national-retry", "全国报送重推", "一笔成功、一笔失败、一笔待报送。"],
    ["gd-inspection", "监管检查整改", "检查发现问题，保司反馈，监管复核。"],
    ["gd-coordination", "省市重点工作", "逾期任务、多次督办、地市反馈。"],
    ["gd-alerts", "预警边界演示", "理赔20/21天，到期90/91天及已服务对照。"],
    ...D.SCENARIOS.map(x => [x.id, x.name, x.description]),
  ].map(([id, name, description]) => ({ id, name, description }));
  const names = ["广州市", "深圳市", "佛山市", "东莞市", "珠海市", "惠州市", "江门市", "清远市", "韶关市"];
  const extra = ["dataConnections", "ingestionBatches", "sourceRecords", "qualityIssues", "reportJobs", "inspections", "assignments"];
  function seed(id = "gd-baseline") {
    const db = D.createSeed(id.startsWith("gd-") ? "baseline" : id);
    db.meta.profile = "guangdong";
    db.meta.scenarioId = id;
    db.meta.scenarioName = scenarios.find(x => x.id === id)?.name || "广东全景演示";
    db.meta.eventSequence = 0;
    db.regions.forEach((x, i) => { x.name = names[i]; });
    db.insurers.forEach((x, i) => { x.name = `示例保险机构 ${String.fromCharCode(65 + i)}`; x.shortName = `示例保司 ${String.fromCharCode(65 + i)}`; });
    db.enterprises.forEach((x, i) => {
      x.name = `示例·${x.name}`;
      x.isRequired = true;
      x.baseCategory = ({ I01: "非煤矿山", I02: "危险化学品", I03: "烟花爆竹", I07: "金属冶炼" })[x.industryId] || "其他重点行业";
      x.source = "示例行业底数";
      x.sourceUpdatedAt = db.meta.businessDate;
    });
    db.accounts[0].organization = "广东省级监管（演示）";
    db.accounts[0].name = "省级监管员";
    db.accounts[0].level = "province";
    db.accounts[1].organization = db.insurers[0].name;
    db.accounts[3].organization = db.enterprises[0].name;
    db.accounts.push({ id: "ACC-CITY-01", role: "regulator", username: "city", password: "demo123", name: "广州市监管员", organization: "广州市级监管（演示）", orgId: "CITY-01", level: "city", regionId: "R01" });
    extra.forEach(k => { db[k] = []; });
    db.dataConnections = db.insurers.map(x => ({ id: `CON-${x.id}`, insurerId: x.id, mode: "内建批次 · 模拟接入" }));
    db.inspections.push({ id: "CHK-001", insurerId: "INS-01", title: "事故预防服务档案专项检查", status: "待检查", items: [
      { name: "服务计划与保单关联", result: "通过" },
      { name: "服务归档证明完整", result: "不通过", problem: "缺少企业回访确认材料", passed: false },
    ], history: [] });
    db.assignments.push({ id: "TASK-001", regionId: "R01", title: "更新高危行业应保企业底数", deadline: D.addDays(db.meta.businessDate, -3), status: "待反馈", history: [] });
    if (id.startsWith("gd-") && id !== "gd-alerts") {
      const p = db.policies[db.policies.length - 1];
      p.startDate = D.addDays(db.meta.businessDate, -365);
      p.endDate = D.addDays(db.meta.businessDate, -1);
      p.status = "已到期";
    }
    if (id === "gd-national-retry") {
      loadBatch(db);
      checkBatch(db);
      db.reportJobs[0].status = "成功";
      db.reportJobs[0].attempts.push({ at: db.meta.businessDate, result: "成功", receipt: "DEMO-ACK-001" });
      db.reportJobs[1].status = "失败";
      db.reportJobs[1].attempts.push({ at: db.meta.businessDate, result: "失败", error: "模拟传输超时" });
      const p = db.policies[0];
      db.reportJobs.push(jobFor(p, 3));
    }
    if (id === "gd-alerts") {
      db.claims.slice(0, 2).forEach((c, i) => { c.reportedAt = D.addDays(db.meta.businessDate, -20 - i); c.status = "查勘中"; c.demoBoundary = true; });
      db.policies.slice(0, 3).forEach((p, i) => {
        p.endDate = D.addDays(db.meta.businessDate, i === 1 ? 91 : 90);
        p.startDate = D.addDays(db.meta.businessDate, -100);
        p.status = "生效中";
        p.demoBoundary = true;
        db.serviceTasks.filter(t => t.policyId === p.id).forEach(t => { t.completedAt = i === 2 ? db.meta.businessDate : null; });
        db.serviceRecords = db.serviceRecords.filter(s => !db.serviceTasks.some(t => t.policyId === p.id && t.id === s.taskId));
        if (i === 2) db.serviceRecords.push({ id: "SR-BOUNDARY", taskId: db.serviceTasks.find(t => t.policyId === p.id)?.id, executedAt: db.meta.businessDate });
      });
    }
    return db;
  }
  function jobFor(p, i) {
    return { id: `JOB-${i}`, policyId: p.id, version: p.businessVersion || 1, payload: D.clone(p), status: "待报送", attempts: [] };
  }
  function loadBatch(db) {
    if (db.ingestionBatches.length) throw new Error("此批次已载入，请在现有批次中继续处理。");
    db.ingestionBatches.push({ id: "BATCH-001", insurerId: "INS-01", receivedAt: db.meta.businessDate });
    for (let i = 0; i < 6; i++) {
      const raw = { policyNo: `DEMO-EXT-${i === 5 ? 1 : i + 1}`, enterpriseId: `ENT-${String(i + 2).padStart(3, "0")}`, startDate: db.meta.businessDate, endDate: D.addDays(db.meta.businessDate, 364), premium: 30000, sumInsured: 10000000 };
      if (i === 2) raw.policyNo = "";
      if (i === 3) raw.endDate = D.addDays(db.meta.businessDate, -1);
      if (i === 4) raw.enterpriseId = "未匹配企业";
      if (i === 5) Object.assign(raw, db.sourceRecords[0].raw);
      db.sourceRecords.push({ id: `SRC-${i + 1}`, batchId: "BATCH-001", insurerId: "INS-01", sourceKey: i === 5 ? "EXT-1" : `EXT-${i + 1}`, sourceVersion: 1, revision: 1, raw: D.clone(raw), value: D.clone(raw), status: "待校验", revisions: [], appliedId: null });
    }
  }
  function rules(db, record) {
    const v = record.value;
    const issues = [];
    const add = (code, dimension, field, reason) => issues.push({ code, dimension, field, reason });
    if (!v.policyNo) add("Q01", "完整性", "policyNo", "缺少来源保单编号");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v.startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(v.endDate) || !Number.isFinite(Date.parse(v.startDate)) || !Number.isFinite(Date.parse(v.endDate)) || v.startDate > v.endDate || v.premium < 0) add("Q02", "有效性", "endDate", "保险期间或金额无效");
    if (!db.enterprises.some(e => e.id === v.enterpriseId)) add("Q03", "准确性", "enterpriseId", "未找到企业映射");
    if (db.sourceRecords.find(r => r.sourceKey === record.sourceKey)?.id !== record.id) add("Q05", "唯一性", "sourceKey", "与主记录重复，不重复入列");
    return issues;
  }
  function checkBatch(db) {
    if (!db.sourceRecords.length) throw new Error("请先载入模拟批次。");
    db.sourceRecords.forEach(r => {
      if (r.status === "已入列") return;
      const issues = rules(db, r);
      db.qualityIssues.filter(q => q.recordId === r.id && q.status !== "已解决").forEach(q => { q.status = issues.some(i => i.code === q.code) ? "待整改" : "已解决"; });
      issues.forEach(i => {
        if (!db.qualityIssues.some(q => q.recordId === r.id && q.code === i.code && q.status !== "已解决")) db.qualityIssues.push({ id: `QI-${r.id}-${i.code}-${r.revision}`, recordId: r.id, ...i, status: "待整改" });
      });
      if (issues.length) { r.status = "待整改"; return; }
      const policy = { id: r.appliedId || `POL-EXT-${r.id}`, ...D.clone(r.value), origin: "external", insurerId: r.insurerId, applicationId: null, productId: null, sourceProduct: "外部来源示例保障", sourceKey: r.sourceKey, businessVersion: r.revision, insuredCount: 20, status: "生效中" };
      const at = db.policies.findIndex(p => p.id === policy.id);
      if (at < 0) db.policies.push(policy); else db.policies[at] = policy;
      r.appliedId = policy.id;
      r.status = "已入列";
      if (!db.reportJobs.some(j => j.policyId === policy.id && j.version === policy.businessVersion)) db.reportJobs.push(jobFor(policy, db.reportJobs.length + 1));
    });
  }
  function validate(db) {
    const errors = D.validate(db);
    extra.forEach(k => {
      if (!Array.isArray(db[k])) errors.push(`缺少广东演示集合 ${k}`);
      else if (new Set(db[k].map(x => x.id)).size !== db[k].length) errors.push(`${k} 有重复ID`);
    });
    return errors;
  }
  function load() {
    let raw;
    try { raw = global.localStorage.getItem(D.STORAGE_KEY); }
    catch (e) { return { db: seed(), blocked: true, warning: `本地储存不可读：${e.message}。已停止写入，原存档未覆盖。` }; }
    if (!raw) return { db: seed(), warning: null };
    try {
      const db = JSON.parse(raw);
      if (db.meta?.profile !== "guangdong") throw new Error("不是广东版资料");
      const errors = validate(db);
      if (errors.length) throw new Error(errors.join("；"));
      return { db, warning: null };
    } catch (e) {
      return { db: seed(), warning: `无法载入已存资料：${e.message}。已显示临时基准；请在演示设置确认重置。`, blocked: true };
    }
  }
  const actions = {
    loadBatch(db) { loadBatch(db); return "六笔模拟来源已载入，尚未校验"; },
    checkBatch(db) { checkBatch(db); return "校验完成，合格记录已入列，问题记录已隔离"; },
    fixRecord(db, id) {
      const r = db.sourceRecords.find(x => x.id === id);
      if (!r || r.status !== "待整改" || r.id === "SRC-6") throw new Error("此记录不可修正；重复来源应保持隔离。");
      r.revisions.push({ revision: r.revision, value: D.clone(r.value) });
      if (id === "SRC-3") r.value.policyNo = "DEMO-EXT-3";
      if (id === "SRC-4") r.value.endDate = D.addDays(db.meta.businessDate, 364);
      if (id === "SRC-5") r.value.enterpriseId = "ENT-006";
      r.revision++;
      r.status = "待复验";
      return "已提交示例修正，等待监管重新校验";
    },
    revisePolicy(db, id) {
      const r = db.sourceRecords.find(x => x.id === id && x.status === "已入列");
      const p = r && db.policies.find(x => x.id === r.appliedId);
      if (!p) throw new Error("请先完成校验入列");
      r.revisions.push({ revision: r.revision, value: D.clone(r.value) });
      r.revision++;
      r.value.premium += 100;
      r.status = "待复验";
      return "已提交保费增加100元的新修订示例；复验后生成新业务版本，旧报送回执不覆盖新版";
    },
    pushJob(db, id) {
      const j = db.reportJobs.find(x => x.id === id);
      if (!j || j.status === "成功") throw new Error("此版本已成功或记录不存在，无需重复报送。");
      if (j.version !== (db.policies.find(p => p.id === j.policyId)?.businessVersion || 1)) throw new Error("此版本已被新修订取代，请报送最新版本。");
      const fail = j.id === "JOB-2" && j.attempts.length === 0;
      j.status = fail ? "失败" : "成功";
      j.attempts.push({ at: db.meta.businessDate, result: j.status, ...(fail ? { error: "DEMO-TIMEOUT：模拟传输超时，请重推" } : { receipt: `DEMO-ACK-${j.id}-${j.attempts.length + 1}` }) });
      return fail ? "模拟报送超时，已保留失败记录，可点击重推" : "报送成功，模拟回执已归档";
    },
    inspect(db) {
      const t = db.inspections[0];
      if (t.status !== "待检查") throw new Error("检查已经发出");
      t.status = "待整改"; t.history.push({ text: "省级监管检查发现回访材料缺失，要求整改", at: db.meta.businessDate }); return "检查结果已发送给示例保司 A";
    },
    feedbackInspection(db) {
      const t = db.inspections[0];
      if (!["待整改", "退回整改"].includes(t.status)) throw new Error("当前不在整改阶段");
      t.status = "待复核"; t.history.push({ text: "保司提交回访确认材料（内建示例）", at: db.meta.businessDate }); return "整改材料已提交，等待监管复核";
    },
    returnInspection(db) {
      const t = db.inspections[0];
      if (t.status !== "待复核") throw new Error("请等待保司反馈");
      t.status = "退回整改"; t.history.push({ text: "监管退回：请补充企业确认日期", at: db.meta.businessDate }); return "已退回补充";
    },
    closeInspection(db) {
      const t = db.inspections[0];
      if (t.status !== "待复核") throw new Error("请等待保司反馈");
      t.status = "已结案"; t.items.forEach(i => { i.passed = true; }); t.history.push({ text: "监管复核通过，检查结案", at: db.meta.businessDate }); return "复核通过，检查已结案";
    },
    remind(db) {
      const t = db.assignments[0];
      if (t.status === "已完成") throw new Error("任务已完成");
      t.history.push({ kind: "reminder", text: "省级督办：请更新底数并反馈完成情况", at: db.meta.businessDate }); return "督办已送达广州市监管";
    },
    feedbackCity(db) {
      const t = db.assignments[0];
      if (!["待反馈", "退回待补充"].includes(t.status)) throw new Error("已提交反馈，无需重复提交");
      t.status = "已反馈待确认"; t.history.push({ text: "广州市反馈：已核对样本企业并提交底数更新说明", at: db.meta.businessDate }); return "已提交地市反馈";
    },
    closeCity(db) {
      const t = db.assignments[0];
      if (t.status !== "已反馈待确认") throw new Error("请等待地市反馈");
      t.status = "已完成"; t.history.push({ text: "省级确认完成，重点工作闭环", at: db.meta.businessDate }); return "任务已确认完成";
    },
    returnCity(db) {
      const t = db.assignments[0];
      if (t.status !== "已反馈待确认") throw new Error("请等待地市反馈");
      t.status = "退回待补充"; t.history.push({ text: "省级退回：请补充底数来源说明", at: db.meta.businessDate }); return "已退回地市补充";
    },
  };
  function run(db, accountId, action, id) {
    const a = db.accounts.find(x => x.id === accountId);
    const insurerActions = ["fixRecord", "revisePolicy", "feedbackInspection"];
    const cityActions = ["feedbackCity"];
    if (!a || !actions[action]) return { ok: false, message: "操作不可用" };
    if (insurerActions.includes(action) ? a.role !== "insurer" || a.orgId !== "INS-01" : cityActions.includes(action) ? a.level !== "city" : a.role !== "regulator" || a.level === "city") return { ok: false, message: "请使用对应责任主体的演示账号" };
    try {
      const next = D.clone(db);
      const message = actions[action](next, id);
      next.meta.eventSequence++;
      next.auditLogs.unshift({ id: `GD-AUD-${next.meta.eventSequence}`, at: next.meta.businessDate, actorId: a.id, role: a.role, action: message, entityType: action, entityId: id || "广东演示", detail: message });
      const target = insurerActions.includes(action) || cityActions.includes(action) ? db.accounts[0] : ["inspect", "returnInspection"].includes(action) ? db.accounts[1] : ["remind", "returnCity"].includes(action) ? db.accounts.find(x => x.level === "city") : null;
      if (target) next.notifications.unshift({ id: `GD-NTF-${next.meta.eventSequence}`, role: target.role, orgId: target.orgId, title: message, detail: "请进入对应业务页面处理。", createdAt: next.meta.businessDate, read: false });
      const errors = validate(next);
      if (errors.length) throw new Error(errors.join("；"));
      D.save(next);
      Object.assign(db, next);
      return { ok: true, message };
    } catch (e) { return { ok: false, message: e.message }; }
  }
  function metrics(db) {
    const active = db.policies.filter(p => p.startDate <= db.meta.businessDate && p.endDate >= db.meta.businessDate && p.status !== "已退保");
    const covered = new Set(active.map(p => p.enterpriseId));
    const currentJobs = db.reportJobs.filter(j => j.version === (db.policies.find(p => p.id === j.policyId)?.businessVersion || 1));
    return { enterprises: db.enterprises.length, covered: covered.size, policies: active.length, records: db.sourceRecords.length, passed: db.sourceRecords.filter(r => r.status === "已入列").length, issues: db.qualityIssues.filter(q => q.status !== "已解决").length, success: currentJobs.filter(j => j.status === "成功").length, jobs: currentJobs.length, reminders: db.assignments[0].history.filter(h => h.kind === "reminder").length };
  }
  function alertRows(db) {
    const rows = db.claims.filter(c => c.status !== "已结案" && D.daysBetween(c.reportedAt, db.meta.businessDate) > 20).map(c => ({ id: c.id, type: "理赔超过20天未结案", days: D.daysBetween(c.reportedAt, db.meta.businessDate), entity: c.enterpriseId }));
    db.policies.filter(p => p.status !== "已退保" && p.startDate <= db.meta.businessDate && D.daysBetween(db.meta.businessDate, p.endDate) >= 0 && D.daysBetween(db.meta.businessDate, p.endDate) <= 90 && !db.serviceTasks.some(t => t.policyId === p.id && (t.completedAt || db.serviceRecords.some(s => s.taskId === t.id)))).forEach(p => rows.push({ id: p.id, type: "90天内到期尚未服务", days: D.daysBetween(db.meta.businessDate, p.endDate), entity: p.enterpriseId }));
    return rows;
  }
  global.AZXDemoData = Object.freeze({ ...D, SCENARIOS: scenarios, createSeed: seed, validate, load, reset(id) { const db = seed(id); D.save(db); return db; } });
  global.AZXDemoReports = Object.freeze({ ...R, gdMetrics: metrics, gdAlerts: alertRows });
  global.AZXDemoWorkflows = Object.freeze({ ...W, gdRun: run });
})(globalThis);
