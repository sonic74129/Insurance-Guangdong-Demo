(function initPlatform(global) {
  "use strict";
  const SESSION_KEY = "anezx-platform-session-v1";
  const data = Object.freeze({ insurance: global.AZXDemoData, inspection: global.Coordination.data });
  // These are demo login grants, not a match between organizations or enterprises.
  const identities = Object.freeze([
    { id: "ACC-REG-01", username: "regulator", role: "regulator", name: "省级监管员／统筹监管员", grants: { insurance: "ACC-REG-01", inspection: "CO-REG" } },
    { id: "ACC-INS-01", username: "insurer", role: "insurer", name: "保司A业务与履责经理", grants: { insurance: "ACC-INS-01", inspection: "CO-INS-1" } },
    { id: "CO-INS-2", username: "insurer-b", role: "insurer", name: "保司B履责经理", grants: { inspection: "CO-INS-2" } },
    { id: "ACC-SP-01", username: "service", role: "service", name: "服务项目经理／巡检机构甲项目经理", grants: { insurance: "ACC-SP-01", inspection: "CO-SP-1" } },
    { id: "CO-SP-2", username: "service-b", role: "service", name: "巡检机构乙项目经理", grants: { inspection: "CO-SP-2" } },
    { id: "ACC-ENT-01", username: "enterprise", role: "enterprise", name: "企业安全管理员／企业甲安全员", grants: { insurance: "ACC-ENT-01", inspection: "CO-ENT" } },
    { id: "CO-ENT-2", username: "enterprise-2", role: "enterprise", name: "企业乙安全员", grants: { inspection: "CO-ENT-2" } },
    { id: "CO-ENT-3", username: "enterprise-3", role: "enterprise", name: "企业丙安全员", grants: { inspection: "CO-ENT-3" } },
    { id: "ACC-CITY-01", username: "city", role: "regulator", name: "广州市监管员", grants: { insurance: "ACC-CITY-01" } },
  ].map(identity => Object.freeze({ ...identity, grants: Object.freeze(identity.grants) })));
  const insurancePages = {
    regulator: [
      ["dashboard", "监管驾驶舱", "监管概览"],
      ["enterprises", "应保企业底数", "企业与保险数据"],
      ["connections", "保司数据接入", "企业与保险数据"],
      ["quality", "数据质量治理", "企业与保险数据"],
      ["reporting", "全国报送台账", "企业与保险数据"],
      ["inspection", "保司资料检查", "保司资料检查与省市协同"],
      ["coordination", "省市工作协同", "保司资料检查与省市协同"],
      ["gd-alerts", "理赔与服务预警", "统计、预警与月报"],
      ["monthly", "运营月报", "统计、预警与月报"],
      ["analytics", "统计分析", "统计、预警与月报"],
      ["alerts", "待办与预警", "统计、预警与月报"],
      ["assessments", "机构考核", "统计、预警与月报"],
      ["brief", "监管简报", "统计、预警与月报"],
    ],
    insurer: [
      ["dashboard", "保险工作台", "保险业务"],
      ["quality", "数据质量整改", "保司资料检查与监管反馈"],
      ["inspection", "保司资料检查反馈", "保司资料检查与监管反馈"],
      ["applications", "投保核保", "保险业务"],
      ["policies", "保单与服务", "保险业务"],
      ["claims", "报案理赔", "保险业务"],
    ],
    service: [
      ["dashboard", "服务工作台", "原保险服务与隐患闭环"],
      ["tasks", "服务任务", "原保险服务与隐患闭环"],
      ["hazards", "隐患与复查", "原保险服务与隐患闭环"],
      ["archive", "回访与归档", "原保险服务与隐患闭环"],
    ],
    enterprise: [
      ["dashboard", "企业首页", "保险业务与原服务记录"],
      ["market", "产品与投保", "保险业务与原服务记录"],
      ["policies", "保单与服务", "保险业务与原服务记录"],
      ["hazards", "隐患整改", "保险业务与原服务记录"],
      ["claims", "报案理赔", "保险业务与原服务记录"],
    ],
  };
  const inspectionPages = [
    ["overview", "履责总览", ["regulator", "insurer", "service", "enterprise"]],
    ["risk", "地区风险分析", ["regulator"]],
    ["budgets", "费用与服务包", ["regulator", "insurer"]],
    ["plans", "既有计划", ["service"]],
    ["standards", "标准模板", ["regulator", "service", "enterprise"]],
    ["tasks", "任务与报告", ["regulator", "insurer", "service", "enterprise"]],
    ["outcomes", "验收与成果", ["regulator"]],
  ];
  const features = Object.freeze([
    ...Object.entries(insurancePages).flatMap(([role, pages]) => pages.map(([id, label, group]) => ({
      path: `/${role}/${id}`, role, label, group, business: "insurance", icon: label.slice(0, 1),
      city: role === "regulator" && ["dashboard", "enterprises", "coordination"].includes(id),
    }))),
    ...inspectionPages.flatMap(([id, label, roles]) => roles.map(role => ({
      path: `/${role}/co-${id}`, role, label, icon: label.slice(0, 1), business: "inspection",
      group: ["budgets", "outcomes"].includes(id) ? "履约、费用与成果" : "企业现场巡检与报告",
    }))),
  ].map(Object.freeze));
  function featuresFor(actor, business) {
    if (!actor) return [];
    return features.filter(feature => feature.business === business && feature.role === actor.role
      && (actor.level !== "city" || feature.city));
  }
  function menuGroups(identity, contexts) {
    if (!identity) return [];
    const groups = [];
    for (const business of ["insurance", "inspection"]) {
      const actor = actorFor(identity, business, contexts[business].db);
      for (const feature of featuresFor(actor, business)) {
        let group = groups.find(item => item.label === feature.group && item.business === business);
        if (!group) { group = { label: feature.group, business, items: [] }; groups.push(group); }
        group.items.push(feature);
      }
    }
    return groups;
  }
  function identityFor(id) {
    return identities.find(identity => identity.id === id || identity.username === id || Object.values(identity.grants).includes(id)) || null;
  }
  function actorFor(identity, business, db) {
    const id = identity?.grants[business];
    return id ? db.accounts.find(account => account.id === id && account.role === identity.role) || null : null;
  }
  function businessFor(path, query = new URLSearchParams()) {
    return /^\/(regulator|insurer|service|enterprise)\/co-/.test(path)
      || (path === "/demo-control" && query.get("business") === "inspection") ? "inspection" : "insurance";
  }
  function readSession() {
    try {
      const current = global.sessionStorage.getItem(SESSION_KEY);
      if (current) return { identity: identityFor(current), warning: identityFor(current) ? null : "统一登录身份无法识别，请重新选择账号。原业务存档未改动。" };
      const old = Object.values(data).map(module => identityFor(global.sessionStorage.getItem(module.SESSION_KEY))).filter(Boolean);
      const distinct = [...new Set(old.map(identity => identity.id))];
      if (distinct.length > 1) return { identity: null, warning: "两份旧登录会话属于不同演示身份，请在统一登录页明确选择；未自动合并会话。" };
      return { identity: old[0] || null, warning: null };
    } catch (error) {
      console.warn("无法读取统一登录会话。", error);
      return { identity: null, warning: `登录会话无法读取：${error.message}` };
    }
  }
  function saveSession(identity) {
    if (identity) global.sessionStorage.setItem(SESSION_KEY, identity.id);
    else {
      global.sessionStorage.removeItem(SESSION_KEY);
      Object.values(data).forEach(module => global.sessionStorage.removeItem(module.SESSION_KEY));
    }
  }
  global.AZXPlatform = Object.freeze({ SESSION_KEY, data, identities, features, featuresFor, menuGroups, identityFor, actorFor, businessFor, readSession, saveSession });
})(globalThis);
