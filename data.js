(function initDemoData(global) {
  "use strict";

  const STORAGE_KEY = "anezx-gd-demo-v1";
  const SESSION_KEY = "anezx-gd-demo-session-v1";
  const SCHEMA_VERSION = 3;
  const BUSINESS_DATE = "2026-09-07";

  const SCENARIOS = [
    { id: "baseline", name: "基准数据", description: "完整报表数据，故事企业等待发起投保。" },
    { id: "underwriting", name: "待核保申请", description: "华安新材料已有一笔待核保申请。" },
    { id: "rectification", name: "待整改重大隐患", description: "重点企业存在待整改重大隐患。" },
    { id: "overdue", name: "重大隐患超期", description: "重点企业重大隐患已超过整改期限。" },
    { id: "claims", name: "理赔处理中", description: "重点企业赔案处于查勘处理中。" },
  ];

  const REGIONS = [
    { id: "R01", name: "中心区", target: 90 },
    { id: "R02", name: "东部区", target: 88 },
    { id: "R03", name: "西部区", target: 82 },
    { id: "R04", name: "南部区", target: 86 },
    { id: "R05", name: "北部区", target: 84 },
    { id: "R06", name: "临港区", target: 92 },
    { id: "R07", name: "高新区", target: 90 },
    { id: "R08", name: "经开区", target: 88 },
    { id: "R09", name: "山区", target: 78 },
  ];

  const INDUSTRIES = [
    { id: "I01", name: "矿山" },
    { id: "I02", name: "危险化学品" },
    { id: "I03", name: "烟花爆竹" },
    { id: "I04", name: "交通运输" },
    { id: "I05", name: "建筑施工" },
    { id: "I06", name: "民用爆炸物品" },
    { id: "I07", name: "金属冶炼" },
    { id: "I08", name: "渔业生产" },
  ];

  const INSURERS = [
    { id: "INS-01", name: "中国人民财产保险股份有限公司", shortName: "人保财险", score: 92 },
    { id: "INS-02", name: "中国大地财产保险股份有限公司", shortName: "大地保险", score: 89 },
    { id: "INS-03", name: "紫金财产保险股份有限公司", shortName: "紫金保险", score: 87 },
    { id: "INS-04", name: "国任财产保险股份有限公司", shortName: "国任保险", score: 84 },
    { id: "INS-05", name: "安诚财产保险股份有限公司", shortName: "安诚保险", score: 82 },
  ];

  const SERVICE_PROVIDERS = [
    { id: "SP-01", name: "安衡安全技术服务有限公司", shortName: "安衡服务", score: 94, experts: 18 },
    { id: "SP-02", name: "中安风险管理有限公司", shortName: "中安风控", score: 90, experts: 16 },
    { id: "SP-03", name: "众合安全科技有限公司", shortName: "众合安全", score: 86, experts: 13 },
    { id: "SP-04", name: "恒泰应急技术有限公司", shortName: "恒泰应急", score: 81, experts: 11 },
  ];

  const PRODUCTS = [
    { id: "PRD-001", insurerId: "INS-01", name: "安责险综合保障方案", version: "2026-A", premiumRate: 920, coveragePerPerson: 500000, serviceLevel: "全面", tags: ["事故预防", "快速理赔"] },
    { id: "PRD-002", insurerId: "INS-01", name: "高危行业增强保障方案", version: "2026-B", premiumRate: 1280, coveragePerPerson: 800000, serviceLevel: "增强", tags: ["重大风险", "专家服务"] },
    { id: "PRD-003", insurerId: "INS-02", name: "企业安全守护计划", version: "2026-A", premiumRate: 880, coveragePerPerson: 500000, serviceLevel: "标准", tags: ["基础保障", "隐患排查"] },
    { id: "PRD-004", insurerId: "INS-02", name: "交通运输行业方案", version: "2026-T", premiumRate: 1060, coveragePerPerson: 600000, serviceLevel: "行业", tags: ["交通运输", "应急演练"] },
    { id: "PRD-005", insurerId: "INS-03", name: "安全生产责任保险标准版", version: "2026-A", premiumRate: 840, coveragePerPerson: 500000, serviceLevel: "标准", tags: ["标准责任", "风险评估"] },
    { id: "PRD-006", insurerId: "INS-03", name: "矿山企业专项保障", version: "2026-M", premiumRate: 1380, coveragePerPerson: 800000, serviceLevel: "专项", tags: ["矿山", "驻场服务"] },
    { id: "PRD-007", insurerId: "INS-04", name: "安责险普惠方案", version: "2026-A", premiumRate: 780, coveragePerPerson: 400000, serviceLevel: "基础", tags: ["普惠", "线上服务"] },
    { id: "PRD-008", insurerId: "INS-05", name: "建筑施工综合保障", version: "2026-C", premiumRate: 1120, coveragePerPerson: 600000, serviceLevel: "行业", tags: ["建筑施工", "现场检查"] },
  ];

  const ACCOUNTS = [
    { id: "ACC-REG-01", role: "regulator", username: "regulator", password: "demo123", name: "监管业务管理员", orgId: "REG-01", organization: "安全生产监管单位" },
    { id: "ACC-INS-01", role: "insurer", username: "insurer", password: "demo123", name: "保险业务经理", orgId: "INS-01", organization: "中国人民财产保险股份有限公司" },
    { id: "ACC-SP-01", role: "service", username: "service", password: "demo123", name: "服务项目经理", orgId: "SP-01", organization: "安衡安全技术服务有限公司" },
    { id: "ACC-ENT-01", role: "enterprise", username: "enterprise", password: "demo123", name: "企业安全管理员", orgId: "ENT-001", organization: "华安新材料有限公司" },
  ];

  const FEATURED_ENTERPRISES = [
    ["ENT-001", "华安新材料有限公司", "I02", "R01", 286, "重大"],
    ["ENT-002", "北辰矿业有限公司", "I01", "R09", 328, "重大"],
    ["ENT-003", "海岳港口物流有限公司", "I04", "R06", 214, "较大"],
    ["ENT-004", "盛达金属冶炼有限公司", "I07", "R03", 376, "重大"],
    ["ENT-005", "东升建筑工程有限公司", "I05", "R02", 168, "较大"],
    ["ENT-006", "远航渔业发展有限公司", "I08", "R04", 132, "一般"],
    ["ENT-007", "泰和民爆器材有限公司", "I06", "R08", 198, "重大"],
    ["ENT-008", "锦程危化运输有限公司", "I04", "R05", 156, "较大"],
    ["ENT-009", "新源化工科技有限公司", "I02", "R07", 244, "重大"],
    ["ENT-010", "宏远矿山设备有限公司", "I01", "R03", 117, "较大"],
    ["ENT-011", "华景建设集团有限公司", "I05", "R01", 205, "较大"],
    ["ENT-012", "瑞丰烟花制造有限公司", "I03", "R04", 96, "重大"],
  ];

  const SERVICE_TYPES = [
    "安全生产宣传教育培训",
    "安全风险辨识评估",
    "安全生产标准化建设",
    "生产安全事故隐患排查",
    "安全生产应急预案编制和演练",
    "安全生产科技推广应用",
    "其他事故预防工作",
  ];

  const HAZARD_TYPES = ["设备设施", "作业管理", "电气安全", "消防安全", "危化品管理", "应急管理"];
  const CLAIM_STATUSES = ["已报案", "查勘中", "审核中", "待赔付", "已赔付", "已结案"];

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function createRandom(seed) {
    let value = seed >>> 0;
    return function next() {
      value += 0x6d2b79f5;
      let result = value;
      result = Math.imul(result ^ (result >>> 15), result | 1);
      result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
      return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
    };
  }

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function parseDate(value) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, day));
  }

  function formatDate(date) {
    return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
  }

  function addDays(value, amount) {
    const date = parseDate(value);
    date.setUTCDate(date.getUTCDate() + amount);
    return formatDate(date);
  }

  function addMonths(value, amount) {
    const date = parseDate(value);
    date.setUTCMonth(date.getUTCMonth() + amount);
    return formatDate(date);
  }

  function daysBetween(left, right) {
    return Math.round((parseDate(right) - parseDate(left)) / 86400000);
  }

  function pick(list, random) {
    return list[Math.floor(random() * list.length)];
  }

  function createEnterprises(random) {
    const enterprises = FEATURED_ENTERPRISES.map(([id, name, industryId, regionId, employees, riskLevel], index) => ({
      id,
      name,
      creditCode: `91350000DEMO${String(index + 1).padStart(4, "0")}`,
      industryId,
      regionId,
      employees,
      riskLevel,
      requiredInsurance: true,
      contact: index === 0 ? "周安全" : `联系人${index + 1}`,
      phone: `1380000${String(index + 1).padStart(4, "0")}`,
    }));

    const prefixes = ["兴安", "华盛", "远达", "新城", "恒源", "嘉泰", "金海", "顺通", "启明", "安盛", "联创", "卓越"];
    const suffixes = ["实业有限公司", "安全生产有限公司", "工程有限公司", "工业有限公司"];

    for (let index = 13; index <= 60; index += 1) {
      const region = REGIONS[(index - 1) % REGIONS.length];
      const industry = INDUSTRIES[(index * 3) % INDUSTRIES.length];
      enterprises.push({
        id: `ENT-${String(index).padStart(3, "0")}`,
        name: `${region.name}${prefixes[(index - 1) % prefixes.length]}${suffixes[Math.floor(random() * suffixes.length)]}`,
        creditCode: `91350000DEMO${String(index).padStart(4, "0")}`,
        industryId: industry.id,
        regionId: region.id,
        employees: 58 + Math.floor(random() * 360),
        riskLevel: index % 5 === 0 ? "重大" : index % 3 === 0 ? "较大" : "一般",
        requiredInsurance: true,
        contact: `联系人${index}`,
        phone: `139${String(10000000 + index).slice(-8)}`,
      });
    }
    return enterprises;
  }

  function createApplicationsAndPolicies(enterprises, random) {
    const applications = [];
    const policies = [];

    enterprises.slice(1, 53).forEach((enterprise, index) => {
      const insurer = INSURERS[index % INSURERS.length];
      const insurerProducts = PRODUCTS.filter(product => product.insurerId === insurer.id);
      const product = insurerProducts[index % insurerProducts.length];
      const createdAt = addMonths("2025-10-08", index % 11);
      const startDate = addDays(createdAt, 8 + (index % 9));
      const endDate = addDays(addMonths(startDate, 12), -1);
      const premium = enterprise.employees * product.premiumRate;
      const applicationId = `APP-${String(index + 1).padStart(4, "0")}`;
      applications.push({
        id: applicationId,
        enterpriseId: enterprise.id,
        insurerId: insurer.id,
        productId: product.id,
        insuredCount: enterprise.employees,
        premium,
        sumInsured: enterprise.employees * product.coveragePerPerson,
        status: "已承保",
        createdAt,
        updatedAt: addDays(createdAt, 6),
      });
      policies.push({
        id: `POL-${String(index + 1).padStart(4, "0")}`,
        policyNo: `AZX-2026-${String(index + 1).padStart(5, "0")}`,
        applicationId,
        enterpriseId: enterprise.id,
        insurerId: insurer.id,
        productId: product.id,
        insuredCount: enterprise.employees,
        premium,
        sumInsured: enterprise.employees * product.coveragePerPerson,
        startDate,
        endDate,
        status: endDate >= BUSINESS_DATE ? "生效中" : "已到期",
      });
    });

    const extraStatuses = ["核保中", "待补正", "已拒保", "已撤回", "已承保"];
    for (let index = applications.length; index < 80; index += 1) {
      const enterprise = enterprises[2 + (index * 5) % (enterprises.length - 2)];
      const insurer = INSURERS[(index + 2) % INSURERS.length];
      const insurerProducts = PRODUCTS.filter(product => product.insurerId === insurer.id);
      const product = insurerProducts[index % insurerProducts.length];
      const createdAt = addDays("2025-09-12", (index * 13) % 340);
      const status = extraStatuses[index % extraStatuses.length];
      applications.push({
        id: `APP-${String(index + 1).padStart(4, "0")}`,
        enterpriseId: enterprise.id,
        insurerId: insurer.id,
        productId: product.id,
        insuredCount: enterprise.employees,
        premium: enterprise.employees * product.premiumRate,
        sumInsured: enterprise.employees * product.coveragePerPerson,
        status,
        createdAt,
        updatedAt: addDays(createdAt, 2 + Math.floor(random() * 12)),
      });
    }
    return { applications, policies };
  }

  function createServiceData(policies, enterprises, random) {
    const activePolicies = policies.filter(policy => policy.status === "生效中");
    const serviceTasks = [];
    const serviceRecords = [];
    const hazards = [];
    const rectifications = [];
    const reviews = [];
    const archives = [];
    const taskStatuses = ["已归档", "已归档", "已归档", "待接单", "执行中", "待整改", "待复查", "待回访", "待归档"];

    for (let index = 0; index < 90; index += 1) {
      const policy = activePolicies[index % activePolicies.length];
      const enterprise = enterprises.find(item => item.id === policy.enterpriseId);
      const provider = SERVICE_PROVIDERS[(index + 1) % SERVICE_PROVIDERS.length];
      const status = taskStatuses[index % taskStatuses.length];
      const plannedDate = addDays("2025-10-10", (index * 17) % 325);
      const taskId = `SVT-${String(index + 1).padStart(4, "0")}`;
      const completedAt = ["已归档", "待回访", "待归档"].includes(status) ? addDays(plannedDate, 4) : null;
      serviceTasks.push({
        id: taskId,
        policyId: policy.id,
        enterpriseId: enterprise.id,
        insurerId: policy.insurerId,
        providerId: provider.id,
        serviceType: SERVICE_TYPES[index % SERVICE_TYPES.length],
        plannedDate,
        dueDate: addDays(plannedDate, 12),
        status,
        expertName: `专家${String((index % 24) + 1).padStart(2, "0")}`,
        completedAt,
        followUpAt: status === "已归档" ? addDays(plannedDate, 8) : null,
      });
      if (status !== "待接单") {
        serviceRecords.push({
          id: `SR-${String(index + 1).padStart(4, "0")}`,
          taskId,
          visitDate: addDays(plannedDate, 1),
          summary: `${SERVICE_TYPES[index % SERVICE_TYPES.length]}现场服务记录`,
          evidenceCount: 2 + (index % 5),
        });
      }
      if (status === "已归档") {
        archives.push({
          id: `ARC-${String(index + 1).padStart(4, "0")}`,
          taskId,
          archivedAt: addDays(plannedDate, 11),
          completeness: index % 7 === 0 ? 92 : 100,
        });
      }
    }

    for (let index = 0; index < 180; index += 1) {
      const task = serviceTasks[index % serviceTasks.length];
      const level = index % 11 === 0 ? "重大" : index % 4 === 0 ? "较大" : "一般";
      const status = task.status === "已归档"
        ? "已销号"
        : task.status === "待复查"
          ? "待复查"
          : task.status === "待整改"
            ? "待整改"
            : index % 3 === 0
              ? "已销号"
              : "待整改";
      const discoveredAt = addDays(task.plannedDate, 1);
      const deadline = addDays(discoveredAt, level === "重大" ? 7 : level === "较大" ? 12 : 20);
      const hazardId = `HZ-${String(index + 1).padStart(4, "0")}`;
      hazards.push({
        id: hazardId,
        taskId: task.id,
        enterpriseId: task.enterpriseId,
        providerId: task.providerId,
        type: HAZARD_TYPES[index % HAZARD_TYPES.length],
        level,
        description: `${HAZARD_TYPES[index % HAZARD_TYPES.length]}检查发现第 ${index + 1} 项不符合要求`,
        discoveredAt,
        deadline,
        status,
        evidenceCount: status === "待整改" ? 0 : 2 + (index % 3),
      });
      if (["待复查", "已销号"].includes(status)) {
        const rectificationId = `REC-${String(index + 1).padStart(4, "0")}`;
        rectifications.push({
          id: rectificationId,
          hazardId,
          submittedAt: addDays(discoveredAt, 5 + (index % 5)),
          description: "已按要求完成整改并补充现场照片和记录。",
          evidenceCount: 2 + (index % 3),
          status: status === "已销号" ? "复查通过" : "待复查",
        });
        if (status === "已销号") {
          reviews.push({
            id: `REV-${String(index + 1).padStart(4, "0")}`,
            rectificationId,
            reviewedAt: addDays(discoveredAt, 8 + (index % 4)),
            result: "通过",
            note: "整改措施有效，现场条件符合销号要求。",
          });
        }
      }
    }
    return { serviceTasks, serviceRecords, hazards, rectifications, reviews, archives };
  }

  function createClaims(policies, random) {
    const activePolicies = policies.filter(policy => policy.status === "生效中");
    const claims = [];
    const claimProgress = [];
    for (let index = 0; index < 30; index += 1) {
      const policy = activePolicies[(index * 3) % activePolicies.length];
      const status = CLAIM_STATUSES[index % CLAIM_STATUSES.length];
      const reportedAt = addDays("2025-10-18", (index * 19) % 310);
      const claimId = `CLM-${String(index + 1).padStart(4, "0")}`;
      const estimatedLoss = 18000 + Math.floor(random() * 380000);
      claims.push({
        id: claimId,
        policyId: policy.id,
        enterpriseId: policy.enterpriseId,
        insurerId: policy.insurerId,
        incidentType: ["人员轻伤", "设备损坏", "火灾事故", "运输事故"][index % 4],
        reportedAt,
        status,
        estimatedLoss,
        paidAmount: ["已赔付", "已结案"].includes(status) ? Math.round(estimatedLoss * (0.68 + random() * 0.22)) : 0,
        updatedAt: addDays(reportedAt, 2 + (index % 18)),
      });
      const progressCount = CLAIM_STATUSES.indexOf(status) + 1;
      for (let step = 0; step < progressCount; step += 1) {
        claimProgress.push({
          id: `CP-${String(claimProgress.length + 1).padStart(5, "0")}`,
          claimId,
          status: CLAIM_STATUSES[step],
          at: addDays(reportedAt, step * 3),
          note: `${CLAIM_STATUSES[step]}节点已记录`,
        });
      }
    }
    return { claims, claimProgress };
  }

  function createComplaints(enterprises) {
    const statuses = ["处理中", "已办结", "已办结", "待反馈"];
    return Array.from({ length: 20 }, (_, index) => ({
      id: `CMP-${String(index + 1).padStart(4, "0")}`,
      enterpriseId: enterprises[(index * 7) % enterprises.length].id,
      targetType: index % 2 === 0 ? "保险机构" : "技术服务机构",
      targetId: index % 2 === 0 ? INSURERS[index % INSURERS.length].id : SERVICE_PROVIDERS[index % SERVICE_PROVIDERS.length].id,
      category: ["服务时效", "沟通质量", "理赔进度", "报告质量"][index % 4],
      status: statuses[index % statuses.length],
      createdAt: addDays("2026-01-05", index * 11),
    }));
  }

  function createEvaluations(serviceTasks) {
    return serviceTasks
      .filter(task => task.status === "已归档")
      .map((task, index) => ({
        id: `EVA-${String(index + 1).padStart(4, "0")}`,
        taskId: task.id,
        enterpriseId: task.enterpriseId,
        providerId: task.providerId,
        score: 4 + (index % 5) * 0.2,
        comment: index % 4 === 0 ? "服务专业，整改建议清晰。" : "服务过程规范。",
      }));
  }

  function createAuditLogs() {
    return Array.from({ length: 36 }, (_, index) => ({
      id: `AUD-${String(index + 1).padStart(5, "0")}`,
      at: `${addDays("2026-08-10", index % 28)} ${pad(8 + (index % 9))}:${pad((index * 7) % 60)}`,
      actorId: ACCOUNTS[index % ACCOUNTS.length].id,
      role: ACCOUNTS[index % ACCOUNTS.length].role,
      action: ["查看监管报表", "更新投保申请", "维护服务记录", "查看企业待办"][index % 4],
      entityType: ["report", "application", "serviceTask", "enterprise"][index % 4],
      entityId: `REF-${String(index + 1).padStart(4, "0")}`,
      beforeStatus: null,
      afterStatus: null,
      detail: "演示数据初始化记录",
    }));
  }

  function addScenarioData(db, scenarioId) {
    if (scenarioId === "underwriting") {
      const enterprise = db.enterprises.find(item => item.id === "ENT-001");
      const product = db.products.find(item => item.id === "PRD-001");
      db.applications.unshift({
        id: "APP-STORY-001",
        enterpriseId: enterprise.id,
        insurerId: product.insurerId,
        productId: product.id,
        insuredCount: enterprise.employees,
        premium: enterprise.employees * product.premiumRate,
        sumInsured: enterprise.employees * product.coveragePerPerson,
        status: "核保中",
        createdAt: BUSINESS_DATE,
        updatedAt: BUSINESS_DATE,
      });
    }

    if (scenarioId === "rectification" || scenarioId === "overdue") {
      const policy = db.policies.find(item => item.enterpriseId === "ENT-002" && item.status === "生效中");
      const task = {
        id: "SVT-STORY-001",
        policyId: policy.id,
        enterpriseId: "ENT-002",
        insurerId: policy.insurerId,
        providerId: "SP-01",
        serviceType: "生产安全事故隐患排查",
        plannedDate: "2026-08-18",
        dueDate: "2026-09-02",
        status: "待整改",
        expertName: "李明远",
        completedAt: null,
        followUpAt: null,
      };
      db.serviceTasks.unshift(task);
      db.hazards.unshift({
        id: "HZ-STORY-001",
        taskId: task.id,
        enterpriseId: task.enterpriseId,
        providerId: task.providerId,
        type: "危化品管理",
        level: "重大",
        description: "重大危险源区域联锁报警测试记录缺失",
        discoveredAt: "2026-08-19",
        deadline: scenarioId === "overdue" ? "2026-08-28" : "2026-09-12",
        status: "待整改",
        evidenceCount: 0,
      });
    }

    if (scenarioId === "claims") {
      const policy = db.policies.find(item => item.enterpriseId === "ENT-003" && item.status === "生效中");
      const claim = {
        id: "CLM-STORY-001",
        policyId: policy.id,
        enterpriseId: policy.enterpriseId,
        insurerId: policy.insurerId,
        incidentType: "装卸作业人员受伤",
        reportedAt: "2026-09-04",
        status: "查勘中",
        estimatedLoss: 186000,
        paidAmount: 0,
        updatedAt: "2026-09-06",
      };
      db.claims.unshift(claim);
      db.claimProgress.unshift(
        { id: "CP-STORY-002", claimId: claim.id, status: "查勘中", at: "2026-09-06", note: "查勘人员已到达现场。" },
        { id: "CP-STORY-001", claimId: claim.id, status: "已报案", at: "2026-09-04", note: "企业已提交报案材料。" },
      );
    }
  }

  function createSeed(scenarioId = "baseline") {
    const scenario = SCENARIOS.find(item => item.id === scenarioId) || SCENARIOS[0];
    const random = createRandom(90102026);
    const enterprises = createEnterprises(random);
    const { applications, policies } = createApplicationsAndPolicies(enterprises, random);
    const serviceData = createServiceData(policies, enterprises, random);
    const claimData = createClaims(policies, random);
    const db = {
      meta: {
        schemaVersion: SCHEMA_VERSION,
        businessDate: BUSINESS_DATE,
        scenarioId: scenario.id,
        scenarioName: scenario.name,
        updatedAt: `${BUSINESS_DATE} 09:00`,
        sequences: {
          application: 80,
          policy: policies.length,
          task: 90,
          hazard: 180,
          rectification: serviceData.rectifications.length,
          review: serviceData.reviews.length,
          claim: 30,
          progress: claimData.claimProgress.length,
          audit: 36,
          notification: 0,
        },
      },
      accounts: clone(ACCOUNTS),
      regions: clone(REGIONS),
      industries: clone(INDUSTRIES),
      insurers: clone(INSURERS),
      serviceProviders: clone(SERVICE_PROVIDERS),
      products: clone(PRODUCTS),
      enterprises,
      applications,
      policies,
      serviceTasks: serviceData.serviceTasks,
      serviceRecords: serviceData.serviceRecords,
      hazards: serviceData.hazards,
      rectifications: serviceData.rectifications,
      reviews: serviceData.reviews,
      archives: serviceData.archives,
      claims: claimData.claims,
      claimProgress: claimData.claimProgress,
      complaints: createComplaints(enterprises),
      evaluations: createEvaluations(serviceData.serviceTasks),
      notifications: [],
      auditLogs: createAuditLogs(),
    };
    addScenarioData(db, scenario.id);
    return db;
  }

  function findDuplicates(records) {
    const seen = new Set();
    return records
      .map(item => item.id)
      .filter(id => {
        if (seen.has(id)) return true;
        seen.add(id);
        return false;
      });
  }

  function validate(db) {
    const errors = [];
    const collections = [
      "accounts", "regions", "industries", "insurers", "serviceProviders", "products",
      "enterprises", "applications", "policies", "serviceTasks", "serviceRecords", "hazards", "rectifications",
      "reviews", "archives", "claims", "claimProgress", "complaints", "evaluations", "notifications", "auditLogs",
    ];
    collections.forEach(name => {
      const duplicates = findDuplicates(db[name] || []);
      if (duplicates.length) errors.push(`${name} 存在重复 ID：${duplicates.join(", ")}`);
    });

    const has = (name, id) => (db[name] || []).some(item => item.id === id);
    db.products.forEach(item => {
      if (!has("insurers", item.insurerId)) errors.push(`产品 ${item.id} 引用了不存在的保险机构`);
    });
    db.enterprises.forEach(item => {
      if (!has("regions", item.regionId)) errors.push(`企业 ${item.id} 引用了不存在的地区`);
      if (!has("industries", item.industryId)) errors.push(`企业 ${item.id} 引用了不存在的行业`);
    });
    db.applications.forEach(item => {
      if (!has("enterprises", item.enterpriseId)) errors.push(`投保申请 ${item.id} 引用了不存在的企业`);
      if (!has("insurers", item.insurerId)) errors.push(`投保申请 ${item.id} 引用了不存在的保险机构`);
      if (!has("products", item.productId)) errors.push(`投保申请 ${item.id} 引用了不存在的产品`);
    });
    db.policies.forEach(item => {
      if ((item.origin !== "external" || item.applicationId) && !has("applications", item.applicationId)) errors.push(`保单 ${item.id} 引用了不存在的投保申请`);
      if (!has("enterprises", item.enterpriseId)) errors.push(`保单 ${item.id} 引用了不存在的企业`);
      if (!has("insurers", item.insurerId)) errors.push(`保单 ${item.id} 引用了不存在的保险机构`);
      if ((item.origin !== "external" || item.productId) && !has("products", item.productId)) errors.push(`保单 ${item.id} 引用了不存在的产品`);
      if (item.startDate > item.endDate) errors.push(`保单 ${item.id} 的保险期间不合法`);
    });
    db.serviceTasks.forEach(item => {
      if (!has("policies", item.policyId)) errors.push(`服务任务 ${item.id} 引用了不存在的保单`);
      if (!has("serviceProviders", item.providerId)) errors.push(`服务任务 ${item.id} 引用了不存在的服务机构`);
    });
    db.serviceRecords.forEach(item => {
      if (!has("serviceTasks", item.taskId)) errors.push(`服务记录 ${item.id} 引用了不存在的服务任务`);
    });
    db.hazards.forEach(item => {
      if (!has("serviceTasks", item.taskId)) errors.push(`隐患 ${item.id} 引用了不存在的服务任务`);
      if (!has("enterprises", item.enterpriseId)) errors.push(`隐患 ${item.id} 引用了不存在的企业`);
      if (item.discoveredAt > item.deadline) errors.push(`隐患 ${item.id} 的整改期限早于发现日期`);
    });
    db.rectifications.forEach(item => {
      if (!has("hazards", item.hazardId)) errors.push(`整改 ${item.id} 引用了不存在的隐患`);
    });
    db.reviews.forEach(item => {
      if (!has("rectifications", item.rectificationId)) errors.push(`复查 ${item.id} 引用了不存在的整改`);
    });
    db.claims.forEach(item => {
      if (!has("policies", item.policyId)) errors.push(`赔案 ${item.id} 引用了不存在的保单`);
    });
    db.claimProgress.forEach(item => {
      if (!has("claims", item.claimId)) errors.push(`理赔进度 ${item.id} 引用了不存在的赔案`);
    });
    db.archives.forEach(item => {
      if (!has("serviceTasks", item.taskId)) errors.push(`服务档案 ${item.id} 引用了不存在的服务任务`);
    });
    db.complaints.forEach(item => {
      if (!has("enterprises", item.enterpriseId)) errors.push(`投诉 ${item.id} 引用了不存在的企业`);
      const validTarget = item.targetType === "保险机构"
        ? has("insurers", item.targetId)
        : has("serviceProviders", item.targetId);
      if (!validTarget) errors.push(`投诉 ${item.id} 引用了不存在的被投诉机构`);
    });
    db.evaluations.forEach(item => {
      if (!has("serviceTasks", item.taskId)) errors.push(`评价 ${item.id} 引用了不存在的服务任务`);
      if (!has("enterprises", item.enterpriseId)) errors.push(`评价 ${item.id} 引用了不存在的企业`);
      if (!has("serviceProviders", item.providerId)) errors.push(`评价 ${item.id} 引用了不存在的服务机构`);
    });

    const allowedStatuses = {
      applications: ["核保中", "待补正", "已拒保", "已撤回", "已承保"],
      policies: ["生效中", "已到期", "已退保"],
      serviceTasks: ["待接单", "执行中", "待整改", "待复查", "待回访", "待归档", "已归档"],
      hazards: ["待整改", "待复查", "已销号"],
      claims: CLAIM_STATUSES,
    };
    Object.entries(allowedStatuses).forEach(([name, statuses]) => {
      db[name].forEach(item => {
        if (!statuses.includes(item.status)) errors.push(`${name} ${item.id} 使用了非法状态 ${item.status}`);
      });
    });
    return errors;
  }

  function load() {
    const raw = global.localStorage ? global.localStorage.getItem(STORAGE_KEY) : null;
    if (!raw) return { db: createSeed(), warning: null };
    try {
      const db = JSON.parse(raw);
      if (db.meta?.schemaVersion !== SCHEMA_VERSION) {
        return { db: createSeed(), warning: "演示数据版本已更新，已恢复为最新基准数据。" };
      }
      const errors = validate(db);
      if (errors.length) {
        return { db: createSeed(), warning: `本地演示数据校验失败，已恢复基准数据：${errors[0]}` };
      }
      return { db, warning: null };
    } catch (error) {
      return { db: createSeed(), warning: `本地演示数据无法读取，已恢复基准数据：${error.message}` };
    }
  }

  function save(db) {
    db.meta.updatedAt = `${db.meta.businessDate} ${new Date().toTimeString().slice(0, 5)}`;
    global.localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  }

  function reset(scenarioId = "baseline") {
    const db = createSeed(scenarioId);
    save(db);
    return db;
  }

  function nextId(db, type, prefix) {
    db.meta.sequences[type] = (db.meta.sequences[type] || 0) + 1;
    return `${prefix}-${String(db.meta.sequences[type]).padStart(5, "0")}`;
  }

  global.AZXDemoData = Object.freeze({
    STORAGE_KEY,
    SESSION_KEY,
    SCHEMA_VERSION,
    BUSINESS_DATE,
    SCENARIOS: clone(SCENARIOS),
    CLAIM_STATUSES: clone(CLAIM_STATUSES),
    createSeed,
    load,
    save,
    reset,
    validate,
    nextId,
    clone,
    addDays,
    addMonths,
    daysBetween,
  });
})(globalThis);
