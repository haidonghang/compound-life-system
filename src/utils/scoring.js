export const defaultCategories = ['学习成长', '实习职业', '身体财富', '表达能力', '项目作品', '其他'];
export const priorities = ['S', 'A', 'B', 'C', 'D'];
export const goalLevels = [
  { value: 'ten_year', label: '十年目标' },
  { value: 'five_year', label: '五年目标' },
  { value: 'three_year', label: '三年目标' },
  { value: 'one_year', label: '一年目标' },
  { value: 'month', label: '月目标' },
  { value: 'week', label: '周目标' },
  { value: 'day', label: '日目标' },
];
export const taskStatuses = [
  { value: 'pending', label: '待开始' },
  { value: 'running', label: '执行中' },
  { value: 'paused', label: '已暂停' },
  { value: 'completed', label: '已完成' },
  { value: 'partially_completed', label: '部分完成' },
  { value: 'abandoned', label: '已放弃' },
];
export const evidenceTypes = [
  { value: 'note', label: '笔记' },
  { value: 'screenshot', label: '截图说明' },
  { value: 'code', label: '代码' },
  { value: 'drawing', label: '图纸' },
  { value: 'audio', label: '录音说明' },
  { value: 'delivery_record', label: '投递记录' },
  { value: 'review_text', label: '复盘文字' },
  { value: 'link', label: '链接' },
  { value: 'file', label: '文件' },
  { value: 'other', label: '其他' },
];

const evidenceRequiredCategories = ['学习成长', '实习职业', '表达能力', '项目作品'];

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

export function priorityFromScore(score) {
  if (score >= 85) return 'S';
  if (score >= 70) return 'A';
  if (score >= 50) return 'B';
  if (score >= 40) return 'C';
  return 'D';
}

export function evidenceTypeLabel(type) {
  return evidenceTypes.find((item) => item.value === type)?.label || type || '其他';
}

export function shouldRequireEvidence(task) {
  if (typeof task.requiresEvidence === 'boolean') return task.requiresEvidence;
  return evidenceRequiredCategories.includes(task.category);
}

export function hasEvidence(task) {
  return Array.isArray(task.evidenceItems) && task.evidenceItems.length > 0;
}

export function calculateTaskScore(task, context = {}) {
  const minutes = Number(task.estimatedMinutes || 0);
  const energy = context.energyLevel || 'normal';
  const title = String(task.title || '');
  const hasGoal = Boolean(task.goalId);
  const requiresEvidence = shouldRequireEvidence(task);

  const categoryValue =
    {
      学习成长: 19,
      实习职业: 18,
      身体财富: 15,
      表达能力: 15,
      项目作品: 18,
      其他: 8,
    }[task.category] || 12;

  const longTermAlignment = hasGoal ? 20 : Math.min(16, categoryValue);
  const compoundValue = categoryValue + (/复盘|练习|作品|项目|输出|记录|交付|简历|错题/.test(title) ? 1 : 0);
  const executability = minutes <= 0 ? 6 : minutes <= 30 ? 15 : minutes <= 60 ? 14 : minutes <= 120 ? 12 : minutes <= 240 ? 9 : 7;
  const resultImpact = /交付|完成|输出|复盘|练习|记录|作品|简历|面试|还款|存钱/.test(title) ? 15 : 10;
  const evidenceOutput = requiresEvidence ? (hasEvidence(task) ? 15 : 9) : 10;
  const taskDate = task.date || (task.deadline ? String(task.deadline).slice(0, 10) : '');
  const today = context.date || new Date().toISOString().slice(0, 10);
  const urgent = taskDate === today ? 9 : task.deadline ? 7 : 5;

  let bodyFit = 4;
  if (energy === 'low') bodyFit = minutes <= 45 || task.category === '身体财富' ? 5 : 2;
  if (energy === 'sprint') bodyFit = minutes <= 180 ? 5 : 3;

  return Math.round(
    clamp(longTermAlignment, 0, 20) +
      clamp(compoundValue, 0, 20) +
      clamp(executability, 0, 15) +
      clamp(resultImpact, 0, 15) +
      clamp(evidenceOutput, 0, 15) +
      clamp(urgent, 0, 10) +
      clamp(bodyFit, 0, 5)
  );
}

export function calculateDailyCompoundScore(tasks = []) {
  if (!tasks.length) return 0;
  const total = tasks.reduce((sum, task) => {
    const score = Number(task.score || 0);
    const progress = clamp(task.progress, 0, 100) / 100;
    const quality = clamp(task.qualityScore ?? 80, 0, 100) / 100;
    return sum + score * progress * quality;
  }, 0);
  return Math.round(clamp(total / tasks.length));
}

export function detectFakeEffort(task, historyTasks = []) {
  const warnings = [];
  const title = String(task.title || '');
  const vagueWords = /整理资料|看视频|学习|了解|研究一下|提升|看看|熟悉/;

  if (vagueWords.test(title) && !hasEvidence(task)) {
    warnings.push('任务表述偏模糊，且没有交付物，可能是伪努力。');
  }

  if (task.estimatedMinutes > 30 && shouldRequireEvidence(task) && !hasEvidence(task)) {
    warnings.push('重要任务超过 30 分钟，但缺少笔记、截图说明、代码、图纸、录音说明、链接等证据。');
  }

  if (task.category === '项目作品' && !hasEvidence(task)) {
    warnings.push('项目作品类任务需要至少一个交付物。');
  }

  if (title.length <= 4) {
    warnings.push('任务颗粒度偏粗，建议改成有数量、有动作、有交付物的一步。');
  }

  const recent = historyTasks.slice(0, 30);
  const planned = recent.filter((item) => item.status !== 'abandoned').length;
  const completed = recent.filter((item) => ['completed', 'partially_completed'].includes(item.status)).length;
  if (planned >= 10 && completed / planned < 0.35) {
    warnings.push('任务过载，建议今天只保留三件大事。');
  }

  return {
    isFakeEffort: warnings.length > 0,
    warnings,
    suggestion: warnings.length ? '请把任务改成有数量、有动作、有交付物的一步。' : '',
  };
}

export function lowScoreWarning(score) {
  return score < 40 ? '这件事成长价值较低，请判断它是成长任务还是娱乐任务。' : '';
}
