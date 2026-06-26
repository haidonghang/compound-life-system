<script setup>
import { computed, reactive, ref, watch } from 'vue';
import PageHeader from '../components/PageHeader.vue';
import StatCard from '../components/StatCard.vue';
import { useAppStore } from '../store/useAppStore';
import { addDays, todayKey } from '../utils/date';
import { readJsonFile } from '../services/storageService';

const {
  state,
  getters,
  tasksForDay,
  completionRateForDay,
  calculateDailyCompoundScore,
  fakeEffortForTask,
  upsertReview,
  createRescueTask,
  exportAllData,
  importAllData,
} = useAppStore();

const selectedDate = ref(todayKey());
const monthCursor = ref(new Date());
const fileInput = ref(null);
const notice = ref('');
const reviewForm = reactive({
  offMainLine: 'no',
  biggestGain: '',
  tomorrowChange: '',
  notes: '',
});

const selectedTasks = computed(() => tasksForDay(selectedDate.value));
const completedTasks = computed(() => selectedTasks.value.filter((task) => ['completed', 'partially_completed'].includes(task.status)));
const unfinishedTasks = computed(() =>
  selectedTasks.value.filter((task) => !['completed', 'partially_completed', 'abandoned'].includes(task.status))
);
const selectedReview = computed(() => state.reviews.find((review) => review.date === selectedDate.value));
const missedSTasks = computed(() => selectedTasks.value.filter((task) => task.priority === 'S' && task.progress < 100));
const fakeEffortWarnings = computed(() =>
  selectedTasks.value
    .map((task) => ({ task, result: fakeEffortForTask(task) }))
    .filter((item) => item.result.warnings.length)
);
const monthLabel = computed(() => monthCursor.value.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' }));
const monthDays = computed(() => {
  const year = monthCursor.value.getFullYear();
  const month = monthCursor.value.getMonth();
  const first = new Date(year, month, 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }).map((_, index) => {
    const date = todayKey(addDays(start, index));
    const tasks = tasksForDay(date);
    const rate = completionRateForDay(date);
    const status = !tasks.length ? 'empty' : rate >= 80 ? 'good' : rate >= 40 ? 'partial' : 'off';
    return {
      date,
      day: Number(date.slice(8, 10)),
      inMonth: new Date(date).getMonth() === month,
      rate,
      compoundScore: calculateDailyCompoundScore(tasks),
      status,
    };
  });
});

watch(
  () => selectedDate.value,
  () => {
    const review = selectedReview.value;
    Object.assign(reviewForm, {
      offMainLine: review?.offMainLine || 'no',
      biggestGain: review?.biggestGain || '',
      tomorrowChange: review?.tomorrowChange || '',
      notes: review?.notes || '',
    });
  },
  { immediate: true }
);

function saveReview() {
  upsertReview({
    date: selectedDate.value,
    ...reviewForm,
  });
  notice.value = '复盘已保存。';
}

function shiftMonth(offset) {
  monthCursor.value = new Date(monthCursor.value.getFullYear(), monthCursor.value.getMonth() + offset, 1);
}

function rescue(task) {
  createRescueTask(task);
  notice.value = '已生成次日补救任务。';
}

function triggerImport() {
  fileInput.value?.click();
}

