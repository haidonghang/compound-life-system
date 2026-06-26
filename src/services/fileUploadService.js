import { getSupabaseConfig, supabaseFetch, supabaseRawFetch } from './supabaseClient';
import { getCloudAccessToken, getCloudUser } from './cloudSyncService';

const BUCKET = 'evidence-files';
const MAX_FILE_SIZE = 10 * 1024 * 1024;

function uid() {
  return window.crypto?.randomUUID ? window.crypto.randomUUID() : `evidence_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function authHeaders(json = true) {
  const token = getCloudAccessToken();
  if (!token) throw new Error('文件上传需要先登录。');
  return {
    Authorization: `Bearer ${token}`,
    ...(json ? { 'Content-Type': 'application/json' } : {}),
  };
}

function currentUserId() {
  const id = getCloudUser()?.id;
  if (!id) throw new Error('文件上传需要先登录。');
  return id;
}

function sanitizeFileName(name) {
  return String(name || 'evidence-file')
    .replace(/[\\/:*?"<>|#%{}[\]^~`]/g, '-')
    .replace(/\s+/g, '-')
    .slice(0, 120);
}

function encodeStoragePath(path) {
  return path.split('/').map(encodeURIComponent).join('/');
}

function rowToEvidenceItem(row) {
  return {
    id: row.id,
    type: row.type || 'file',
    title: row.title || row.file_name || '文件交付物',
    content: row.content || '',
    url: row.url || '',
    storagePath: row.storage_path || '',
    fileName: row.file_name || '',
    fileType: row.file_type || '',
    fileSize: Number(row.file_size || 0),
    createdAt: row.created_at || nowIso(),
    updatedAt: row.updated_at || nowIso(),
  };
}

async function upsertEvidenceRow(row) {
  const rows = await supabaseFetch('/rest/v1/evidence_items?on_conflict=id', {
    method: 'POST',
    headers: {
      ...authHeaders(),
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify(row),
  });
  return rowToEvidenceItem(rows?.[0] || row);
}

export function validateEvidenceFile(file) {
  if (!file) return { ok: false, error: '请先选择文件。' };
  if (file.size > MAX_FILE_SIZE) return { ok: false, error: '单个文件不能超过 10MB，请压缩后上传或改为填写链接。' };
  return { ok: true };
}

export async function uploadEvidenceFile(taskId, file, evidenceMeta = {}) {
  const check = validateEvidenceFile(file);
  if (!check.ok) throw new Error(check.error);

  const userId = currentUserId();
  const evidenceId = evidenceMeta.id || uid();
  const fileName = sanitizeFileName(file.name);
  const storagePath = `${userId}/${taskId}/${evidenceId}/${fileName}`;
  const contentType = file.type || 'application/octet-stream';

  await supabaseRawFetch(`/storage/v1/object/${BUCKET}/${encodeStoragePath(storagePath)}`, {
    method: 'POST',
    headers: {
      ...authHeaders(false),
      'Content-Type': contentType,
      'x-upsert': 'false',
    },
    body: file,
  });

  return upsertEvidenceRow({
    id: evidenceId,
    user_id: userId,
    task_id: taskId,
    type: evidenceMeta.type || 'file',
    title: evidenceMeta.title || file.name,
    content: evidenceMeta.content || '',
    url: evidenceMeta.url || '',
    storage_path: storagePath,
    file_name: file.name,
    file_type: contentType,
    file_size: file.size,
    created_at: evidenceMeta.createdAt || nowIso(),
    updated_at: nowIso(),
  });
}

export async function saveEvidenceMetadata(taskId, item) {
  const userId = currentUserId();
  return upsertEvidenceRow({
    id: item.id || uid(),
    user_id: userId,
    task_id: taskId,
    type: item.type || 'note',
    title: item.title || item.fileName || '交付物',
    content: item.content || '',
    url: item.url || '',
    storage_path: item.storagePath || '',
    file_name: item.fileName || '',
    file_type: item.fileType || '',
    file_size: Number(item.fileSize || 0),
    created_at: item.createdAt || nowIso(),
    updated_at: nowIso(),
  });
}

export async function getEvidenceSignedUrl(storagePath) {
  if (!storagePath) throw new Error('文件路径为空。');
  const result = await supabaseFetch(`/storage/v1/object/sign/${BUCKET}/${encodeStoragePath(storagePath)}`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ expiresIn: 60 * 10 }),
  });
  const signedURL = result?.signedURL || result?.signedUrl || '';
  if (!signedURL) throw new Error('无法生成文件访问链接。');
  return signedURL.startsWith('http') ? signedURL : `${getSupabaseConfig().url}${signedURL}`;
}

export async function deleteEvidenceFile(storagePath) {
  if (!storagePath) return;
  await supabaseRawFetch(`/storage/v1/object/${BUCKET}`, {
    method: 'DELETE',
    headers: authHeaders(),
    body: JSON.stringify({ prefixes: [storagePath] }),
  });
  await supabaseFetch(`/rest/v1/evidence_items?storage_path=eq.${encodeURIComponent(storagePath)}`, {
    method: 'DELETE',
    headers: {
      ...authHeaders(),
      Prefer: 'return=minimal',
    },
  });
}

export async function deleteEvidenceItem(id) {
  if (!id) return;
  await supabaseFetch(`/rest/v1/evidence_items?id=eq.${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: {
      ...authHeaders(),
      Prefer: 'return=minimal',
    },
  });
}

export async function listTaskEvidence(taskId) {
  const rows = await supabaseFetch(`/rest/v1/evidence_items?task_id=eq.${encodeURIComponent(taskId)}&order=created_at.asc`, {
    headers: authHeaders(),
  });
  return Array.isArray(rows) ? rows.map(rowToEvidenceItem) : [];
}
