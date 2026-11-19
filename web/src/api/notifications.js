export function subscribeToNotifications(onNotification) {
  const source = new EventSource('/api/notifications');
  const receive = (event) => {
    try {
      const { eventId } = JSON.parse(event.data);
      if (!event.lastEventId || !Number.isSafeInteger(eventId) || eventId < 1) return;
      onNotification({ id: event.lastEventId, type: event.type, eventId });
    } catch {
      // Ignore malformed frames; EventSource handles reconnection without producing a toast.
    }
  };
  source.addEventListener('event.created', receive);
  source.addEventListener('registration.created', receive);
  return () => source.close();
}
