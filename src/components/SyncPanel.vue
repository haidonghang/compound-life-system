<script setup>
import { reactive, ref } from 'vue';
import { useAppStore } from '../store/useAppStore';
import { readJsonFile } from '../services/storageService';

const {
  getters,
  signUp,
  signIn,
  signOut,
  uploadLocalDataToCloud,
  downloadCloudDataToLocal,
  exportAllData,
  importAllData,
} = useAppStore();

const form = reactive({
  email: '',
  password: '',
});
const expanded = ref(false);
const notice = ref('');
const fileInput = ref(null);

async function register() {
  const result = await signUp(form.email.trim(), form.password);
  notice.value = result.ok ? '注册请求已提交。如 Supabase 开启邮箱确认，请先去邮箱确认。' : result.error;
}

async function login() {
  const result = await signIn(form.email.trim(), form.password);
  notice.value = result.ok ? '已登录。现在可以上传本地数据或从云端拉取。' : result.error;
}

async function logout() {
  const result = await signOut();
  notice.value = result.ok ? '已退出登录，当前回到本地模式。' : result.error;
}

async function uploadLocal() {
  if (!window.confirm('确认把当前本地数据上传到云端吗？同 id 数据会被更新。')) return;
  const result = await uploadLocalDataToCloud();
  notice.value = result.ok ? '本地数据已上传到云端。' : result.error;
}

async function downloadCloud() {
  if (!window.confirm('确认从云端拉取数据到本地吗？这会覆盖当前本地 goals/tasks/reviews/events/settings。')) return;
  const result = await downloadCloudDataToLocal();
  notice.value = result.ok ? '云端数据已拉取到本地。' : result.error;
}

function triggerImport() {
  fileInput.value?.click();
}

async function handleImport(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const payload = await readJsonFile(file);
    if (!window.confirm('导入 JSON 会覆盖当前本地数据。请确认你已经备份，是否继续？')) return;
    const result = importAllData(payload);
    notice.value = result.ok ? 'JSON 数据已导入。' : result.error;
  } catch (error) {
    notice.value = error.message;
  } finally {
    event.target.value = '';
  }
}
</script>

<template>
  <section class="sync-panel panel">
    <div class="sync-panel-head">
      <div>
        <span class="small-label">同步/账号</span>
        <strong>{{ getters.syncStatus.value.message }}</strong>
        <small v-if="getters.syncStatus.value.user">{{ getters.syncStatus.value.user.email }}</small>
        <small v-else-if="!getters.syncStatus.value.configured">未配置 Supabase 环境变量时仅使用本地模式</small>
      </div>
      <button class="ghost-btn compact-btn" type="button" @click="expanded = !expanded">
        {{ expanded ? '收起' : '账号/备份' }}
      </button>
    </div>

    <div v-if="expanded" class="sync-panel-body">
      <div v-if="!getters.syncStatus.value.user" class="auth-grid">
        <label>
          邮箱
          <input v-model.trim="form.email" type="email" placeholder="you@example.com" />
        </label>
        <label>
          密码
          <input v-model="form.password" type="password" placeholder="至少 6 位" />
        </label>
        <div class="button-row">
          <button class="ghost-btn" type="button" @click="register">注册</button>
          <button class="primary-btn" type="button" @click="login">登录</button>
        </div>
      </div>

      <div v-else class="button-row">
        <button class="ghost-btn" type="button" @click="logout">退出登录</button>
        <button class="primary-btn" type="button" @click="uploadLocal">上传本地数据到云端</button>
        <button class="ghost-btn" type="button" @click="downloadCloud">从云端拉取数据</button>
      </div>

      <div class="button-row">
        <button class="ghost-btn" type="button" @click="exportAllData">导出 JSON</button>
        <button class="ghost-btn" type="button" @click="triggerImport">导入 JSON</button>
        <input ref="fileInput" class="hidden-file" type="file" accept="application/json,.json" @change="handleImport" />
      </div>

      <p v-if="notice" class="inline-notice">{{ notice }}</p>
    </div>
  </section>
</template>
