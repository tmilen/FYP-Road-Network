import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import MainMenu from './frontend/mainmenu';
import Login from './frontend/login';
import UserManagement from './frontend/usermanagement';
import AccountManagement from './frontend/accountmanagement';
import TrafficManagement from './frontend/trafficmanagement';
import DataHealth from './frontend/datahealth';
import UploadMap from './frontend/uploadmap';
import TrafficData from './frontend/trafficdata';
import LiveMap  from './frontend/LiveMap';
import Reports  from './frontend/reports';
import './css/global.css'

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<MainMenu />} />
        <Route path="/login" element={<Login />} />
        <Route path="/manage-users" element={<UserManagement />} />
        <Route path="/account-management" element={<AccountManagement />} />
        <Route path="/traffic-management" element={<TrafficManagement />} />
        <Route path="/data-health" element={<DataHealth />} />
        <Route path="/upload-map" element={<UploadMap />} />
        <Route path="/traffic-data" element={<TrafficData />} />
        <Route path="/live-map" element={<LiveMap />} />
        <Route path="/reports" element={<Reports />} />
      </Routes>
    </Router>
  );
}

export default App;
