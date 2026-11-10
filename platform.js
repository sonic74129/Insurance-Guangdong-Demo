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
  global.AZXPlatform = Object.freeze({ SESSION_KEY, data, identities, identityFor, actorFor, businessFor, readSession, saveSession });
})(globalThis);
