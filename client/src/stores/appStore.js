import { create } from 'zustand';

export const useAppStore = create((set, get) => ({
  activeTab: 'today',
  setActiveTab: (tab) => set({ activeTab: tab }),

  selectedDate: new Date().toISOString().split('T')[0],
  setSelectedDate: (date) => set({ selectedDate: date }),

  toast: null,
  showToast: (message, onUndo) => {
    set({ toast: { message, onUndo } });
    setTimeout(() => {
      if (get().toast?.message === message) {
        set({ toast: null });
      }
    }, 6000);
  },
  hideToast: () => set({ toast: null }),

  timerRunning: false,
  setTimerRunning: (running) => set({ timerRunning: running }),
}));
