// API Configuration
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || '';

export const API_ENDPOINTS = {
  // Auth endpoints
  LOGIN: `${API_BASE_URL}/api/auth/login`,
  SIGNUP: `${API_BASE_URL}/api/auth/signup`,
  LOGOUT: `${API_BASE_URL}/api/auth/logout`,
  ME: `${API_BASE_URL}/api/auth/me`,
  PROFILE: `${API_BASE_URL}/api/auth/profile`,
  SEND_OTP: `${API_BASE_URL}/api/auth/send-otp`,
  VERIFY_OTP: `${API_BASE_URL}/api/auth/verify-otp`,
  
  // Goals endpoints
  GOALS: `${API_BASE_URL}/api/goals`,
  
  // Daily logs endpoints
  DAILY_LOGS: `${API_BASE_URL}/api/daily-logs`,
  
  // Analytics endpoints
  ANALYTICS_PROGRESS: `${API_BASE_URL}/api/analytics/progress`,
  ANALYTICS_GOALS: `${API_BASE_URL}/api/analytics/goals`,
  
  // AI Suggestions endpoints
  AI_SUGGESTIONS: `${API_BASE_URL}/api/ai-suggestions`,
  AI_SUGGESTIONS_RECENT: `${API_BASE_URL}/api/ai-suggestions/recent`,
  
  // Chat endpoints
  CHAT: `${API_BASE_URL}/api/chat`,
  
  // FAQ endpoints
  FAQS: `${API_BASE_URL}/api/faqs`,
};

export default API_ENDPOINTS;