async function handleImport(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const payload = await readJsonFile(file);
    const confirmed = window.confirm('导入会覆盖当前本地数据。请确认你已经导出过备份，是否继续？');
    if (!confirmed) return;
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
  <PageHeader title="复盘台" eyebrow="Review">
    <div class="header-stack">
      <span class="sync-pill">{{ getters.syncStatus.value.message }}</span>
    </div>
  </PageHeader>

  <section class="stat-grid compact-stats">
    <StatCard label="7天平均复利分" :value="getters.sevenDayAverageCompound.value" hint="最近状态" />
    <StatCard label="今日完成率" :value="`${getters.todayCompletionRate.value}%`" hint="按进度均值" />
    <StatCard label="连续执行" :value="`${getters.streakDays.value} 天`" hint="任务或复盘" />
  </section>

  <section class="content-grid two">
    <form class="panel review-form" @submit.prevent="saveReview">
      <div class="panel-title">
        <div>
          <h2>每日复盘</h2>
          <span>{{ selectedDate }}</span>
        </div>
        <input class="date-field" v-model="selectedDate" type="date" />
      </div>

      <label>
        今天是否偏离主线？
        <select v-model="reviewForm.offMainLine">
          <option value="no">没有</option>
          <option value="slight">有一点</option>
          <option value="yes">严重偏离</option>
        </select>
      </label>
      <label>
        今天最大收获是什么？
        <select v-model="reviewForm.biggestGain">
          <option value="">请选择</option>
          <option>学到了新知识</option>
          <option>完成了重要任务</option>
          <option>产生了交付物</option>
          <option>发现了问题</option>
          <option>保持了状态</option>
          <option>其他</option>
        </select>
      </label>
      <label>
        明天怎么改？
        <select v-model="reviewForm.tomorrowChange">
          <option value="">请选择</option>
          <option>只保留三件大事</option>
          <option>上午先做最重要任务</option>
          <option>降低任务量</option>
          <option>增加交付物要求</option>
          <option>早点睡</option>
          <option>其他</option>
        </select>
      </label>
      <label>
        补充文字
        <textarea v-model.trim="reviewForm.notes" rows="3" placeholder="可选：今天发生了什么，明天第一步是什么"></textarea>
      </label>

      <div class="review-summary">
        <div>
          <span class="small-label">已完成</span>
          <strong>{{ completedTasks.length }}</strong>
        </div>
        <div>
          <span class="small-label">未完成</span>
          <strong>{{ unfinishedTasks.length }}</strong>
        </div>
        <div>
          <span class="small-label">伪努力提醒</span>
          <strong>{{ fakeEffortWarnings.length }}</strong>
        </div>
      </div>
      <button class="primary-btn full-btn" type="submit">保存复盘</button>
    </form>

    <div class="panel">
      <div class="panel-title">
        <div>
          <h2>月视图</h2>
          <span>{{ monthLabel }}</span>
        </div>
        <div class="button-row tight">
          <button class="ghost-btn compact-btn" type="button" @click="shiftMonth(-1)">上月</button>
          <button class="ghost-btn compact-btn" type="button" @click="shiftMonth(1)">下月</button>
        </div>
      </div>
      <div class="month-grid">
        <button
          v-for="day in monthDays"
          :key="day.date"
          class="month-day"
          :class="[day.status, { muted: !day.inMonth, active: selectedDate === day.date }]"
          type="button"
          @click="selectedDate = day.date"
        >
          <span>{{ day.day }}</span>
          <small>{{ day.rate }}%</small>
        </button>
      </div>
    </div>
  </section>

  <section class="content-grid two">
    <div class="panel">
      <div class="panel-title">
        <h2>当天任务</h2>
        <span>{{ selectedTasks.length }} 项</span>
      </div>
      <div v-if="!selectedTasks.length" class="empty-state">这一天没有任务记录。</div>
      <article v-for="task in selectedTasks" :key="task.id" class="template-row">
        <div>
          <span class="small-label">{{ task.priority }}级 · {{ task.score }}分 · {{ task.status }}</span>
          <h3>{{ task.title }}</h3>
          <p>{{ task.category }} · 进度 {{ task.progress }}% · 质量 {{ task.qualityScore }}分 · 交付物 {{ task.evidenceItems?.length || 0 }}</p>
        </div>
        <button v-if="task.priority === 'S' && task.progress < 100" class="ghost-btn" type="button" @click="rescue(task)">补救</button>
      </article>
      <div v-if="missedSTasks.length" class="warning-box">
        <strong>未完成 S 级任务</strong>
        <span v-for="task in missedSTasks" :key="task.id">{{ task.title }}</span>
      </div>
    </div>

    <div class="panel">
      <div class="panel-title">
        <h2>备份与数据</h2>
        <span>本地模式</span>
      </div>
      <div class="bar-list">
        <div v-for="day in getters.sevenDayStats.value" :key="day.date" class="bar-row">
          <span>{{ day.label }}</span>
          <div class="bar-track"><i :style="{ width: `${day.rate}%` }"></i></div>
          <strong>{{ day.compoundScore }}</strong>
        </div>
      </div>
      <div class="button-row">
        <button class="primary-btn" type="button" @click="exportAllData">导出 JSON</button>
        <button class="ghost-btn" type="button" @click="triggerImport">导入 JSON</button>
        <input ref="fileInput" class="hidden-file" type="file" accept="application/json,.json" @change="handleImport" />
      </div>
      <div v-if="fakeEffortWarnings.length" class="warning-box data-warning">
        <strong>伪努力提醒</strong>
        <span v-for="item in fakeEffortWarnings" :key="item.task.id">{{ item.task.title }}：{{ item.result.warnings[0] }}</span>
      </div>
    </div>
  </section>

  <p v-if="notice" class="inline-notice floating-notice">{{ notice }}</p>
</template>
