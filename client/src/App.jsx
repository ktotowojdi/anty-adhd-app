import { useState, useEffect } from 'react';
import { useAppStore } from './stores/appStore';
import StatusBar from './components/StatusBar';
import TabBar from './components/TabBar';
import SchedulePage from './features/schedule/SchedulePage';
import BacklogPage from './features/backlog/BacklogPage';
import RulesPage from './features/rules/RulesPage';
import ReviewPage from './features/review/ReviewPage';
import SummaryPage from './features/schedule/SummaryPage';
import FocusTimer from './features/focus/FocusTimer';
import AfterHoursOverlay from './components/AfterHoursOverlay';
import UndoToast from './components/UndoToast';

const TABS = [
  { id: 'today', label: 'Dziś', icon: '◉' },
  { id: 'backlog', label: 'Backlog', icon: '☰' },
  { id: 'rules', label: 'Zasady', icon: '◈' },
  { id: 'focus', label: 'Focus', icon: '◎' },
  { id: 'review', label: 'Review', icon: '▣' },
];

export default function App() {
  const activeTab = useAppStore(s => s.activeTab);
  const toast = useAppStore(s => s.toast);

  const renderTab = () => {
    switch (activeTab) {
      case 'today': return <SchedulePage />;
      case 'backlog': return <BacklogPage />;
      case 'rules': return <RulesPage />;
      case 'focus': return <FocusTimer />;
      case 'review': return <ReviewPage />;
      default: return <SchedulePage />;
    }
  };

  return (
    <div className="app">
      <header className="header">
        <div className="header-left">
          <h1>Anty-ADHD</h1>
          <div className="subtitle">Mission Control</div>
        </div>
        <StatusBar />
      </header>

      <TabBar tabs={TABS} />

      <div className="tab-panel">
        {renderTab()}
      </div>

      <AfterHoursOverlay />
      {toast && <UndoToast />}
    </div>
  );
}
