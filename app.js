(function initApplication(global) {
  "use strict";

  const Platform = global.AZXPlatform;
  let Data = Platform.data.insurance;
  const Reports = global.AZXDemoReports;
  const Workflows = global.AZXDemoWorkflows;
  let coMode = false;
  let business = "insurance";
  const contexts = Object.fromEntries(Object.entries(Platform.data).map(([key, module]) => [key, { ...module.load(), data: module }]));
  const loadResult = contexts.insurance;
  const session = Platform.readSession();
  const CO_DRAFT_STORAGE_KEY = "anezx-coordination-field-drafts-v1";
  const compactLayout = global.matchMedia("(max-width: 1179px)");
  let utilityReturn = null;
  let lastBusinessFocus = null;
  let dialogReturnFocus = null;

  function readCoDraftStore() {
    try {
      const raw = global.localStorage.getItem(CO_DRAFT_STORAGE_KEY);
      if (!raw) return { store: { version: 1, accounts: {} }, warning: null };
      const store = JSON.parse(raw);
      if (store?.version !== 1 || !store.accounts || typeof store.accounts !== "object" || Array.isArray(store.accounts)) {
        throw new Error("草稿存储格式不兼容");
      }
      return { store, warning: null };
    } catch (error) {
      console.warn("无法读取统筹巡检草稿。", error);
      return { store: { version: 1, accounts: {} }, warning: `统筹巡检草稿无法读取：${error.message}。原草稿未覆盖。` };
    }
  }

  const coDraftRead = readCoDraftStore();

  const state = {
    db: loadResult.db,
    warning: loadResult.warning,
    identity: session.identity,
    accountId: null,
    pendingLoginPath: null,
    selectedAccountId: null,
    filters: {
      period: "year",
      regionId: "",
      industryId: "",
      insurerId: "",
      providerId: "",
    },
    userMenuOpen: false,
    presentation: false,
    guideOpen: false,
    guideTargetSelector: null,
    pendingGuideJump: null,
    marketFilters: {
      insurerId: "",
      serviceLevel: "",
    },
    currentDetail: null,
    pendingScenario: null,
    monthlySnapshot: null,
    storageBlocked: loadResult.blocked || false,
    coSnapshot: null,
    coDrafts: {},
    coDraftAccount: null,
    coDirty: false,
    formDirty: false,
    renderedRoute: null,
    renderedHash: null,
    coDraftWarning: coDraftRead.warning,
    coDraftStorageErrorShown: false,
  };

  const ROLE_LABELS = {
    regulator: "监管单位",
    insurer: "保险公司",
    service: "技术服务机构",
    enterprise: "生产经营单位",
  };

  const ROLE_HOME = {
    regulator: "/regulator/home",
    insurer: "/insurer/home",
    service: "/service/home",
    enterprise: "/enterprise/home",
  };

  const PAGE_DESCRIPTIONS = {
    "/regulator/enterprises": ["应保企业底数", "广东高危行业样本企业"],
    "/regulator/connections": ["保司数据接入", "来源与批次"],
    "/regulator/quality": ["数据质量治理", "校验、整改与复验"],
    "/regulator/reporting": ["全国报送台账", "模拟报送与回执"],
    "/regulator/inspection": ["保司资料检查", "监管与保司闭环"],
    "/regulator/coordination": ["省市工作协同", "下发、督办与反馈"],
    "/regulator/gd-alerts": ["理赔与服务预警", "可解释的演示规则"],
    "/regulator/monthly": ["运营月报", "从操作到汇报成果"],
    "/insurer/quality": ["数据质量整改", "修正后等待监管复验"],
    "/insurer/inspection": ["保司资料检查反馈", "提交示例整改材料"],
    "/regulator/dashboard": ["监管驾驶舱", "全域安责险运行态势与重点风险"],
    "/regulator/analytics": ["统计分析", "按专题、地区、行业和机构下钻分析"],
    "/regulator/alerts": ["待办与预警", "低覆盖、重大隐患、服务时限和理赔进度"],
    "/regulator/assessments": ["机构考核", "保险机构与技术服务机构综合表现"],
    "/regulator/brief": ["监管运行简报", "面向汇报、投屏和打印的自动汇总"],
    "/insurer/dashboard": ["保险工作台", "投保、承保、事故预防和理赔业务概览"],
    "/insurer/applications": ["投保核保", "处理本机构投保申请和核保决定"],
    "/insurer/policies": ["保单与事故预防服务", "管理有效保单和服务委托"],
    "/insurer/claims": ["报案理赔", "受理报案并维护理赔进度"],
    "/service/dashboard": ["技术服务工作台", "任务执行、隐患闭环和时限概览"],
    "/service/tasks": ["服务任务", "接单、派单、现场执行和隐患登记"],
    "/service/hazards": ["隐患与复查", "跟踪企业整改并执行复查销号"],
    "/service/archive": ["回访与归档", "完成回访并形成服务档案"],
    "/enterprise/dashboard": ["企业首页", "查看保障、服务、整改和理赔事项"],
    "/enterprise/market": ["保险产品市场", "比较保险机构和产品并提交投保"],
    "/enterprise/policies": ["保单与服务", "查看投保申请、保单和事故预防计划"],
    "/enterprise/hazards": ["隐患整改", "查看整改要求并提交整改证据"],
    "/enterprise/claims": ["报案理赔", "使用有效保单报案并跟踪进度"],
    "/demo-control": ["演示设置", "恢复固定场景和查看演示环境状态"],
  };
  const PAGE_TITLES = Object.fromEntries(Platform.features.map(feature => [
    feature.path, [feature.label, PAGE_DESCRIPTIONS[feature.path]?.[1] || "企业现场巡检 · 独立合成样本"],
  ]));
  PAGE_TITLES["/demo-control"] = PAGE_DESCRIPTIONS["/demo-control"];

  function saveSessionAccount(accountId) {
    Platform.saveSession(Platform.identityFor(accountId));
  }

  function activateContext(path, query) {
    contexts[business].db = state.db;
    contexts[business].blocked = state.storageBlocked;
    business = Platform.businessFor(path, query);
    coMode = business === "inspection";
    const context = contexts[business];
    Data = context.data;
    state.db = context.db;
    state.storageBlocked = Boolean(context.blocked);
    state.warning = context.warning;
    state.accountId = Platform.actorFor(state.identity, business, state.db)?.id || null;
    const coActor = Platform.actorFor(state.identity, "inspection", contexts.inspection.db);
    if (state.coDraftAccount !== (coActor?.id || null)) {
      state.coDraftAccount = coActor?.id || null;
      state.coDrafts = coActor ? readCoDraftStore().store.accounts[coActor.id] || {} : {};
    }
  }

  function route() {
    const legacy = new URLSearchParams(global.location.search).get("mode") === "coordination";
    const hash = global.location.hash.replace(/^#/, "") || (state.identity ? ROLE_HOME[state.identity.role] : legacy ? "/login" : "/portal");
    const [path, queryString = ""] = hash.split("?");
    const query = new URLSearchParams(queryString);
    const ui = query.get("ui"), chapter = query.get("chapter");
    query.delete("ui"); query.delete("chapter");
    return { path, query, ui, chapter };
  }

  function businessHash() {
    const { path, query } = route();
    return `${path}${query.size ? `?${query}` : ""}`;
  }

  function setUtility(view, chapter = "") {
    const current = route();
    if (!view && current.ui) {
      if (global.history.state?.azxUtility) { global.history.back(); return; }
      global.history.replaceState(null, "", `#${businessHash()}`);
    } else if (view) {
      const query = new URLSearchParams(current.query);
      query.set("ui", view);
      if (chapter) query.set("chapter", chapter);
      const hash = `#${current.path}?${query}`;
      if (current.ui) global.history.replaceState(global.history.state, "", hash);
      else global.history.pushState({ azxUtility: true }, "", hash);
    }
    syncUtility();
  }

  function syncUtility() {
    const { ui, chapter } = route();
    if (ui && !utilityReturn) {
      const element = lastBusinessFocus?.isConnected ? lastBusinessFocus : null;
      utilityReturn = {
        hash: businessHash(), x: global.scrollX, y: global.scrollY, element,
        start: element?.selectionStart, end: element?.selectionEnd,
      };
    }
    state.guideOpen = ui === "help";
    const directory = document.getElementById("featureDirectory");
    directory.hidden = ui !== "features";
    if (!directory.hidden) {
      directory.innerHTML = `<header><h1 id="directoryTitle">全部功能</h1><button class="btn" data-action="closeUtility">返回原页面</button></header>
        <p>仅列出当前身份全部获授权功能；保险与现场巡检独立存档。</p>
        ${state.identity ? menuGroups(state.identity).map(group => `<section><h2>${Reports.escapeHtml(group.label)}</h2>
        ${group.items.map(item => `<a href="#${item.path}">${Reports.escapeHtml(item.label)}<span aria-hidden="true"> →</span></a>`).join("")}</section>`).join("")
        : '<a class="btn" href="#/login">选择演示账号</a>'}`;
    }
    renderGuide();
    applyUtilityLayout();
    if (chapter && state.guideOpen) {
      const section = [...document.querySelectorAll("[data-guide-chapter]")].find(element => element.dataset.guideChapter === chapter);
      if (section) { section.open = true; section.scrollIntoView({ block: "start" }); }
    }
    const active = ui === "features" ? directory : state.guideOpen && compactLayout.matches ? document.getElementById("guidePanel") : null;
    if (active) {
      active.querySelector("button, a, summary")?.focus({ preventScroll: true });
    } else if (utilityReturn && !ui) {
      const restore = utilityReturn;
      utilityReturn = null;
      if (restore.hash === businessHash()) {
        global.scrollTo(restore.x, restore.y);
        if (restore.element?.isConnected) {
          restore.element.focus({ preventScroll: true });
          if (typeof restore.element.setSelectionRange === "function" && restore.start !== null) {
            try { restore.element.setSelectionRange(restore.start, restore.end); }
            catch (error) { console.debug("此字段不支持选区恢复。", error); }
          }
          const rect = restore.element.getBoundingClientRect();
          if (rect.top < 0 || rect.bottom > global.innerHeight - 80) restore.element.scrollIntoView({ block: "center" });
        }
      }
    }
  }

  function applyUtilityLayout() {
    const fullHelp = state.guideOpen && compactLayout.matches;
    const blocking = Boolean(document.querySelector("#modalRoot [role=dialog], #drawerRoot [role=dialog]"));
    const covered = blocking || fullHelp || !document.getElementById("featureDirectory").hidden;
    const app = document.getElementById("app");
    app.inert = covered;
    if (covered) app.setAttribute("aria-hidden", "true");
    else app.removeAttribute("aria-hidden");
    document.body.classList.toggle("utility-open", covered);
    document.getElementById("guideRoot").inert = blocking;
    document.getElementById("drawerRoot").inert = Boolean(document.querySelector("#modalRoot [role=dialog]"));
    const panel = document.getElementById("guidePanel");
    if (fullHelp) { panel.setAttribute("role", "dialog"); panel.setAttribute("aria-modal", "true"); }
    else { panel.removeAttribute("role"); panel.removeAttribute("aria-modal"); }
    document.getElementById("guideRoot").hidden = !document.getElementById("featureDirectory").hidden;
  }

  function syncVisibleArea() {
    const editing = document.activeElement?.matches("input:not([type=checkbox]):not([type=radio]), textarea, select");
    document.body.classList.toggle("editing-constrained", Boolean(compactLayout.matches && editing
      && global.visualViewport && global.visualViewport.height < 480));
  }

  function navigate(path) {
    if (!discardCoDraft()) return;
    state.userMenuOpen = false;
    global.location.hash = path.startsWith("#") ? path.slice(1) : path;
  }

  function discardCoDraft() {
    if ((state.coDirty || state.formDirty) && !global.confirm("当前表单有尚未成功保存或提交的内容，离开后可能丢失。确认离开？")) return false;
    state.coDirty = false;
    state.formDirty = false;
    return true;
  }

  function persistCoDraft(taskId, draft) {
    if (!coMode || !state.accountId || !taskId) return false;
    const { store, warning } = readCoDraftStore();
    if (warning) {
      state.coDirty = true;
      updateDraftStatus(false);
      if (!state.coDraftStorageErrorShown) {
        state.coDraftStorageErrorShown = true;
        showToast(warning, true);
      }
      return false;
    }
    try {
      store.accounts[state.accountId] ||= {};
      if (draft) store.accounts[state.accountId][taskId] = Data.clone(draft);
      else delete store.accounts[state.accountId][taskId];
      if (!Object.keys(store.accounts[state.accountId]).length) delete store.accounts[state.accountId];
      global.localStorage.setItem(CO_DRAFT_STORAGE_KEY, JSON.stringify(store));
      state.coDirty = false;
      updateDraftStatus(true);
      state.coDraftStorageErrorShown = false;
      return true;
    } catch (error) {
      console.error("统筹巡检草稿保存失败。", error);
      state.coDirty = true;
      updateDraftStatus(false);
      if (!state.coDraftStorageErrorShown) {
        state.coDraftStorageErrorShown = true;
        showToast(`草稿未保存：${error.message}。当前页面输入仍保留，请勿刷新。`, true);
      }
      return false;
    }
  }

  function updateDraftStatus(saved) {
    const status = document.querySelector(".draft-status");
    if (!status) return;
    status.textContent = saved ? "草稿已保存在本浏览器，不跨设备同步" : "草稿未保存，请勿刷新；当前输入仍在本页";
    status.classList.toggle("unsaved", !saved);
  }

  function renderGuide() {
    const { path } = route();
    const account = currentAccount() || state.identity;
    const title = path === "/portal" ? "公共门户"
      : path === "/market" ? "保险产品市场"
        : path === "/login" ? "登录页"
          : path.endsWith("/home") ? "综合工作台"
            : coMode ? global.CoordinationPages.title(path) : PAGE_TITLES[path]?.[0] || "业务工作台";
    const role = account?.role;
    const steps = role
      ? menuGroups(state.identity).flatMap(group => group.items.map(item => [item.path, item.label]))
      : [["/login", "选择演示账号"], ["/market", "浏览保险产品"]];
    const mode = "统一操作说明";
    const identity = account ? `${ROLE_LABELS[account.role]}：${account.name}` : "尚未登录";
    const pageInstructions = coMode ? {
      regulator: "接收并审核现场巡检报告，再记录隐患判定和地区分析；合同验收与结算是独立分支，不要求先派单。",
      insurer: "查看本机构预算与服务安排，跟进现场任务和报告处理。",
      service: "从既有计划开始巡检，再按锁定模板填报、提交报告并跟进整改复查。",
      enterprise: "查看与企业相关的巡检任务、报告及整改跟进。",
    }[role] || "先选择演示角色，再按对应职责体验服务统筹流程。"
      : {
        regulator: "按数据接入、质量校验与整改、全国报送、监督检查、省市协同、运营月报的顺序体验监管流程。",
        insurer: "从数据质量整改与保司资料检查反馈开始，再查看投保核保、保单服务和理赔。",
        service: "从服务任务开始，登记隐患、跟进整改复查，并完成回访归档。",
        enterprise: "比较保险产品并投保，查看保障与服务，提交隐患整改或理赔报案。",
      }[role] || "先选择演示角色，再按页面路线体验安责险业务闭环。";
    const instructions = path.endsWith("/home") ? ({
      regulator: account?.level === "city" ? "查看本市监管驾驶舱、应保企业底数和省市工作协同；未授予跨地区现场巡检权限。"
        : "保险监管与企业现场巡检分组处理：保司资料检查不等于企业巡检；报告审核后另做隐患判定和地区分析。",
      insurer: "从数据质量整改与保司资料检查反馈处理原业务；查看本机构预算与服务安排，在任务与报告覆核成果，结算前另行确认费用台账。",
      service: "企业现场巡检从既有计划开始；原保险服务从服务任务开始，两组隐患与复查记录互不替代。",
      enterprise: "原保险业务可投保、查保单和报案；现场巡检在任务与报告确认收到并整改，企业整改前需监管人工判定。",
    })[role] : pageInstructions;
    const panel = document.getElementById("guidePanel");
    const launcher = document.querySelector(".guide-launcher");
    const modeLabel = document.getElementById("guideMode");
    const content = document.getElementById("guideContent");
    if (!panel || !launcher || !modeLabel || !content) return;
    global.AZXGuideWindow.capture();
    panel.hidden = !state.guideOpen;
    launcher.hidden = state.guideOpen;
    launcher.setAttribute("aria-expanded", String(state.guideOpen));
    modeLabel.textContent = `${mode} · ${identity}`;
    content.innerHTML = `
      <section>
        <h3>本页：${Reports.escapeHtml(title)}</h3>
        <p>${instructions}</p>
        <p>${account ? "请按下方流程跳转到相应业务页面；切换角色时先退出登录，再选择其他演示账号。" : "先选择演示账号并登录；也可先浏览保险产品。"} </p>
      </section>
      <section>
        <h3>建议操作路线</h3>
        <ol class="guide-steps">
          ${steps.map(([path, label], index) => `<li><span>${index + 1}</span><button type="button" data-nav="${path}">${label}</button></li>`).join("")}
        </ol>
      </section>
      <section>
        <h3>演示提示</h3>
        <ul class="guide-notes">
          <li>登录密码为 <code>demo123</code>；退出后重新选择账号不会重置资料。</li>
          <li>所有企业和业务资料均为合成样例，只保存在当前浏览器。</li>
          <li>「演示设置」明确选择恢复哪一业务；保险与现场巡检存档、草稿、统计互相独立。</li>
          <li>报送、检查、验收及费用均为交互示例，不连接官方接口或真实支付。</li>
        </ul>
      </section>
      ${global.AZXDemoGuide.render()}
      <p class="guide-hint">宽屏可边看边操作并拖动缩放说明窗口；手机为整页说明，点「返回原页面」继续原任务，不会清除未提交输入。</p>
    `;
    global.AZXGuideWindow.restore();
    applyUtilityLayout();
    if (state.guideTargetSelector) {
      const targetSelector = state.guideTargetSelector;
      state.guideTargetSelector = null;
      global.setTimeout(() => highlightGuideTarget(targetSelector), 100);
    }
  }

  function prepareResponsiveContent() {
    document.querySelectorAll(".data-table").forEach(table => {
      table.setAttribute("role", "table");
      table.querySelectorAll("tr").forEach(row => row.setAttribute("role", "row"));
      const headers = [...table.querySelectorAll("thead th")].map(header => {
        header.scope = "col";
        header.setAttribute("role", "columnheader");
        return header.textContent;
      });
      table.querySelectorAll("tbody tr").forEach(row => {
        [...row.children].forEach((cell, index) => {
          cell.setAttribute("role", "cell");
          if (cell.colSpan > 1 || cell.querySelector(":scope > .mobile-cell-label")) return;
          const label = document.createElement("span");
          label.className = "mobile-cell-label";
          label.setAttribute("aria-hidden", "true");
          label.textContent = headers[index] || "";
          const value = document.createElement("div");
          value.className = "cell-value";
          value.append(...cell.childNodes);
          cell.append(label, value);
        });
      });
    });
    document.querySelectorAll("#co-report-form").forEach(form => {
      if (form.querySelector(".form-sections")) return;
      const sections = [...form.querySelectorAll(":scope > fieldset")];
      const nav = document.createElement("nav");
      nav.className = "form-sections no-print";
      nav.setAttribute("aria-label", "报告填写步骤");
      const status = document.createElement("p");
      status.className = "draft-status";
      status.setAttribute("role", "status");
      status.textContent = state.coDirty ? "草稿未保存，请勿刷新" : "填写时自动保存到本浏览器，不跨设备同步";
      nav.append(status);
      sections.forEach((section, index) => {
        section.id = `report-section-${index}`;
        const button = document.createElement("button");
        button.type = "button";
        button.className = "btn btn-quiet";
        button.textContent = index ? `检查项 ${index}` : "基本信息";
        button.dataset.formSection = String(index);
        nav.append(button);
        const actions = document.createElement("div");
        actions.className = "section-actions compact-control no-print";
        for (const [offset, label] of [[-1, "上一项"], [1, "下一项"]]) {
          if (!sections[index + offset]) continue;
          const step = document.createElement("button");
          step.type = "button"; step.className = "btn";
          step.dataset.formSection = String(index + offset); step.textContent = label;
          actions.append(step);
        }
        const help = document.createElement("button");
        help.type = "button"; help.className = "btn btn-quiet";
        help.dataset.action = "fieldHelp"; help.textContent = "本项填写说明";
        actions.append(help); section.append(actions);
      });
      form.prepend(nav);
    });
    document.querySelectorAll(".filter-bar, .gd-filter, .co-filter").forEach(filter => {
      if (filter.dataset.filterReady || filter.querySelectorAll("select").length < 2) return;
      filter.dataset.filterReady = "true";
      const open = document.createElement("button");
      open.type = "button"; open.className = "btn compact-control filter-opener";
      open.dataset.action = "openFilters"; open.textContent = "筛选当前列表";
      filter.before(open);
    });
  }

  function openFilters(filter) {
    const controls = [...filter.querySelectorAll("select")];
    dialogReturnFocus = document.activeElement;
    document.getElementById("modalRoot").innerHTML = `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="filterTitle">
      <header class="modal-head"><h2 id="filterTitle">筛选当前列表</h2><button class="btn" data-action="closeModal">取消</button></header>
      <form id="responsiveFilters"><div class="modal-body">${controls.map((control, index) => `<label>${Reports.escapeHtml(control.labels?.[0]?.textContent || control.closest("label")?.textContent.split("\n")[0] || "筛选条件")}
      <select name="filter-${index}">${[...control.options].map(option => `<option value="${Reports.escapeHtml(option.value)}"${option.selected ? " selected" : ""}>${Reports.escapeHtml(option.textContent)}</option>`).join("")}</select></label>`).join("")}</div>
      <footer class="modal-footer"><button type="button" class="btn" data-action="clearFilters">清空条件</button><button type="submit" class="btn btn-primary">应用筛选</button></footer></form></section></div>`;
    const form = document.getElementById("responsiveFilters");
    form.addEventListener("submit", event => {
      event.preventDefault();
      const query = route().query;
      controls.forEach((control, index) => {
        const value = form.elements.namedItem(`filter-${index}`).value;
        if (control.dataset.filter) state.filters[control.dataset.filter] = value;
        else if (control.dataset.marketFilter) state.marketFilters[control.dataset.marketFilter] = value;
        else if (control.dataset.gdFilter) {
          if (value) query.set(control.dataset.gdFilter, value);
          else query.delete(control.dataset.gdFilter);
          query.delete("firm");
        } else if (control.dataset.coFilter) {
          if (value) query.set(control.dataset.coFilter, value);
          else query.delete(control.dataset.coFilter);
        }
      });
      closeModal();
      const hash = `${route().path}${query.size ? `?${query}` : ""}`;
      if (hash !== businessHash()) navigate(hash);
      else render();
    });
    form.querySelector("select")?.focus();
    applyUtilityLayout();
  }

  function clearGuideTarget() {
    document.querySelectorAll(".guide-target-highlight").forEach(element => element.classList.remove("guide-target-highlight"));
    document.getElementById("guideTargetTip")?.remove();
    document.getElementById("guideRoot")?.classList.remove("guide-top", "guide-left");
  }

  function highlightGuideTarget(selector) {
    clearGuideTarget();
    const target = document.querySelector(selector);
    if (!target) {
      showToast("已打开对应页面；当前步骤没有可定位的操作控件，请按说明继续。");
      return;
    }
    target.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    target.classList.add("guide-target-highlight");
    const isActionTarget = target.matches("a, button, input, select, textarea, [role='button'], [tabindex]");
    if (isActionTarget) target.focus({ preventScroll: true });
    const root = document.getElementById("guideRoot");
    const tip = document.createElement("div");
    tip.id = "guideTargetTip";
    tip.className = "guide-target-tip";
    tip.setAttribute("role", "status");
    tip.setAttribute("aria-live", "polite");
    const tipMessage = isActionTarget ? "下一步看这里：请点击高亮区域" : "已定位相关界面；请按说明继续操作";
    tip.innerHTML = `<span>${tipMessage}</span><button type="button" data-action="dismissGuideTarget" aria-label="关闭操作指示">知道了</button>`;
    document.body.appendChild(tip);
    global.setTimeout(() => {
      const rect = target.getBoundingClientRect();
      const tipRect = tip.getBoundingClientRect();
      const top = rect.top > global.innerHeight / 2
        ? Math.max(8, rect.top - tipRect.height - 10)
        : Math.min(global.innerHeight - tipRect.height - 8, rect.bottom + 10);
      const left = Math.max(8, Math.min(rect.left, global.innerWidth - tipRect.width - 8));
      tip.style.left = `${left}px`;
      tip.style.top = `${top}px`;
      tip.classList.toggle("points-up", rect.top <= global.innerHeight / 2);
    }, 350);
  }

  function currentAccount() {
    return state.db.accounts.find(item => item.id === state.accountId) || null;
  }

  function entity(collection, id) {
    return state.db[collection].find(item => item.id === id) || null;
  }

  function label(collection, id) {
    const item = entity(collection, id);
    return item?.name || item?.shortName || id || "-";
  }

  function statusClass(status) {
    if (status === "重大") return "danger";
    if (status === "较大") return "warning";
    if (["已承保", "生效中", "已归档", "已销号", "复查通过", "已赔付", "已结案", "已办结"].includes(status)) return "success";
    if (["已拒保", "已退保", "失败"].includes(status)) return "danger";
    if (["核保中", "待补正", "待接单", "执行中", "待整改", "待复查", "待回访", "待归档", "查勘中", "审核中", "待赔付", "处理中", "待反馈"].includes(status)) return "warning";
    return "info";
  }

  function statusTag(status) {
    return `<span class="status ${statusClass(status)}">${Reports.escapeHtml(status)}</span>`;
  }

  function pageHeading(title, description, actions = "") {
    return `
      <div class="page-heading">
        <div>
          <h2>${Reports.escapeHtml(title)}</h2>
          <p>${Reports.escapeHtml(description)}</p>
        </div>
        ${actions ? `<div class="page-actions no-print">${actions}</div>` : ""}
      </div>
    `;
  }

  function emptyState(title, description) {
    return `<div class="empty-state"><strong>${Reports.escapeHtml(title)}</strong>${Reports.escapeHtml(description)}</div>`;
  }

  function renderTable(columns, rows, emptyTitle = "暂无数据") {
    return `
      <div class="table-scroll">
        <table class="data-table">
          <thead><tr>${columns.map(column => `<th>${Reports.escapeHtml(column.label)}</th>`).join("")}</tr></thead>
          <tbody>
            ${rows.length ? rows.map(row => `
              <tr>${columns.map(column => `<td>${column.render ? column.render(row) : Reports.escapeHtml(row[column.key])}</td>`).join("")}</tr>
            `).join("") : `<tr><td colspan="${columns.length}">${emptyState(emptyTitle, "当前条件下没有需要显示的记录。")}</td></tr>`}
          </tbody>
        </table>
      </div>
    `;
  }

  function kpiCards(cards, compact = false) {
    return `
      <div class="kpi-grid${compact ? " compact" : ""}">
        ${cards.map(card => {
          const comparison = card.comparison;
          const sentimentClass = comparison?.sentiment ? `trend-${comparison.sentiment}` : "trend-neutral";
          const progress = card.target ? Math.min(100, (Number(card.raw || 0) / card.target) * 100) : null;
          return `
            <button type="button" class="kpi-card chart-action${card.emphasis ? " emphasis" : ""}" data-drill="${Reports.escapeHtml(card.drill || "")}">
              <span class="kpi-label">${Reports.escapeHtml(card.label)}</span>
              <strong class="kpi-value">${Reports.escapeHtml(card.value)}</strong>
              <span class="kpi-meta">
                <span class="${sentimentClass}">${comparison ? `较上期 ${Reports.escapeHtml(comparison.text)}` : "由业务明细汇总"}</span>
                ${card.target ? `<span>目标 ${card.target}%</span>` : ""}
              </span>
              ${progress !== null ? `<span class="progress"><span style="--progress:${progress}%"></span></span>` : ""}
            </button>
          `;
        }).join("")}
      </div>
    `;
  }

  function reportCard(title, content, description = "", className = "") {
    return `
      <section class="report-card ${className}">
        <div class="card-head">
          <div><h3>${Reports.escapeHtml(title)}</h3>${description ? `<p>${Reports.escapeHtml(description)}</p>` : ""}</div>
        </div>
        ${content}
      </section>
    `;
  }

  function filterBar() {
    const f = state.filters;
    return `
      <div class="filter-bar no-print">
        <div class="field">
          <label for="filterPeriod">统计周期</label>
          <select id="filterPeriod" data-filter="period">
            ${[["month", "本月"], ["quarter", "本季度"], ["year", "本年度"], ["all", "全部"]].map(([value, text]) => `<option value="${value}"${f.period === value ? " selected" : ""}>${text}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label for="filterRegion">地区</label>
          <select id="filterRegion" data-filter="regionId">
            <option value="">全部地区</option>
            ${state.db.regions.map(item => `<option value="${item.id}"${f.regionId === item.id ? " selected" : ""}>${Reports.escapeHtml(item.name)}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label for="filterIndustry">行业</label>
          <select id="filterIndustry" data-filter="industryId">
            <option value="">全部行业</option>
            ${state.db.industries.map(item => `<option value="${item.id}"${f.industryId === item.id ? " selected" : ""}>${Reports.escapeHtml(item.name)}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label for="filterInsurer">保险机构</label>
          <select id="filterInsurer" data-filter="insurerId">
            <option value="">全部保险机构</option>
            ${state.db.insurers.map(item => `<option value="${item.id}"${f.insurerId === item.id ? " selected" : ""}>${Reports.escapeHtml(item.shortName)}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label for="filterProvider">服务机构</label>
          <select id="filterProvider" data-filter="providerId">
            <option value="">全部服务机构</option>
            ${state.db.serviceProviders.map(item => `<option value="${item.id}"${f.providerId === item.id ? " selected" : ""}>${Reports.escapeHtml(item.shortName)}</option>`).join("")}
          </select>
        </div>
        <button type="button" class="btn btn-quiet" data-action="clearFilters">清除筛选</button>
        <span class="filter-summary">当前口径：${Reports.escapeHtml(Reports.filterLabel(state.db, state.filters))}</span>
      </div>
    `;
  }

  function publicLayout(content, active = "portal") {
    return `
      <div class="public-shell">
        <header class="public-header">
          <a class="brand" href="#/portal">
            <span class="brand-mark">安</span>
            <span class="brand-copy"><strong>安责险信息管理平台</strong><span>监管 · 保险 · 服务 · 企业</span></span>
          </a>
          <nav class="public-nav" aria-label="公共门户导航">
            <a class="${active === "portal" ? "active" : ""}" href="#/portal">平台首页</a>
            <a class="${active === "market" ? "active" : ""}" href="#/market">保险产品</a>
            <a href="#/portal" data-action="scrollNotices">政策通知</a>
            <a class="btn btn-primary" href="#/login">登录平台</a>
          </nav>
        </header>
        <main class="public-main">${content}</main>
        <footer class="public-footer">
          <strong>安责险信息管理平台</strong>
          <p>统一入口与明确业务身份；保险与现场巡检保留独立存档、流程和统计口径。</p>
        </footer>
      </div>
    `;
  }

  function renderPortal() {
    const report = Reports.dashboard(state.db, { period: "year" });
    const stats = [
      ["保险样本企业", Reports.number(report.current.enterpriseCount), "家"],
      ["有效保单", Reports.number(report.current.activePolicyCount), "张"],
      ["参保覆盖率", Reports.percent(report.current.coverageRate), ""],
      ["服务任务", Reports.number(state.db.serviceTasks.length), "项"],
      ["隐患整改率", Reports.percent(report.current.hazardRectificationRate), ""],
      ["累计赔付", Reports.money(report.current.paidAmount), ""],
    ];
    const features = [
      ["保", "保险产品服务", "多家保险机构和产品集中展示，企业自主比较并提交投保。", "/market"],
      ["服", "企业现场巡检", "第三方依既有计划巡检，监管接收报告并分析；与原保险服务记录分开。", "/login"],
      ["监", "监管分析", "覆盖率、服务质量、隐患和理赔数据自动汇总并支持下钻。", "/login"],
      ["证", "业务证据链", "业务动作形成状态、时间、责任主体和审计记录。", "/login"],
    ];
    return publicLayout(`
      <section class="hero">
        <div class="hero-copy">
          <span class="eyebrow">互联网 + 安责险 + 监管 + 服务</span>
          <h1>让每张保单、每次服务和每条隐患都可追踪</h1>
          <p>同一入口连接保险全流程与企业现场巡检。登录后按职责显示全部获授权功能，不混合未匹配的企业、机构或历史记录。</p>
          <div class="hero-actions">
            <a class="btn btn-primary" href="#/login">进入业务平台</a>
            <a class="btn btn-link" href="#/market">浏览保险产品</a>
          </div>
        </div>
        <div class="hero-panel">
          <div class="card-head"><div><h2>保险业务样本概览</h2><p>数据日期 ${state.db.meta.businessDate} · 不含独立现场巡检样本</p></div><span class="status ${state.storageBlocked ? "warning" : "info"}">${state.storageBlocked ? "临时样本／存档不可读" : "合成样本"}</span></div>
          <div class="hero-metrics">
            ${stats.slice(0, 4).map(([name, value, unit]) => `<div class="hero-metric"><span>${name}</span><strong>${value}${unit ? `<small>${unit}</small>` : ""}</strong></div>`).join("")}
          </div>
        </div>
      </section>
      <section class="section">
        <div class="section-heading"><div><h2>平台服务</h2><p>围绕安责险全流程提供统一的数据和业务入口</p></div></div>
        <div class="feature-grid">
          ${features.map(([icon, title, description, path]) => `<a class="feature-card" href="#${path}"><span class="feature-icon">${icon}</span><h3>${title}</h3><p>${description}</p></a>`).join("")}
        </div>
      </section>
      <section class="section">
        <div class="section-heading"><div><h2>保险业务数据</h2><p>仅汇总原保险保单、服务、隐患和理赔；企业现场巡检在独立分组查看，不生成未经匹配的全平台合计。</p></div></div>
        <div class="public-stat-grid">
          ${stats.map(([name, value, unit]) => `<div class="public-stat"><span>${name}</span><strong>${value}${unit ? `<small>${unit}</small>` : ""}</strong></div>`).join("")}
        </div>
      </section>
      <section class="section" id="notices">
        <div class="section-heading"><div><h2>政策通知</h2><p>示范通知用于展示公共门户信息组织方式</p></div><a href="#/login">进入通知中心 →</a></div>
        <div class="panel notice-list">
          ${[
            ["2026-09-05", "关于加强高危行业安责险事故预防服务工作的通知", "业务通知"],
            ["2026-08-26", "安责险重点行业参保数据质量核查提示", "数据治理"],
            ["2026-08-18", "事故预防服务档案完整性检查工作安排", "监督检查"],
            ["2026-08-02", "保险机构和技术服务机构季度考核说明", "考核评价"],
          ].map(item => `<div class="notice-item"><time>${item[0]}</time><strong>${item[1]}</strong><span>${item[2]}</span></div>`).join("")}
        </div>
      </section>
    `);
  }

  function filteredProducts() {
    return state.db.products.filter(product => (
      (!state.marketFilters.insurerId || product.insurerId === state.marketFilters.insurerId)
      && (!state.marketFilters.serviceLevel || product.serviceLevel === state.marketFilters.serviceLevel)
    ));
  }

  function productCards(publicMode = false) {
    return filteredProducts().map(product => {
      const insurer = entity("insurers", product.insurerId);
      return `
        <article class="product-card">
          <div class="product-insurer"><span class="product-logo">${Reports.escapeHtml(insurer.shortName.slice(0, 1))}</span><div><strong>${Reports.escapeHtml(insurer.shortName)}</strong><div class="product-version">产品版本 ${Reports.escapeHtml(product.version)}</div></div></div>
          <h3>${Reports.escapeHtml(product.name)}</h3>
          <div class="product-coverage"><span>每人责任限额</span><strong>${Reports.money(product.coveragePerPerson, false)}</strong></div>
          <div class="tag-list">${product.tags.map(tag => `<span class="tag">${Reports.escapeHtml(tag)}</span>`).join("")}</div>
          <button type="button" class="btn ${publicMode ? "btn-link" : "btn-primary"}" ${publicMode ? `data-nav="/login"` : `data-workflow="submitApplication" data-id="${product.id}"`}>${publicMode ? "登录后投保" : "选择并提交投保"}</button>
        </article>
      `;
    }).join("");
  }

  function renderPublicMarket() {
    return publicLayout(`
      <section class="section">
        <div class="section-heading"><div><span class="eyebrow">保险服务</span><h2>安责险产品市场</h2><p>企业可自主比较保险机构、保障方案和事故预防服务内容</p></div><a class="btn btn-primary" href="#/login">企业登录</a></div>
        <div class="filter-bar">
          <div class="field"><label>承保机构</label><select data-market-filter="insurerId"><option value="">全部保险机构</option>${state.db.insurers.map(item => `<option value="${item.id}"${state.marketFilters.insurerId === item.id ? " selected" : ""}>${Reports.escapeHtml(item.shortName)}</option>`).join("")}</select></div>
          <div class="field"><label>服务等级</label><select data-market-filter="serviceLevel"><option value="">全部方案</option>${["基础", "标准", "全面", "增强", "行业", "专项"].map(item => `<option value="${item}"${state.marketFilters.serviceLevel === item ? " selected" : ""}>${item}</option>`).join("")}</select></div>
          <button type="button" class="btn btn-quiet" data-action="clearMarketFilters">清除筛选</button>
          <span class="filter-summary">共 ${filteredProducts().length} 个在售方案</span>
        </div>
        <div class="product-grid">${filteredProducts().length ? productCards(true) : emptyState("没有匹配的保险产品", "请调整承保机构或服务等级。")}</div>
      </section>
    `, "market");
  }

  function renderLogin() {
    const selected = Platform.identityFor(state.selectedAccountId)?.id || Platform.identities[0].id;
    state.selectedAccountId = selected;
    return `
      <div class="login-page">
        <section class="login-intro">
          <a class="brand" href="#/portal"><span class="brand-mark">安</span><span class="brand-copy"><strong>安责险信息管理平台</strong><span>返回公共门户</span></span></a>
          <h1>统一入口，按职责进入业务工作台</h1>
          <p>一次登录，进入本账号获授权的保险业务、保司资料检查和企业现场巡检。各业务保留独立记录与完整流程；同名企业或同号记录不会自动关联。所有资料均为合成示例。</p>
          <div class="login-points">
            <div class="login-point"><i>✓</i><span>数据完全本地运行，断网也可使用</span></div>
            <div class="login-point"><i>✓</i><span>固定业务日期和场景，演示结果稳定</span></div>
            <div class="login-point"><i>✓</i><span>独立角色权限，不在工作台直接切换身份</span></div>
          </div>
        </section>
        <section class="login-panel">
          <div class="login-panel-head"><h2>登录业务平台</h2><p>选择演示账号并输入统一演示密码</p></div>
          <div class="account-grid">
            ${Platform.identities.map(account => `
              <button type="button" class="account-card${selected === account.id ? " selected" : ""}" data-account="${account.id}">
                <span class="account-role">${ROLE_LABELS[account.role]}</span>
                <strong>${Reports.escapeHtml(account.name)}</strong>
                <p>${Object.keys(account.grants).map(key => key === "insurance" ? "保险业务" : "现场巡检").join(" · ")}</p>
                <span class="table-secondary">账号：${Reports.escapeHtml(account.username)}</span>
              </button>
            `).join("")}
          </div>
          <div class="login-actions">
            <div class="field">
              <label for="demoPassword">演示密码</label>
              <input id="demoPassword" type="password" value="demo123" autocomplete="off" />
            </div>
            <button type="button" class="btn btn-primary" data-action="login">进入工作台</button>
          </div>
          <p class="login-hint">统一演示密码：demo123。「使用说明」可查看操作路线；登录后窄屏使用底部导航，桌面使用左侧菜单。</p>
        </section>
      </div>
    `;
  }

  function notificationsFor(account) {
    return state.db.notifications.filter(item => (
      item.role === account.role
      && (!item.orgId || item.orgId === account.orgId)
    ));
  }

  function menuGroups(identity) {
    return Platform.menuGroups(identity, contexts);
  }

  function renderUnifiedHome() {
    const identity = state.identity;
    return workbenchLayout(identity, ROLE_HOME[identity.role], `
      ${pageHeading("综合工作台", "按业务分组显示本演示身份的全部获授权功能；各业务样本独立，不合计未知分母")}
      <div class="mobile-intro"><strong>${Reports.escapeHtml(identity.name)}</strong><p>完整功能 · 本浏览器保存 · 不跨设备同步</p><button class="btn btn-primary" data-action="showFeatures">查看全部功能</button></div>
      <p class="co-note">统一登录授予的是明确列出的演示业务身份，不代表两份历史中的机构、企业或同号记录是同一实体。未确认的跨业务关联保持独立。</p>
      <div class="content-grid two">
        ${menuGroups(identity).map(group => {
          const context = contexts[group.business];
          const actor = Platform.actorFor(identity, group.business, context.db);
          const notices = context.db.notifications.filter(item => item.role === actor.role && (!item.orgId || item.orgId === actor.orgId));
          const tasks = group.business === "inspection" ? context.db.co.tasks.filter(task => global.Coordination.taskVisible(context.db, actor, task)) : null;
          return `<section class="card unified-group" data-business="${group.business}">
            <div class="card-head"><div><h2>${Reports.escapeHtml(group.label)}</h2><p>${Reports.escapeHtml(actor.name)} · ${Reports.escapeHtml(actor.organization)}</p></div></div>
            <p>${group.business === "inspection" ? `本业务可见执行记录 ${tasks.length} 笔（不是企业数）；从既有计划直接开始，无需监管派单。` : `本业务未读通知 ${notices.filter(item => !item.read).length} 条；保险服务与保司资料检查不计入现场巡检地区风险。`}</p>
            ${context.warning ? `<p role="alert" class="co-note">${Reports.escapeHtml(context.warning)}</p>` : ""}
            <div class="btn-row">${group.items.map(item => `<a class="btn btn-quiet" href="#${item.path}">${Reports.escapeHtml(item.label)}</a>`).join("")}</div>
          </section>`;
        }).join("")}
      </div>
      ${!identity.grants.insurance ? '<p class="co-note">本账号未获授权访问原保险业务；没有默认映射到保司A、机构甲或企业甲。</p>' : ""}
      ${!identity.grants.inspection ? '<p class="co-note">本账号未获授权访问跨地区现场巡检；市级监管仅保留原辖区功能。</p>' : ""}
    `);
  }

  function workbenchLayout(account, path, content) {
    const groups = menuGroups(state.identity);
    const home = path === ROLE_HOME[state.identity.role];
    const [title, description] = home ? ["综合工作台", "全部获授权功能"] : coMode ? [global.CoordinationPages.title(path), "企业现场巡检 · 独立合成样本"] : PAGE_TITLES[path] || ["业务工作台", ""];
    const notifications = currentAccount() ? notificationsFor(currentAccount()) : [];
    return `
      <div class="workbench" data-context-path="${Reports.escapeHtml(state.renderedHash)}" data-context-actor="${Reports.escapeHtml(account.id)}">
        <aside class="sidebar">
          <a class="sidebar-brand" href="#${ROLE_HOME[account.role]}">
            <span class="brand-mark">安</span>
            <span><strong>安责险信息管理平台</strong><span>${ROLE_LABELS[account.role]} · 运营演示</span></span>
          </a>
          <div class="sidebar-role">${ROLE_LABELS[account.role]}</div>
          <nav class="side-nav">
            <a class="${home ? "active" : ""}" href="#${ROLE_HOME[account.role]}"><i class="nav-icon">首</i><span>综合工作台</span></a>
            ${groups.map(group => `<div class="nav-group-label">${Reports.escapeHtml(group.label)}</div>${group.items.map(item => `<a class="${path === item.path ? "active" : ""}" href="#${item.path}"><i class="nav-icon">${item.icon}</i><span>${Reports.escapeHtml(item.label)}</span></a>`).join("")}`).join("")}
          </nav>
          <div class="sidebar-footer">
            <div class="business-date">演示业务日期<br><strong>${state.db.meta.businessDate}</strong><br>${home ? "各业务独立存档与统计口径" : Reports.escapeHtml(state.db.meta.scenarioName)}</div>
          </div>
        </aside>
        <section class="workspace">
          <header class="workspace-header">
            <button type="button" class="btn compact-control" data-nav="${ROLE_HOME[account.role]}" aria-label="返回综合工作台">返回</button>
            <div class="workspace-title"><div class="breadcrumb">首页 / ${ROLE_LABELS[account.role]} / ${Reports.escapeHtml(title)}</div><h1>${Reports.escapeHtml(title)}</h1></div>
            <div class="header-actions">
              ${account.role === "regulator" ? `<button type="button" class="btn btn-quiet presentation-toggle" data-action="togglePresentation">${state.presentation ? "退出投屏" : "驾驶舱投屏"}</button>` : ""}
              ${currentAccount() ? `<button type="button" class="btn btn-icon notification-button" data-action="showNotifications" aria-label="当前业务通知">信${notifications.filter(item => !item.read).length ? `<span class="notification-count">${notifications.filter(item => !item.read).length}</span>` : ""}</button>` : ""}
              <div class="user-menu">
                <button type="button" class="user-trigger" data-action="toggleUserMenu" aria-expanded="${state.userMenuOpen}" aria-label="账号：${Reports.escapeHtml(state.identity.name)}">
                  <span class="avatar">${Reports.escapeHtml(account.name.slice(0, 1))}</span>
                  <span class="user-copy"><strong>${Reports.escapeHtml(state.identity.name)}</strong><span>${Reports.escapeHtml(account.organization || "综合工作台 · 明确业务授权")}</span></span>
                </button>
                  <div class="dropdown"${state.userMenuOpen ? "" : " hidden"}>
                    ${account.role === "regulator" ? `<button type="button" class="compact-control" data-action="togglePresentation">${state.presentation ? "退出投屏" : "驾驶舱投屏"}</button>` : ""}
                    <a href="#/demo-control?business=${business}">演示设置</a>
                    <a href="#/portal">公共门户</a>
                    <button type="button" data-action="logout">退出登录</button>
                  </div>
              </div>
            </div>
          </header>
          <main class="page">
            ${content || `${pageHeading(title, description)}${emptyState("页面建设中", "该页面尚未完成。")}`}
          </main>
          <button type="button" class="btn presentation-exit no-print" data-action="togglePresentation">退出投屏</button>
          <nav class="mobile-navigation no-print" aria-label="主导航">
            <a href="#${ROLE_HOME[account.role]}"${home ? ' aria-current="page"' : ""}>工作台</a>
            <button type="button" data-action="showFeatures">全部功能</button>
            <button type="button" data-action="toggleGuide">使用说明</button>
          </nav>
        </section>
      </div>
    `;
  }

  function renderRegulatorDashboard() {
    const report = Reports.dashboard(state.db, state.filters);
    return `
      ${pageHeading("监管驾驶舱", "从参保覆盖、业务规模、事故预防、隐患和理赔把握全域运行态势", `
        <button type="button" class="btn btn-quiet" data-nav="/regulator/brief">生成监管简报</button>
      `)}
      ${filterBar()}
      ${kpiCards(report.cards)}
      <div class="dashboard-grid">
        ${reportCard("地区参保覆盖率", Reports.renderChart({ type: "bar", data: report.regionCoverage, suffix: "%", decimals: 1, drill: "regionCoverage" }), "点击地区查看企业参保明细")}
        ${reportCard("重点待办与预警", `
          <div class="alert-list">
            ${report.alerts.length ? report.alerts.slice(0, 7).map(item => `
              <button type="button" class="alert-item ${item.level}" data-drill="${item.drill}" data-key="${item.key || ""}">
                <span class="alert-type">${Reports.escapeHtml(item.type)}</span>
                <span class="alert-copy"><strong>${Reports.escapeHtml(item.title)}</strong><span>${Reports.escapeHtml(item.description)}</span></span>
                <span>查看 →</span>
              </button>
            `).join("") : emptyState("暂无预警", "当前筛选条件下没有需要处理的异常。")}
          </div>
        `, "从预警直接进入业务明细")}
      </div>
      <div class="report-grid" style="margin-top:14px">
        ${reportCard("行业覆盖率对比", Reports.renderChart({ type: "bar", data: report.industryCoverage, suffix: "%", decimals: 1, drill: "industryCoverage" }), "八类高危行业参保差异")}
        ${reportCard("月度投保与承保趋势", Reports.renderChart({ type: "line", data: report.trend, series: [{ key: "applications", label: "投保申请" }, { key: "policies", label: "承保出单" }], drill: "applications" }), "最近 12 个月")}
        ${reportCard("隐患等级与闭环", Reports.renderChart({ type: "donut", data: report.hazardStatus.map(item => ({ label: item.label, value: item.value })), drill: "hazards" }), "点击等级查看隐患记录")}
        ${reportCard("服务机构质量排名", Reports.renderChart({ type: "ranking", data: report.providerRanking.map(item => ({ id: item.id, label: item.label, value: item.score, meta: `完成率 ${Reports.percent(item.completionRate)}` })), suffix: "分", drill: "provider" }), "综合任务、时限、整改和评价")}
      </div>
    `;
  }

  function analyticsTabs(topic) {
    const tabs = [
      ["coverage", "参保覆盖"],
      ["insurance", "保险业务"],
      ["prevention", "事故预防"],
      ["hazards", "隐患整改"],
      ["claims", "理赔运行"],
      ["assessment", "机构考核"],
    ];
    return `<nav class="report-tabs">${tabs.map(([id, name]) => `<a class="${topic === id ? "active" : ""}" href="#/regulator/analytics?topic=${id}">${name}</a>`).join("")}</nav>`;
  }

  function renderRegulatorAnalytics(query) {
    const topic = query.get("topic") || "coverage";
    const report = Reports.topicReport(state.db, topic, state.filters);
    return `
      ${pageHeading(report.title, report.description, `<button type="button" class="btn btn-quiet" data-action="exportTopic" data-topic="${topic}">导出当前明细 CSV</button>`)}
      ${analyticsTabs(topic)}
      ${filterBar()}
      ${kpiCards(report.cards, true)}
      <div class="report-grid">
        ${report.charts.map((chart, index) => reportCard(chart.title, Reports.renderChart(chart), "", chart.type === "heatmap" || (report.charts.length % 2 === 1 && index === report.charts.length - 1) ? "wide" : "")).join("")}
      </div>
    `;
  }

  function renderRegulatorAlerts() {
    const report = Reports.dashboard(state.db, state.filters);
    return `
      ${pageHeading("待办与预警", "聚合低覆盖、重大隐患、服务时限和理赔进度异常")}
      ${filterBar()}
      <section class="card">
        <div class="card-head"><div><h3>重点监管事项</h3><p>按风险等级排序，点击查看关联明细</p></div><span class="status warning">${report.alerts.length} 项</span></div>
        <div class="alert-list">
          ${report.alerts.length ? report.alerts.map(item => `
            <button type="button" class="alert-item ${item.level}" data-drill="${item.drill}" data-key="${item.key || ""}">
              <span class="alert-type">${Reports.escapeHtml(item.type)}</span>
              <span class="alert-copy"><strong>${Reports.escapeHtml(item.title)}</strong><span>${Reports.escapeHtml(item.description)}</span></span>
              <span>查看明细 →</span>
            </button>
          `).join("") : emptyState("暂无预警", "当前筛选条件下没有需要处理的异常。")}
        </div>
      </section>
    `;
  }

  function renderRegulatorAssessments() {
    const report = Reports.topicReport(state.db, "assessment", state.filters);
    return `
      ${pageHeading("机构考核", "综合展示保险机构与技术服务机构业务贡献、质量、时效和投诉")}
      ${filterBar()}
      ${kpiCards(report.cards, true)}
      <div class="report-grid">
        ${report.charts.map(chart => reportCard(chart.title, Reports.renderChart(chart), chart.title.includes("保险") ? "覆盖贡献 25% + 承保时效 20% + 服务投入 20% + 理赔时效 20% + 投诉评价 15%" : "任务完成 25% + 隐患闭环 25% + 回访归档 20% + 档案完整 15% + 企业评价 15%")).join("")}
      </div>
      <section class="card" style="margin-top:14px">
        <div class="card-head"><div><h3>口径说明</h3><p>以下权重为演示建议口径，不代表正式监管规则</p></div></div>
        <div class="summary-list">
          <div class="summary-row"><span>保险机构评分</span><strong>覆盖贡献、承保时效、事故预防投入、理赔时效、投诉评价</strong></div>
          <div class="summary-row"><span>服务机构评分</span><strong>任务完成、隐患闭环、回访归档时效、档案完整、企业评价</strong></div>
        </div>
      </section>
    `;
  }

  function renderRegulatorBrief() {
    const brief = Reports.brief(state.db, state.filters);
    return `
      ${pageHeading("监管运行简报", "由当前筛选数据自动生成，适合会议投屏和打印", `
        <button type="button" class="btn btn-quiet" data-action="printBrief">打印 / 保存 PDF</button>
        <button type="button" class="btn btn-primary" data-action="exportBrief">导出明细 CSV</button>
      `)}
      ${filterBar()}
      <article class="brief-sheet">
        <div class="brief-cover">
          <div><span class="eyebrow">安全生产责任保险</span><h2>监管运行简报</h2><p>${Reports.escapeHtml(Reports.filterLabel(state.db, state.filters))}</p></div>
          <div class="brief-number">数据日期<br><strong>${state.db.meta.businessDate}</strong><br>数据场景：${Reports.escapeHtml(state.db.meta.scenarioName)}</div>
        </div>
        <div style="margin-top:18px">${kpiCards(brief.cards)}</div>
        <div class="brief-narratives">${brief.narratives.map(item => `<p>${Reports.escapeHtml(item)}</p>`).join("")}</div>
        <div class="report-grid">
          ${reportCard("地区参保覆盖率", Reports.renderChart({ type: "bar", data: brief.regionCoverage, suffix: "%", decimals: 1, drill: "regionCoverage" }))}
          ${reportCard("月度投保与承保趋势", Reports.renderChart({ type: "line", data: brief.trend, series: [{ key: "applications", label: "投保申请" }, { key: "policies", label: "承保出单" }], drill: "applications" }))}
          ${reportCard("隐患等级分布", Reports.renderChart({ type: "donut", data: brief.hazardStatus.map(item => ({ label: item.label, value: item.value })), drill: "hazards" }))}
          ${reportCard("服务机构质量排名", Reports.renderChart({ type: "ranking", data: brief.providerRanking.map(item => ({ id: item.id, label: item.label, value: item.score, meta: `完成率 ${Reports.percent(item.completionRate)}` })), suffix: "分", drill: "provider" }))}
        </div>
        <div class="brief-signature">安责险信息管理平台自动汇总 · 指标均可下钻至业务明细</div>
      </article>
    `;
  }

  function renderInsurerDashboard(account) {
    const applications = state.db.applications.filter(item => item.insurerId === account.orgId);
    const policies = state.db.policies.filter(item => item.insurerId === account.orgId);
    const policyIds = new Set(policies.map(item => item.id));
    const tasks = state.db.serviceTasks.filter(item => item.insurerId === account.orgId);
    const claims = state.db.claims.filter(item => policyIds.has(item.policyId));
    const cards = [
      { label: "待核保申请", value: Reports.number(applications.filter(item => item.status === "核保中").length), drill: "applications" },
      { label: "有效保单", value: Reports.number(policies.filter(item => item.status === "生效中").length), drill: "policies" },
      { label: "有效保费", value: Reports.money(policies.filter(item => item.status === "生效中").reduce((sum, item) => sum + item.premium, 0)), drill: "policies" },
      { label: "在途理赔", value: Reports.number(claims.filter(item => item.status !== "已结案").length), drill: "openClaims" },
    ];
    const report = Reports.topicReport(state.db, "insurance", { period: "year", insurerId: account.orgId });
    return `
      ${pageHeading("保险工作台", "集中处理投保、保单、事故预防服务和理赔事项")}
      ${kpiCards(cards, true)}
      <div class="report-grid">
        ${reportCard("投保转化漏斗", Reports.renderChart(report.charts[0]), "从提交申请到承保出单")}
        ${reportCard("月度投保与承保趋势", Reports.renderChart(report.charts[1]), "本机构最近 12 个月")}
      </div>
      <section class="card" style="margin-top:14px">
        <div class="card-head"><div><h3>当前待办</h3><p>优先显示待核保、待委托和待推进理赔事项</p></div></div>
        ${renderTable([
          { label: "事项", render: row => Reports.escapeHtml(row.type) },
          { label: "业务编号", render: row => `<span class="table-primary">${Reports.escapeHtml(row.id)}</span>` },
          { label: "对象", render: row => Reports.escapeHtml(row.enterprise) },
          { label: "状态", render: row => statusTag(row.status) },
        ], [
          ...applications.filter(item => item.status === "核保中").slice(0, 4).map(item => ({ type: "投保核保", id: item.id, enterprise: label("enterprises", item.enterpriseId), status: item.status })),
          ...tasks.filter(item => item.status === "待接单").slice(0, 3).map(item => ({ type: "服务委托", id: item.id, enterprise: label("enterprises", item.enterpriseId), status: item.status })),
          ...claims.filter(item => item.status !== "已结案").slice(0, 3).map(item => ({ type: "理赔处理", id: item.id, enterprise: label("enterprises", item.enterpriseId), status: item.status })),
        ])}
      </section>
    `;
  }

  function renderInsurerApplications(account) {
    const rows = state.db.applications
      .filter(item => item.insurerId === account.orgId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    return `
      ${pageHeading("投保核保", "核验企业资料并作出补正、承保或拒保决定")}
      <section class="card">
        <div class="card-head"><div><h3>投保申请</h3><p>本机构共 ${rows.length} 笔申请</p></div></div>
        ${renderTable([
          { label: "申请编号", render: row => `<span class="table-primary">${Reports.escapeHtml(row.id)}</span><span class="table-secondary">${Reports.escapeHtml(row.createdAt)}</span>` },
          { label: "企业", render: row => Reports.escapeHtml(label("enterprises", row.enterpriseId)) },
          { label: "产品", render: row => Reports.escapeHtml(label("products", row.productId)) },
          { label: "人数", render: row => Reports.number(row.insuredCount) },
          { label: "保费", render: row => Reports.money(row.premium, false) },
          { label: "状态", render: row => statusTag(row.status) },
          { label: "操作", render: row => row.status === "核保中" ? `
            <div class="btn-row">
              <button type="button" class="btn btn-primary btn-quiet" data-workflow="approveApplication" data-id="${row.id}">核保通过</button>
              <button type="button" class="btn btn-quiet" data-workflow="requestCorrection" data-id="${row.id}">要求补正</button>
              <button type="button" class="btn btn-danger btn-quiet" data-workflow="rejectApplication" data-id="${row.id}">拒保</button>
            </div>
          ` : "-" },
        ], rows)}
      </section>
    `;
  }

  function renderInsurerPolicies(account) {
    const rows = state.db.policies
      .filter(item => item.insurerId === account.orgId)
      .sort((left, right) => right.startDate.localeCompare(left.startDate));
    return `
      ${pageHeading("保单与事故预防服务", "查看有效保单并创建事故预防服务委托")}
      <section class="card">
        <div class="card-head"><div><h3>保单清单</h3><p>服务委托会同步到技术服务机构和企业</p></div></div>
        ${renderTable([
          { label: "保单号", render: row => `<span class="table-primary">${Reports.escapeHtml(row.policyNo)}</span><span class="table-secondary">${Reports.escapeHtml(row.startDate)} 至 ${Reports.escapeHtml(row.endDate)}</span>` },
          { label: "企业", render: row => Reports.escapeHtml(label("enterprises", row.enterpriseId)) },
          { label: "产品", render: row => Reports.escapeHtml(label("products", row.productId)) },
          { label: "保费", render: row => Reports.money(row.premium, false) },
          { label: "保额", render: row => Reports.money(row.sumInsured) },
          { label: "状态", render: row => statusTag(row.status) },
          { label: "事故预防服务", render: row => {
            const task = state.db.serviceTasks.find(item => item.policyId === row.id && item.status !== "已归档");
            return task
              ? `${statusTag(task.status)}<span class="table-secondary">${Reports.escapeHtml(label("serviceProviders", task.providerId))}</span>`
              : row.status === "生效中"
                ? `<button type="button" class="btn btn-primary btn-quiet" data-workflow="delegateService" data-id="${row.id}">创建并委托</button>`
                : "-";
          } },
        ], rows)}
      </section>
    `;
  }

  function renderInsurerClaims(account) {
    const rows = state.db.claims
      .filter(item => item.insurerId === account.orgId)
      .sort((left, right) => right.reportedAt.localeCompare(left.reportedAt));
    return `
      ${pageHeading("报案理赔", "受理企业报案并维护查勘、审核、赔付和结案进度")}
      <section class="card">
        ${renderTable([
          { label: "赔案编号", render: row => `<span class="table-primary">${Reports.escapeHtml(row.id)}</span><span class="table-secondary">${Reports.escapeHtml(row.reportedAt)}</span>` },
          { label: "企业", render: row => Reports.escapeHtml(label("enterprises", row.enterpriseId)) },
          { label: "事故类型", render: row => Reports.escapeHtml(row.incidentType) },
          { label: "估损金额", render: row => Reports.money(row.estimatedLoss, false) },
          { label: "赔付金额", render: row => Reports.money(row.paidAmount, false) },
          { label: "状态", render: row => statusTag(row.status) },
          { label: "操作", render: row => row.status !== "已结案" ? `<button type="button" class="btn btn-primary btn-quiet" data-workflow="advanceClaim" data-id="${row.id}">推进下一状态</button>` : "-" },
        ], rows)}
      </section>
    `;
  }

  function serviceContext(account) {
    const tasks = state.db.serviceTasks.filter(item => item.providerId === account.orgId);
    const taskIds = new Set(tasks.map(item => item.id));
    const hazards = state.db.hazards.filter(item => taskIds.has(item.taskId));
    return { tasks, taskIds, hazards };
  }

  function renderServiceDashboard(account) {
    const { tasks, hazards } = serviceContext(account);
    const cards = [
      { label: "服务任务", value: Reports.number(tasks.length), drill: "services" },
      { label: "待执行", value: Reports.number(tasks.filter(item => ["待接单", "执行中"].includes(item.status)).length), drill: "services" },
      { label: "隐患整改率", value: Reports.percent(hazards.length ? hazards.filter(item => item.status === "已销号").length / hazards.length * 100 : 0), drill: "hazards" },
      { label: "超期隐患", value: Reports.number(hazards.filter(item => Reports.overdueHazard(item, state.db.meta.businessDate)).length), drill: "overdueHazards" },
    ];
    const statusData = Object.entries(tasks.reduce((map, item) => ({ ...map, [item.status]: (map[item.status] || 0) + 1 }), {})).map(([labelText, value]) => ({ label: labelText, value }));
    const hazardData = Object.entries(hazards.reduce((map, item) => ({ ...map, [item.level]: (map[item.level] || 0) + 1 }), {})).map(([labelText, value]) => ({ label: labelText, value }));
    return `
      ${pageHeading("技术服务工作台", "掌握服务任务执行、隐患整改、回访和归档时限")}
      ${kpiCards(cards, true)}
      <div class="report-grid">
        ${reportCard("任务状态分布", Reports.renderChart({ type: "donut", data: statusData, drill: "services" }))}
        ${reportCard("隐患等级分布", Reports.renderChart({ type: "donut", data: hazardData, drill: "hazards" }))}
      </div>
      <section class="card" style="margin-top:14px">
        <div class="card-head"><div><h3>近期任务</h3><p>优先显示未归档任务</p></div></div>
        ${renderServiceTaskTable(tasks.filter(item => item.status !== "已归档").slice(0, 10))}
      </section>
    `;
  }

  function taskAction(task) {
    if (task.status === "待接单") return `<button type="button" class="btn btn-primary btn-quiet" data-workflow="acceptTask" data-id="${task.id}">接单并派专家</button>`;
    if (task.status === "执行中") return `<button type="button" class="btn btn-primary btn-quiet" data-workflow="recordHazard" data-id="${task.id}">提交现场结果</button>`;
    if (task.status === "待回访") return `<button type="button" class="btn btn-primary btn-quiet" data-workflow="completeFollowUp" data-id="${task.id}">完成回访</button>`;
    if (task.status === "待归档") return `<button type="button" class="btn btn-primary btn-quiet" data-workflow="archiveTask" data-id="${task.id}">归档</button>`;
    return "-";
  }

  function renderServiceTaskTable(tasks) {
    return renderTable([
      { label: "任务编号", render: row => `<span class="table-primary">${Reports.escapeHtml(row.id)}</span><span class="table-secondary">${Reports.escapeHtml(row.serviceType)}</span>` },
      { label: "企业", render: row => Reports.escapeHtml(label("enterprises", row.enterpriseId)) },
      { label: "专家", render: row => Reports.escapeHtml(row.expertName) },
      { label: "计划日期", render: row => Reports.escapeHtml(row.plannedDate) },
      { label: "完成期限", render: row => Reports.escapeHtml(row.dueDate) },
      { label: "状态", render: row => statusTag(row.status) },
      { label: "操作", render: taskAction },
    ], tasks);
  }

  function renderServiceTasks(account) {
    const { tasks } = serviceContext(account);
    return `
      ${pageHeading("服务任务", "接受保险机构委托、安排专家并提交现场服务结果")}
      <section class="card">${renderServiceTaskTable(tasks.sort((left, right) => right.plannedDate.localeCompare(left.plannedDate)))}</section>
    `;
  }

  function renderServiceHazards(account) {
    const { hazards } = serviceContext(account);
    return `
      ${pageHeading("隐患与复查", "查看企业整改证据并执行复查销号")}
      <section class="card">
        ${renderTable([
          { label: "隐患编号", render: row => `<span class="table-primary">${Reports.escapeHtml(row.id)}</span><span class="table-secondary">${Reports.escapeHtml(row.type)}</span>` },
          { label: "企业", render: row => Reports.escapeHtml(label("enterprises", row.enterpriseId)) },
          { label: "等级", render: row => statusTag(row.level) },
          { label: "隐患描述", render: row => Reports.escapeHtml(row.description) },
          { label: "整改期限", render: row => Reports.escapeHtml(row.deadline) },
          { label: "证据", render: row => `${row.evidenceCount} 份` },
          { label: "状态", render: row => statusTag(row.status) },
          { label: "操作", render: row => row.status === "待复查" ? `<button type="button" class="btn btn-primary btn-quiet" data-workflow="reviewRectification" data-id="${row.id}">复查通过</button>` : "-" },
        ], hazards.sort((left, right) => right.discoveredAt.localeCompare(left.discoveredAt)))}
      </section>
    `;
  }

  function renderServiceArchive(account) {
    const { tasks } = serviceContext(account);
    return `
      ${pageHeading("回访与归档", "完成企业回访并归集服务方案、现场记录、整改和复查资料")}
      <section class="card">
        ${renderTable([
          { label: "任务编号", render: row => `<span class="table-primary">${Reports.escapeHtml(row.id)}</span><span class="table-secondary">${Reports.escapeHtml(row.serviceType)}</span>` },
          { label: "企业", render: row => Reports.escapeHtml(label("enterprises", row.enterpriseId)) },
          { label: "服务完成", render: row => Reports.escapeHtml(row.completedAt || "-") },
          { label: "回访日期", render: row => Reports.escapeHtml(row.followUpAt || "-") },
          { label: "档案完整度", render: row => {
            const archive = state.db.archives.find(item => item.taskId === row.id);
            return archive ? `${archive.completeness}%` : "-";
          } },
          { label: "状态", render: row => statusTag(row.status) },
          { label: "操作", render: taskAction },
        ], tasks.filter(item => ["待回访", "待归档", "已归档"].includes(item.status)).sort((left, right) => right.plannedDate.localeCompare(left.plannedDate)))}
      </section>
    `;
  }

  function enterpriseContext(account) {
    const enterprise = entity("enterprises", account.orgId);
    const applications = state.db.applications.filter(item => item.enterpriseId === enterprise.id);
    const policies = state.db.policies.filter(item => item.enterpriseId === enterprise.id);
    const policyIds = new Set(policies.map(item => item.id));
    const tasks = state.db.serviceTasks.filter(item => item.enterpriseId === enterprise.id);
    const taskIds = new Set(tasks.map(item => item.id));
    const hazards = state.db.hazards.filter(item => item.enterpriseId === enterprise.id && taskIds.has(item.taskId));
    const claims = state.db.claims.filter(item => item.enterpriseId === enterprise.id && policyIds.has(item.policyId));
    return { enterprise, applications, policies, tasks, hazards, claims };
  }

  function renderEnterpriseDashboard(account) {
    const ctx = enterpriseContext(account);
    const activePolicies = ctx.policies.filter(item => item.status === "生效中");
    return `
      ${pageHeading("企业首页", "查看企业保障状态、服务计划、隐患整改和理赔事项")}
      <section class="identity-card">
        <span class="identity-logo">${Reports.escapeHtml(ctx.enterprise.name.slice(0, 1))}</span>
        <div class="identity-copy"><h2>${Reports.escapeHtml(ctx.enterprise.name)}</h2><p>${Reports.escapeHtml(label("industries", ctx.enterprise.industryId))} · ${Reports.escapeHtml(label("regions", ctx.enterprise.regionId))} · 风险等级 ${Reports.escapeHtml(ctx.enterprise.riskLevel)}</p></div>
        <div class="identity-meta"><span>统一信用代码<br><strong>${Reports.escapeHtml(ctx.enterprise.creditCode)}</strong></span><span>从业人员<br><strong>${ctx.enterprise.employees} 人</strong></span><span>联系人<br><strong>${Reports.escapeHtml(ctx.enterprise.contact)}</strong></span><span>当前保障<br><strong>${activePolicies.length ? "已参保" : "待投保"}</strong></span></div>
      </section>
      <div class="quick-actions">
        <button type="button" class="quick-action" data-nav="/enterprise/market"><strong>选择保险产品</strong><span>比较方案并提交投保</span></button>
        <button type="button" class="quick-action" data-nav="/enterprise/policies"><strong>查看保单与服务</strong><span>${activePolicies.length} 张有效保单</span></button>
        <button type="button" class="quick-action" data-nav="/enterprise/hazards"><strong>处理隐患整改</strong><span>${ctx.hazards.filter(item => item.status === "待整改").length} 项待整改</span></button>
        <button type="button" class="quick-action" data-nav="/enterprise/claims"><strong>报案与理赔</strong><span>${ctx.claims.filter(item => item.status !== "已结案").length} 起在途案件</span></button>
      </div>
      <div class="content-grid two">
        ${reportCard("保障概览", `
          <div class="summary-list">
            <div class="summary-row"><span>有效保单</span><strong>${activePolicies.length} 张</strong></div>
            <div class="summary-row"><span>总保额</span><strong>${Reports.money(activePolicies.reduce((sum, item) => sum + item.sumInsured, 0))}</strong></div>
            <div class="summary-row"><span>事故预防任务</span><strong>${ctx.tasks.length} 项</strong></div>
            <div class="summary-row"><span>隐患整改率</span><strong>${Reports.percent(ctx.hazards.length ? ctx.hazards.filter(item => item.status === "已销号").length / ctx.hazards.length * 100 : 0)}</strong></div>
          </div>
        `)}
        ${reportCard("最新业务进度", `
          <div class="timeline">
            ${[
              ...ctx.applications.slice(0, 2).map(item => ({ title: `投保申请 ${item.status}`, note: item.id, date: item.updatedAt })),
              ...ctx.tasks.slice(0, 2).map(item => ({ title: `服务任务 ${item.status}`, note: item.id, date: item.plannedDate })),
              ...ctx.claims.slice(0, 2).map(item => ({ title: `理赔 ${item.status}`, note: item.id, date: item.updatedAt })),
            ].sort((left, right) => right.date.localeCompare(left.date)).slice(0, 5).map(item => `<div class="timeline-item"><span class="timeline-dot"></span><span class="timeline-copy"><strong>${Reports.escapeHtml(item.title)}</strong><span>${Reports.escapeHtml(item.note)}</span></span><time>${Reports.escapeHtml(item.date)}</time></div>`).join("") || emptyState("暂无业务进度", "可从产品市场发起投保。")}
          </div>
        `)}
      </div>
    `;
  }

  function renderEnterpriseMarket() {
    return `
      ${pageHeading("保险产品市场", "自主比较保险机构、保障额度和事故预防服务内容")}
      <div class="filter-bar">
        <div class="field"><label>承保机构</label><select data-market-filter="insurerId"><option value="">全部保险机构</option>${state.db.insurers.map(item => `<option value="${item.id}"${state.marketFilters.insurerId === item.id ? " selected" : ""}>${Reports.escapeHtml(item.shortName)}</option>`).join("")}</select></div>
        <div class="field"><label>服务等级</label><select data-market-filter="serviceLevel"><option value="">全部类型</option>${["基础", "标准", "全面", "增强", "行业", "专项"].map(item => `<option value="${item}"${state.marketFilters.serviceLevel === item ? " selected" : ""}>${item}</option>`).join("")}</select></div>
        <button type="button" class="btn btn-quiet" data-action="clearMarketFilters">清除筛选</button>
        <span class="filter-summary">共 ${filteredProducts().length} 个方案，点击即可提交当前企业投保申请</span>
      </div>
      <div class="product-grid">${filteredProducts().length ? productCards(false) : emptyState("没有匹配的保险产品", "请调整承保机构或服务等级。")}</div>
    `;
  }

  function renderEnterprisePolicies(account) {
    const ctx = enterpriseContext(account);
    return `
      ${pageHeading("保单与服务", "跟踪投保申请、有效保单和事故预防服务计划")}
      <section class="card">
        <div class="card-head"><div><h3>投保申请</h3></div></div>
        ${renderTable([
          { label: "申请编号", render: row => Reports.escapeHtml(row.id) },
          { label: "保险机构", render: row => Reports.escapeHtml(label("insurers", row.insurerId)) },
          { label: "产品", render: row => Reports.escapeHtml(label("products", row.productId)) },
          { label: "申请日期", render: row => Reports.escapeHtml(row.createdAt) },
          { label: "保费", render: row => Reports.money(row.premium, false) },
          { label: "状态", render: row => statusTag(row.status) },
        ], ctx.applications.sort((left, right) => right.createdAt.localeCompare(left.createdAt)), "尚未提交投保申请")}
      </section>
      <section class="card">
        <div class="card-head"><div><h3>保单与服务计划</h3></div></div>
        ${renderTable([
          { label: "保单号", render: row => Reports.escapeHtml(row.policyNo) },
          { label: "保险机构", render: row => Reports.escapeHtml(label("insurers", row.insurerId)) },
          { label: "保险期间", render: row => `${Reports.escapeHtml(row.startDate)} 至 ${Reports.escapeHtml(row.endDate)}` },
          { label: "保障额度", render: row => Reports.money(row.sumInsured) },
          { label: "保单状态", render: row => statusTag(row.status) },
          { label: "服务计划", render: row => {
            const task = ctx.tasks.find(item => item.policyId === row.id);
            return task ? `${Reports.escapeHtml(task.serviceType)} ${statusTag(task.status)}` : "待保险机构安排";
          } },
        ], ctx.policies, "尚无保单")}
      </section>
    `;
  }

  function renderEnterpriseHazards(account) {
    const ctx = enterpriseContext(account);
    return `
      ${pageHeading("隐患整改", "按整改期限处理隐患并提交说明和模拟证据")}
      <section class="card">
        ${renderTable([
          { label: "隐患编号", render: row => `<span class="table-primary">${Reports.escapeHtml(row.id)}</span><span class="table-secondary">${Reports.escapeHtml(row.type)}</span>` },
          { label: "等级", render: row => statusTag(row.level) },
          { label: "隐患描述", render: row => Reports.escapeHtml(row.description) },
          { label: "整改期限", render: row => Reports.escapeHtml(row.deadline) },
          { label: "证据", render: row => `${row.evidenceCount} 份` },
          { label: "状态", render: row => statusTag(row.status) },
          { label: "操作", render: row => row.status === "待整改" ? `<button type="button" class="btn btn-primary btn-quiet" data-workflow="submitRectification" data-id="${row.id}">提交整改证据</button>` : "-" },
        ], ctx.hazards.sort((left, right) => right.discoveredAt.localeCompare(left.discoveredAt)), "暂无隐患整改事项")}
      </section>
    `;
  }

  function renderEnterpriseClaims(account) {
    const ctx = enterpriseContext(account);
    const activePolicy = ctx.policies.find(item => item.status === "生效中");
    return `
      ${pageHeading("报案理赔", "使用有效保单提交事故报案并查看理赔时间线", activePolicy ? `<button type="button" class="btn btn-primary" data-workflow="reportClaim" data-id="${activePolicy.id}">使用 ${Reports.escapeHtml(activePolicy.policyNo)} 报案</button>` : "")}
      <section class="card">
        ${renderTable([
          { label: "赔案编号", render: row => Reports.escapeHtml(row.id) },
          { label: "事故类型", render: row => Reports.escapeHtml(row.incidentType) },
          { label: "报案日期", render: row => Reports.escapeHtml(row.reportedAt) },
          { label: "估损金额", render: row => Reports.money(row.estimatedLoss, false) },
          { label: "赔付金额", render: row => Reports.money(row.paidAmount, false) },
          { label: "当前状态", render: row => statusTag(row.status) },
          { label: "进度", render: row => `<button type="button" class="btn btn-quiet" data-action="showClaimTimeline" data-id="${row.id}">查看时间线</button>` },
        ], ctx.claims.sort((left, right) => right.reportedAt.localeCompare(left.reportedAt)), "暂无报案记录")}
      </section>
    `;
  }

  function renderDemoControl(account) {
    return workbenchLayout(account, "/demo-control", `
      ${pageHeading("演示设置", `仅恢复${coMode ? "现场巡检" : "保险业务"}存档，不影响另一业务与统一登录身份`)}
      <div class="btn-row">${Object.keys(state.identity.grants).map(key => `<a class="btn btn-quiet" href="#/demo-control?business=${key}">${key === "insurance" ? "保险业务" : "现场巡检"}场景</a>`).join("")}</div>
      <section class="card">
        <div class="card-head"><div><h3>固定演示场景</h3><p>切换场景会覆盖当前操作数据，请在演示前选择</p></div><span class="status info">${Reports.escapeHtml(state.db.meta.scenarioName)}</span></div>
        <div class="demo-control-grid">
          ${Data.SCENARIOS.map(scenario => `
            <article class="scenario-card${state.db.meta.scenarioId === scenario.id ? " active" : ""}">
              <h3>${Reports.escapeHtml(scenario.name)}</h3>
              <p>${Reports.escapeHtml(scenario.description)}</p>
              <button type="button" class="btn ${state.db.meta.scenarioId === scenario.id ? "btn-ghost" : "btn-link"}" data-action="confirmScenario" data-id="${scenario.id}">${state.db.meta.scenarioId === scenario.id ? "当前场景" : "载入场景"}</button>
            </article>
          `).join("")}
        </div>
      </section>
      <div class="content-grid two" style="margin-top:14px">
        <section class="card">
          <div class="card-head"><div><h3>演示环境</h3></div></div>
          <div class="summary-list">
            <div class="summary-row"><span>业务日期</span><strong>${state.db.meta.businessDate}</strong></div>
            <div class="summary-row"><span>数据版本</span><strong>v${state.db.meta.schemaVersion}</strong></div>
            <div class="summary-row"><span>${coMode ? "统筹样本企业" : "重点企业"}</span><strong>${coMode ? state.db.enterprises.length : 12} 家</strong></div>
            <div class="summary-row"><span>${coMode ? "资料边界" : "背景企业"}</span><strong>${coMode ? "仅恢复现场巡检，不影响保险存档" : `${state.db.enterprises.length - 12} 家`}</strong></div>
          </div>
        </section>
        <section class="card">
          <div class="card-head"><div><h3>帮助文档</h3></div></div>
          <div class="summary-list">
            <div class="summary-row"><span>操作手册</span><strong>本机 docs\\demo-script.md（不由预览服务公开）</strong></div>
            <div class="summary-row"><span>演示账号</span><a href="#/login">查看登录页账号</a></div>
            <div class="summary-row"><span>离线启动</span><strong>双击 start-demo.cmd</strong></div>
          </div>
        </section>
      </div>
    `);
  }

  function renderRolePage(account, path, query) {
    if (path === "/demo-control") return renderDemoControl(account);
    const ownPath = path.split("/")[1] === account.role;
    const allowed = menuGroups(state.identity).some(group => group.items.some(item => item.path === path));
    if (!ownPath || !allowed) return workbenchLayout(account, path, emptyState("权限不足", "此身份未获授权访问该业务页面，请返回综合工作台；未映射到其他机构。"));
    if (coMode) return workbenchLayout(account, path, global.CoordinationPages.render(state.db, account, path, query, state.coSnapshot, state.coDrafts));
    const gdContent = ownPath ? global.GuangdongPages.render(state.db, account, path, query, state.monthlySnapshot) : null;
    if (gdContent !== null) return workbenchLayout(account, path, `<div class="gd-page">${gdContent}<div class="gd-footnote">广东安责险 · 演示资料 / 模拟对接 · 未连接官方平台</div></div>`);
    if (account.role === "regulator") {
      if (path === "/regulator/dashboard") return workbenchLayout(account, path, renderRegulatorDashboard());
      if (path === "/regulator/analytics") return workbenchLayout(account, path, renderRegulatorAnalytics(query));
      if (path === "/regulator/alerts") return workbenchLayout(account, path, renderRegulatorAlerts());
      if (path === "/regulator/assessments") return workbenchLayout(account, path, renderRegulatorAssessments());
      if (path === "/regulator/brief") return workbenchLayout(account, path, renderRegulatorBrief());
    }
    if (account.role === "insurer") {
      if (path === "/insurer/dashboard") return workbenchLayout(account, path, renderInsurerDashboard(account));
      if (path === "/insurer/applications") return workbenchLayout(account, path, renderInsurerApplications(account));
      if (path === "/insurer/policies") return workbenchLayout(account, path, renderInsurerPolicies(account));
      if (path === "/insurer/claims") return workbenchLayout(account, path, renderInsurerClaims(account));
    }
    if (account.role === "service") {
      if (path === "/service/dashboard") return workbenchLayout(account, path, renderServiceDashboard(account));
      if (path === "/service/tasks") return workbenchLayout(account, path, renderServiceTasks(account));
      if (path === "/service/hazards") return workbenchLayout(account, path, renderServiceHazards(account));
      if (path === "/service/archive") return workbenchLayout(account, path, renderServiceArchive(account));
    }
    if (account.role === "enterprise") {
      if (path === "/enterprise/dashboard") return workbenchLayout(account, path, renderEnterpriseDashboard(account));
      if (path === "/enterprise/market") return workbenchLayout(account, path, renderEnterpriseMarket());
      if (path === "/enterprise/policies") return workbenchLayout(account, path, renderEnterprisePolicies(account));
      if (path === "/enterprise/hazards") return workbenchLayout(account, path, renderEnterpriseHazards(account));
      if (path === "/enterprise/claims") return workbenchLayout(account, path, renderEnterpriseClaims(account));
    }
    return workbenchLayout(account, path, `${pageHeading("无权访问", "当前账号不能访问该页面")}<section class="card">${emptyState("权限不足", "请返回本角色首页。")}<div class="btn-row"><button type="button" class="btn btn-primary" data-nav="${ROLE_HOME[account.role]}">返回工作台</button></div></section>`);
  }

  function render() {
    const root = document.getElementById("app");
    const { path, query } = route();
    state.renderedHash = `${path}${query.size ? `?${query}` : ""}`;
    const renderKey = `${state.identity?.id || ""}:${path}?${query}`;
    if (state.renderedRoute !== renderKey) {
      document.body.classList.remove("co-report-printing");
      document.getElementById("coReportPrint")?.remove();
      closeDrawer();
      closeModal();
      clearGuideTarget();
      state.renderedRoute = renderKey;
    }
    activateContext(path, query);
    const account = currentAccount();
    document.body.classList.toggle("presentation", state.presentation);
    document.body.classList.toggle("co-mode", coMode);

    if (path === "/portal") root.innerHTML = renderPortal();
    else if (path === "/market") root.innerHTML = coMode ? renderPortal() : renderPublicMarket();
    else if (path === "/login") root.innerHTML = renderLogin();
    else if (!state.identity) {
      state.pendingLoginPath = `${path}${query.size ? `?${query}` : ""}`;
      global.location.hash = "/login";
      return;
    } else if (path === ROLE_HOME[state.identity.role]) {
      root.innerHTML = renderUnifiedHome();
    } else if (!account) {
      root.innerHTML = workbenchLayout(state.identity, path, emptyState("权限不足", "此身份在该业务没有明确授权；未使用同名或同号实体自动匹配。请返回综合工作台。"));
    } else {
      const rolePrefix = path.split("/")[1];
      if (path !== "/demo-control" && rolePrefix && rolePrefix !== account.role) {
        root.innerHTML = renderRolePage(account, path, query);
      } else {
        root.innerHTML = renderRolePage(account, path, query);
      }
    }
    const publicTitles = {
      "/portal": "安责险信息管理平台",
      "/market": "保险产品市场 - 安责险信息管理平台",
      "/login": "登录 - 安责险信息管理平台",
    };
    document.title = publicTitles[path] || `${path.endsWith("/home") ? "综合工作台" : coMode ? global.CoordinationPages.title(path) : PAGE_TITLES[path]?.[0] || "业务工作台"} - 安责险信息管理平台`;
    renderGuide();
    prepareResponsiveContent();
  }

  function showToast(message, error = false) {
    const root = document.getElementById("toastRoot");
    const toast = document.createElement("div");
    toast.className = `toast${error ? " error" : ""}`;
    toast.textContent = message;
    root.appendChild(toast);
    global.setTimeout(() => toast.remove(), 3600);
  }

  function closeDrawer() {
    state.currentDetail = null;
    document.getElementById("drawerRoot").innerHTML = "";
    applyUtilityLayout();
    dialogReturnFocus?.focus({ preventScroll: true });
  }

  function openDrawer(detailData, contextText) {
    dialogReturnFocus = document.activeElement;
    state.currentDetail = detailData;
    document.getElementById("drawerRoot").innerHTML = `
      <div class="drawer-backdrop" data-action="closeDrawer"></div>
      <aside class="drawer" aria-modal="true" role="dialog">
        <div class="drawer-head">
          <div><h2>${Reports.escapeHtml(detailData.title)}</h2><p>${Reports.escapeHtml(contextText)}</p></div>
          <button type="button" class="btn btn-icon" data-action="closeDrawer" aria-label="关闭">×</button>
        </div>
        <div class="drawer-body">${Reports.detailTable(detailData)}</div>
        <div class="drawer-footer">
          <button type="button" class="btn btn-quiet" data-action="exportCurrentDetail">导出 CSV</button>
          <button type="button" class="btn btn-primary" data-action="closeDrawer">关闭</button>
        </div>
      </aside>
    `;
    prepareResponsiveContent();
    document.querySelector("#drawerRoot button")?.focus({ preventScroll: true });
    applyUtilityLayout();
  }

  function closeModal() {
    state.pendingScenario = null;
    document.getElementById("modalRoot").innerHTML = "";
    applyUtilityLayout();
    dialogReturnFocus?.focus({ preventScroll: true });
  }

  function openScenarioConfirmation(scenarioId) {
    const scenario = Data.SCENARIOS.find(item => item.id === scenarioId);
    if (!scenario) return;
    state.pendingScenario = scenario.id;
    dialogReturnFocus = document.activeElement;
    document.getElementById("modalRoot").innerHTML = `
      <div class="modal-backdrop" data-action="closeModal">
        <section class="modal" role="dialog" aria-modal="true" aria-labelledby="scenarioTitle">
          <div class="modal-head"><div><h2 id="scenarioTitle">载入“${Reports.escapeHtml(scenario.name)}”</h2><p>当前操作数据将被覆盖</p></div><button type="button" class="btn btn-icon" data-action="closeModal">×</button></div>
          <div class="modal-body"><p>仅${coMode ? "现场巡检" : "保险业务"}中的账号、报表和业务记录恢复为该场景，另一业务存档不变。该操作用于演示准备，不可撤销。</p></div>
          <div class="modal-footer"><button type="button" class="btn" data-action="closeModal">取消</button><button type="button" class="btn btn-danger" data-action="loadScenario">确认载入</button></div>
        </section>
      </div>
    `;
    document.querySelector('#modalRoot [data-action="closeModal"]')?.focus({ preventScroll: true });
    applyUtilityLayout();
  }

  function showNotifications() {
    const account = currentAccount();
    if (!account) return;
    if (state.storageBlocked) { showToast("本业务存档不可读，通知状态未保存。请先处理存档问题。", true); return; }
    const next = Data.clone(state.db);
    const notifications = next.notifications.filter(item => item.role === account.role && (!item.orgId || item.orgId === account.orgId));
    notifications.forEach(item => { item.read = true; });
    try { Data.save(next); }
    catch (error) { showToast(`通知未保存：${error.message}`, true); return; }
    state.db = next;
    const detailData = {
      title: "通知中心",
      columns: [["createdAt", "时间"], ["title", "通知"], ["detail", "内容"]],
      rows: notifications.map(item => ({ createdAt: item.createdAt, title: item.title, detail: item.detail })),
    };
    openDrawer(detailData, `${ROLE_LABELS[account.role]} · ${notifications.length} 条通知`);
    render();
  }

  function showClaimTimeline(claimId) {
    const claim = entity("claims", claimId);
    if (!claim) return;
    const progress = state.db.claimProgress
      .filter(item => item.claimId === claim.id)
      .sort((left, right) => left.at.localeCompare(right.at));
    const detailData = {
      title: `理赔时间线 ${claim.id}`,
      columns: [["at", "日期"], ["status", "状态"], ["note", "说明"]],
      rows: progress,
    };
    openDrawer(detailData, `${label("enterprises", claim.enterpriseId)} · ${claim.incidentType}`);
  }

  function openDrill(type, key = "") {
    if (!type) return;
    const detailData = Reports.detail(state.db, type, key, state.filters);
    openDrawer(detailData, Reports.filterLabel(state.db, state.filters));
  }

  function downloadCsv(detailData, filename) {
    const blob = new Blob([Reports.toCsv(detailData)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function executeWorkflow(name, id) {
    if (coMode) { showToast("保险业务动作不能在现场巡检上下文执行。", true); return; }
    if (state.storageBlocked) { showToast("已存资料不兼容，请先在演示设置确认重置。", true); return; }
    const account = currentAccount();
    if (!account || typeof Workflows[name] !== "function") {
      showToast("当前操作不可用。", true);
      return;
    }
    let result;
    const next = Data.clone(state.db);
    next.meta.eventSequence++;
    try { result = Workflows[name](next, account.id, id); }
    catch (error) { showToast(`操作未保存：${error.message}`, true); return; }
    if (result.ok) state.db = next;
    showToast(result.message, !result.ok);
    if (result.ok) render();
  }

  function handleClick(event) {
    if (document.querySelector(".guide-target-highlight") && !event.target.closest(".guide-target-tip, [data-guide-nav]")) clearGuideTarget();
    const anchor = event.target.closest('a[href^="#"]');
    if (anchor && !discardCoDraft()) { event.preventDefault(); return; }
    const target = event.target.closest("[data-action], [data-nav], [data-guide-nav], [data-account], [data-workflow], [data-drill], [data-gd], [data-co], [data-form-section]");
    if (!target) {
      if (state.userMenuOpen && !event.target.closest(".user-menu")) {
        state.userMenuOpen = false;
        document.querySelector(".user-menu .dropdown").hidden = true;
        document.querySelector(".user-trigger").setAttribute("aria-expanded", "false");
      }
      return;
    }

    if (target.dataset.guideNav) {
      if (!discardCoDraft()) return;
      clearGuideTarget();
      const nextPath = target.dataset.guideNav;
      const nextAccount = Platform.identityFor(target.dataset.guideAccount)?.id;
      const guideTarget = target.dataset.guideTarget;
      if (nextAccount && state.identity?.id !== nextAccount) {
        try { saveSessionAccount(null); }
        catch (error) { showToast(`账号切换未完成：${error.message}`, true); return; }
        state.pendingGuideJump = { path: nextPath, target: guideTarget };
        state.selectedAccountId = nextAccount;
        state.accountId = null;
        state.identity = null;
        state.guideOpen = false;
        state.guideTargetSelector = null;
        navigate("/login");
        return;
      }
      state.guideTargetSelector = guideTarget || null;
      if (global.location.hash.replace(/^#/, "") === nextPath) render();
      else navigate(nextPath);
      return;
    }

    if (target.dataset.nav) {
      navigate(target.dataset.nav);
      return;
    }
    if (target.dataset.formSection !== undefined) {
      const section = document.getElementById(`report-section-${target.dataset.formSection}`);
      section?.scrollIntoView({ block: "start" });
      section?.querySelector("input, select, textarea")?.focus({ preventScroll: true });
      return;
    }
    if (target.dataset.account) {
      state.selectedAccountId = Platform.identityFor(target.dataset.account)?.id;
      render();
      return;
    }
    if (target.dataset.workflow) {
      executeWorkflow(target.dataset.workflow, target.dataset.id);
      return;
    }
    if (target.dataset.drill) {
      openDrill(target.dataset.drill, target.dataset.key || "");
      return;
    }
    if (target.dataset.co) {
      const account = currentAccount();
      if (!coMode || !account) { showToast("请从授权的现场巡检页面操作。", true); return; }
      if (state.storageBlocked) { showToast("请先在演示设置确认重置不兼容的统筹资料", true); return; }
      const action = target.dataset.co;
      if (["sampleReport", "previewReport", "printReport"].includes(action)) {
        const c = global.Coordination, pages = global.CoordinationPages;
        const report = state.db.co.reports.find(x => x.id === target.dataset.id);
        const task = state.db.co.tasks.find(x => x.id === (report?.taskId || target.dataset.id));
        if (!task || !c.taskVisible(state.db, account, task)) { showToast("无权查看此任务报告", true); return; }
        if (action === "sampleReport") {
          if (account.role !== "service" || !["执行中", "退回补充"].includes(task.status)) { showToast("当前不能填报", true); return; }
          const previous = state.coDrafts[task.id];
          state.coDrafts[task.id] = {
            reportSchemaVersion: task.templateId === "TPL-INSPECT-1" ? 3 : 2,
            meta: c.sampleReport(state.db, task),
            answers: (task.templateId === "TPL-INSPECT-1" ? c.sampleInspectionAnswers() : c.sampleDetailedAnswers()).map(x => ({ ...x, ...previous?.answers?.find(a => a.id === x.id), id: x.id })),
          };
          persistCoDraft(task.id, state.coDrafts[task.id]); render(); return;
        }
        if (action === "previewReport") {
          dialogReturnFocus = document.activeElement;
          const form = target.closest("form");
          const input = readCoReport(form);
          state.coDrafts[task.id] = input;
          persistCoDraft(task.id, input);
          const html = pages.reportDocument(state.db, task, { ...input, id: "未提交草稿", version: "草稿", status: "未校验／未提交", source: "现场预览", templateId: task.templateId, templateSnapshot: Data.clone(state.db.co.templates.find(x => x.id === task.templateId)), submittedAt: "未提交", submittedBy: account.id }, false);
          document.getElementById("modalRoot").innerHTML = `<div class="modal-backdrop"><section class="modal co-preview-modal" role="dialog" aria-modal="true" aria-label="巡检报告预览"><header class="modal-head"><h2>报告草稿预览</h2><button class="btn" data-action="closeModal">关闭</button></header><div class="modal-body">${html}</div></section></div>`;
          document.querySelector("#modalRoot button")?.focus({ preventScroll: true });
          applyUtilityLayout();
        } else if (report) {
          let root = document.getElementById("coReportPrint");
          if (!root) { root = document.createElement("section"); root.id = "coReportPrint"; document.body.appendChild(root); }
          root.innerHTML = `<div class="no-print co-print-toolbar"><button class="btn" data-co="closeReportPrint">返回任务</button><button class="btn btn-primary" data-co="executeReportPrint">打印／保存 PDF</button></div>${pages.reportDocument(state.db, task, report)}`;
          root.querySelectorAll("details").forEach(el => { el.open = true; });
          document.body.classList.add("co-report-printing");
          scrollTo(0, 0);
        }
        return;
      }
      if (action === "closeReportPrint") { document.body.classList.remove("co-report-printing"); document.getElementById("coReportPrint")?.remove(); return; }
      if (action === "executeReportPrint") { if (document.body.classList.contains("co-report-printing")) global.print(); return; }
      if (["snapshot", "export", "print"].includes(action)) {
        if (account.role !== "regulator") { showToast("仅示例监管验收人可生成成果", true); return; }
        if (action === "snapshot") { state.coSnapshot = global.CoordinationPages.outcomeData(state.db, account); render(); }
        else if (!state.coSnapshot) showToast("请先生成成果快照", true);
        else if (action === "export") downloadCsv(state.coSnapshot, `标书外统筹成果-合成-${state.db.meta.businessDate}.csv`);
        else global.print();
        return;
      }
      const form = target.closest("form");
      let payload = {};
      if (action === "dispatch" && form) payload = Object.fromEntries(new FormData(form));
      if (action === "classify" && form) payload = Object.fromEntries(new FormData(form));
      if (action === "assessRegion" && form) payload = Object.fromEntries(new FormData(form));
      if (action === "submitReport" && form) {
        payload = readCoReport(form);
        state.coDrafts[target.dataset.id] = payload;
        persistCoDraft(target.dataset.id, payload);
      }
      if (["rectify", "failReview", "passReview"].includes(action) && form) {
        payload = Object.fromEntries(new FormData(form)); payload.evidence = new FormData(form).has("evidence");
      }
      const result = global.Coordination.run(state.db, account.id, action, target.dataset.id, payload);
      showToast(result.message, !result.ok || result.warning);
      if (result.ok) {
        state.formDirty = false;
        if (action === "submitReport") {
          delete state.coDrafts[target.dataset.id];
          persistCoDraft(target.dataset.id, null);
          state.coDirty = false;
        }
        if (result.navigateTo) global.location.hash = result.navigateTo;
        render();
      }
      return;
    }
    if (target.dataset.gd) {
      if (coMode) { showToast("请从授权的保险业务菜单执行此操作。", true); return; }
      if (state.storageBlocked) { showToast("请先在演示设置确认重置不兼容的本地资料。", true); return; }
      const action = target.dataset.gd;
      if (action === "monthly") {
        state.monthlySnapshot = { sequence: state.db.meta.eventSequence, date: state.db.meta.businessDate, generatedAt: new Date().toLocaleString("zh-CN"), metrics: Reports.gdMetrics(state.db), services: state.db.serviceTasks.length, archived: state.db.serviceTasks.filter(t => t.status === "已归档").length, inspection: state.db.inspections[0].status, coordination: state.db.assignments[0].status };
        render(); return;
      }
      if (action === "exportMonthly") {
        const s = state.monthlySnapshot;
        if (!s) { showToast("请先生成月报", true); return; }
        downloadCsv({ title: "广东示例月报", columns: [["label", "指标"], ["value", "值"]], rows: [{ label: "统计截止日（合成样本）", value: s.date }, ...Object.entries(s.metrics).map(([label, value]) => ({ label, value }))] }, `广东演示月报-${s.date}.csv`);
        return;
      }
      const result = Workflows.gdRun(state.db, currentAccount()?.id, action, target.dataset.id);
      showToast(result.message, !result.ok);
      if (result.ok) render();
      return;
    }

    const action = target.dataset.action;
    if (action === "openFilters") { openFilters(target.nextElementSibling); return; }
    if (action === "clearFilters") {
      document.querySelectorAll("#responsiveFilters select").forEach(select => { select.selectedIndex = 0; });
      return;
    }
    if (action === "fieldHelp") { setUtility("help", "inspection-report"); return; }
    if (action === "showFeatures") { setUtility("features"); return; }
    if (action === "closeUtility") { setUtility(null); return; }
    if (action === "dismissGuideTarget") {
      state.guideTargetSelector = null;
      clearGuideTarget();
      return;
    }
    if (action === "toggleGuide") {
      if (compactLayout.matches || route().ui) {
        setUtility(state.guideOpen ? null : "help");
        return;
      }
      state.guideOpen = !state.guideOpen;
      renderGuide();
      return;
    }
    if (action === "login") {
      const account = Platform.identityFor(state.selectedAccountId);
      const password = document.getElementById("demoPassword")?.value || "";
      if (!account || password !== "demo123") {
        showToast("账号或演示密码不正确。", true);
        return;
      }
      try { saveSessionAccount(account.id); }
      catch (error) { showToast(`登录未保存：${error.message}`, true); return; }
      state.identity = account;
      if (state.pendingGuideJump) {
        const destination = state.pendingGuideJump;
        state.pendingGuideJump = null;
        state.pendingLoginPath = null;
        state.guideTargetSelector = destination.target || null;
        state.guideOpen = true;
        navigate(destination.path);
      } else {
        const destination = state.pendingLoginPath;
        state.pendingLoginPath = null;
        navigate(destination || ROLE_HOME[account.role]);
      }
      return;
    }
    if (action === "logout") {
      if (!discardCoDraft()) return;
      try { saveSessionAccount(null); }
      catch (error) { showToast(`退出未完成：${error.message}`, true); return; }
      state.accountId = null;
      state.identity = null;
      state.coDrafts = {};
      state.coDraftAccount = null;
      state.presentation = false;
      navigate("/login");
      return;
    }
    if (action === "toggleUserMenu") {
      state.userMenuOpen = !state.userMenuOpen;
      target.setAttribute("aria-expanded", String(state.userMenuOpen));
      target.closest(".user-menu").querySelector(".dropdown").hidden = !state.userMenuOpen;
      return;
    }
    if (action === "togglePresentation") {
      state.presentation = !state.presentation;
      document.body.classList.toggle("presentation", state.presentation);
      document.querySelectorAll('[data-action="togglePresentation"]').forEach(button => {
        button.textContent = state.presentation ? "退出投屏" : "驾驶舱投屏";
      });
      if (state.presentation) document.querySelector(".presentation-exit")?.focus({ preventScroll: true });
      else document.querySelector(".user-trigger")?.focus({ preventScroll: true });
      return;
    }
    if (action === "clearFilters") {
      state.filters = { period: "year", regionId: "", industryId: "", insurerId: "", providerId: "" };
      render();
      return;
    }
    if (action === "clearMarketFilters") {
      state.marketFilters = { insurerId: "", serviceLevel: "" };
      render();
      return;
    }
    if (action === "scrollNotices") {
      if (route().path !== "/portal") {
        navigate("/portal");
        global.setTimeout(() => document.getElementById("notices")?.scrollIntoView({ behavior: "smooth" }), 80);
      } else {
        document.getElementById("notices")?.scrollIntoView({ behavior: "smooth" });
      }
      return;
    }
    if (action === "showNotifications") {
      showNotifications();
      return;
    }
    if (action === "showClaimTimeline") {
      showClaimTimeline(target.dataset.id);
      return;
    }
    if (action === "closeDrawer") {
      closeDrawer();
      return;
    }
    if (action === "closeModal") {
      if (event.target.classList.contains("modal-backdrop") && event.target !== event.currentTarget) return;
      closeModal();
      return;
    }
    if (action === "confirmScenario") {
      openScenarioConfirmation(target.dataset.id);
      return;
    }
    if (action === "loadScenario") {
      try { state.db = Data.reset(state.pendingScenario || "gd-baseline"); }
      catch (error) { showToast(`重置未保存：${error.message}`, true); return; }
      state.monthlySnapshot = null;
      state.coSnapshot = null;
      state.coDrafts = {};
      state.coDirty = false;
      state.storageBlocked = false;
      contexts[business].warning = null;
      closeModal();
      showToast(`已载入“${state.db.meta.scenarioName}”。`);
      render();
      return;
    }
    if (action === "exportCurrentDetail" && state.currentDetail) {
      downloadCsv(state.currentDetail, `${state.currentDetail.title}-${state.db.meta.businessDate}.csv`);
      return;
    }
    if (action === "exportTopic") {
      const topic = target.dataset.topic || "coverage";
      const typeMap = { coverage: "coverage", insurance: "applications", prevention: "services", hazards: "hazards", claims: "claims", assessment: "insurer" };
      const detailData = Reports.detail(state.db, typeMap[topic], "", state.filters);
      downloadCsv(detailData, `${detailData.title}-${state.db.meta.businessDate}.csv`);
      return;
    }
    if (action === "exportBrief") {
      const detailData = Reports.detail(state.db, "coverage", "", state.filters);
      downloadCsv(detailData, `监管简报企业参保明细-${state.db.meta.businessDate}.csv`);
      return;
    }
    if (action === "printBrief") {
      global.print();
    }
  }

  function handleChange(event) {
    if (event.target.dataset.coFilter) {
      const { path, query } = route();
      query.set(event.target.dataset.coFilter, event.target.value);
      navigate(`${path}?${query}`);
      return;
    }
    if (event.target.dataset.gdFilter) {
      const { path, query } = route();
      query.set(event.target.dataset.gdFilter, event.target.value);
      navigate(`${path}?${query}`);
      return;
    }

    const filter = event.target.dataset.filter;
    if (filter) {
      state.filters[filter] = event.target.value;
      render();
      return;
    }
    const marketFilter = event.target.dataset.marketFilter;
    if (marketFilter) {
      state.marketFilters[marketFilter] = event.target.value;
      render();
    }
  }

  function readCoAnswers(form) {
    const values = new FormData(form);
    const task = state.db.co.tasks.find(x => x.id === form.dataset.coForm);
    const template = state.db.co.templates.find(x => x.id === task.templateId);
    if (template.id === "TPL-INSPECT-1") return template.items.map(({ id }) => ({
      id,
      result: values.get(`${id}-result`) || "",
      note: values.get(`${id}-note`) || "",
      reason: values.get(`${id}-reason`) || "",
      photoCount: Number(values.get(`${id}-photoCount`) || 0),
    }));
    return template.items.map(({ id }) => ({ id, result: values.get(`${id}-result`), note: values.get(`${id}-note`) || "", reason: values.get(`${id}-reason`) || "", evidence: values.has(`${id}-evidence`), location: values.get(`${id}-location`) || "", risk: values.get(`${id}-risk`) || "", recommendation: values.get(`${id}-recommendation`) || "" }));
  }
  function readCoReport(form) {
    const values = new FormData(form), task = state.db.co.tasks.find(x => x.id === form.dataset.coForm);
    const meta = Object.fromEntries([...Object.keys(global.Coordination.reportFields), "excludedScope", "exclusionReason"].map(key => [key, values.get(`meta-${key}`) || ""]));
    meta.taskId = task.id;
    const answers = readCoAnswers(form);
    return { reportSchemaVersion: task.templateId === "TPL-INSPECT-1" ? 3 : 2, answers, meta, evidence: global.Coordination.evidenceFor(task, answers, meta) };
  }

  function rememberCoDraft(event) {
    const workspace = event.target.closest(".workbench");
    if (!coMode || workspace?.dataset.contextPath !== state.renderedHash || workspace.dataset.contextActor !== state.accountId) return;
    const form = event.target.closest("[data-co-form]");
    if (form) {
      state.coDrafts[form.dataset.coForm] = readCoReport(form);
      persistCoDraft(form.dataset.coForm, state.coDrafts[form.dataset.coForm]);
    } else if (event.target.closest("[data-co-followup], [data-co-classification], [data-co-region-review], [data-co-dispatch]")) state.formDirty = true;
  }
  document.addEventListener("input", rememberCoDraft);
  document.addEventListener("change", rememberCoDraft);
  document.addEventListener("submit", event => {
    if (event.target.matches("[data-co-dispatch], [data-co-form], [data-co-followup]")) event.preventDefault();
  });
  global.addEventListener("beforeunload", event => {
    if (state.coDirty || state.formDirty) { event.preventDefault(); event.returnValue = ""; }
  });
  global.addEventListener("hashchange", () => {
    if (businessHash() === state.renderedHash) { syncUtility(); return; }
    if (!discardCoDraft()) {
      global.history.replaceState(null, "", `#${state.renderedHash}`);
      return;
    }
    document.getElementById("featureDirectory").hidden = true;
    if (compactLayout.matches) state.guideOpen = route().ui === "help";
    utilityReturn = null;
    render();
  });
  compactLayout.addEventListener("change", () => {
    if (compactLayout.matches && state.guideOpen && !route().ui) setUtility("help");
    else applyUtilityLayout();
    syncVisibleArea();
  });
  global.visualViewport?.addEventListener("resize", syncVisibleArea);
  document.addEventListener("focusout", () => global.setTimeout(syncVisibleArea, 0));
  document.addEventListener("focusin", event => {
    if (event.target.matches("input, select, textarea") && event.target.closest("#app")) lastBusinessFocus = event.target;
    syncVisibleArea();
  });
  document.addEventListener("keydown", event => {
    const active = document.querySelector("#modalRoot [role=dialog], #drawerRoot [role=dialog]")
      || (document.body.classList.contains("utility-open")
        ? !document.getElementById("featureDirectory").hidden ? document.getElementById("featureDirectory") : document.getElementById("guidePanel")
        : null);
    if (!active) {
      if (event.key === "Escape" && state.userMenuOpen) {
        state.userMenuOpen = false;
        document.querySelector(".user-menu .dropdown").hidden = true;
        const trigger = document.querySelector(".user-trigger");
        trigger.setAttribute("aria-expanded", "false");
        trigger.focus();
      }
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      if (active.closest("#modalRoot")) closeModal();
      else if (active.closest("#drawerRoot")) closeDrawer();
      else if (route().ui) setUtility(null);
      else { state.guideOpen = false; renderGuide(); }
    } else if (event.key === "Tab") {
      const focusable = [...active.querySelectorAll("a[href], button, input, select, textarea, summary, [tabindex='0']")]
        .filter(element => !element.disabled && element.getClientRects().length && !element.closest("[hidden]"));
      const first = focusable[0], last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      const form = document.querySelector("[data-co-form]");
      if (form) rememberCoDraft({ target: form });
      global.AZXGuideWindow.capture();
    }
  });
  document.addEventListener("click", handleClick);
  document.addEventListener("change", handleChange);
  render();
  if (route().ui) syncUtility();

  if (state.warning) {
    global.setTimeout(() => showToast(state.warning, true), 120);
  }
  if (state.coDraftWarning) {
    global.setTimeout(() => showToast(state.coDraftWarning, true), 160);
  }
  if (session.warning) global.setTimeout(() => showToast(session.warning, true), 180);
})(globalThis);
