import { useAppStore } from '../stores/appStore';

export default function TabBar({ tabs }) {
  const activeTab = useAppStore(s => s.activeTab);
  const setActiveTab = useAppStore(s => s.setActiveTab);

  return (
    <div className="main-tabs">
      {tabs.map(tab => (
        <button
          key={tab.id}
          className={`main-tab ${activeTab === tab.id ? 'active' : ''}`}
          onClick={() => setActiveTab(tab.id)}
        >
          <span className="tab-icon">{tab.icon}</span>
          {tab.label}
        </button>
      ))}
    </div>
  );
}
