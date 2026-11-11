(function initDemoReports(global) {
  "use strict";

  const Data = global.AZXDemoData;

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function number(value, digits = 0) {
    return Number(value || 0).toLocaleString("zh-CN", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
  }

  function percent(value, digits = 1) {
    return `${number(value, digits)}%`;
  }

  function money(value, compact = true) {
    const amount = Number(value || 0);
    if (compact && Math.abs(amount) >= 100000000) return `${number(amount / 100000000, 2)} 亿元`;
    if (compact && Math.abs(amount) >= 10000) return `${number(amount / 10000, 1)} 万元`;
    return `${number(amount, 0)} 元`;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function getPeriodRange(period, businessDate) {
    const [year, month] = businessDate.split("-").map(Number);
    if (period === "month") {
      return {
        start: `${year}-${String(month).padStart(2, "0")}-01`,
        end: businessDate,
        previousStart: Data.addMonths(`${year}-${String(month).padStart(2, "0")}-01`, -1),
        previousEnd: Data.addDays(`${year}-${String(month).padStart(2, "0")}-01`, -1),
        label: "本月",
      };
    }
    if (period === "quarter") {
      const quarterStartMonth = Math.floor((month - 1) / 3) * 3 + 1;
      const start = `${year}-${String(quarterStartMonth).padStart(2, "0")}-01`;
      return {
        start,
        end: businessDate,
        previousStart: Data.addMonths(start, -3),
        previousEnd: Data.addDays(start, -1),
        label: "本季度",
      };
    }
    if (period === "all") {
      return {
        start: "2025-09-01",
        end: businessDate,
        previousStart: "2024-09-01",
        previousEnd: "2025-08-31",
        label: "全部",
      };
    }
    return {
      start: `${year}-01-01`,
      end: businessDate,
      previousStart: `${year}-01-01`,
      previousEnd: `${year}-06-30`,
      label: "本年度",
    };
  }

  function normalizeFilters(db, filters = {}) {
    return {
      period: filters.period || "year",
      regionId: filters.regionId || "",
      industryId: filters.industryId || "",
      insurerId: filters.insurerId || "",
      providerId: filters.providerId || "",
      ...getPeriodRange(filters.period || "year", db.meta.businessDate),
    };
  }

  function inRange(value, start, end) {
    return Boolean(value && value >= start && value <= end);
  }

  function enterpriseMatches(enterprise, filters) {
    return (!filters.regionId || enterprise.regionId === filters.regionId)
      && (!filters.industryId || enterprise.industryId === filters.industryId);
  }

  function context(db, filtersInput) {
    const filters = normalizeFilters(db, filtersInput);
    const enterprises = db.enterprises.filter(item => enterpriseMatches(item, filters));
    const enterpriseIds = new Set(enterprises.map(item => item.id));
    const policies = db.policies.filter(item => enterpriseIds.has(item.enterpriseId) && (!filters.insurerId || item.insurerId === filters.insurerId));
    const policyIds = new Set(policies.map(item => item.id));
    const tasks = db.serviceTasks.filter(item => (
      enterpriseIds.has(item.enterpriseId)
      && (!filters.insurerId || item.insurerId === filters.insurerId)
      && (!filters.providerId || item.providerId === filters.providerId)
    ));
    const taskIds = new Set(tasks.map(item => item.id));
    const hazards = db.hazards.filter(item => enterpriseIds.has(item.enterpriseId) && taskIds.has(item.taskId));
    const claims = db.claims.filter(item => enterpriseIds.has(item.enterpriseId) && policyIds.has(item.policyId));
    const applications = db.applications.filter(item => enterpriseIds.has(item.enterpriseId) && (!filters.insurerId || item.insurerId === filters.insurerId));
    return { filters, enterprises, enterpriseIds, applications, policies, policyIds, tasks, taskIds, hazards, claims };
  }

  function rate(numerator, denominator) {
    return denominator ? (numerator / denominator) * 100 : 0;
  }

  function activePoliciesAt(policies, asOf) {
    return policies.filter(item => item.startDate <= asOf && item.endDate >= asOf && item.status !== "已退保");
  }

  function coveredEnterpriseIds(policies, asOf) {
    return new Set(activePoliciesAt(policies, asOf).map(item => item.enterpriseId));
  }

  function completedTask(task) {
    return ["待回访", "待归档", "已归档"].includes(task.status);
  }

  function closedHazard(hazard) {
    return hazard.status === "已销号";
  }

  function overdueHazard(hazard, businessDate) {
    return !closedHazard(hazard) && hazard.deadline < businessDate;
  }

  function compare(current, previous, inverse = false) {
    if (!previous) return { value: 0, direction: "flat", text: "无上期基数" };
    const delta = ((current - previous) / Math.abs(previous)) * 100;
    const direction = Math.abs(delta) < 0.05 ? "flat" : delta > 0 ? "up" : "down";
    const isPositive = inverse ? delta < 0 : delta > 0;
    return {
      value: delta,
      direction,
      sentiment: direction === "flat" ? "neutral" : isPositive ? "positive" : "negative",
      text: direction === "flat" ? "持平" : `${direction === "up" ? "↑" : "↓"} ${Math.abs(delta).toFixed(1)}%`,
    };
  }

  function snapshotMetrics(db, filtersInput, asOf) {
    const ctx = context(db, filtersInput);
    const activePolicies = activePoliciesAt(ctx.policies, asOf);
    const covered = new Set(activePolicies.map(item => item.enterpriseId));
    const tasksToDate = ctx.tasks.filter(item => item.plannedDate <= asOf);
    const hazardsToDate = ctx.hazards.filter(item => item.discoveredAt <= asOf);
    const majorOverdue = hazardsToDate.filter(item => item.level === "重大" && overdueHazard(item, asOf));
    const claimsToDate = ctx.claims.filter(item => item.reportedAt <= asOf);
    return {
      enterpriseCount: ctx.enterprises.length,
      coveredCount: covered.size,
      coverageRate: rate(covered.size, ctx.enterprises.length),
      activePolicyCount: activePolicies.length,
      premium: activePolicies.reduce((sum, item) => sum + item.premium, 0),
      sumInsured: activePolicies.reduce((sum, item) => sum + item.sumInsured, 0),
      serviceCompletionRate: rate(tasksToDate.filter(completedTask).length, tasksToDate.length),
      hazardRectificationRate: rate(hazardsToDate.filter(closedHazard).length, hazardsToDate.length),
      overdueMajorCount: majorOverdue.length,
      openClaimCount: claimsToDate.filter(item => item.status !== "已结案").length,
      paidAmount: claimsToDate.reduce((sum, item) => sum + item.paidAmount, 0),
    };
  }

  function dashboard(db, filtersInput = {}) {
    const ctx = context(db, filtersInput);
    const current = snapshotMetrics(db, ctx.filters, ctx.filters.end);
    const previous = snapshotMetrics(db, ctx.filters, ctx.filters.previousEnd);
    return {
      filters: ctx.filters,
      cards: [
        { id: "coverage", label: "企业参保覆盖率", value: percent(current.coverageRate), raw: current.coverageRate, unit: "", comparison: compare(current.coverageRate, previous.coverageRate), target: 88, drill: "coverage" },
        { id: "activePolicies", label: "有效保单", value: number(current.activePolicyCount), raw: current.activePolicyCount, unit: "张", comparison: compare(current.activePolicyCount, previous.activePolicyCount), drill: "policies" },
        { id: "premium", label: "有效保费规模", value: money(current.premium), raw: current.premium, unit: "", comparison: compare(current.premium, previous.premium), drill: "policies" },
        { id: "service", label: "服务任务完成率", value: percent(current.serviceCompletionRate), raw: current.serviceCompletionRate, unit: "", comparison: compare(current.serviceCompletionRate, previous.serviceCompletionRate), target: 85, drill: "services" },
        { id: "rectification", label: "隐患整改率", value: percent(current.hazardRectificationRate), raw: current.hazardRectificationRate, unit: "", comparison: compare(current.hazardRectificationRate, previous.hazardRectificationRate), target: 90, drill: "hazards" },
        { id: "overdue", label: "超期重大隐患", value: number(current.overdueMajorCount), raw: current.overdueMajorCount, unit: "项", comparison: compare(current.overdueMajorCount, previous.overdueMajorCount, true), emphasis: current.overdueMajorCount > 0, drill: "overdueHazards" },
      ],
      current,
      previous,
      regionCoverage: coverageBy(db, ctx, "region"),
      industryCoverage: coverageBy(db, ctx, "industry"),
      trend: monthlyBusinessTrend(db, ctx),
      serviceStatus: statusDistribution(ctx.tasks, "status"),
      hazardStatus: hazardStatusDistribution(ctx.hazards),
      insurerRanking: insurerRanking(db, ctx),
      providerRanking: providerRanking(db, ctx),
      claimStatus: statusDistribution(ctx.claims, "status"),
      alerts: alerts(db, ctx),
    };
  }

  function coverageBy(db, ctx, dimension) {
    const source = dimension === "region" ? db.regions : db.industries;
    return source.map(item => {
      const enterprises = ctx.enterprises.filter(enterprise => enterprise[dimension === "region" ? "regionId" : "industryId"] === item.id);
      const ids = new Set(enterprises.map(enterprise => enterprise.id));
      const policies = ctx.policies.filter(policy => ids.has(policy.enterpriseId));
      const covered = coveredEnterpriseIds(policies, ctx.filters.end);
      return {
        id: item.id,
        label: item.name,
        total: enterprises.length,
        covered: covered.size,
        value: rate(covered.size, enterprises.length),
        target: item.target || 88,
      };
    }).filter(item => item.total > 0).sort((left, right) => right.value - left.value);
  }

  function monthlyBusinessTrend(db, ctx) {
    const points = [];
    for (let offset = 11; offset >= 0; offset -= 1) {
      const monthStart = Data.addMonths("2026-09-01", -offset);
      const monthEnd = Data.addDays(Data.addMonths(monthStart, 1), -1);
      const applications = ctx.applications.filter(item => inRange(item.createdAt, monthStart, monthEnd));
      const policies = ctx.policies.filter(item => inRange(item.startDate, monthStart, monthEnd));
      points.push({
        label: monthStart.slice(2, 7).replace("-", "/"),
        applications: applications.length,
        policies: policies.length,
        premium: policies.reduce((sum, item) => sum + item.premium, 0),
      });
    }
    return points;
  }

  function statusDistribution(records, field) {
    const grouped = new Map();
    records.forEach(item => grouped.set(item[field], (grouped.get(item[field]) || 0) + 1));
    return [...grouped.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((left, right) => right.value - left.value);
  }

  function hazardStatusDistribution(hazards) {
    const levels = ["重大", "较大", "一般"];
    return levels.map(level => ({
      label: level,
      value: hazards.filter(item => item.level === level).length,
      closed: hazards.filter(item => item.level === level && closedHazard(item)).length,
    }));
  }

  function insurerRanking(db, ctx) {
    return db.insurers.map(insurer => {
      const policies = activePoliciesAt(ctx.policies.filter(item => item.insurerId === insurer.id), ctx.filters.end);
      const claims = ctx.claims.filter(item => item.insurerId === insurer.id);
      const complaints = db.complaints.filter(item => item.targetId === insurer.id);
      const applicationCount = ctx.applications.filter(item => item.insurerId === insurer.id).length;
      const score = clamp(
        insurer.score
          + Math.min(policies.length, 10) * 0.25
          - claims.filter(item => item.status !== "已结案").length * 0.3
          - complaints.filter(item => item.status !== "已办结").length * 0.6,
        60,
        99,
      );
      return {
        id: insurer.id,
        label: insurer.shortName,
        policies: policies.length,
        applications: applicationCount,
        premium: policies.reduce((sum, item) => sum + item.premium, 0),
        score,
      };
    }).sort((left, right) => right.score - left.score);
  }

  function providerRanking(db, ctx) {
    return db.serviceProviders.map(provider => {
      const tasks = ctx.tasks.filter(item => item.providerId === provider.id);
      const hazards = ctx.hazards.filter(item => item.providerId === provider.id);
      const completed = tasks.filter(completedTask).length;
      const overdue = hazards.filter(item => overdueHazard(item, ctx.filters.end)).length;
      const evaluations = db.evaluations.filter(item => item.providerId === provider.id);
      const averageEvaluation = evaluations.length
        ? evaluations.reduce((sum, item) => sum + item.score, 0) / evaluations.length
        : 4;
      const score = clamp(
        provider.score
          + rate(completed, tasks.length) * 0.03
          + averageEvaluation
          - overdue * 0.35,
        60,
        99,
      );
      return {
        id: provider.id,
        label: provider.shortName,
        tasks: tasks.length,
        completionRate: rate(completed, tasks.length),
        overdue,
        score,
      };
    }).sort((left, right) => right.score - left.score);
  }

  function alerts(db, ctx) {
    const regionAlerts = coverageBy(db, ctx, "region")
      .filter(item => item.value < item.target)
      .map(item => ({
        level: item.value < item.target - 12 ? "high" : "medium",
        type: "低覆盖地区",
        title: `${item.label}覆盖率 ${percent(item.value)}`,
        description: `低于示范目标 ${percent(item.target)}，差距 ${percent(item.target - item.value)}。`,
        drill: "regionCoverage",
        key: item.id,
      }));
    const hazardAlerts = ctx.hazards
      .filter(item => item.level === "重大" && overdueHazard(item, ctx.filters.end))
      .slice(0, 8)
      .map(item => {
        const enterprise = db.enterprises.find(value => value.id === item.enterpriseId);
        return {
          level: "high",
          type: "重大隐患",
          title: enterprise?.name || item.enterpriseId,
          description: `${item.description}，已超期 ${Data.daysBetween(item.deadline, ctx.filters.end)} 天。`,
          drill: "hazard",
          key: item.id,
        };
      });
    const serviceAlerts = ctx.tasks
      .filter(item => !["已归档"].includes(item.status) && item.dueDate < ctx.filters.end)
      .slice(0, 5)
      .map(item => {
        const enterprise = db.enterprises.find(value => value.id === item.enterpriseId);
        return {
          level: "medium",
          type: "服务超期",
          title: enterprise?.name || item.enterpriseId,
          description: `${item.serviceType}计划完成日为 ${item.dueDate}。`,
          drill: "service",
          key: item.id,
        };
      });
    return [...hazardAlerts, ...regionAlerts, ...serviceAlerts].slice(0, 12);
  }

  function coverageMatrix(db, filtersInput) {
    const ctx = context(db, filtersInput);
    return {
      rows: db.regions.map(region => ({
        id: region.id,
        label: region.name,
        cells: db.industries.map(industry => {
          const enterprises = ctx.enterprises.filter(item => item.regionId === region.id && item.industryId === industry.id);
          const ids = new Set(enterprises.map(item => item.id));
          const policies = ctx.policies.filter(item => ids.has(item.enterpriseId));
          const covered = coveredEnterpriseIds(policies, ctx.filters.end);
          return {
            regionId: region.id,
            industryId: industry.id,
            total: enterprises.length,
            covered: covered.size,
            value: rate(covered.size, enterprises.length),
          };
        }),
      })),
      columns: db.industries.map(item => ({ id: item.id, label: item.name })),
    };
  }

  function applicationFunnel(applications) {
    const submitted = applications.length;
    const reviewing = applications.filter(item => ["核保中", "待补正", "已承保"].includes(item.status)).length;
    const approved = applications.filter(item => item.status === "已承保").length;
    const rejected = applications.filter(item => item.status === "已拒保").length;
    return [
      { label: "提交申请", value: submitted },
      { label: "进入核保", value: reviewing },
      { label: "承保出单", value: approved },
      { label: "拒保", value: rejected },
    ];
  }

  function hazardAgeBuckets(hazards, businessDate) {
    const open = hazards.filter(item => !closedHazard(item));
    const buckets = [
      { label: "7天内", min: 0, max: 7, value: 0 },
      { label: "8-15天", min: 8, max: 15, value: 0 },
      { label: "16-30天", min: 16, max: 30, value: 0 },
      { label: "30天以上", min: 31, max: Infinity, value: 0 },
    ];
    open.forEach(item => {
      const age = Math.max(0, Data.daysBetween(item.discoveredAt, businessDate));
      const bucket = buckets.find(value => age >= value.min && age <= value.max);
      if (bucket) bucket.value += 1;
    });
    return buckets;
  }

  function claimDurationBuckets(claims) {
    const buckets = [
      { label: "7天内", min: 0, max: 7, value: 0 },
      { label: "8-15天", min: 8, max: 15, value: 0 },
      { label: "16-30天", min: 16, max: 30, value: 0 },
      { label: "30天以上", min: 31, max: Infinity, value: 0 },
    ];
    claims.forEach(item => {
      const days = Math.max(0, Data.daysBetween(item.reportedAt, item.updatedAt));
      const bucket = buckets.find(value => days >= value.min && days <= value.max);
      if (bucket) bucket.value += 1;
    });
    return buckets;
  }

  function topicReport(db, topic, filtersInput = {}) {
    const ctx = context(db, filtersInput);
    const current = snapshotMetrics(db, ctx.filters, ctx.filters.end);
    const base = { topic, filters: ctx.filters };

    if (topic === "insurance") {
      const applications = ctx.applications.filter(item => inRange(item.createdAt, ctx.filters.start, ctx.filters.end));
      const policies = ctx.policies.filter(item => item.origin !== "external" && inRange(item.startDate, ctx.filters.start, ctx.filters.end));
      return {
        ...base,
        title: "平台投保业务分析",
        description: "投保转化仅计算平台申请生成的保单，不包含外部接入保单；趋势图展示全量业务。",
        cards: [
          { label: "投保申请", value: number(applications.length), drill: "applications" },
          { label: "承保出单", value: number(policies.length), drill: "policies" },
          { label: "承保转化率", value: percent(rate(policies.length, applications.length)), drill: "applications" },
          { label: "新增保费", value: money(policies.reduce((sum, item) => sum + item.premium, 0)), drill: "policies" },
        ],
        charts: [
          { type: "funnel", title: "投保转化漏斗", data: applicationFunnel(applications), drill: "applications" },
          { type: "line", title: "月度投保与承保趋势", data: monthlyBusinessTrend(db, ctx), series: [{ key: "applications", label: "投保申请" }, { key: "policies", label: "承保出单" }], drill: "applications" },
          { type: "bar", title: "保险机构业务评分", data: insurerRanking(db, ctx).map(item => ({ id: item.id, label: item.label, value: item.score })), suffix: "分", drill: "insurer" },
        ],
      };
    }

    if (topic === "prevention") {
      const periodTasks = ctx.tasks.filter(item => inRange(item.plannedDate, ctx.filters.start, ctx.filters.end));
      return {
        ...base,
        title: "事故预防服务分析",
        description: "分析服务计划执行、任务完成、时限和服务机构质量。",
        cards: [
          { label: "服务任务", value: number(periodTasks.length), drill: "services" },
          { label: "已完成", value: number(periodTasks.filter(completedTask).length), drill: "services" },
          { label: "完成率", value: percent(rate(periodTasks.filter(completedTask).length, periodTasks.length)), drill: "services" },
          { label: "超期任务", value: number(periodTasks.filter(item => item.status !== "已归档" && item.dueDate < ctx.filters.end).length), drill: "overdueServices", emphasis: true },
        ],
        charts: [
          { type: "donut", title: "服务任务状态", data: statusDistribution(periodTasks, "status"), drill: "services" },
          { type: "bar", title: "服务机构质量排名", data: providerRanking(db, ctx).map(item => ({ id: item.id, label: item.label, value: item.score })), suffix: "分", drill: "provider" },
          { type: "bar", title: "服务类型分布", data: statusDistribution(periodTasks, "serviceType"), drill: "services" },
        ],
      };
    }

    if (topic === "hazards") {
      const periodHazards = ctx.hazards.filter(item => inRange(item.discoveredAt, ctx.filters.start, ctx.filters.end));
      return {
        ...base,
        title: "隐患整改分析",
        description: "分析隐患等级、整改闭环、超期账龄和行业风险分布。",
        cards: [
          { label: "发现隐患", value: number(periodHazards.length), drill: "hazards" },
          { label: "重大隐患", value: number(periodHazards.filter(item => item.level === "重大").length), drill: "majorHazards" },
          { label: "整改率", value: percent(rate(periodHazards.filter(closedHazard).length, periodHazards.length)), drill: "hazards" },
          { label: "超期未整改", value: number(periodHazards.filter(item => overdueHazard(item, ctx.filters.end)).length), drill: "overdueHazards", emphasis: true },
        ],
        charts: [
          { type: "donut", title: "隐患等级分布", data: statusDistribution(periodHazards, "level"), drill: "hazards" },
          { type: "funnel", title: "隐患整改漏斗", data: [
            { label: "发现隐患", value: periodHazards.length },
            { label: "已提交整改", value: periodHazards.filter(item => ["待复查", "已销号"].includes(item.status)).length },
            { label: "复查通过", value: periodHazards.filter(closedHazard).length },
          ], drill: "hazards" },
          { type: "bar", title: "未闭环隐患账龄", data: hazardAgeBuckets(periodHazards, ctx.filters.end), drill: "hazards" },
        ],
      };
    }

    if (topic === "claims") {
      const periodClaims = ctx.claims.filter(item => inRange(item.reportedAt, ctx.filters.start, ctx.filters.end));
      const closed = periodClaims.filter(item => item.status === "已结案");
      const averageDays = closed.length
        ? closed.reduce((sum, item) => sum + Data.daysBetween(item.reportedAt, item.updatedAt), 0) / closed.length
        : 0;
      return {
        ...base,
        title: "理赔运行分析",
        description: "分析报案规模、处理状态、赔付金额和处理时长。",
        cards: [
          { label: "报案件数", value: number(periodClaims.length), drill: "claims" },
          { label: "在办案件", value: number(periodClaims.filter(item => item.status !== "已结案").length), drill: "openClaims" },
          { label: "已结案件", value: number(closed.length), drill: "closedClaims" },
          { label: "平均处理时长", value: `${number(averageDays, 1)} 天`, drill: "claims" },
        ],
        charts: [
          { type: "donut", title: "赔案状态分布", data: statusDistribution(periodClaims, "status"), drill: "claims" },
          { type: "bar", title: "案件处理时长", data: claimDurationBuckets(periodClaims), drill: "claims" },
          { type: "bar", title: "保险机构赔付金额", data: db.insurers.map(insurer => ({
            id: insurer.id,
            label: insurer.shortName,
            value: periodClaims.filter(item => item.insurerId === insurer.id).reduce((sum, item) => sum + item.paidAmount, 0),
          })).sort((left, right) => right.value - left.value), valueFormatter: money, drill: "insurerClaims" },
        ],
      };
    }

    if (topic === "assessment") {
      return {
        ...base,
        title: "机构考核分析",
        description: "对保险机构和技术服务机构的业务贡献、质量、时效和投诉进行综合展示。",
        cards: [
          { label: "保险机构", value: number(db.insurers.length), drill: "insurers" },
          { label: "服务机构", value: number(db.serviceProviders.length), drill: "providers" },
          { label: "未办结投诉", value: number(db.complaints.filter(item => item.status !== "已办结").length), drill: "complaints" },
          { label: "平均服务评分", value: number(db.evaluations.reduce((sum, item) => sum + item.score, 0) / db.evaluations.length, 1), drill: "evaluations" },
        ],
        charts: [
          { type: "ranking", title: "保险机构综合排名", data: insurerRanking(db, ctx).map(item => ({ id: item.id, label: item.label, value: item.score, meta: `${item.policies} 张有效保单` })), suffix: "分", drill: "insurer" },
          { type: "ranking", title: "服务机构综合排名", data: providerRanking(db, ctx).map(item => ({ id: item.id, label: item.label, value: item.score, meta: `完成率 ${percent(item.completionRate)}` })), suffix: "分", drill: "provider" },
        ],
      };
    }

    return {
      ...base,
      title: "参保覆盖分析",
      description: "识别地区和行业参保差距，定位未参保及即将到期企业。",
      cards: [
        { label: "应参保企业", value: number(current.enterpriseCount), drill: "enterprises" },
        { label: "已参保企业", value: number(current.coveredCount), drill: "coverage" },
        { label: "未参保企业", value: number(current.enterpriseCount - current.coveredCount), drill: "uncovered" },
        { label: "企业覆盖率", value: percent(current.coverageRate), drill: "coverage" },
      ],
      charts: [
        { type: "bar", title: "地区覆盖率", data: coverageBy(db, ctx, "region").map(item => ({ id: item.id, label: item.label, value: item.value })), suffix: "%", drill: "regionCoverage" },
        { type: "bar", title: "行业覆盖率", data: coverageBy(db, ctx, "industry").map(item => ({ id: item.id, label: item.label, value: item.value })), suffix: "%", drill: "industryCoverage" },
        { type: "heatmap", title: "区域 × 行业覆盖矩阵", data: coverageMatrix(db, ctx), drill: "coverageCell" },
        { type: "line", title: "月度投保与承保趋势", data: monthlyBusinessTrend(db, ctx), series: [{ key: "applications", label: "投保申请" }, { key: "policies", label: "承保出单" }], drill: "applications" },
      ],
    };
  }

  function labelFor(db, collection, id, fallback = id) {
    return db[collection].find(item => item.id === id)?.name
      || db[collection].find(item => item.id === id)?.shortName
      || fallback;
  }

  function detail(db, type, key, filtersInput = {}) {
    const ctx = context(db, filtersInput);
    let rows = [];
    let title = "明细数据";
    let columns = [];

    if (["coverage", "enterprises", "uncovered", "regionCoverage", "industryCoverage", "coverageCell"].includes(type)) {
      const covered = coveredEnterpriseIds(ctx.policies, ctx.filters.end);
      rows = ctx.enterprises.filter(item => {
        if (type === "uncovered" && covered.has(item.id)) return false;
        if (type === "coverage" && !covered.has(item.id)) return false;
        if (type === "regionCoverage" && key && item.regionId !== key) return false;
        if (type === "industryCoverage" && key && item.industryId !== key) return false;
        if (type === "coverageCell" && key) {
          const [regionId, industryId] = key.split("|");
          if (item.regionId !== regionId || item.industryId !== industryId) return false;
        }
        return true;
      }).map(item => ({
        id: item.id,
        name: item.name,
        region: labelFor(db, "regions", item.regionId),
        industry: labelFor(db, "industries", item.industryId),
        employees: item.employees,
        coverage: covered.has(item.id) ? "已参保" : "未参保",
      }));
      title = type === "uncovered" ? "未参保企业明细" : "企业参保明细";
      columns = [["id", "企业编号"], ["name", "企业名称"], ["region", "地区"], ["industry", "行业"], ["employees", "从业人数"], ["coverage", "参保状态"]];
    } else if (["applications"].includes(type)) {
      rows = ctx.applications.filter(item => inRange(item.createdAt, ctx.filters.start, ctx.filters.end)).map(item => ({
        id: item.id,
        enterprise: labelFor(db, "enterprises", item.enterpriseId),
        insurer: labelFor(db, "insurers", item.insurerId),
        product: item.sourceProduct || labelFor(db, "products", item.productId),
        createdAt: item.createdAt,
        premium: money(item.premium, false),
        status: item.status,
      }));
      title = "投保申请明细";
      columns = [["id", "申请编号"], ["enterprise", "企业"], ["insurer", "保险机构"], ["product", "产品"], ["createdAt", "申请日期"], ["premium", "保费"], ["status", "状态"]];
    } else if (["policies"].includes(type)) {
      rows = activePoliciesAt(ctx.policies, ctx.filters.end).map(item => ({
        id: item.policyNo,
        enterprise: labelFor(db, "enterprises", item.enterpriseId),
        insurer: labelFor(db, "insurers", item.insurerId),
        period: `${item.startDate} 至 ${item.endDate}`,
        premium: money(item.premium, false),
        sumInsured: money(item.sumInsured),
        status: item.status,
      }));
      title = "保单明细";
      columns = [["id", "保单号"], ["enterprise", "企业"], ["insurer", "保险机构"], ["period", "保险期间"], ["premium", "保费"], ["sumInsured", "保额"], ["status", "状态"]];
    } else if (["services", "overdueServices", "service"].includes(type)) {
      rows = ctx.tasks.filter(item => {
        if (!inRange(item.plannedDate, ctx.filters.start, ctx.filters.end)) return false;
        if (type === "overdueServices") return item.status !== "已归档" && item.dueDate < ctx.filters.end;
        if (type === "service" && key) return item.id === key;
        return true;
      }).map(item => ({
        id: item.id,
        enterprise: labelFor(db, "enterprises", item.enterpriseId),
        provider: labelFor(db, "serviceProviders", item.providerId),
        serviceType: item.serviceType,
        dueDate: item.dueDate,
        status: item.status,
      }));
      title = "事故预防服务任务明细";
      columns = [["id", "任务编号"], ["enterprise", "企业"], ["provider", "服务机构"], ["serviceType", "服务类型"], ["dueDate", "计划完成"], ["status", "状态"]];
    } else if (["hazards", "majorHazards", "overdueHazards", "hazard"].includes(type)) {
      rows = ctx.hazards.filter(item => {
        if (!inRange(item.discoveredAt, ctx.filters.start, ctx.filters.end)) return false;
        if (type === "majorHazards") return item.level === "重大";
        if (type === "overdueHazards") return overdueHazard(item, ctx.filters.end);
        if (type === "hazard" && key) return item.id === key;
        return true;
      }).map(item => ({
        id: item.id,
        enterprise: labelFor(db, "enterprises", item.enterpriseId),
        type: item.type,
        level: item.level,
        deadline: item.deadline,
        overdue: overdueHazard(item, ctx.filters.end) ? `${Data.daysBetween(item.deadline, ctx.filters.end)} 天` : "-",
        status: item.status,
      }));
      title = "隐患整改明细";
      columns = [["id", "隐患编号"], ["enterprise", "企业"], ["type", "类型"], ["level", "等级"], ["deadline", "整改期限"], ["overdue", "超期"], ["status", "状态"]];
    } else if (["claims", "openClaims", "closedClaims", "insurerClaims"].includes(type)) {
      rows = ctx.claims.filter(item => {
        if (!inRange(item.reportedAt, ctx.filters.start, ctx.filters.end)) return false;
        if (type === "openClaims") return item.status !== "已结案";
        if (type === "closedClaims") return item.status === "已结案";
        if (type === "insurerClaims" && key) return item.insurerId === key;
        return true;
      }).map(item => ({
        id: item.id,
        enterprise: labelFor(db, "enterprises", item.enterpriseId),
        insurer: labelFor(db, "insurers", item.insurerId),
        incidentType: item.incidentType,
        reportedAt: item.reportedAt,
        paidAmount: money(item.paidAmount, false),
        status: item.status,
      }));
      title = "理赔案件明细";
      columns = [["id", "赔案编号"], ["enterprise", "企业"], ["insurer", "保险机构"], ["incidentType", "事故类型"], ["reportedAt", "报案日期"], ["paidAmount", "赔付金额"], ["status", "状态"]];
    } else if (["insurer", "insurers"].includes(type)) {
      const ranking = insurerRanking(db, ctx).filter(item => !key || item.id === key);
      rows = ranking.map((item, index) => ({
        rank: index + 1,
        insurer: item.label,
        applications: item.applications,
        policies: item.policies,
        premium: money(item.premium),
        score: number(item.score, 1),
      }));
      title = "保险机构考核明细";
      columns = [["rank", "排名"], ["insurer", "保险机构"], ["applications", "申请"], ["policies", "有效保单"], ["premium", "保费"], ["score", "综合评分"]];
    } else if (["provider", "providers"].includes(type)) {
      const ranking = providerRanking(db, ctx).filter(item => !key || item.id === key);
      rows = ranking.map((item, index) => ({
        rank: index + 1,
        provider: item.label,
        tasks: item.tasks,
        completionRate: percent(item.completionRate),
        overdue: item.overdue,
        score: number(item.score, 1),
      }));
      title = "服务机构考核明细";
      columns = [["rank", "排名"], ["provider", "服务机构"], ["tasks", "任务"], ["completionRate", "完成率"], ["overdue", "超期隐患"], ["score", "综合评分"]];
    } else if (type === "complaints") {
      rows = db.complaints.map(item => ({
        id: item.id,
        enterprise: labelFor(db, "enterprises", item.enterpriseId),
        target: item.targetType === "保险机构"
          ? labelFor(db, "insurers", item.targetId)
          : labelFor(db, "serviceProviders", item.targetId),
        category: item.category,
        createdAt: item.createdAt,
        status: item.status,
      }));
      title = "投诉处理明细";
      columns = [["id", "投诉编号"], ["enterprise", "企业"], ["target", "被投诉机构"], ["category", "类别"], ["createdAt", "登记日期"], ["status", "状态"]];
    } else if (type === "evaluations") {
      rows = db.evaluations.map(item => ({
        id: item.id,
        enterprise: labelFor(db, "enterprises", item.enterpriseId),
        provider: labelFor(db, "serviceProviders", item.providerId),
        score: number(item.score, 1),
        comment: item.comment,
      }));
      title = "企业评价明细";
      columns = [["id", "评价编号"], ["enterprise", "企业"], ["provider", "服务机构"], ["score", "评分"], ["comment", "评价"]];
    }
    return { title, columns, rows };
  }

  function detailTable(detailData, limit = 100) {
    const rows = detailData.rows.slice(0, limit);
    return `
      <div class="detail-summary">共 ${number(detailData.rows.length)} 条，当前显示 ${number(rows.length)} 条</div>
      <div class="table-scroll">
        <table class="data-table">
          <thead><tr>${detailData.columns.map(([, label]) => `<th>${escapeHtml(label)}</th>`).join("")}</tr></thead>
          <tbody>
            ${rows.length ? rows.map(row => `
              <tr>${detailData.columns.map(([key]) => `<td>${escapeHtml(row[key])}</td>`).join("")}</tr>
            `).join("") : `<tr><td colspan="${detailData.columns.length}"><div class="empty-state">当前筛选条件下暂无数据</div></td></tr>`}
          </tbody>
        </table>
      </div>
    `;
  }

  function barChart(data, options = {}) {
    const max = Math.max(...data.map(item => Number(item.value) || 0), 1);
    const formatter = options.valueFormatter || (value => `${number(value, options.decimals || 0)}${options.suffix || ""}`);
    return `
      <div class="bar-chart">
        ${data.map((item, index) => {
          const size = clamp((Number(item.value) / max) * 100, 2, 100);
          return `
            <button class="bar-row chart-action" data-drill="${escapeHtml(options.drill || "")}" data-key="${escapeHtml(item.id || item.label)}" type="button">
              <span class="bar-rank">${index + 1}</span>
              <span class="bar-label">${escapeHtml(item.label)}</span>
              <span class="bar-track"><span class="bar-fill" style="--bar-size:${size}%"></span></span>
              <strong>${escapeHtml(formatter(item.value))}</strong>
            </button>
          `;
        }).join("")}
      </div>
    `;
  }

  function rankingChart(data, options = {}) {
    return `
      <div class="ranking-list">
        ${data.map((item, index) => `
          <button class="ranking-item chart-action" data-drill="${escapeHtml(options.drill || "")}" data-key="${escapeHtml(item.id || item.label)}" type="button">
            <span class="ranking-index">${index + 1}</span>
            <span class="ranking-copy"><strong>${escapeHtml(item.label)}</strong><small>${escapeHtml(item.meta || "")}</small></span>
            <span class="ranking-score">${number(item.value, 1)}${escapeHtml(options.suffix || "")}</span>
          </button>
        `).join("")}
      </div>
    `;
  }

  function donutChart(data, options = {}) {
    const total = data.reduce((sum, item) => sum + Number(item.value || 0), 0) || 1;
    const radius = 58;
    const circumference = 2 * Math.PI * radius;
    const colors = ["var(--cp-link)", "var(--cp-accent)", "var(--cp-success)", "var(--cp-warning)", "var(--cp-danger)", "var(--cp-text-muted)"];
    let offset = 0;
    const circles = data.map((item, index) => {
      const length = (item.value / total) * circumference;
      const circle = `<circle class="donut-segment chart-action" data-drill="${escapeHtml(options.drill || "")}" data-key="${escapeHtml(item.label)}" cx="80" cy="80" r="${radius}" pathLength="${circumference}" stroke="${colors[index % colors.length]}" stroke-dasharray="${length} ${circumference - length}" stroke-dashoffset="${-offset}" />`;
      offset += length;
      return circle;
    }).join("");
    return `
      <div class="donut-layout">
        <svg class="donut-chart" viewBox="0 0 160 160" role="img" aria-label="${escapeHtml(options.title || "分布图")}">
          <circle class="donut-base" cx="80" cy="80" r="${radius}" />
          ${circles}
          <text x="80" y="74" text-anchor="middle" class="donut-total">${number(total)}</text>
          <text x="80" y="96" text-anchor="middle" class="donut-caption">合计</text>
        </svg>
        <div class="chart-legend">
          ${data.map((item, index) => `
            <button class="legend-item chart-action" data-drill="${escapeHtml(options.drill || "")}" data-key="${escapeHtml(item.label)}" type="button">
              <span class="legend-dot chart-tone-${index % colors.length}"></span>
              <span>${escapeHtml(item.label)}</span>
              <strong>${number(item.value)}</strong>
            </button>
          `).join("")}
        </div>
      </div>
    `;
  }

  function lineChart(data, series, options = {}) {
    const width = 720;
    const height = 240;
    const padX = 42;
    const padY = 28;
    const values = data.flatMap(item => series.map(value => Number(item[value.key]) || 0));
    const max = Math.max(...values, 1);
    const stepX = data.length > 1 ? (width - padX * 2) / (data.length - 1) : 0;
    const colors = ["var(--cp-link)", "var(--cp-accent)", "var(--cp-success)"];
    const paths = series.map((item, seriesIndex) => {
      const points = data.map((entry, index) => {
        const x = padX + stepX * index;
        const y = height - padY - ((Number(entry[item.key]) || 0) / max) * (height - padY * 2);
        return { x, y, value: entry[item.key], label: entry.label };
      });
      const d = points.map((point, index) => `${index ? "L" : "M"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ");
      return `
        <path d="${d}" fill="none" stroke="${colors[seriesIndex % colors.length]}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
        ${points.map(point => `<circle class="chart-action" data-drill="${escapeHtml(options.drill || "")}" data-key="${escapeHtml(point.label)}" cx="${point.x}" cy="${point.y}" r="4" fill="${colors[seriesIndex % colors.length]}"><title>${escapeHtml(item.label)} ${escapeHtml(point.label)}：${number(point.value)}</title></circle>`).join("")}
      `;
    }).join("");
    const grid = [0, 0.25, 0.5, 0.75, 1].map(fraction => {
      const y = height - padY - fraction * (height - padY * 2);
      return `<line x1="${padX}" y1="${y}" x2="${width - padX}" y2="${y}" class="chart-grid-line" /><text x="${padX - 8}" y="${y + 4}" text-anchor="end" class="chart-axis-label">${number(max * fraction)}</text>`;
    }).join("");
    return `
      <div class="line-chart-wrap">
        <div class="line-legend">${series.map((item, index) => `<span><i class="chart-tone-${index % colors.length}"></i>${escapeHtml(item.label)}</span>`).join("")}</div>
        <svg class="line-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(options.title || "趋势图")}">
          ${grid}
          ${paths}
          ${data.map((item, index) => `<text x="${padX + stepX * index}" y="${height - 6}" text-anchor="middle" class="chart-axis-label">${escapeHtml(item.label)}</text>`).join("")}
        </svg>
      </div>
    `;
  }

  function funnelChart(data, options = {}) {
    const max = Math.max(...data.map(item => Number(item.value) || 0), 1);
    return `
      <div class="funnel-chart">
        ${data.map((item, index) => {
          const width = clamp((item.value / max) * 100, 22, 100);
          return `
            <button class="funnel-step chart-action" data-drill="${escapeHtml(options.drill || "")}" data-key="${escapeHtml(item.label)}" type="button" style="--funnel-size:${width}%">
              <span>${escapeHtml(item.label)}</span>
              <strong>${number(item.value)}</strong>
              ${index ? `<small>转化 ${percent(rate(item.value, data[index - 1].value))}</small>` : "<small>100%</small>"}
            </button>
          `;
        }).join("")}
      </div>
    `;
  }

  function heatmapChart(matrix, options = {}) {
    return `
      <div class="heatmap-scroll">
        <div class="heatmap" style="--heatmap-columns:${matrix.columns.length}">
          <div class="heatmap-corner">地区 / 行业</div>
          ${matrix.columns.map(column => `<div class="heatmap-heading">${escapeHtml(column.label)}</div>`).join("")}
          ${matrix.rows.map(row => `
            <div class="heatmap-row-label">${escapeHtml(row.label)}</div>
            ${row.cells.map(cell => `
              <button
                type="button"
                class="heatmap-cell heat-${cell.total ? Math.max(1, Math.ceil(cell.value / 20)) : 0} chart-action"
                data-drill="${escapeHtml(options.drill || "")}"
                data-key="${escapeHtml(`${cell.regionId}|${cell.industryId}`)}"
                title="${escapeHtml(`${row.label} / ${matrix.columns.find(item => item.id === cell.industryId)?.label}：${percent(cell.value)}（${cell.covered}/${cell.total}）`)}"
              >${cell.total ? number(cell.value, 0) : "-"}</button>
            `).join("")}
          `).join("")}
        </div>
      </div>
    `;
  }

  function renderChart(spec) {
    const renderers = { line: () => lineChart(spec.data, spec.series, spec), donut: () => donutChart(spec.data, spec),
      funnel: () => funnelChart(spec.data, spec), heatmap: () => heatmapChart(spec.data, spec),
      ranking: () => rankingChart(spec.data, spec) };
    const chart = renderers[spec.type] ? renderers[spec.type]() : barChart(spec.data, spec);
    const formatValue = spec.valueFormatter || (value => `${number(value, spec.decimals || 0)}${spec.suffix || ""}`);
    const headers = spec.type === "line" ? ["期间", ...spec.series.map(series => series.label)]
      : spec.type === "heatmap" ? ["地区／行业", "覆盖率", "覆盖／总数"] : ["项目", "数值", "说明"];
    const rows = spec.type === "heatmap" ? spec.data.rows.flatMap(row => row.cells.map(cell => ({
      key: `${cell.regionId}|${cell.industryId}`,
      values: [`${row.label}／${spec.data.columns.find(column => column.id === cell.industryId)?.label || cell.industryId}`,
        cell.total ? percent(cell.value) : "无数据", `${cell.covered}／${cell.total}`],
    }))) : spec.data.map(row => ({
      key: row.id || row.label,
      values: spec.type === "line" ? [row.label, ...spec.series.map(series => number(row[series.key]))]
        : [row.label, formatValue(row.value), row.meta || ""],
    }));
    return `${chart}<details class="chart-values no-print"><summary>查看图表数据与明细</summary><div class="table-scroll"><table class="data-table">
      <thead><tr>${headers.map(label => `<th>${escapeHtml(label)}</th>`).join("")}${spec.drill ? "<th>明细</th>" : ""}</tr></thead>
      <tbody>${rows.map(row => `<tr>${row.values.map(value => `<td>${escapeHtml(value)}</td>`).join("")}
      ${spec.drill ? `<td><button class="btn btn-quiet" data-drill="${escapeHtml(spec.drill)}" data-key="${escapeHtml(row.key)}">查看关联明细</button></td>` : ""}</tr>`).join("")}</tbody>
      </table></div></details>`;
  }

  function brief(db, filtersInput = {}) {
    const report = dashboard(db, filtersInput);
    const lowestRegion = [...report.regionCoverage].sort((left, right) => left.value - right.value)[0];
    const topInsurer = report.insurerRanking[0];
    const topProvider = report.providerRanking[0];
    const narratives = [
      `截至 ${db.meta.businessDate}，纳入监管企业 ${number(report.current.enterpriseCount)} 家，已参保 ${number(report.current.coveredCount)} 家，覆盖率为 ${percent(report.current.coverageRate)}。`,
      lowestRegion
        ? `${lowestRegion.label}覆盖率为 ${percent(lowestRegion.value)}，低于示范目标 ${percent(Math.max(0, lowestRegion.target - lowestRegion.value))}，建议列为近期推动重点。`
        : "当前筛选条件下无地区覆盖数据。",
      `事故预防服务完成率为 ${percent(report.current.serviceCompletionRate)}，隐患整改率为 ${percent(report.current.hazardRectificationRate)}，超期重大隐患 ${number(report.current.overdueMajorCount)} 项。`,
      `保险机构综合表现由 ${topInsurer?.label || "-"} 暂列第一，技术服务机构由 ${topProvider?.label || "-"} 暂列第一。`,
      `当前在办理赔案件 ${number(report.current.openClaimCount)} 起，累计赔付 ${money(report.current.paidAmount)}。`,
    ];
    return { ...report, narratives };
  }

  function toCsv(detailData) {
    const quote = value => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const header = detailData.columns.map(([, label]) => quote(label)).join(",");
    const rows = detailData.rows.map(row => detailData.columns.map(([key]) => quote(row[key])).join(","));
    return `\ufeff${[header, ...rows].join("\r\n")}`;
  }

  function filterLabel(db, filtersInput) {
    const filters = normalizeFilters(db, filtersInput);
    const labels = [filters.label];
    if (filters.regionId) labels.push(labelFor(db, "regions", filters.regionId));
    if (filters.industryId) labels.push(labelFor(db, "industries", filters.industryId));
    if (filters.insurerId) labels.push(labelFor(db, "insurers", filters.insurerId));
    if (filters.providerId) labels.push(labelFor(db, "serviceProviders", filters.providerId));
    return labels.join(" · ");
  }

  global.AZXDemoReports = Object.freeze({
    normalizeFilters,
    dashboard,
    topicReport,
    coverageMatrix,
    detail,
    detailTable,
    renderChart,
    brief,
    toCsv,
    filterLabel,
    insurerRanking,
    providerRanking,
    money,
    number,
    percent,
    escapeHtml,
    overdueHazard,
  });
})(globalThis);
