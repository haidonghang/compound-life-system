<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import PageHeader from '../components/PageHeader.vue';
import { useAppStore } from '../store/useAppStore';
import { formatDateTime, formatMinutes } from '../utils/date';

const { state, statusLabel, goalName, startTask, pauseTask, completeTask } = useAppStore();
const tick = ref(Date.now());
let timer;
const completeForms = reactive({});

onMounted(() => {
  timer = window.setInterval(() => {
    tick.value = Date.now();
  }, 1000);
});

onBeforeUnmount(() => window.clearInterval(timer));

const executableTasks = computed(() => state.tasks.filter((task) => task.status !== 'done'));

function elapsedSeconds(task) {
  const active = task.sessions.find((session) => !session.end);
  const live = active ? Math.max(0, Math.round((tick.value - new Date(active.start).getTime()) / 1000)) : 0;
  return Number(task.actualSeconds || 0) + live;
}

function formFor(task) {
  if (!completeForms[task.id]) {
    completeForms[task.id] = {
      quality: task.quality || 3,
      blockers: task.blockers || '',
      evidence: task.evidence || '',
    };
  }
  return completeForms[task.id];
}

function finish(task) {
  completeTask(task.id, formFor(task));
}
</script>

<template>
  <PageHeader title="执行页" eyebrow="Deep Work" />

  <section class="panel">
    <div class="panel-title">
      <h2>可执行任务</h2>
      <span>{{ executableTasks.length }} 项</span>
    </div>
    <div v-if="!executableTasks.length" class="empty-state">暂无待执行任务。去任务页新增一个具体动作。</div>

    <article v-for="task in executableTasks" :key="task.id" class="execute-card">
      <div class="execute-top">
        <div>
          <span class="small-label">{{ task.priority }} · {{ task.category }} · {{ statusLabel(task.status) }}</span>
          <h3>{{ task.title }}</h3>
          <p>{{ goalName(task.goalId) }} · 截止 {{ formatDateTime(task.dueAt) }}</p>
        </div>
        <strong>{{ formatMinutes(elapsedSeconds(task)) }}</strong>
      </div>

      <div class="button-row">
        <button class="primary-btn" type="button" :disabled="task.status === 'doing'" @click="startTask(task.id)">开始</button>
        <button class="ghost-btn" type="button" :disabled="task.status !== 'doing'" @click="pauseTask(task.id)">暂停</button>
      </div>

      <div class="completion-box">
        <label>
          完成质量
          <input v-model.number="formFor(task).quality" type="range" min="1" max="5" />
          <span>{{ formFor(task).quality }}/5</span>
        </label>
        <label>
          卡点
          <textarea v-model.trim="formFor(task).blockers" rows="2" placeholder="记录卡住的位置"></textarea>
        </label>
        <label>
          证据说明
          <textarea v-model.trim="formFor(task).evidence" rows="2" placeholder="链接、截图说明、文件名或成果摘要"></textarea>
        </label>
        <button class="primary-btn" type="button" @click="finish(task)">完成任务</button>
      </div>
    </article>
  </section>
</template>
