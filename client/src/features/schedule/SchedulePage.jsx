import { useState, useEffect } from 'react';
import { useAppStore } from '../../stores/appStore';
import { api } from '../../lib/api';
import DayNav from './DayNav';
import TaskRow from './TaskRow';
import AddTaskModal from './AddTaskModal';

export default function SchedulePage() {
  const selectedDate = useAppStore(s => s.selectedDate);
  const showToast = useAppStore(s => s.showToast);
  const [schedule, setSchedule] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchSchedule = async () => {
    try {
      const data = await api.get(`/api/schedule/${selectedDate}`);
      setSchedule(data.schedule);
      setTasks(data.tasks || []);
    } catch {
      setSchedule(null);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchSchedule();
  }, [selectedDate]);

  const toggleTask = async (taskId, done) => {
    await api.patch(`/api/tasks/${taskId}`, { done: done ? 0 : 1 });
    fetchSchedule();
  };

  const deleteTask = async (taskId) => {
    const task = tasks.find(t => t.id === taskId);
    await api.delete(`/api/tasks/${taskId}`);
    fetchSchedule();
    showToast('Zadanie usunięte', async () => {
      await api.post('/api/tasks', { ...task, schedule_date: selectedDate });
      fetchSchedule();
    });
  };

  const isToday = selectedDate === new Date().toISOString().split('T')[0];
  const isFreeDay = schedule?.type === 'free';

  return (
    <div>
      <DayNav />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div className="day-title">
          {schedule?.title || selectedDate}
          {schedule?.type && schedule.type !== 'work' && (
            <span className="day-type-badge" style={{
              background: schedule.type === 'free' ? 'var(--green-dim)' : 'var(--accent-dim)',
              color: schedule.type === 'free' ? 'var(--green)' : 'var(--accent)',
            }}>
              {schedule.type_label || schedule.type.toUpperCase()}
            </span>
          )}
        </div>
        <button className="btn-green" onClick={() => setShowAddModal(true)}>+ Dodaj</button>
      </div>

      {loading ? (
        <div style={{ color: 'var(--text-dim)', textAlign: 'center', padding: 32 }}>Ładowanie...</div>
      ) : isFreeDay ? (
        <div className="free-day-msg">
          Wolne
          <div className="sub">Nie pracujesz dzisiaj. Odpoczywaj.</div>
        </div>
      ) : tasks.length === 0 ? (
        <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 32 }}>
          Brak zadań na ten dzień. Kliknij "+ Dodaj" lub przenieś z backlogu.
        </div>
      ) : (
        <table className="schedule-table">
          <tbody>
            {tasks.map(task => (
              <TaskRow
                key={task.id}
                task={task}
                isToday={isToday}
                onToggle={() => toggleTask(task.id, task.done)}
                onDelete={() => deleteTask(task.id)}
                onEdit={() => fetchSchedule()}
              />
            ))}
          </tbody>
        </table>
      )}

      {showAddModal && (
        <AddTaskModal
          date={selectedDate}
          onClose={() => setShowAddModal(false)}
          onAdded={fetchSchedule}
        />
      )}
    </div>
  );
}
