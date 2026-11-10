(function initGuangdongPages(global) {
  "use strict";
  const R = global.AZXDemoReports;
  const e = R.escapeHtml;
  const paths = { dashboard: "/regulator/dashboard", connections: "/regulator/connections", quality: "/regulator/quality", reporting: "/regulator/reporting", inspection: "/regulator/inspection", coordination: "/regulator/coordination", enterprises: "/regulator/enterprises", monthly: "/regulator/monthly" };
  function button(text, action, id = "", disabled = false) {
    return `<button type="button" class="btn btn-primary" data-gd="${e(action)}" data-id="${e(id)}"${disabled ? " disabled" : ""}>${e(text)}</button>`;
  }
  function nav(text, path) { return `<a class="btn btn-quiet" href="#${path}">${e(text)} ↗</a>`; }
  function badge(text) { return `<span class="gd-badge${["失败", "待整改", "退回整改"].includes(text) ? " gd-bad" : ["成功", "已入列", "已结案", "已完成", "已解决"].includes(text) ? " gd-good" : ""}">${e(text)}</span>`; }
  function panel(title, body, sub = "") { return `<section class="gd-panel"><div class="gd-panel-head"><h3>${e(title)}</h3><span>${e(sub)}</span></div>${body}</section>`; }
  function table(headers, rows) { return `<div class="table-scroll"><table class="data-table"><thead><tr>${headers.map(h => `<th>${e(h)}</th>`).join("")}</tr></thead><tbody>${rows.length ? rows.map(row => `<tr>${row.map(v => `<td>${v}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="${headers.length}"><div class="empty-state">暂无记录，请按上方流程开始演示。</div></td></tr>`}</tbody></table></div>`; }
  function timeline(history) { return `<ol class="gd-timeline">${history.length ? history.map((h, i) => `<li><span>${String(i + 1).padStart(2, "0")}</span><div><strong>${e(h.text || h.result)}</strong><p>${e(h.at)}${h.receipt ? ` · ${e(h.receipt)}` : ""}${h.error ? ` · ${e(h.error)}` : ""}</p></div></li>`).join("") : "<li><span>○</span><div>尚未处理，等待责任主体发起下一步。</div></li>"}</ol>`; }
  function tiles(items) { return `<div class="gd-kpis">${items.map(([label, value, unit, path]) => `<a class="gd-kpi" href="#${path}"><span>${e(label)}</span><strong>${e(value)}<small>${e(unit || "")}</small></strong><footer>查看业务明细 <span>↗</span></footer></a>`).join("")}</div>`; }
  function flow(active) { return `<div class="gd-flow">${[["connections", "01", "来源接入"], ["quality", "02", "校验整改"], ["enterprises", "03", "合格入列"], ["reporting", "04", "全国报送"], ["monthly", "05", "运营分析"]].map(([key, n, name]) => `<a href="#${paths[key]}" class="${key === active ? "active" : ""}"><b>${n}</b><span>${name}</span><i>→</i></a>`).join("")}</div>`; }
  function hero(kicker, title, description, actions = "") { return `<section class="gd-hero"><div><span class="gd-eyebrow">${e(kicker)}</span><h2>${e(title)}</h2><p>${e(description)}</p></div><div class="gd-hero-actions">${actions}</div></section>`; }
  function cityDb(db, account) {
    if (account.level !== "city") return db;
    const copy = { ...db };
    copy.enterprises = db.enterprises.filter(x => x.regionId === account.regionId);
    const ids = new Set(copy.enterprises.map(x => x.id));
    copy.policies = db.policies.filter(x => ids.has(x.enterpriseId));
    copy.serviceTasks = db.serviceTasks.filter(x => ids.has(x.enterpriseId));
    copy.hazards = db.hazards.filter(x => ids.has(x.enterpriseId));
    copy.claims = db.claims.filter(x => ids.has(x.enterpriseId));
    copy.regions = db.regions.filter(x => x.id === account.regionId);
    return copy;
  }
  function dashboard(db, account) {
    db = cityDb(db, account);
    const m = R.gdMetrics(db), coverage = (100 * m.covered / m.enterprises).toFixed(1);
    const active = db.policies.filter(p => p.startDate <= db.meta.businessDate && p.endDate >= db.meta.businessDate && p.status !== "已退保");
    const cities = db.regions.map(r => {
      const firms = db.enterprises.filter(x => x.regionId === r.id);
      const covered = firms.filter(x => active.some(p => p.enterpriseId === x.id)).length;
      const pct = firms.length ? (100 * covered / firms.length).toFixed(0) : 0;
      return `<a class="gd-city" href="#${paths.enterprises}?region=${r.id}"><div><strong>${e(r.name)}</strong><span>${pct}%</span></div><div class="gd-meter"><i style="--progress:${pct}%"></i></div><small>${covered} / ${firms.length} 家样本在保 ↗</small></a>`;
    }).join("");
    const serviceChart = { type: "donut", data: [...new Set(db.serviceTasks.map(t => t.status))].map(label => ({ label, value: db.serviceTasks.filter(t => t.status === label).length })) };
    return hero("GUANGDONG · SAFETY LIABILITY INSURANCE", account.level === "city" ? "广州市 · 监管运行总览" : "广东安责险 · 监管运行总览", "从企业保障到事故预防，从数据可信到监管闭环。以一份业务数据，连接监管、保险、服务和企业。", nav("开始数据治理演示", paths.connections))
      + `<div class="gd-context"><span class="gd-live"></span>业务日期 ${e(db.meta.businessDate)} <span>广东样本 · 非全省实际统计</span>${nav("场景与重置", "/demo-control")}</div>`
      + tiles([["应保样本企业", m.enterprises, "家", paths.enterprises], ["样本参保覆盖率", coverage, "%", paths.enterprises], ["有效保单", m.policies, "张", paths.enterprises], ["事故预防任务", db.serviceTasks.length, "项", "/regulator/analytics?topic=prevention"]])
      + (account.level === "city" ? "" : flow("dashboard"))
      + `<div class="gd-two">${panel("城市保障覆盖", `<div class="gd-cities">${cities}</div>`, "按企业去重 · 点击下钻")}${panel("事故预防服务", R.renderChart(serviceChart), "沿用既有服务数据")}</div>`
      + (account.level === "city" ? panel("本市重点工作", nav("查看省级任务与反馈", paths.coordination)) : `<div class="gd-two">${panel("监管重点 · 下一步行动", `<div class="gd-actions">${nav("查看未保及脱保企业", paths.enterprises)}${nav("检查整改与反馈", paths.inspection)}${nav("省市重点工作督办", paths.coordination)}${nav("理赔与服务预警", "/regulator/gd-alerts")}</div><p class="gd-note">八大行业分析与四类应保底数独立管理；所有数值均为本地合成样本。</p>`)}${panel("数据运营闭环", tiles([["未解决质量问题", m.issues, "项", paths.quality], ["全国报送成功", `${m.success}/${m.jobs}`, "条", paths.reporting]]), "由业务明细实时汇总")}</div>`);
  }
  function connections(db) {
    const m = R.gdMetrics(db);
    return hero("DATA CONNECTIONS", "保司接入 · 一条数据的旅程", "从来源字段到标准化业务记录，每一步都有状态与依据。接口仅为内建模拟，不向外部传输数据。", button(db.ingestionBatches.length ? "模拟批次已载入" : "载入六笔模拟批次", "loadBatch", "", !!db.ingestionBatches.length))
      + flow("connections")
      + tiles([["来源记录", m.records, "条", paths.quality], ["合格已入列", m.passed, "条", paths.enterprises], ["待处理问题", m.issues, "项", paths.quality], ["待报送业务", db.reportJobs.filter(j => j.status === "待报送").length, "条", paths.reporting]])
      + panel("接入机构", table(["示例机构", "接入方式", "最近批次", "下一步"], db.dataConnections.map(c => [e(db.insurers.find(i => i.id === c.insurerId).name), e(c.mode), c.insurerId === "INS-01" && db.ingestionBatches.length ? "BATCH-001" : "未载入样本", c.insurerId === "INS-01" ? nav("查看质量校验", paths.quality) : "仅展示机构维度"])), "原有5家、本期不少于20家、48家候选与31家营运对象是不同口径")
      + panel("原始与标准字段", `<div class="gd-schema"><div><span class="gd-eyebrow">SOURCE</span><h3>保司核心业务样例</h3><p>来源保单号 / 企业编码 / 保险期间 / 保费</p></div><b>→</b><div><span class="gd-eyebrow">STANDARD</span><h3>省级业务记录</h3><p>保单来源键 + 企业映射 + 业务版本 + 接入批次</p></div></div><p class="gd-note">原始值保留。来源没有平台投保申请时，不伪造投保申请；重复数据不重复生成保单。</p>`);
  }
  function quality(db, account) {
    const m = R.gdMetrics(db);
    const dims = ["完整性", "有效性", "准确性", "及时性"];
    const cards = dims.map(dim => {
      const checked = db.sourceRecords.filter(r => r.status !== "待校验");
      const bad = new Set(db.qualityIssues.filter(q => q.dimension === dim && q.status !== "已解决").map(q => q.recordId));
      return [dim, checked.length ? `${Math.round(100 * (checked.length - bad.size) / checked.length)}%` : "—", "示例校验", paths.quality];
    });
    return hero("DATA QUALITY", "问题可定位，修正可验证", "六笔示例：两笔合格、三笔可修正、一笔重复。提交修正不等于通过，重新校验后才进入业务台账。", account.role === "regulator" ? button("运行校验 / 重新复验", "checkBatch", "", !m.records) : "")
      + flow("quality") + tiles(cards)
      + `<p class="gd-note">当前评估范围：保单及企业／机构关联。理赔、事故预防、企业主数据、机构主数据尚未单独评估。及时性按本批次同日接收演示；唯一性单独检查。</p>`
      + panel("来源记录与处理结果", table(["来源", "原始值 → 当前值", "状态", "问题 / 操作"], db.sourceRecords.map(r => {
        const issue = db.qualityIssues.filter(q => q.recordId === r.id && q.status !== "已解决");
        return [e(r.id), `<strong>${e(r.raw.policyNo || "缺少编号")} → ${e(r.value.policyNo || "缺少编号")}</strong><span class="table-secondary">企业 ${e(r.raw.enterpriseId)} → ${e(r.value.enterpriseId)}<br>截止日 ${e(r.raw.endDate)} → ${e(r.value.endDate)} · 修订 ${r.revision}</span>`, badge(r.status), `${issue.map(q => `<div>${e(q.reason)}</div>`).join("")}${account.role === "insurer" && r.status === "待整改" && r.id !== "SRC-6" ? button("提交示例修正", "fixRecord", r.id) : r.status === "待复验" ? "等待监管复验" : r.status === "已入列" ? e(r.appliedId) : r.id === "SRC-6" ? "主记录 SRC-1 · 保持隔离" : ""}`];
      })), `入列 ${m.passed} / ${m.records} · 未解决问题 ${m.issues}`)
      + (account.role === "insurer" && db.sourceRecords.some(r => r.status === "已入列") ? panel("业务修订示例", `<p class="gd-note">将 SRC-1 保费增加100元，提交新修订；复验后生成新版待报送，旧回执保留。</p>${button("提交新版本示例", "revisePolicy", "SRC-1", db.sourceRecords[0]?.status !== "已入列")}`) : "")
      + (account.role === "regulator" ? `<div class="gd-callout"><strong>下一步：使用「保险业务经理」账号提交示例修正</strong><span>然后回到监管端重新校验，观察合格数量与报送队列一起变化。</span>${nav("切换演示账号", "/login")}</div>` : "");
  }
  function reporting(db, selected) {
    const chosen = db.reportJobs.find(j => j.id === selected);
    const current = db.reportJobs.filter(j => j.version === (db.policies.find(p => p.id === j.policyId)?.businessVersion || 1));
    return hero("NATIONAL REPORTING", "全国报送 · 每一次尝试都有回声", "只模拟保单代表性报送。首次超时与重推成功采用固定情节；DEMO 回执不是官方协议回执。")
      + flow("reporting")
      + tiles(["待报送", "成功", "失败"].map(s => [s, current.filter(j => j.status === s).length, "个最新业务版本", paths.reporting]))
      + panel("报送台账", table(["业务版本", "传输状态", "尝试次数", "操作"], db.reportJobs.map(j => [e(`${j.policyId} · v${j.version}${current.includes(j) ? "" : "（历史版本）"}`), badge(j.status), String(j.attempts.length), `${button(j.status === "失败" ? "重推" : "模拟报送", "pushJob", j.id, j.status === "成功" || !current.includes(j))} <a class="btn btn-quiet" href="#${paths.reporting}?job=${j.id}">查看回执</a>`])), "调度示例：每日；演示仅手动触发，关闭浏览器不运行")
      + (chosen ? panel(`${chosen.id} · 传输尝试与回执`, timeline(chosen.attempts)) : panel("业务台账与传输尝试分开", `<p class="gd-note">点击「查看回执」展开明细。重推增加尝试次数，不增加业务保单；新业务版本需要重新报送。</p>`));
  }
  function inspection(db, a) {
    const t = db.inspections[0], insurer = a.role === "insurer";
    return hero("SUPERVISION", "检查有依据，整改有闭环", "模拟对示例保司 A 的事故预防服务档案检查。此处是监管检查问题，不是企业安全隐患。")
      + `<div class="gd-two">${panel(t.title, `${badge(t.status)}<p>检查对象：示例保司 A</p>${table(["检查项", "现场结果", "复核"], t.items.map(i => [e(i.name), e(i.result), i.passed ? badge("已解决") : e(i.problem || "无需整改")]))}<div class="gd-actions">${insurer ? button("提交整改材料（示例）", "feedbackInspection", "", !["待整改", "退回整改"].includes(t.status)) : button("发出检查整改要求", "inspect", "", t.status !== "待检查") + button("退回补充", "returnInspection", "", t.status !== "待复核") + button("复核通过并结案", "closeInspection", "", t.status !== "待复核")}</div>`, "内建示例材料 · 无真实文件上传")}${panel("责任与处理时间线", timeline(t.history), "监管发起 → 保司反馈 → 监管复核")}</div>`
      + `<div class="gd-callout"><strong>${insurer ? "提交后回到省级监管进行复核" : "发出要求后，由保险业务经理提交整改"}</strong>${nav("选择演示账号", "/login")}</div>`;
  }
  function coordination(db, a) {
    const t = db.assignments[0], city = a.level === "city";
    return hero("PROVINCE × CITY", "省市协同 · 工作落到具体责任人", "以「更新应保企业底数」为例，演示重点工作下发、逾期督办、地市反馈及省级确认。")
      + `<div class="gd-two">${panel(t.title, `${badge(t.status)} <span class="gd-note">${t.status !== "已完成" && t.deadline < db.meta.businessDate ? "已逾期" : "任务进度"}</span><div class="gd-task-meta"><div>接收部门<strong>广州市监管（演示）</strong></div><div>计划完成日期<strong>${e(t.deadline)}</strong></div><div>督办次数<strong>${R.gdMetrics(db).reminders} 次</strong></div></div><p>请核对本市高危企业底数，补充来源说明并反馈完成情况。</p><div class="gd-actions">${city ? button("提交地市反馈（示例）", "feedbackCity", "", !["待反馈", "退回待补充"].includes(t.status)) : button("发起一次督办", "remind", "", t.status === "已完成") + button("退回补充", "returnCity", "", t.status !== "已反馈待确认") + button("确认任务完成", "closeCity", "", t.status !== "已反馈待确认")}</div>`)}${panel("督办与反馈时间线", timeline(t.history))}</div><div class="gd-callout"><strong>${city ? "地市提交反馈后，省级监管确认完成" : "督办后切换广州市监管员提交反馈"}</strong>${nav("选择演示账号", "/login")}</div>`;
  }
  function enterprises(db, account, query) {
    db = cityDb(db, account);
    const region = query.get("region") || "";
    const industry = query.get("industry") || "";
    const firms = db.enterprises.filter(x => (!region || x.regionId === region) && (!industry || x.industryId === industry));
    const chosen = firms.find(x => x.id === query.get("firm"));
    const picture = chosen ? panel(`${chosen.name} · 关联画像`, table(["业务", "编号", "状态 / 来源"], [
      ...db.policies.filter(x => x.enterpriseId === chosen.id).map(x => ["保单", e(x.policyNo), `${e(x.status)} · ${e(x.origin === "external" ? `${x.sourceProduct} / ${x.sourceKey}` : "平台投保")}`]),
      ...db.serviceTasks.filter(x => x.enterpriseId === chosen.id).map(x => ["服务", e(x.id), `${e(x.serviceType)} · ${e(x.status)}`]),
      ...db.hazards.filter(x => x.enterpriseId === chosen.id).map(x => ["隐患", e(x.id), e(x.status)]),
      ...db.claims.filter(x => x.enterpriseId === chosen.id).map(x => ["理赔", e(x.id), e(x.status)]),
    ]), `${chosen.source} · ${chosen.sourceUpdatedAt}`) : "";
    return hero("ENTERPRISE BASE", "应保底数 · 看清保障空白", "四类高危企业底数与八大行业分析分开呈现。按企业去重，外部保单合格入列后自动反映保障状态。")
      + `<form class="gd-filter"><label>城市 <select name="region" data-gd-filter="region"><option value="">全部样本城市</option>${db.regions.map(r => `<option value="${r.id}"${region === r.id ? " selected" : ""}>${e(r.name)}</option>`).join("")}</select></label><label>行业 <select name="industry" data-gd-filter="industry"><option value="">全部行业</option>${db.industries.map(r => `<option value="${r.id}"${industry === r.id ? " selected" : ""}>${e(r.name)}</option>`).join("")}</select></label><span>当前 ${firms.length} 家样本企业</span></form>`
      + picture + panel("企业保障与来源台账", table(["企业", "地区 / 行业", "底数 / 来源", "保障", "业务详情"], firms.map(x => {
        const policies = db.policies.filter(p => p.enterpriseId === x.id);
        const active = policies.filter(p => p.startDate <= db.meta.businessDate && p.endDate >= db.meta.businessDate && p.status !== "已退保");
        const status = active.length ? "在保" : policies.some(p => p.startDate <= db.meta.businessDate && p.endDate < db.meta.businessDate) ? "脱保" : "未保";
        return [e(x.name), `${e(db.regions.find(r => r.id === x.regionId)?.name)}<br>${e(db.industries.find(i => i.id === x.industryId)?.name)}`, `${e(x.baseCategory)}<span class="table-secondary">${e(x.source)} · ${e(x.sourceUpdatedAt)}</span>`, badge(status), nav("画像与关联明细", `${paths.enterprises}?firm=${x.id}`) + (x.id === "ENT-001" && !active.length ? nav("以企业账号投保", "/login") : "")];
      })), "没有载入样本的城市不代表零企业");
  }
  function monthly(db, snapshot) {
    const m = R.gdMetrics(db), current = db.meta.eventSequence;
    const has = snapshot && snapshot.sequence === current;
    return hero("OPERATIONS REVIEW", "让每一次处理，都成为可汇报的成果", "本月截至业务日期的示例运营报告。存量与处理事件分开，所有数字来自当前业务数据。", button("生成 / 更新月报", "monthly"))
      + (snapshot && !has ? `<div class="gd-callout">业务已变化，请重新生成月报。下方显示上一次快照。</div>` : "")
      + (snapshot ? `<article class="gd-monthly"><header><span class="gd-eyebrow">广东省安责险 · 示例运营月报</span><h2>${e(snapshot.date.slice(0, 7))} 运行与服务分析</h2><p>截至 ${e(snapshot.date)} · ${e(snapshot.generatedAt)} 生成 · 合成样本，非实际运行成果</p></header>${tiles([["期末有效保单", snapshot.metrics.policies, "张", paths.enterprises], ["本场景入列", snapshot.metrics.passed, "条", paths.quality], ["已成功报送版本", snapshot.metrics.success, "条", paths.reporting], ["本场景处理事件", snapshot.sequence, "次", paths.dashboard]])}<div class="gd-two">${panel("01 · 数据接入与质量", `<p>本场景载入 ${snapshot.metrics.records} 条来源数据，合格入列 ${snapshot.metrics.passed} 条；尚有 ${snapshot.metrics.issues} 项问题待处理。</p><p>建议：优先核实企业映射及保险期间，重复来源保持隔离。</p>`)}${panel("02 · 监管协同", `<p>检查状态：${e(snapshot.inspection)}；省市任务：${e(snapshot.coordination)}；累计发起 ${snapshot.metrics.reminders} 次督办。</p><p>建议：跟踪整改材料补充与地市反馈，完成复核后再计入闭环。</p>`)}</div>${panel("03 · 事故预防与保障", `<p>应保样本 ${snapshot.metrics.enterprises} 家，在保 ${snapshot.metrics.covered} 家。服务任务 ${snapshot.services} 项，已归档 ${snapshot.archived} 项。</p><p>建议：结合未保企业、临近到期未服务和超期理赔清单，安排下一步核查。</p>`)}<footer>报送与处理为模拟；该报告不是正式履约、全年运营或政府统计成果。</footer></article><div class="gd-actions no-print"><button class="btn btn-primary" data-action="printBrief">打印 / 保存 PDF</button>${button("导出月报 CSV", "exportMonthly")}</div>` : panel("报告尚未生成", `<p class="gd-note">先完成数据修正、报送或监管任务，再点击「生成月报」，将操作结果整理成适合汇报的成果。</p>`))
      + `<p class="gd-note">当前业务事件序号 ${current} · 当前有效保单 ${m.policies} 张。刷新后可重新生成报告。</p>`;
  }
  function alerts(db) {
    return hero("EARLY WARNING", "把规则变成可行动的清单", "演示起算：理赔自报案日起超过20天；有效保单距到期0–90天且无已执行服务。60内／保额预警原文歧义保持停用。")
      + panel("理赔与服务预警", table(["记录", "预警", "天数", "企业"], R.gdAlerts(db).map(x => [e(x.id), e(x.type), e(x.days), e(db.enterprises.find(y => y.id === x.entity)?.name)])), "示例口径，非正式法规判定");
  }
  function render(db, account, path, query, snapshot) {
    if (account.level === "city" && ![paths.dashboard, paths.enterprises, paths.coordination].includes(path)) return panel("市级监管范围", `<p>当前账号只展示本市总览、企业底数与重点工作反馈。</p>${nav("返回本市总览", paths.dashboard)}`);
    if (path === paths.dashboard) return dashboard(db, account);
    if (path === paths.connections) return connections(db);
    if (path === paths.quality || path === "/insurer/quality") return quality(db, account);
    if (path === paths.reporting) return reporting(db, query.get("job"));
    if (path === paths.inspection || path === "/insurer/inspection") return inspection(db, account);
    if (path === paths.coordination) return coordination(db, account);
    if (path === paths.enterprises) return enterprises(db, account, query);
    if (path === paths.monthly) return monthly(db, snapshot);
    if (path === "/regulator/gd-alerts") return alerts(db);
    return null;
  }
  global.GuangdongPages = Object.freeze({ render });
})(globalThis);
