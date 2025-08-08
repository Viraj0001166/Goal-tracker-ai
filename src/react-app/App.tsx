import { BrowserRouter as Router, Routes, Route } from "react-router";
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from '@/react-app/hooks/useCustomAuth';
import DashboardPage from "@/react-app/pages/Dashboard";
import DailyViewPage from "@/react-app/pages/DailyView";
import GoalsPage from "@/react-app/pages/Goals";
import QuestionsPage from "@/react-app/pages/Questions";
import ChatPage from "@/react-app/pages/Chat";
import ProfilePage from "@/react-app/pages/Profile";
import AuthCallbackPage from "@/react-app/pages/AuthCallback";

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/daily" element={<DailyViewPage />} />
          <Route path="/goals" element={<GoalsPage />} />
          <Route path="/questions" element={<QuestionsPage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
        </Routes>
      </Router>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#1f2937',
            color: '#f9fafb',
            border: '1px solid #374151',
          },
        }}
      />
    </AuthProvider>
  );
}
