(function initDemoWorkflows(global) {
  "use strict";

  const Data = global.AZXDemoData;

  function accountFor(db, accountId) {
    return db.accounts.find(item => item.id === accountId) || null;
  }

  function requireRole(db, accountId, role) {
    const account = accountFor(db, accountId);
    if (!account) return { ok: false, message: "当前未登录，无法执行该操作。" };
    if (account.role !== role) return { ok: false, message: "当前账号无权执行该操作。" };
    return { ok: true, account };
  }

  function timestamp(db) {
    return `${db.meta.businessDate} ${new Date().toTimeString().slice(0, 5)}`;
  }

  function addAudit(db, account, action, entityType, entityId, beforeStatus, afterStatus, detail) {
    db.auditLogs.unshift({
      id: Data.nextId(db, "audit", "AUD"),
      at: timestamp(db),
      actorId: account.id,
      role: account.role,
      action,
      entityType,
      entityId,
      beforeStatus: beforeStatus || null,
      afterStatus: afterStatus || null,
      detail,
    });
    db.auditLogs = db.auditLogs.slice(0, 250);
  }

  function addNotification(db, role, orgId, title, detail, entityType, entityId) {
    db.notifications.unshift({
      id: Data.nextId(db, "notification", "NTF"),
      role,
      orgId,
      title,
      detail,
      entityType,
      entityId,
      createdAt: timestamp(db),
      read: false,
    });
  }

  function commit(db, result) {
    Data.save(db);
    return { ok: true, ...result };
  }

  function submitApplication(db, accountId, productId) {
    const auth = requireRole(db, accountId, "enterprise");
    if (!auth.ok) return auth;
    const enterprise = db.enterprises.find(item => item.id === auth.account.orgId);
    const product = db.products.find(item => item.id === productId);
    if (!enterprise || !product) return { ok: false, message: "企业或保险产品不存在。" };
    const duplicate = db.applications.find(item => (
      item.enterpriseId === enterprise.id
      && item.productId === product.id
      && ["核保中", "待补正"].includes(item.status)
    ));
    if (duplicate) return { ok: false, message: `已有待处理申请 ${duplicate.id}，请勿重复提交。` };

    const application = {
      id: Data.nextId(db, "application", "APP"),
      enterpriseId: enterprise.id,
      insurerId: product.insurerId,
      productId: product.id,
      insuredCount: enterprise.employees,
      premium: enterprise.employees * product.premiumRate,
      sumInsured: enterprise.employees * product.coveragePerPerson,
      status: "核保中",
      createdAt: db.meta.businessDate,
      updatedAt: db.meta.businessDate,
    };
    db.applications.unshift(application);
    addAudit(db, auth.account, "提交投保申请", "application", application.id, null, application.status, `选择产品 ${product.name}`);
    addNotification(db, "insurer", product.insurerId, "收到新的投保申请", `${enterprise.name}提交了投保申请。`, "application", application.id);
    return commit(db, { message: `投保申请 ${application.id} 已提交。`, entity: application });
  }

  function requestCorrection(db, accountId, applicationId) {
    const auth = requireRole(db, accountId, "insurer");
    if (!auth.ok) return auth;
    const application = db.applications.find(item => item.id === applicationId);
    if (!application) return { ok: false, message: "投保申请不存在。" };
    if (application.insurerId !== auth.account.orgId) return { ok: false, message: "只能处理本机构的投保申请。" };
    if (application.status !== "核保中") return { ok: false, message: `当前状态为“${application.status}”，不能要求补正。` };
    const before = application.status;
    application.status = "待补正";
    application.updatedAt = db.meta.businessDate;
    addAudit(db, auth.account, "要求补正投保资料", "application", application.id, before, application.status, "需补充最新从业人员清单。");
    addNotification(db, "enterprise", application.enterpriseId, "投保资料待补正", `申请 ${application.id} 需补充从业人员清单。`, "application", application.id);
    return commit(db, { message: "已向企业发出补正通知。", entity: application });
  }

  function approveApplication(db, accountId, applicationId) {
    const auth = requireRole(db, accountId, "insurer");
    if (!auth.ok) return auth;
    const application = db.applications.find(item => item.id === applicationId);
    if (!application) return { ok: false, message: "投保申请不存在。" };
    if (application.insurerId !== auth.account.orgId) return { ok: false, message: "只能处理本机构的投保申请。" };
    if (application.status !== "核保中") return { ok: false, message: `当前状态为“${application.status}”，不能承保。` };
    if (db.policies.some(item => item.applicationId === application.id)) return { ok: false, message: "该申请已经生成保单，不能重复出单。" };

    const before = application.status;
    application.status = "已承保";
    application.updatedAt = db.meta.businessDate;
    const policySequence = (db.meta.sequences.policy || 0) + 1;
    const policy = {
      id: Data.nextId(db, "policy", "POL"),
      policyNo: `AZX-2026-${String(policySequence).padStart(5, "0")}`,
      applicationId: application.id,
      enterpriseId: application.enterpriseId,
      insurerId: application.insurerId,
      productId: application.productId,
      insuredCount: application.insuredCount,
      premium: application.premium,
      sumInsured: application.sumInsured,
      startDate: db.meta.businessDate,
      endDate: Data.addDays(Data.addMonths(db.meta.businessDate, 12), -1),
      status: "生效中",
    };
    db.policies.unshift(policy);
    addAudit(db, auth.account, "核保通过并出单", "application", application.id, before, application.status, `生成保单 ${policy.policyNo}`);
    addNotification(db, "enterprise", application.enterpriseId, "保单已生效", `申请 ${application.id} 已承保，保单号 ${policy.policyNo}。`, "policy", policy.id);
    return commit(db, { message: `核保通过，已生成保单 ${policy.policyNo}。`, entity: policy });
  }

  function rejectApplication(db, accountId, applicationId) {
    const auth = requireRole(db, accountId, "insurer");
    if (!auth.ok) return auth;
    const application = db.applications.find(item => item.id === applicationId);
    if (!application) return { ok: false, message: "投保申请不存在。" };
    if (application.insurerId !== auth.account.orgId) return { ok: false, message: "只能处理本机构的投保申请。" };
    if (!["核保中", "待补正"].includes(application.status)) return { ok: false, message: `当前状态为“${application.status}”，不能拒保。` };
    const before = application.status;
    application.status = "已拒保";
    application.updatedAt = db.meta.businessDate;
    addAudit(db, auth.account, "拒绝承保", "application", application.id, before, application.status, "风险资料不满足当前产品承保条件。");
    addNotification(db, "enterprise", application.enterpriseId, "投保申请未通过", `申请 ${application.id} 未通过核保。`, "application", application.id);
    return commit(db, { message: "已记录拒保决定。", entity: application });
  }

  function delegateService(db, accountId, policyId, providerId = "SP-01") {
    const auth = requireRole(db, accountId, "insurer");
    if (!auth.ok) return auth;
    const policy = db.policies.find(item => item.id === policyId);
    if (!policy) return { ok: false, message: "保单不存在。" };
    if (policy.insurerId !== auth.account.orgId) return { ok: false, message: "只能为本机构保单委托服务。" };
    if (policy.status !== "生效中") return { ok: false, message: "只有生效中的保单可以创建服务计划。" };
    const duplicate = db.serviceTasks.find(item => item.policyId === policy.id && item.status !== "已归档");
    if (duplicate) return { ok: false, message: `该保单已有未归档服务任务 ${duplicate.id}。` };
    const provider = db.serviceProviders.find(item => item.id === providerId);
    if (!provider) return { ok: false, message: "技术服务机构不存在。" };

    const task = {
      id: Data.nextId(db, "task", "SVT"),
      policyId: policy.id,
      enterpriseId: policy.enterpriseId,
      insurerId: policy.insurerId,
      providerId,
      serviceType: "生产安全事故隐患排查",
      plannedDate: Data.addDays(db.meta.businessDate, 3),
      dueDate: Data.addDays(db.meta.businessDate, 15),
      status: "待接单",
      expertName: "待服务机构派单",
      completedAt: null,
      followUpAt: null,
    };
    db.serviceTasks.unshift(task);
    addAudit(db, auth.account, "委托事故预防服务", "serviceTask", task.id, null, task.status, `委托给 ${provider.name}`);
    addNotification(db, "service", providerId, "收到新的服务委托", `服务任务 ${task.id} 等待接单。`, "serviceTask", task.id);
    addNotification(db, "enterprise", policy.enterpriseId, "事故预防服务计划已创建", `服务任务 ${task.id} 已委托。`, "serviceTask", task.id);
    return commit(db, { message: `已委托 ${provider.shortName} 开展事故预防服务。`, entity: task });
  }

  function acceptTask(db, accountId, taskId) {
    const auth = requireRole(db, accountId, "service");
    if (!auth.ok) return auth;
    const task = db.serviceTasks.find(item => item.id === taskId);
    if (!task) return { ok: false, message: "服务任务不存在。" };
    if (task.providerId !== auth.account.orgId) return { ok: false, message: "只能处理本机构的服务任务。" };
    if (task.status !== "待接单") return { ok: false, message: `当前状态为“${task.status}”，不能重复接单。` };
    const before = task.status;
    task.status = "执行中";
    task.expertName = "李明远";
    db.serviceRecords.unshift({
      id: Data.nextId(db, "serviceRecord", "SR"),
      taskId: task.id,
      visitDate: Data.addDays(db.meta.businessDate, 4),
      summary: "已完成服务方案确认并安排现场检查。",
      evidenceCount: 1,
    });
    addAudit(db, auth.account, "接受服务任务并派单", "serviceTask", task.id, before, task.status, `派单专家 ${task.expertName}`);
    return commit(db, { message: "服务任务已接单，并安排现场检查。", entity: task });
  }

  function recordHazard(db, accountId, taskId) {
    const auth = requireRole(db, accountId, "service");
    if (!auth.ok) return auth;
    const task = db.serviceTasks.find(item => item.id === taskId);
    if (!task) return { ok: false, message: "服务任务不存在。" };
    if (task.providerId !== auth.account.orgId) return { ok: false, message: "只能处理本机构的服务任务。" };
    if (task.status !== "执行中") return { ok: false, message: `当前状态为“${task.status}”，不能提交现场隐患。` };
    if (db.hazards.some(item => item.taskId === task.id && item.id.startsWith("HZ-STORY"))) {
      return { ok: false, message: "该演示任务已经登记现场隐患。" };
    }

    const before = task.status;
    task.status = "待整改";
    task.completedAt = db.meta.businessDate;
    const hazard = {
      id: `HZ-STORY-${String((db.meta.sequences.hazard || 0) + 1).padStart(3, "0")}`,
      taskId: task.id,
      enterpriseId: task.enterpriseId,
      providerId: task.providerId,
      type: "危化品管理",
      level: "重大",
      description: "重大危险源区域联锁报警测试记录缺失",
      discoveredAt: db.meta.businessDate,
      deadline: Data.addDays(db.meta.businessDate, 7),
      status: "待整改",
      evidenceCount: 0,
    };
    db.meta.sequences.hazard += 1;
    db.hazards.unshift(hazard);
    addAudit(db, auth.account, "提交现场服务并登记重大隐患", "hazard", hazard.id, before, hazard.status, hazard.description);
    addNotification(db, "enterprise", task.enterpriseId, "重大隐患待整改", `隐患 ${hazard.id} 整改期限为 ${hazard.deadline}。`, "hazard", hazard.id);
    return commit(db, { message: "现场服务已提交，重大隐患已下发企业整改。", entity: hazard });
  }

  function submitRectification(db, accountId, hazardId) {
    const auth = requireRole(db, accountId, "enterprise");
    if (!auth.ok) return auth;
    const hazard = db.hazards.find(item => item.id === hazardId);
    if (!hazard) return { ok: false, message: "隐患记录不存在。" };
    if (hazard.enterpriseId !== auth.account.orgId) return { ok: false, message: "只能整改本企业隐患。" };
    if (hazard.status !== "待整改") return { ok: false, message: `当前状态为“${hazard.status}”，不能重复提交整改。` };
    const before = hazard.status;
    hazard.status = "待复查";
    hazard.evidenceCount = 3;
    const rectification = {
      id: Data.nextId(db, "rectification", "REC"),
      hazardId: hazard.id,
      submittedAt: db.meta.businessDate,
      description: "已补做联锁报警测试，完善测试记录并上传现场照片。",
      evidenceCount: 3,
      status: "待复查",
    };
    db.rectifications.unshift(rectification);
    const task = db.serviceTasks.find(item => item.id === hazard.taskId);
    if (task) task.status = "待复查";
    addAudit(db, auth.account, "提交隐患整改", "hazard", hazard.id, before, hazard.status, rectification.description);
    addNotification(db, "service", hazard.providerId, "企业已提交整改", `隐患 ${hazard.id} 等待复查。`, "hazard", hazard.id);
    return commit(db, { message: "整改说明和 3 份模拟证据已提交。", entity: rectification });
  }

  function reviewRectification(db, accountId, hazardId) {
    const auth = requireRole(db, accountId, "service");
    if (!auth.ok) return auth;
    const hazard = db.hazards.find(item => item.id === hazardId);
    if (!hazard) return { ok: false, message: "隐患记录不存在。" };
    if (hazard.providerId !== auth.account.orgId) return { ok: false, message: "只能复查本机构负责的隐患。" };
    if (hazard.status !== "待复查") return { ok: false, message: `当前状态为“${hazard.status}”，不能复查通过。` };
    const rectification = db.rectifications.find(item => item.hazardId === hazard.id && item.status === "待复查");
    if (!rectification) return { ok: false, message: "缺少待复查的整改记录。" };
    const before = hazard.status;
    hazard.status = "已销号";
    rectification.status = "复查通过";
    const review = {
      id: Data.nextId(db, "review", "REV"),
      rectificationId: rectification.id,
      reviewedAt: db.meta.businessDate,
      result: "通过",
      note: "整改措施有效，记录和现场证据完整，同意销号。",
    };
    db.reviews.unshift(review);
    const task = db.serviceTasks.find(item => item.id === hazard.taskId);
    if (task) task.status = "待回访";
    addAudit(db, auth.account, "整改复查通过", "hazard", hazard.id, before, hazard.status, review.note);
    addNotification(db, "enterprise", hazard.enterpriseId, "隐患已销号", `隐患 ${hazard.id} 已复查通过。`, "hazard", hazard.id);
    return commit(db, { message: "复查通过，隐患已销号。", entity: review });
  }

  function completeFollowUp(db, accountId, taskId) {
    const auth = requireRole(db, accountId, "service");
    if (!auth.ok) return auth;
    const task = db.serviceTasks.find(item => item.id === taskId);
    if (!task) return { ok: false, message: "服务任务不存在。" };
    if (task.providerId !== auth.account.orgId) return { ok: false, message: "只能处理本机构的服务任务。" };
    if (task.status !== "待回访") return { ok: false, message: `当前状态为“${task.status}”，不能完成回访。` };
    const before = task.status;
    task.status = "待归档";
    task.followUpAt = db.meta.businessDate;
    addAudit(db, auth.account, "完成企业回访", "serviceTask", task.id, before, task.status, "企业确认整改有效，服务评价为满意。");
    return commit(db, { message: "企业回访已完成，任务进入待归档。", entity: task });
  }

  function archiveTask(db, accountId, taskId) {
    const auth = requireRole(db, accountId, "service");
    if (!auth.ok) return auth;
    const task = db.serviceTasks.find(item => item.id === taskId);
    if (!task) return { ok: false, message: "服务任务不存在。" };
    if (task.providerId !== auth.account.orgId) return { ok: false, message: "只能归档本机构的服务任务。" };
    if (task.status !== "待归档") return { ok: false, message: `当前状态为“${task.status}”，不能归档。` };
    if (db.archives.some(item => item.taskId === task.id)) return { ok: false, message: "该任务已经归档。" };
    const before = task.status;
    task.status = "已归档";
    const archive = {
      id: Data.nextId(db, "archive", "ARC"),
      taskId: task.id,
      archivedAt: db.meta.businessDate,
      completeness: 100,
    };
    db.archives.unshift(archive);
    addAudit(db, auth.account, "归档事故预防服务", "serviceTask", task.id, before, task.status, "服务方案、现场记录、隐患整改、复查和回访资料完整。");
    addNotification(db, "regulator", "REG-01", "服务任务已归档", `任务 ${task.id} 已完成闭环。`, "serviceTask", task.id);
    return commit(db, { message: "服务档案完整，任务已归档。", entity: archive });
  }

  function reportClaim(db, accountId, policyId) {
    const auth = requireRole(db, accountId, "enterprise");
    if (!auth.ok) return auth;
    const policy = db.policies.find(item => item.id === policyId);
    if (!policy) return { ok: false, message: "保单不存在。" };
    if (policy.enterpriseId !== auth.account.orgId) return { ok: false, message: "只能使用本企业保单报案。" };
    if (policy.status !== "生效中") return { ok: false, message: "只有生效中的保单可以报案。" };
    const duplicate = db.claims.find(item => item.policyId === policy.id && item.id.startsWith("CLM-STORY") && item.status !== "已结案");
    if (duplicate) return { ok: false, message: `已有在途演示赔案 ${duplicate.id}。` };
    const claim = {
      id: `CLM-STORY-${String((db.meta.sequences.claim || 0) + 1).padStart(3, "0")}`,
      policyId: policy.id,
      enterpriseId: policy.enterpriseId,
      insurerId: policy.insurerId,
      incidentType: "生产作业人员轻伤",
      reportedAt: db.meta.businessDate,
      status: "已报案",
      estimatedLoss: 128000,
      paidAmount: 0,
      updatedAt: db.meta.businessDate,
    };
    db.meta.sequences.claim += 1;
    db.claims.unshift(claim);
    db.claimProgress.unshift({
      id: Data.nextId(db, "progress", "CP"),
      claimId: claim.id,
      status: claim.status,
      at: db.meta.businessDate,
      note: "企业已提交报案和现场情况说明。",
    });
    addAudit(db, auth.account, "提交事故报案", "claim", claim.id, null, claim.status, claim.incidentType);
    addNotification(db, "insurer", policy.insurerId, "收到新的事故报案", `赔案 ${claim.id} 等待受理。`, "claim", claim.id);
    return commit(db, { message: `报案 ${claim.id} 已提交。`, entity: claim });
  }

  function advanceClaim(db, accountId, claimId) {
    const auth = requireRole(db, accountId, "insurer");
    if (!auth.ok) return auth;
    const claim = db.claims.find(item => item.id === claimId);
    if (!claim) return { ok: false, message: "赔案不存在。" };
    if (claim.insurerId !== auth.account.orgId) return { ok: false, message: "只能处理本机构赔案。" };
    const statuses = Data.CLAIM_STATUSES;
    const index = statuses.indexOf(claim.status);
    if (index < 0 || index === statuses.length - 1) return { ok: false, message: "赔案已处于最终状态。" };
    const before = claim.status;
    claim.status = statuses[index + 1];
    claim.updatedAt = db.meta.businessDate;
    if (claim.status === "已赔付") claim.paidAmount = Math.round(claim.estimatedLoss * 0.82);
    db.claimProgress.unshift({
      id: Data.nextId(db, "progress", "CP"),
      claimId: claim.id,
      status: claim.status,
      at: db.meta.businessDate,
      note: `${claim.status}节点已由保险机构更新。`,
    });
    addAudit(db, auth.account, "更新理赔进度", "claim", claim.id, before, claim.status, `赔案状态更新为 ${claim.status}`);
    addNotification(db, "enterprise", claim.enterpriseId, "理赔进度已更新", `赔案 ${claim.id} 当前状态为 ${claim.status}。`, "claim", claim.id);
    addNotification(db, "regulator", "REG-01", "理赔数据已回流", `赔案 ${claim.id} 状态更新为 ${claim.status}。`, "claim", claim.id);
    return commit(db, { message: `赔案已推进至“${claim.status}”。`, entity: claim });
  }

  global.AZXDemoWorkflows = Object.freeze({
    submitApplication,
    requestCorrection,
    approveApplication,
    rejectApplication,
    delegateService,
    acceptTask,
    recordHazard,
    submitRectification,
    reviewRectification,
    completeFollowUp,
    archiveTask,
    reportClaim,
    advanceClaim,
  });
})(globalThis);
