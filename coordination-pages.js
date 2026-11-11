(function initCoordinationPages(global) {
  "use strict";
  const C = global.Coordination, e = global.AZXDemoReports.escapeHtml;
  const money = cents => `¥${(cents / 100).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const rate = x => x === null ? "不适用" : `${(x * 100).toFixed(1)}%`;
  const find = (list, id) => list.find(x => x.id === id);
  const badge = text => `<span class="co-badge${/失败|冲突|不符合|未通过/.test(text) ? " co-bad" : /已验收|已闭环|审核通过|已确认|可派单/.test(text) ? " co-good" : ""}">${e(text)}</span>`;
  const button = (text, action, id = "", secondary = false) => `<button type="button" class="btn ${secondary ? "btn-quiet" : "btn-primary"}" data-co="${e(action)}" data-id="${e(id)}">${e(text)}</button>`;
  const link = (text, href) => `<a class="btn btn-quiet" href="#${e(href)}">${e(text)} ↗</a>`;
  const panel = (title, body, sub = "") => `<section class="co-panel"><header><div><h3>${e(title)}</h3>${sub ? `<p>${e(sub)}</p>` : ""}</div></header>${body}</section>`;
  const table = (headers, rows) => `<div class="table-scroll"><table class="data-table"><thead><tr>${headers.map(x => `<th>${e(x)}</th>`).join("")}</tr></thead><tbody>${rows.length ? rows.map(row => `<tr>${row.map(x => `<td>${x}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="${headers.length}"><p class="co-muted">当前范围尚无记录。请按主故事操作。</p></td></tr>`}</tbody></table></div>`;
  const note = text => `<p class="co-note">${e(text)}</p>`;
  const entity = (db, collection, id) => find(db[collection], id)?.name || id;
  function menus(a) {
    return global.AZXPlatform.featuresFor(a, "inspection");
  }
  function riskAnalysisPage(db, a, query) {
    if (a.role !== "regulator") return panel("地区风险分析", note("仅统筹监管员可查看跨地区汇总；请使用对应账号登录。"));
    const regions = C.riskAnalysis(db, a), selected = regions.find(x => x.id === query.get("region"));
    const colorClass = assessment => assessment.startsWith("红色") ? "co-risk-red"
      : assessment.startsWith("橙色") ? "co-risk-orange"
        : assessment.startsWith("黄色") ? "co-risk-yellow"
          : assessment.startsWith("蓝色") ? "co-risk-blue" : "co-risk-unknown";
    const regionRows = regions.map(region => [
      link(`${e(region.name)} · ${e(region.id)}`, `${pathFor(a, "risk")}?region=${encodeURIComponent(region.id)}`),
      `${region.requiredEnterprises} 家计划企业`,
      `${region.receivedEnterprises} / ${region.requiredEnterprises}`,
      `${region.pendingReports} 份待审`,
      `${region.verifiedReports.length} 份已审核`,
      `<span class="co-risk-level ${colorClass(region.assessment)}">${e(region.assessment)}</span>`,
    ]);
    const header = panel("地区风险分析 · Demo示例口径",
      `${note("四色为本 Demo 的监管人员显式记录的人工研判展示，不是官方等级、风险预测或地区安全结论。风险线索须来自当前版本已审核的报告；报告提交即纳入“已接收覆盖”，但待审／退回报告不纳入已核验分析。没有已审核结论、待人工研判或数据不足时，不会自动显示蓝色。")}
      ${note("红／橙／黄／蓝及其说明由监管员填写依据后明确保存，并绑定当时的已审核报告版本；报告范围改变后记录会标为过期。蓝色只可在当前已审核报告没有模板标记风险线索、未知项、待确认例外或无法追溯的既有研判时人工选择，含义为“本次已审核样本未见模板标记风险项”，绝不等于地区低风险。没有按报告份数、覆盖率或风险占比设置阈值；是否足以作地区示例判断由监管员说明依据与限制。")}
      ${note("“不适用”仅在报告版本保留了审核记录时作为例外展示；“无法检查／无法确认”、待审、未提交和旧版无法追溯的例外均单独列出，不作为低风险证据。每个数值可下钻到计划、企业、任务及报告版本。")}
      ${table(["地区", "计划企业", "已接收企业／计划企业", "待审", "已审核", "Demo示例评估"], regionRows)}`,
      "提交覆盖、审核状态、风险线索和人工研判是不同指标；同一企业多保司／多份报告不重复计企业。");
    if (!selected) return `<div class="co-risk-analysis">${header}</div>`;
    const projectRows = selected.projects.map(project => [
      e(`${project.plan.id} · ${project.plan.site}`),
      project.task
        ? link(`${project.enterprise.name} · ${project.enterprise.id}`, `${pathFor(a, "tasks")}?task=${encodeURIComponent(project.task.id)}`)
        : e(`${project.enterprise.name} · ${project.enterprise.id}`),
      project.task ? e(project.task.id) : "尚未开始执行",
      project.currentReport ? badge(project.currentReport.status) : "尚未提交",
      `${project.reports.length} 个版本`,
    ]);
    const versionRows = selected.projects.flatMap(project => project.reports.flatMap(report => {
      const current = report.id === project.currentReport?.id;
      return [[
        e(`${report.id} · v${report.version}${current ? "（当前）" : ""}`),
        link(`${project.enterprise.name} · ${project.enterprise.id}`, `${pathFor(a, "tasks")}?task=${encodeURIComponent(project.task.id)}&report=${encodeURIComponent(report.id)}`),
        e(project.plan.id),
        badge(report.status),
        e(report.submittedAt || "旧版未采集"),
        e(`${report.answers.filter(x => ["无法检查", "无法确认"].includes(x.result)).length} 项无法确认／待补查`),
      ]];
    }));
    const clueRows = selected.riskClues.map(clue => [
      e(`${clue.reportId} · ${clue.itemId}`),
      e(clue.issue?.note || "报告标记的示例风险线索"),
      clue.issue?.judgement
        ? `<span class="co-risk-level ${clue.issue.judgement.demoColor === "red" ? "co-risk-red" : clue.issue.judgement.demoColor === "orange" ? "co-risk-orange" : "co-risk-yellow"}">${e(clue.issue.classification)}</span>`
        : badge("待监管人工研判"),
      clue.issue?.judgement ? e(`${clue.issue.judgement.actor} · ${clue.issue.judgement.at} · ${clue.issue.judgement.basis}`) : link("查看报告与研判入口", `${pathFor(a, "tasks")}?task=${encodeURIComponent(clue.taskId)}&report=${encodeURIComponent(clue.reportId)}`),
    ]);
    const blueUnavailable = selected.riskClues.length || selected.unknownItems.length || selected.exceptionReviewPending.length || selected.uncoloredJudgements.length;
    const regionReviewForm = selected.verifiedReports.length
      ? `<form data-co-region-review="${e(selected.id)}" class="co-region-review"><label>地区Demo示例颜色<select name="demoColor" required><option value="" selected disabled>请选择人工研判结果</option><option value="red">红色 · 高关注</option><option value="orange">橙色 · 重点关注</option><option value="yellow">黄色 · 一般关注</option><option value="blue"${blueUnavailable ? " disabled" : ""}>蓝色 · 本次样本未见模板标记风险项${blueUnavailable ? "（有风险线索、未知项或待确认记录，不可选）" : ""}</option></select></label><label>本次判断依据与适用范围<textarea name="basis" maxlength="1000" required placeholder="说明参考的已审核报告、检查范围及尚未覆盖的事项"></textarea></label><p>仅为本地 Demo 人工研判并记录报告版本范围；不是正式地区风险结论。不得用“没有报告”或“没有发现”替代充分性说明。</p>${button("保存地区Demo研判", "assessRegion", selected.id)}</form>`
      : note("至少有一份当前已审核报告后，才可记录地区Demo研判；待审或退回报告不能作为已核验风险依据。");
    const reviewStale = selected.latestRiskReview && !selected.riskReviewCurrent
      ? note(`上次地区研判 ${selected.latestRiskReview.id} 所依据的已审核报告版本已变化；该记录保留但不再作为当前结论。`)
      : "";
    const detail = panel(`${selected.name} · ${selected.id}`,
      `${note(selected.assessmentBasis)}<div class="co-risk-summary"><span>计划企业：<b>${selected.requiredEnterprises}</b></span><span>已接收覆盖：<b>${selected.receivedEnterprises} / ${selected.requiredEnterprises}</b></span><span>待人工审核：<b>${selected.pendingReports}</b></span><span>未提交计划：<b>${selected.unsubmittedProjects}</b></span><span>已审核报告：<b>${selected.verifiedReports.length}</b></span><span>待研判线索：<b>${selected.unjudgedFindings.length}</b></span><span>无法检查／确认：<b>${selected.unknownItems.length}</b></span><span>不适用项：<b>${selected.approvedExceptions.length}</b>（独立留痕 ${selected.approvedExceptions.filter(x => x.independentlyReviewed).length}，待确认 ${selected.exceptionReviewPending.length}）</span></div>
      ${reviewStale}${selected.riskReviewCurrent ? note(`当前人工研判：${selected.latestRiskReview.id} · ${entity(db, "accounts", selected.latestRiskReview.reviewer)} · ${selected.latestRiskReview.at}；依据版本 ${selected.latestRiskReview.reportIds.join("、")}。`) : ""}
      ${selected.uncoloredJudgements.length ? note(`${selected.uncoloredJudgements.length} 条既有人工判定没有本 Demo 颜色记录，未擅自映射；请依据原报告重新研判。`) : ""}
      ${panel("监管员人工记录地区Demo研判", regionReviewForm)}
      ${panel("计划／项目与企业", table(["计划／场所", "企业", "执行任务", "当前报告状态", "报告版本数"], projectRows))}
      ${panel("报告版本追溯", table(["报告版本", "企业／任务", "来源计划", "版本状态", "提交日期", "未知／补查项"], versionRows))}
      ${panel("已审核报告风险线索及人工研判", table(["报告／检查项", "记录摘要", "Demo示例颜色", "判定依据／下钻"], clueRows), "模板标记只用于提示待研判，不自动生成地区等级")}`,
      `当前展示 ${selected.projects.length} 项计划、${selected.submittedReports} 个提交版本；已接收覆盖不等于已审核或正式风险结论。`);
    return `<div class="co-risk-analysis">${header}${detail}</div>`;
  }
  function title(path) { return global.AZXPlatform.features.find(feature => feature.path === path)?.label || "事故预防统筹"; }
  const pathFor = (a, tab) => `/${a.role}/co-${tab}`;
  function evidence(label = "现场证据") {
    return `<details class="co-evidence"><summary>查看${e(label)}（合成）</summary><figure><svg viewBox="0 0 320 140" role="img" aria-label="合成现场示意图，非真实照片"><rect x="2" y="2" width="316" height="136" rx="12" class="co-svg-bg"/><path d="M32 110V30H288V110M120 110V50H200V110" class="co-svg-line"/><path d="M142 100V72H178V100" class="co-svg-accent"/><text x="160" y="128" text-anchor="middle" class="co-svg-text">DEMO · 合成证据，非现场认证</text></svg><figcaption>${e(label)}：仅说明证据查看及审核交互。无真实照片、定位或签章。</figcaption></figure></details>`;
  }
  function history(list) {
    return `<ol class="co-timeline">${list.length ? list.map(x => `<li><span></span><div><strong>${e(x.text || x.result)}</strong><p>${e(x.actor || "系统示例")} · ${e(x.at || "")}</p></div></li>`).join("") : "<li>暂无操作，等待对应责任主体。</li>"}</ol>`;
  }
  function cards(a, list) {
    return `<div class="co-cards">${list.map(([label, value, tab, sub]) => `<a class="co-stat" href="#${pathFor(a, tab)}"><span>${e(label)}</span><strong>${e(value)}</strong><small>${e(sub || "下钻查看责任明细")} ↗</small></a>`).join("")}</div>`;
  }
  function overview(db, a, query) {
    const insurerId = a.role === "regulator" ? query.get("insurer") || "" : "";
    const m = C.metrics(db, a, insurerId), c = db.co;
    const filters = a.role === "regulator" ? `<div class="co-filter no-print"><label>责任保司 <select data-co-filter="insurer"><option value="">全部保司（企业去重）</option>${db.insurers.map(i => `<option value="${i.id}"${insurerId === i.id ? " selected" : ""}>${e(i.shortName)}</option>`).join("")}</select></label><span>服务期：2026-09 · 广州样本 · 隐患排查</span></div>` : "";
    const finance = ["regulator", "insurer"].includes(a.role) ? cards(a, [
      ["已确认费用预算", money(m.budget), "budgets", "已含示例调整；不是银行余额"],
      [a.role === "insurer" ? "验收后已确认分摊" : "已验收服务金额", money(m.acceptedCents), "tasks", a.role === "insurer" ? "分摊确认前不归属个人保司金额" : "验收不代表付款"],
      ["已登记付款凭证", money(m.paidCents), "budgets", "合成凭证；没有真实支付"],
    ]) : "";
    const stages = [["计划企业", m.required], ["已建执行记录企业", m.assigned], ["报告审核通过企业", m.completed], ["已验收企业", m.verified]];
    const matrix = db.insurers.filter(i => a.role === "regulator" ? !insurerId || i.id === insurerId : a.role === "insurer" && i.id === a.orgId).map(i => {
      const x = C.metrics(db, a, i.id);
      return [link(i.shortName, `${pathFor(a, "overview")}?insurer=${i.id}`), `${x.required} 家`, `${x.assigned} 家`, `${x.verified} 家`, `${Math.max(0, x.required - x.assigned)} 家尚未開始`, money(x.budget)];
    });
    const taskRows = m.plans.map(p => {
      const t = m.tasks.find(x => x.planId === p.id), r = t && C.latest(db, t.id);
      const missingPath = a.role === "service" ? "plans" : "tasks";
      return [e(entity(db, "enterprises", p.enterpriseId)), e(p.site), e(p.policyIds.map(id => entity(db, "insurers", find(db.policies, id).insurerId)).join(" / ")), t ? badge(t.status) : badge("尚未开始执行"), r ? badge(r.status) : "未提交报告", link(t ? "查看责任链" : "查看计划", `${pathFor(a, t ? "tasks" : missingPath)}${t ? `?task=${t.id}` : ""}`)];
    });
    const providers = db.serviceProviders.filter(p => a.role !== "service" || p.id === a.orgId).map(p => {
      const tasks = m.tasks.filter(t => t.providerId === p.id);
      return [e(p.name), `${tasks.length} 项`, `${tasks.filter(t => t.status === "已验收").length} 项`, `${tasks.filter(t => db.co.reports.some(r => r.taskId === t.id && r.returned)).length} 项曾退回`];
    });
    return filters + finance
      + cards(a, [["应服务企业", m.required, "tasks", "来自服务计划，非已建任务"], ["已验收覆盖率", m.required ? rate(m.verified / m.required) : "不适用", "tasks", `${m.verified} / ${m.required} 家企业`], ["逾期未验收计划", m.overdue, "tasks", "按示例合同期限；非监管处罚"], ["未闭环问题", m.issues.filter(x => x.status !== "已闭环").length, "tasks", `${m.issues.filter(x => x.classification.includes("待人工")).length} 项待人工判定`]])
      + `<div class="co-grid">${panel("从计划到结果，每一步可追溯", `<div class="co-stages">${stages.map(([label, n], i) => `<a href="#${pathFor(a, "tasks")}"><span>0${i + 1}</span><strong>${n}</strong><small>${e(label)}</small></a>`).join("")}</div>${note("报告审核、隐患整改及阶段验收分别记录，不以“已交钱”代替履责。")}`)}
      ${panel("报告与计划状态", `<div class="co-actions">${link(`待人工审核报告 · ${m.reports.filter(r => r.status === "待人工审核").length}`, pathFor(a, "tasks"))}${link(`尚未开始的计划 · ${m.required - m.assigned}`, pathFor(a, a.role === "service" ? "plans" : "tasks"))}${link(`逾期计划 · ${m.overdue}`, pathFor(a, "tasks"))}</div><div class="co-quality"><span>证据完整率 <b>${rate(m.evidenceRate)}</b></span><span>曾退回任务占比 <b>${rate(m.returnRate)}</b></span></div>`)}</div>`
      + (matrix.length ? panel("保司责任关联", table(["责任保司", "计划企业", "已开始执行", "已验收", "尚未开始", "确认预算"], matrix), "同企业可关联多保司；企业数全局去重，保司行不可直接相加") : "")
      + panel("企业服务责任链", table(["企业", "场所", "关联责任保司", "服务履行", "报告", "追溯"], taskRows), "保障、服务、整改与验收是不同维度")
      + panel("第三方履约", table(["服务机构", "可见任务", "已验收", "报告补正"], providers), "不以发现隐患数量或零隐患作为机构排名");
  }
  function budgets(db, a) {
    const c = db.co, budgets = c.budgets.filter(b => a.role === "regulator" || b.id === a.orgId);
    const rows = budgets.map(b => [
      e(entity(db, "insurers", b.id)), e(`${b.period} / ${b.source}`), money(b.receivedCents + b.adjustments.reduce((n, x) => n + x.receivedDeltaCents, 0)),
      `${money(b.budgetCents)}${b.adjustments.length ? `<br><small>调整 ${money(b.adjustments[0].deltaCents)}</small>` : ""}`, badge(b.status),
      a.role === "insurer" ? b.status === "待确认" ? button("确认本保司预算", "confirmBudget", b.id) : b.adjustments.length ? "调整已追加" : button("追加退款／批改示例", "adjustBudget", b.id, true) : "由各保司确认",
    ]);
    const adjustments = budgets.flatMap(b => b.adjustments.map(x => [e(entity(db, "insurers", b.id)), e(x.id), money(x.receivedDeltaCents), money(x.deltaCents), e(x.reason), e(`${x.actor} · ${x.at}`)]));
    const packs = c.packs.map(p => `<article class="co-pack"><div class="co-pack-top">${badge(p.authorized && p.contract ? "历史合同样例 · 不用于派单" : "合同／授权待完善")}<span>${e(p.id)}</span></div><h3>${e(p.name)}</h3><p>${e(entity(db, "serviceProviders", p.providerId))}</p><dl><dt>合同</dt><dd>${e(p.contract || "未录入")}</dd><dt>示例采购主体</dt><dd>${e(p.buyer)}</dd><dt>示例付款主体</dt><dd>${e(p.payer)}</dd><dt>服务范围</dt><dd>广州样本 · 2026-09 · 隐患排查</dd><dt>约定单价／容量</dt><dd>${money(p.unitCents)} / 次；${p.capacity} 次</dd><dt>阶段验收</dt><dd>${e(p.milestone)}</dd></dl></article>`);
    return note("巡检主线由第三方机构依据已存在的合成计划开展；监管不在此编制或派发具体任务。下方合同及费用仅为既有履约样例，不代表已确认的采购、验收或付款规则。")
      + panel("保司费用台账", table(["保司", "期间／实收来源", "调整后实收", "录入预算／调整", "确认状态", "操作"], rows), "金额由合成实收记录及预算录入，不根据保单保费或全部营业额推算")
      + note("应计列／确认预算不等于实际划转。没有银行余额或监管资金池；不应用未经确认的政策比例。")
      + panel("追加调整，不改写原账", table(["保司", "调整单", "实收变化", "预算变化", "原因", "确认记录"], adjustments))
      + (a.role === "regulator" ? `<div class="co-pack-grid">${packs.join("")}</div>` : note("服务包由统筹主体依示例授权安排；本保司仍需覆核关联合同与服务成果。"));
  }
  function plans(db, a) {
    const rows = C.plansFor(db, a).map(p => {
      const task = db.co.tasks.find(x => x.planId === p.id);
      const action = task
        ? link(`继续 ${task.id}`, `${pathFor(a, "tasks")}?task=${task.id}`)
        : button("从此计划开始", "startInspection", p.id);
      return [e(p.id), e(entity(db, "enterprises", p.enterpriseId)), e(p.site), e(p.service), e(p.period), e(p.deadline), task ? badge(task.status) : badge("尚未开始"), action];
    });
    return note("这些是演示内预置的合成计划，不是监管派单或真实导入记录。计划与企业、执行机构及责任范围关联；开始后会建立唯一执行记录，重复进入将继续原任务。")
      + panel("可执行的既有巡检计划", table(["计划", "企业", "场所", "服务内容", "服务期", "示例期限", "执行状态", "操作"], rows), "当前登录机构仅能查看分配给本机构的计划");
  }
  function standards(db) {
    return db.co.templates.map(t => {
      const inspection = t.id === "TPL-INSPECT-1";
      const results = inspection ? "是 / 否 / 不适用 / 无法检查" : "符合 / 不符合 / 不适用 / 无法确认";
      const handling = inspection
        ? "“否”表示本示例清单发现不符合项；不适用须填理由并经审核确认后排除，不适用审核不等于已整改；无法检查保留为未知并需补查。"
        : "不适用必须说明理由；无法确认须补查说明。重大线索须人工判定。";
      return panel(`${t.name} · v${t.version}`, `<div class="co-meta">${badge(t.status)}<span>生效：${e(t.effective)}</span><span>适用：金属冶炼示例／主厂区</span></div>${note(t.basis)}${table(["检查项", "检查方法", "必填证据", "结果与处理"], t.items.map(q => [e(`${q.id} ${q.title}`), e(q.method), e(q.evidence), results]))}${note(`${handling}执行任务锁定模板，升版不修改旧报告。`)}`);
    }).join("");
  }
  function reportForm(db, t, draft) {
    const template = find(db.co.templates, t.templateId), previous = C.latest(db, t.id);
    const inspection = template.id === "TPL-INSPECT-1";
    const current = (Array.isArray(draft?.answers) ? draft.answers : null) || (Array.isArray(t.draft) ? t.draft : null) || (previous?.status === "退回补充" ? previous.answers : template.items.map(({ id }) => inspection
      ? { id, result: "", note: "", reason: "", photoCount: 0 }
      : { id, result: "", note: "", reason: "", evidence: false, location: "", risk: "", recommendation: "" }));
    const meta = draft?.meta && typeof draft.meta === "object" ? draft.meta : previous?.meta || {};
    const field = (key, label, limit, type = "text") => `<label>${e(label)}<input name="meta-${key}" type="${type}" maxlength="${limit}" value="${e(meta[key] || "")}"></label>`;
    return `<div class="co-phone"><header><span>现场填报预览 · 非正式小程序</span><h3>${e(entity(db, "enterprises", t.enterpriseId))}</h3><p>${e(t.id)} · 模板 v${e(template.version)} · 全部证据为合成</p></header><form id="co-report-form" data-co-form="${e(t.id)}">
      <fieldset><legend>报告基本信息</legend>${button("填入合成现场信息", "sampleReport", t.id, true)}${Object.entries(C.reportFields).map(([key, [label, limit]]) => field(key, label, limit, ["startedAt", "endedAt"].includes(key) ? "datetime-local" : "text")).join("")}${field("excludedScope", "未检查范围（无则留空）", 500)}${field("exclusionReason", "未检查范围的理由", 500)}<p>示例检查依据，正式条款待核实；不将未采集内容自动认定为已发生。</p></fieldset>
      ${template.items.map(q => {
        const x = find(current, q.id) || {};
        if (inspection) return `<fieldset><legend>${e(q.id)} · ${e(q.title)}</legend><p>${e(q.method)}</p><small>演示模板：${e(template.basis)}</small><label>检查结果<select name="${q.id}-result"><option value="">请选择</option>${["是", "否", "不适用", "无法检查"].map(v => `<option${x.result === v ? " selected" : ""}>${v}</option>`).join("")}</select></label><label>现场简述（是／否时必填）<textarea name="${q.id}-note" maxlength="500">${e(x.note || "")}</textarea></label><label>例外理由（不适用／无法检查时必填）<textarea name="${q.id}-reason" maxlength="500">${e(x.reason || "")}</textarea></label><label>现场照片（合成示意，最多3张）${q.photoRequired ? " · 是／否至少1张" : " · 选填"}<input name="${q.id}-photoCount" type="number" min="0" max="3" step="1" value="${Number.isSafeInteger(x.photoCount) ? x.photoCount : 0}"></label><p>此 Demo 不上传真实照片；数量仅生成合成证据引用。例外答案可免照片。</p></fieldset>`;
        return `<fieldset><legend>${e(q.id)} · ${e(q.title)}</legend><p>${e(q.method)}</p><small>依据：${e(template.basis)}</small><label>检查位置／对象<input name="${q.id}-location" maxlength="200" value="${e(x.location || "")}"></label><label>检查结果<select name="${q.id}-result">${["符合", "不符合", "不适用", "无法确认"].map(v => `<option${x.result === v ? " selected" : ""}>${v}</option>`).join("")}</select></label><label>现场记录／补查说明<textarea name="${q.id}-note" maxlength="500">${e(x.note || "")}</textarea></label><label>不适用理由<input name="${q.id}-reason" value="${e(x.reason || "")}" maxlength="200"></label><label>风险说明（不符合时必填）<input name="${q.id}-risk" maxlength="500" value="${e(x.risk || "")}"></label><label>整改建议（不符合时必填）<input name="${q.id}-recommendation" maxlength="500" value="${e(x.recommendation || "")}"></label><label class="co-check"><input type="checkbox" name="${q.id}-evidence"${x.evidence ? " checked" : ""}>附上内建合成${e(q.evidence)}</label>${evidence(q.evidence)}</fieldset>`;
      }).join("")}<footer>${button("预览报告", "previewReport", t.id, true)}${button("提交巡检报告", "submitReport", t.id)}<p>提交后进入待人工审核，不自动认定履约。</p></footer></form></div>`;
  }
  function reportDocument(db, t, v, includeFollowup = true) {
    const template = v.templateSnapshot || find(db.co.templates, v.templateId), pack = find(db.co.packs, t.packId);
    const m = v.meta;
    return `<article class="co-report-document"><h2>事故预防巡检报告</h2><p>标书外扩充 · 合成资料 · 非行政执法结论</p><p>${e(v.id)} · v${e(String(v.version))} · ${e(v.status)} · ${e(v.source)}</p>
      ${table(["关联项目", "记录"], [["企业／任务", e(`${entity(db, "enterprises", t.enterpriseId)} / ${t.id}`)], ["计划来源", e(`${find(db.co.plans, t.planId)?.source || "历史记录"} / ${t.planId}`)], ...(pack ? [["合同／服务包", e(`${pack.contract} / ${pack.id}`)]] : [["合同／服务包", "无合同关联的既定巡检计划"]]), ["责任保单／保司", e(t.policyIds.map(id => `${id} / ${entity(db, "insurers", find(db.policies, id).insurerId)}`).join("；"))], ["执行机构", e(entity(db, "serviceProviders", t.providerId))], ["提交／审核", e(`${v.submittedBy || "旧版未采集"} / ${v.submittedAt} / ${v.reviewer || "待审核"}`)]])}
      ${m ? table(["现场信息", "记录"], [...Object.entries(C.reportFields).map(([key, [label]]) => [e(label), e(m[key])]), ["未检查范围", e(m.excludedScope || "未列出")], ["未检查理由", e(m.exclusionReason || "未列出")]]) : note("旧版记录：未采集新版现场信息，不补造历史事实。")}
      <h3>检查依据与逐项结果</h3>${note(`${template.name} v${template.version} · ${template.basis} · 适用行业 ${template.industryId}；正式条款待核实`)}
      ${v.answers.map(x => `<section class="co-report-item"><h4>${e(x.id)} ${e(find(template.items, x.id)?.title || x.id)} · ${e(x.result)}</h4><p>检查方法：${e(find(template.items, x.id)?.method || "")}</p>${x.photoCount !== undefined ? `<p>现场记录：${e(x.note || "无")}</p>${x.reason ? `<p>例外理由：${e(x.reason)}</p>` : ""}${x.photoCount ? evidence(`${x.id} · ${x.photoCount}张合成照片示意`) : note("无照片引用；请结合检查结果及例外适用性审核")}` : `<p>位置／对象：${e(x.location || "旧版未采集")}</p><p>事实／补查说明：${e(x.note || x.reason)}</p>${x.reason ? `<p>不适用理由：${e(x.reason)}</p>` : ""}${x.risk ? `<p>风险说明：${e(x.risk)}</p><p>整改建议：${e(x.recommendation)}</p>` : ""}${x.evidence ? evidence(x.id) : note("此项无证据附件；按适用性及检查结果审核")}`}${v.evidence?.filter(ref => ref.itemId === x.id).map(ref => `<p>证据 ${e(ref.id)} · ${e(ref.type)} · ${e(ref.collector)} · ${e(ref.capturedAt)}</p>`).join("") || ""}</section>`).join("")}
      ${v.exceptionReviews?.length ? table(["不适用项审核留痕", "审核理由", "审核人", "日期"], v.exceptionReviews.map(x => [e(x.itemId), e(x.reason), e(entity(db, "accounts", x.reviewer)), e(x.at)])) : ""}
      ${v.reviewNote ? note(`审核记录：${v.reviewNote}`) : ""}${note(`企业当前签收状态：${t.receipt}；签收不等于认可全部结论。`)}
      ${includeFollowup ? `<h3>关联整改／复查附录</h3>${note(`查询时点：${db.meta.businessDate} / 事件 ${db.meta.eventSequence}。以下为后续记录，不改写所选巡检报告原文。`)}${db.co.issues.filter(i => i.reportId === v.id).map(i => `<section class="co-report-item"><h4>${e(i.id)} · ${e(i.status)}</h4><p>${e(i.note)} · ${e(i.classification)} · 示例期限 ${e(i.deadline)}</p>${followupRecords(i)}</section>`).join("") || note("此报告版本尚无关联整改问题。")}` : ""}
      <p>报告版本、整改闭环、合同验收及付款为不同状态。本报告不构成整体安全保证。</p></article>`;
  }
  function followupRecords(i) {
    return (i.submissions || []).map(s => `<div class="co-followup"><strong>${e(s.id)} · 整改提交</strong><p>责任人：${e(s.owner)} · ${e(s.date)}</p><p>${e(s.measures)}</p>${evidence(s.evidence)}${(i.reviewRecords || []).filter(r => r.submissionId === s.id).map(reviewRecord).join("")}</div>`).join("")
      + (i.reviewRecords || []).filter(r => r.legacySubmission).map(reviewRecord).join("")
      + (!i.submissions?.length ? note("旧版或尚无结构化整改提交；原处理历史见时间线。") : "") + history(i.history);
  }
  function reviewRecord(r) { return `<p><strong>${e(r.id)} · ${e(r.result)}</strong> · ${e(r.method)} · ${e(r.actor)} · ${e(r.date)}</p><p>${e(r.findings)}${r.legacySubmission ? "（关联旧版整改，未补造提交详情）" : ""}</p>`; }
  function issueForm(db, i, review) {
    return `<form data-co-followup="${e(i.id)}"><label>${review ? "复查方式" : "整改责任人"}${review ? '<select name="method"><option>材料复核</option><option>现场复查</option></select>' : '<input name="owner" maxlength="200" value="合成企业安全员">'}</label><label>${review ? "核验事实／未通过补充要求" : "整改措施"}<textarea name="${review ? "findings" : "measures"}" maxlength="1000">${review ? "合成复查示例：核对指定整改提交的范围及证据；未通过时须补充对应检查点材料。" : "合成整改示例：已清理占用物品并检查同类位置，提交整改记录。"}</textarea></label><label>日期<input type="date" name="date" value="${e(db.meta.businessDate)}"></label>${review ? button("复查退回补充", "failReview", i.id, true) + button("复查通过", "passReview", i.id) : `<label class="co-check"><input type="checkbox" name="evidence">附上内建合成整改证据</label>${button("提交示例整改材料", "rectify", i.id)}`}</form>`;
  }
  function taskDetail(db, a, t, draft, selectedReportId = "") {
    const c = db.co, p = find(c.plans, t.planId), pack = find(c.packs, t.packId), template = find(c.templates, t.templateId), r = C.latest(db, t.id);
    const reportList = c.reports.filter(x => x.taskId === t.id);
    const issues = c.issues.filter(x => x.taskId === t.id);
    const buttons = [];
    if (a.role === "service" && t.status === "待接单") buttons.push(button("接受巡检任务", "acceptTask", t.id));
    if (a.role === "regulator" && r?.status === "待人工审核") buttons.push(button("退回补充报告", "returnReport", t.id, true), button("人工审核通过", "approveReport", t.id));
    if (a.role === "insurer" && r?.status === "审核通过" && !t.insurerChecks.includes(a.orgId)) buttons.push(button("本保司覆核成果", "insurerCheck", t.id));
    if (a.role === "enterprise" && r?.status === "审核通过" && t.status !== "已验收") {
      if (t.receipt !== "已确认") buttons.push(button("确认收到／撤回异议", "confirmReceipt", t.id));
      if (t.receipt !== "有异议") buttons.push(button("提出服务异议（示例）", "dispute", t.id, true));
    }
    return panel("选中任务 · 责任与计划", `<div class="co-meta">${badge(t.status)}<span>${e(t.id)}</span><span>${e(t.source)}</span></div><h3>${e(entity(db, "enterprises", t.enterpriseId))} · ${e(p.site)}</h3><div class="co-chain"><div><small>巡检来源</small><strong>${e(p.id)} · ${e(p.source || "既有计划")}</strong><span>${e(entity(db, "serviceProviders", t.providerId))}</span></div><div><small>责任保单（共用一次服务）</small><strong>${e(t.policyIds.join(" / "))}</strong><span>${e(t.policyIds.map(id => entity(db, "insurers", find(db.policies, id).insurerId)).join(" / "))}</span></div><div><small>${pack ? "合同／锁定模板" : "锁定模板／服务期"}</small><strong>${pack ? e(pack.name) : `v${e(template.version)}`} / ${e(p.period)}</strong><span>${pack ? e(pack.contract || "合同资料待确认") : `期限 ${e(p.deadline)}`}</span></div></div><div class="co-meta"><span>企业：${e(t.receipt)}</span><span>保司覆核：${e(t.insurerChecks.map(id => entity(db, "insurers", id)).join(" / ") || "尚无")}</span></div><div class="co-actions no-print">${buttons.join("")}</div>`)
      + (a.role === "service" && ["执行中", "退回补充"].includes(t.status) ? reportForm(db, t, draft) : "")
      + panel("巡检报告与原始版本", reportList.length ? reportList.map(v => `<details class="co-report" id="co-report-${e(v.id)}" ${v.id === r.id || v.id === selectedReportId ? "open" : ""}><summary>${e(v.id)} · v${v.version} · ${e(v.status)} · ${e(v.source)}</summary><div class="no-print">${button("打印此版本／保存 PDF", "printReport", v.id, true)}</div>${reportDocument(db, t, v)}${v.raw ? `<details><summary>原始接入内容（保留来源）</summary><pre class="co-json">${e(JSON.stringify(v.raw, null, 2))}</pre></details>` : ""}</details>`).join("") : note("尚未提交报告；现场完成、报告提交及验收分别统计。"))
      + panel("隐患整改与技术复查", issues.map(i => {
        const actions = [];
        if (a.role === "regulator" && i.classification.includes("待人工")) actions.push(`<form data-co-classification="${e(i.id)}"><label>Demo示例人工研判颜色<select name="demoColor"><option value="yellow">黄色 · 一般关注</option><option value="orange">橙色 · 重点关注</option><option value="red">红色 · 高关注</option></select></label><p>仅作示例分级，须结合报告范围和事实人工判断；不是正式标准或系统自动认定。</p>${button("记录示例人工判定", "classify", i.id)}</form>`);
        if (a.role === "enterprise" && ["待整改", "复查未通过"].includes(i.status)) actions.push(issueForm(db, i, false));
        if (a.role === "service" && i.status === "待复查") actions.push(issueForm(db, i, true));
        return `<article class="co-issue"><div class="co-meta">${badge(i.status)}${badge(i.classification)}</div><h4>${e(i.itemId)} · ${e(i.note)}</h4><p>整改期限：${e(i.deadline)}</p>${i.judgement ? note(`${i.judgement.actor}：${i.judgement.basis}`) : ""}<div class="co-actions no-print">${actions.join("")}</div>${followupRecords(i)}</article>`;
      }).join("") || note("尚无已确认需整改问题。"))
      + panel("任务处理时间线", history(t.history));
  }
  function apiPanel(db, a) {
    if (a.role !== "regulator") return "";
    const b = db.co.batches[0];
    return panel("第三方报告接口接入 · 固定模拟", `<div class="co-actions no-print">${button(b ? "重试／重新校验接入" : "接收三笔接口样例（模拟超时）", "ingest")}${b ? button("加入同键异内容冲突", "apiConflict", "", true) : ""}</div>${note("不是实际API。接口与手机共用证据校验及人工审核出口；相同来源键重送不增报告、服务或费用。")}
      ${b ? `<div class="co-meta">${badge(b.status)}<span>${b.id} · ${b.attempts.length} 次尝试</span></div>${table(["来源记录", "报告号／版本", "逐笔状态", "问题／操作"], b.rows.map(x => [e(x.id), e(`${x.raw.sourceReportNo} / v${x.raw.version}${x.correction ? ` → 补正v${x.correction.version}` : ""}`), badge(x.status), `${e(x.error)}${x.status === "校验失败" ? button("追加缺证据补正版本", "fixApi", x.id, true) : ""}`]))}<details><summary>原始与补正数据</summary><pre class="co-json">${e(JSON.stringify(b.rows, null, 2))}</pre></details>${history(b.attempts)}` : ""}`);
  }
  function tasks(db, a, query, draft) {
    const rows = db.co.tasks.filter(t => C.taskVisible(db, a, t));
    const requested = query.get("task"), reportId = query.get("report");
    const selected = requested ? rows.find(t => t.id === requested) : rows.find(t => t.id === "CT-PLAN-1") || rows[0];
    const list = panel("任务清单", table(["任务", "企业", "责任范围", "状态", "报告／异常摘要", "操作"], rows.map(t => {
      const r = C.latest(db, t.id);
      return [e(t.id), e(entity(db, "enterprises", t.enterpriseId)), e(t.policyIds.join(" / ")), badge(t.status),
        r ? e(`v${r.version} · ${r.reportSchemaVersion === 3 ? "现场巡检新版" : r.reportSchemaVersion === 2 ? "结构化新版" : "旧版"} · ${r.status}；${r.answers.filter(x => ["无法确认", "无法检查"].includes(x.result)).length} 项待核／补查；企业${t.receipt}`) : "尚无报告",
        link("打开任务", `${pathFor(a, "tasks")}?task=${t.id}`)];
    })), "任务来自既有计划或历史服务安排；第三方只能处理本机构任务");
    if (requested && !selected) return list + panel("无法打开指定任务", note("任务不存在或不在本账号授权范围。未改为打开其他任务；请核对机构及编号，尚未开始时回「既有计划」。"));
    if (reportId && !db.co.reports.some(report => report.id === reportId && report.taskId === selected?.id)) return list + panel("无法打开指定报告版本", note("该报告版本不存在或不属于指定任务。未改为打开其他版本。"));
    return list + (selected ? taskDetail(db, a, selected, draft?.[selected.id], reportId || "") : note(a.role === "service" ? "当前机构暂无执行记录；如有可见计划，请到「既有计划」开始。" : "当前范围尚无任务记录。")) + apiPanel(db, a);
  }
  function outcomeData(db, a) {
    const m = C.metrics(db, a);
    return { title: "标书外统筹成果（合成）", sequence: db.meta.eventSequence, columns: [["label", "指标／口径"], ["value", "示例值"]],
      rows: [
        { label: "模式", value: "标书外统筹版 · 合成资料／非真实履约" },
        { label: "固定业务日期", value: db.meta.businessDate }, { label: "服务期", value: "2026-09" },
        { label: "计划企业（去重）", value: m.required }, { label: "已开始执行企业", value: m.assigned },
        { label: "报告审核通过企业", value: m.completed }, { label: "已验收企业", value: m.verified },
        { label: "已确认预算（元）", value: (m.budget / 100).toFixed(2) },
        { label: "已验收服务（元）", value: (m.acceptedCents / 100).toFixed(2) },
        { label: "已确认结算（元）", value: (m.settledCents / 100).toFixed(2) },
        { label: "合成付款凭证登记（元，非银行支付）", value: (m.paidCents / 100).toFixed(2) },
        { label: "未闭环问题", value: m.issues.filter(i => i.status !== "已闭环").length },
      ] };
  }
  function outcomes(db, a, snapshot) {
    const c = db.co;
    return panel("阶段验收与结算依据", table(["任务／企业", "验收前置", "金额", "操作"], c.tasks.filter(t => t.packId).map(t => {
      const accepted = c.acceptances.find(x => x.taskId === t.id), s = accepted && c.settlements.find(x => x.acceptanceId === accepted.id), paid = s && c.payments.find(x => x.settlementId === s.id);
      return [link(`${t.id} / ${entity(db, "enterprises", t.enterpriseId)}`, `${pathFor(a, "tasks")}?task=${t.id}`), e(find(c.packs, t.packId).milestone),
        money(find(c.packs, t.packId).unitCents), !accepted ? button("核对条件并验收", "acceptService", t.id) : !s ? button("确认示例结算与分摊", "settle", accepted.id) : !paid ? button("登记合成付款凭证", "payment", s.id) : badge("合成凭证已登记")];
    })), "本故事按示例合同约定复查完成后验收；不代表所有服务必须按此条件付款")
      + panel("验收／结算／付款分别追溯", table(["验收单", "服务金额", "分摊依据", "付款状态"], c.acceptances.map(ac => {
        const s = c.settlements.find(x => x.acceptanceId === ac.id), pay = s && c.payments.find(x => x.settlementId === s.id);
        return [e(`${ac.id} / ${ac.actor} / ${ac.at}`), money(ac.cents), s ? `${e(s.basis)}<br>${s.allocations.map(x => `${e(entity(db, "insurers", x.insurerId))} ${money(x.cents)}`).join(" / ")}` : "待确认分摊", pay ? `${e(pay.voucher)}<br>${e(pay.status)}` : "未登记付款"];
      })))
      + panel("可投屏／打印的成果快照", `<div class="co-actions no-print">${button("生成／更新成果快照", "snapshot")}${snapshot ? button("导出成果 CSV", "export", "", true) + button("打印／保存 PDF", "print", "", true) : ""}</div>${snapshot ? `<article class="co-print-report"><h2>事故预防服务统筹 · 示例成果</h2><p>标书外扩充／合成资料 · 业务日期 ${e(db.meta.businessDate)}</p>${snapshot.sequence !== db.meta.eventSequence ? note("业务已更新，请重新生成快照；旧快照仍保留原时点数值。") : ""}${table(["指标／口径", "示例值"], snapshot.rows.map(r => [e(r.label), e(String(r.value))]))}${note("费用投入不等于履责；付款记录仅为合成凭证。无真实银行、政府采购或官方接口。")}</article>` : note("先生成快照，再导出或打印；业务变化后提示更新。")}`)
      + panel("全流程操作记录", history(c.history));
  }
  function render(db, a, path, query, snapshot, draft) {
    const menu = menus(a), entry = menu.find(x => x.path === path);
    if (!entry) return panel("此账号未获授权访问", note("请使用综合工作台中本角色获授权的业务菜单。"));
    let content;
    if (path.endsWith("co-overview")) content = overview(db, a, query);
    else if (path.endsWith("co-risk")) content = riskAnalysisPage(db, a, query);
    else if (path.endsWith("co-budgets")) content = budgets(db, a);
    else if (path.endsWith("co-standards")) content = standards(db);
    else if (path.endsWith("co-plans")) content = plans(db, a);
    else if (path.endsWith("co-tasks")) content = tasks(db, a, query, draft);
    else content = outcomes(db, a, snapshot);
    return `<div class="co-page"><section class="co-hero"><div><span class="co-eyebrow">PREVENTION SERVICE COORDINATION</span><h2>${e(a.role === "insurer" && path.endsWith("co-overview") ? "保司履责总览" : entry.label)}</h2><p>让每笔安排、每次服务、每份证据都有责任归属。</p></div><div>${badge("企业现场巡检 · 独立业务存档")}<p>合成样本／拟采用业务<br>采购、资金与合同授权待真实业务确认</p></div></section><nav class="co-tabs no-print">${menu.map(x => `<a href="#${x.path}" class="${x.path === path ? "active" : ""}">${e(x.label)}</a>`).join("")}</nav>${content}<p class="co-footnote">本机演示 · 非真实资金／非正式小程序／非官方接口 · 不代表原招标需求或实际履约</p></div>`;
  }
  global.CoordinationPages = Object.freeze({ render, menus, title, outcomeData, reportDocument, riskAnalysisPage });
})(globalThis);
