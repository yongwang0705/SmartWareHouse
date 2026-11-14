import { useState } from 'react';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faChartGantt, faClipboardList, faRoute, faUsersGear,
} from '@fortawesome/free-solid-svg-icons';
import PlanningBoard from './production/PlanningBoard';
import GanttBoard from './production/GanttBoard';
import ResourceManagement from './production/ResourceManagement';
import RoutingManagement from './production/RoutingManagement';

type ProductionTab = 'board' | 'gantt' | 'resources' | 'routings';

const tabs: Array<{ id: ProductionTab; label: string; icon: IconDefinition; hint: string }> = [
  {
    id: 'board',
    label: 'Planning board',
    icon: faClipboardList,
    hint: 'Generate plans, review risks and confirm production schedules.',
  },
  {
    id: 'gantt',
    label: 'Gantt chart',
    icon: faChartGantt,
    hint: 'Visualise scheduled operations across work centers, employees and operations.',
  },
  {
    id: 'resources',
    label: 'Resources',
    icon: faUsersGear,
    hint: 'Manage employees, skills, shifts, work centers and the working calendar.',
  },
  {
    id: 'routings',
    label: 'Routings',
    icon: faRoute,
    hint: 'Define product routings and their ordered production operations.',
  },
];

export default function ProductionPage() {
  const [tab, setTab] = useState<ProductionTab>('board');
  const active = tabs.find((item) => item.id === tab) ?? tabs[0];

  return (
    <div>
      <div className="page-toolbar">
        <div>
          <h2>Production planning</h2>
          <p>{active.hint}</p>
        </div>
      </div>

      <div className="module-tabs" role="tablist" aria-label="Production planning sections">
        {tabs.map((item) => (
          <button
            key={item.id}
            role="tab"
            aria-selected={tab === item.id}
            className={`module-tab ${tab === item.id ? 'module-tab-active' : ''}`}
            onClick={() => setTab(item.id)}
          >
            <FontAwesomeIcon icon={item.icon} />
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'board' && <PlanningBoard />}
      {tab === 'gantt' && <GanttBoard />}
      {tab === 'resources' && <ResourceManagement />}
      {tab === 'routings' && <RoutingManagement />}
    </div>
  );
}
