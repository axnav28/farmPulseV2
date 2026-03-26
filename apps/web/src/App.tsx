import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import AuditTrail from './pages/AuditTrail';
import ChannelFallback from './pages/ChannelFallback';
import DistrictExplorer from './pages/DistrictExplorer';
import FarmerAdvisory from './pages/FarmerAdvisory';
import InstitutionalDashboard from './pages/InstitutionalDashboard';
import MandiPrices from './pages/MandiPrices';
import Overview from './pages/Overview';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/overview" replace />} />
          <Route path="overview" element={<Overview />} />
          <Route path="farmer-advisory" element={<FarmerAdvisory />} />
          <Route path="channel-fallback" element={<ChannelFallback />} />
          <Route path="districts" element={<DistrictExplorer />} />
          <Route path="mandi-prices" element={<MandiPrices />} />
          <Route path="institutional" element={<InstitutionalDashboard />} />
          <Route path="audit" element={<AuditTrail />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
