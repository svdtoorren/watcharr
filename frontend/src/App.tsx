import { Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import WatchesPage from "./pages/WatchesPage";
import WatchDetailPage from "./pages/WatchDetailPage";
import ActivityPage from "./pages/ActivityPage";
import SettingsPage from "./pages/SettingsPage";

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<WatchesPage />} />
        <Route path="/watches/:id" element={<WatchDetailPage />} />
        <Route path="/activity" element={<ActivityPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </Layout>
  );
}
