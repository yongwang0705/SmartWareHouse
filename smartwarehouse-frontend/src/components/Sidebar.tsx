import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faBoxesStacked, faChartPie, faChartBar, faClipboardList, faGear,
  faLayerGroup, faTableColumns, faTruckFast, faWarehouse,
} from '@fortawesome/free-solid-svg-icons';

export type Page = 'dashboard' | 'orders' | 'inventory' | 'kanban' | 'warehouses' | 'suppliers' | 'production' | 'bom';

const navItems: Array<{ id: Page; label: string; icon: any }> = [
  { id: 'dashboard', label: 'Dashboard', icon: faChartPie },
  { id: 'orders', label: 'Orders', icon: faClipboardList },
  { id: 'inventory', label: 'Inventory', icon: faBoxesStacked },
  { id: 'kanban', label: 'JIT Kanban', icon: faTableColumns },
  { id: 'production', label: 'Production', icon: faChartBar },
  { id: 'bom', label: 'BOM', icon: faLayerGroup },
  { id: 'warehouses', label: 'Warehouses', icon: faWarehouse },
  { id: 'suppliers', label: 'Suppliers', icon: faTruckFast },
];

interface Props {
  page: Page;
  onNavigate: (page: Page) => void;
  open: boolean;
  onClose: () => void;
}

export default function Sidebar({ page, onNavigate, open, onClose }: Props) {
  return (
    <>
      {open && <button aria-label="Close navigation" className="sidebar-scrim" onClick={onClose} />}
      <aside className={`sidebar ${open ? 'sidebar-open' : ''}`}>
        <div className="brand-lockup">
          <div className="brand-mark"><FontAwesomeIcon icon={faBoxesStacked} /></div>
          <div><div className="brand-name">smart<span>warehouse</span></div><div className="brand-caption">SUPPLY CHAIN PLATFORM</div></div>
        </div>
        <div className="nav-section-label">WORKSPACE</div>
        <nav className="nav-list">
          {navItems.map((item) => (
            <button key={item.id} className={`nav-item ${page === item.id ? 'nav-item-active' : ''}`} onClick={() => { onNavigate(item.id); onClose(); }}>
              <FontAwesomeIcon icon={item.icon} className="nav-icon" />
              <span>{item.label}</span>
              {item.id === 'orders' && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-status"><span className="status-pulse" /><div><strong>System operational</strong><small>Services connected</small></div></div>
          <button className="nav-item settings-item" onClick={() => window.alert('Settings will be added in a future iteration.')}><FontAwesomeIcon icon={faGear} className="nav-icon" /><span>Settings</span></button>
          <div className="profile-card"><div className="avatar">YW</div><div className="profile-info"><strong>Warehouse Admin</strong><small>Administrator</small></div><span className="profile-menu">•••</span></div>
        </div>
      </aside>
    </>
  );
}
