const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export function isSupabaseConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

export function getSupabaseConfig() {
  return {
    url: SUPABASE_URL,
    anonKey: SUPABASE_ANON_KEY,
    configured: isSupabaseConfigured(),
  };
}

export async function supabaseFetch(path, options = {}) {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase 未配置，请先设置 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY。');
  }

  const url = `${SUPABASE_URL}${path}`;
  const headers = {
    apikey: SUPABASE_ANON_KEY,
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = data?.msg || data?.message || data?.error_description || data?.error || 'Supabase 请求失败。';
    throw new Error(message);
  }

  return data;
}

export async function supabaseRawFetch(path, options = {}) {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase 未配置，请先设置 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY。');
  }

  const response = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    const message = data?.msg || data?.message || data?.error_description || data?.error || 'Supabase 请求失败。';
    throw new Error(message);
  }

  return data;
}
