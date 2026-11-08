import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBars, faBell, faChevronDown, faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons';

interface Props {
  title: string;
  subtitle: string;
  onMenu: () => void;
  onSearch: (value: string) => void;
}

export default function Topbar({ title, subtitle, onMenu, onSearch }: Props) {
  return (
    <header className="topbar">
      <button className="mobile-menu icon-button" onClick={onMenu} aria-label="Open menu"><FontAwesomeIcon icon={faBars} /></button>
      <div className="page-heading"><div className="eyebrow">SMARTWAREHOUSE / OPERATIONS</div><h1>{title}</h1><p>{subtitle}</p></div>
      <div className="topbar-actions">
        <label className="search-box"><FontAwesomeIcon icon={faMagnifyingGlass} /><input placeholder="Search anything..." onChange={(e) => onSearch(e.target.value)} /><kbd>⌘ K</kbd></label>
        <button className="icon-button notification-button" aria-label="Notifications"><FontAwesomeIcon icon={faBell} /><i /></button>
        <button className="topbar-user"><span className="avatar avatar-small">YW</span><span className="user-label">Admin</span><FontAwesomeIcon icon={faChevronDown} className="tiny-chevron" /></button>
      </div>
    </header>
  );
}
