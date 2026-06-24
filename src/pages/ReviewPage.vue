<script setup>
import { computed, reactive, watch } from 'vue';
import PageHeader from '../components/PageHeader.vue';
import { useAppStore } from '../store/useAppStore';
import { todayKey } from '../utils/date';

const { state, upsertReview } = useAppStore();
const form = reactive({
  date: todayKey(),
  done: '',
  problems: '',
  shortcomings: '',
  reasons: '',
  improvements: '',
  gains: '',
  tomorrowFocus: '',
});

const existing = computed(() => state.reviews.find((review) => review.date === form.date));

watch(
  () => form.date,
  () => {
    if (existing.value) Object.assign(form, existing.value);
    else {
      Object.assign(form, {
        done: '',
        problems: '',
        shortcomings: '',
        reasons: '',
        improvements: '',
        gains: '',
        tomorrowFocus: '',
      });
    }
  },
  { immediate: true }
);

function submit() {
  upsertReview({ ...form });
}
</script>

<template>
  <PageHeader title="复盘页" eyebrow="Daily Review" />

  <form class="panel review-form" @submit.prevent="submit">
    <div class="panel-title">
      <h2>每日复盘</h2>
      <label class="inline-field">
        日期
        <input v-model="form.date" type="date" />
      </label>
    </div>
    <div class="review-grid">
      <label>
        完成事项
        <textarea v-model.trim="form.done" rows="4"></textarea>
      </label>
      <label>
        问题
        <textarea v-model.trim="form.problems" rows="4"></textarea>
      </label>
      <label>
        不足
        <textarea v-model.trim="form.shortcomings" rows="4"></textarea>
      </label>
      <label>
        原因
        <textarea v-model.trim="form.reasons" rows="4"></textarea>
      </label>
      <label>
        改进
        <textarea v-model.trim="form.improvements" rows="4"></textarea>
      </label>
      <label>
        收获
        <textarea v-model.trim="form.gains" rows="4"></textarea>
      </label>
    </div>
    <label>
      明日重点
      <textarea v-model.trim="form.tomorrowFocus" rows="3"></textarea>
    </label>
    <button class="primary-btn" type="submit">保存复盘</button>
  </form>
</template>
