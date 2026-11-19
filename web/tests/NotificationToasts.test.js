import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import NotificationToasts from '../src/components/NotificationToasts.vue';
import { subscribeToNotifications } from '../src/api/notifications.js';

vi.mock('../src/api/notifications.js', () => ({ subscribeToNotifications: vi.fn() }));

describe('NotificationToasts', () => {
  let receive; let stop; let wrapper;
  beforeEach(() => {
    vi.useFakeTimers(); stop = vi.fn();
    vi.mocked(subscribeToNotifications).mockImplementation((callback) => { receive = callback; return stop; });
    wrapper = mount(NotificationToasts, { global: { stubs: { RouterLink: { props: ['to'], template: '<a :href="to"><slot /></a>' } } } });
  });
  afterEach(() => { wrapper.unmount(); vi.useRealTimers(); vi.clearAllMocks(); });

  it('shows one anonymous toast per registration and ignores duplicate deliveries', async () => {
    const message = { id: 'one', type: 'registration.created', eventId: 3, name: 'Private Name', email: 'private@example.com' };
    receive(message); receive(message);
    await wrapper.vm.$nextTick();
    expect(wrapper.findAll('[data-testid="notification-toast"]')).toHaveLength(1);
    expect(wrapper.text()).toContain('Someone registered for an event.');
    expect(wrapper.text()).not.toContain('Private Name');
    expect(wrapper.text()).not.toContain('private@example.com');
    expect(wrapper.find('a').attributes('href')).toBe('/events/3');
    expect(subscribeToNotifications).toHaveBeenCalledOnce();
  });

  it('keeps separate registrations separate, and shows event creation without success duplicates', async () => {
    receive({ id: 'one', type: 'registration.created', eventId: 3 });
    receive({ id: 'two', type: 'registration.created', eventId: 3 });
    receive({ id: 'three', type: 'event.created', eventId: 4 });
    await wrapper.vm.$nextTick();
    expect(wrapper.findAll('[data-testid="notification-toast"]')).toHaveLength(3);
    expect(wrapper.text()).toContain('A new event was created.');
    await wrapper.find('button').trigger('click');
    expect(wrapper.findAll('[data-testid="notification-toast"]')).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(8000);
    expect(wrapper.findAll('[data-testid="notification-toast"]')).toHaveLength(0);
  });

  it('closes the connection and clears timers when the global component unmounts', async () => {
    receive({ id: 'one', type: 'event.created', eventId: 4 });
    await wrapper.vm.$nextTick();
    wrapper.unmount();
    expect(stop).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
});
