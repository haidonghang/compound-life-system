export const STORAGE_KEY = 'compound-life-system-state';

export function loadState(createFallbackState) {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createFallbackState();
    return JSON.parse(raw);
  } catch {
    return createFallbackState();
  }
}

export function saveState(state) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function createExportPayload(state) {
  return {
    app: 'compound-life-system',
    schemaVersion: '3.1.4',
    exportedAt: new Date().toISOString(),
    data: {
      goals: Array.isArray(state.goals) ? state.goals : [],
      tasks: Array.isArray(state.tasks) ? state.tasks : [],
      events: Array.isArray(state.events) ? state.events : [],
      reviews: Array.isArray(state.reviews) ? state.reviews : [],
      settings: state.settings || {},
    },
  };
}

export function downloadJson(payload, filename = 'compound-life-system-backup.json') {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function readJsonFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(JSON.parse(String(reader.result || '{}')));
      } catch {
        reject(new Error('JSON 文件格式错误，无法解析。'));
      }
    };
    reader.onerror = () => reject(new Error('读取文件失败，请重新选择 JSON 文件。'));
    reader.readAsText(file, 'utf-8');
  });
}

export function validateImportPayload(payload) {
  const data = payload?.data || payload;
  if (!data || typeof data !== 'object') {
    return { ok: false, error: '导入内容不是有效的数据对象。' };
  }

  const requiredArrays = ['goals', 'tasks', 'reviews'];
  const invalidKey = requiredArrays.find((key) => !Array.isArray(data[key]));
  if (invalidKey) {
    return { ok: false, error: `导入失败：${invalidKey} 必须是数组。` };
  }

  if (!data.settings || typeof data.settings !== 'object') {
    return { ok: false, error: '导入失败：settings 必须是对象。' };
  }

  return {
    ok: true,
    data: {
      version: '3.1.4',
      settings: data.settings,
      goals: data.goals,
      tasks: data.tasks,
      events: Array.isArray(data.events) ? data.events : [],
      reviews: data.reviews,
    },
  };
}
