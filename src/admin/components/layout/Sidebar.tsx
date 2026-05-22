import { NavLink } from 'react-router-dom';

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  onLogout: () => void;
}

const items = [
  ['dashboard', '📊', '数据总览'], ['map-monitor', '🛰️', '地图监控'], ['merchant-kyc', '🔍', '商家 KYC 审核'], ['platform-routes', '🗺️', '路线审核'],
  ['invite-codes', '🎟️', '邀请码管理'], ['gmv-reports', '💹', 'GMV 报表'], ['commission-config', '⚙️', '佣金配置'], ['disputes', '⚖️', '争议处理'],
  ['traffic', '🚦', '流量分发'], ['users', '👥', '用户管理'], ['content', '🧾', '内容审核'], ['guides', '🧗', '向导审核'],
  ['orders', '🧾', '订单管理'], ['clubs', '🏕️', '俱乐部管理'], ['routes', '🛤️', '线路管理'], ['booking', '📅', '预约管理'],
  ['passengers', '🧍', '乘客管理'], ['events', '🎉', '活动管理'], ['lead-records', '📌', '带队记录'], ['reviews', '⭐', '评价管理'],
  ['summit-orders', '⛰️', '参登订单'], ['applications', '📋', '申请审核'], ['suspicious-tracks', '🚨', '可疑轨迹'], ['audit-logs', '📚', '审核日志'],
  ['club-licenses', '🏢', '俱乐部商业资质'], ['guide-licenses', '🪪', '向导业务资质'], ['sos', '🆘', 'SOS 数据记录'], ['base-applications', '📍', '据点申请管理'],
] as const;

export function Sidebar({ open, onClose, onLogout }: SidebarProps) {
  return (
    <>
      {open && <button type="button" className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={onClose} />}
      <aside className={`fixed left-0 top-0 z-40 h-full w-[240px] overflow-y-auto bg-slate-800 p-3 text-slate-200 transition-transform lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <h1 className="mb-4 px-2 text-lg font-semibold text-white">SummitLink Admin</h1>
        <nav className="space-y-1 text-sm">
          {items.map(([path, icon, label]) => (
            <NavLink
              key={path}
              to={`/${path}`}
              className={({ isActive }) => `sidebar-item flex items-center gap-2 rounded-md px-2 py-2 ${isActive ? 'bg-indigo-600 text-white' : 'hover:bg-slate-700'}`}
              onClick={onClose}
            >
              <span>{icon}</span><span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <button
          type="button"
          className="mt-3 block w-full rounded-md px-2 py-2 text-left text-sm text-rose-300 hover:bg-slate-700"
          onClick={() => { onLogout(); onClose(); }}
        >
          🚪 退出登录
        </button>
      </aside>
    </>
  );
}
