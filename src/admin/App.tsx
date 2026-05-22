import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { DashboardPage } from './pages/DashboardPage';
import { LoginPage } from './pages/LoginPage';
import { PlaceholderPage } from './pages/PlaceholderPage';
import { useAuth } from './context/AuthContext';

function PrivateRoute({ children }: { children: JSX.Element }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <div className="p-8">加载中...</div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}

const placeholderRoutes = [
  ['/map-monitor', '地图监控'], ['/merchant-kyc', '商家 KYC 审核'], ['/platform-routes', '路线审核'], ['/invite-codes', '邀请码管理'],
  ['/gmv-reports', 'GMV 报表'], ['/commission-config', '佣金配置'], ['/disputes', '争议处理'], ['/traffic', '流量分发'], ['/users', '用户管理'],
  ['/content', '内容审核'], ['/guides', '向导审核'], ['/orders', '订单管理'], ['/clubs', '俱乐部管理'], ['/routes', '线路管理'], ['/booking', '预约管理'],
  ['/passengers', '乘客管理'], ['/events', '活动管理'], ['/lead-records', '带队记录'], ['/reviews', '评价管理'], ['/summit-orders', '参登订单'],
  ['/applications', '申请审核'], ['/suspicious-tracks', '可疑轨迹'], ['/audit-logs', '审核日志'], ['/club-licenses', '俱乐部商业资质'],
  ['/guide-licenses', '向导业务资质'], ['/sos', 'SOS 数据记录'], ['/base-applications', '据点申请管理'],
] as const;

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<PrivateRoute><DashboardPage /></PrivateRoute>} />
        {placeholderRoutes.map(([path, title]) => (
          <Route key={path} path={path} element={<PrivateRoute><PlaceholderPage title={title} /></PrivateRoute>} />
        ))}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </HashRouter>
  );
}
