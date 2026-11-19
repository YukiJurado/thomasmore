<script setup>
import { onMounted, onUnmounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { subscribeToNotifications } from '../api/notifications.js';

const toasts = ref([]);
const seen = new Set();
const timers = new Map();
let unsubscribe;

function dismiss(id) {
  clearTimeout(timers.get(id));
  timers.delete(id);
  toasts.value = toasts.value.filter((toast) => toast.id !== id);
}

function show(notification) {
  if (seen.has(notification.id)) return;
  const messages = {
    'event.created': 'A new event was created.',
    'registration.created': 'Someone registered for an event.'
  };
  const message = messages[notification.type];
  if (!message) return;
  seen.add(notification.id);
  if (seen.size > 200) seen.delete(seen.values().next().value);
  if (toasts.value.length >= 5) dismiss(toasts.value[0].id);
  toasts.value.push({ id: notification.id, eventId: notification.eventId, message });
  timers.set(notification.id, setTimeout(() => dismiss(notification.id), 8000));
}

onMounted(() => { unsubscribe = subscribeToNotifications(show); });
onUnmounted(() => {
  unsubscribe?.();
  for (const timer of timers.values()) clearTimeout(timer);
});
</script>

<template>
  <section class="toast-stack" aria-label="Live notifications" aria-live="polite" aria-relevant="additions">
    <article v-for="toast in toasts" :key="toast.id" class="toast" data-testid="notification-toast">
      <div>
        <p class="toast__message">{{ toast.message }}</p>
        <RouterLink :to="`/events/${toast.eventId}`">View event</RouterLink>
      </div>
      <button class="toast__dismiss" type="button" aria-label="Dismiss notification" @click="dismiss(toast.id)">×</button>
    </article>
  </section>
</template>
