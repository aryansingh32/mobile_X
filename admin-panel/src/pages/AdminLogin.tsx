import React, { useState } from 'react';
import { GoogleLogin, CredentialResponse } from '@react-oauth/google';
import { ShieldCheck, AlertCircle } from 'lucide-react';
import { api } from '../services/api';

interface AdminLoginProps {
  onLogin: () => void;
}

const AdminLogin: React.FC<AdminLoginProps> = ({ onLogin }) => {
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSuccess = async (credentialResponse: CredentialResponse) => {
    setError(null);
    try {
      const idToken = credentialResponse.credential;
      if (!idToken) {
        setError('Failed to get credentials from Google. Please try again.');
        return;
      }

      // Send token to backend for verification and get admin JWT
      const response = await api.post('/auth/google', { idToken });
      const { token, user } = response.data;

      // Verify user is an admin
      const adminRoles = ['SUPER_ADMIN', 'FINANCE_ADMIN', 'FRAUD_ANALYST'];
      if (!adminRoles.includes(user.role)) {
        setError('Access denied — this account does not have admin privileges.');
        return;
      }

      // Store admin token
      localStorage.setItem('adminToken', token);
      localStorage.setItem('adminUser', JSON.stringify(user));
      onLogin();
    } catch (error: any) {
      console.error('Admin login error:', error);
      setError(error.response?.data?.error || 'Login failed. Please try again.');
    }
  };

  const handleGoogleError = () => {
    setError('Google Sign-In failed. Please try again.');
  };

  return (
    <div className="min-h-screen bg-[#111] flex items-center justify-center">
      <div className="bg-[#1A1A1A] rounded-2xl border border-[#333] p-12 w-full max-w-md text-center shadow-2xl">
        <div className="flex items-center justify-center mb-6">
          <ShieldCheck className="text-orange-400 mr-3" size={40} />
          <h1 className="text-3xl font-bold text-white">Admin Panel</h1>
        </div>
        <p className="text-gray-400 mb-8 text-sm">
          Sign in with your authorized Google account to access the admin dashboard.
        </p>
        {error ? (
          <div className="mb-6 flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-950/20 p-3 text-left">
            <AlertCircle className="text-red-400 shrink-0 mt-0.5" size={16} />
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        ) : null}
        <div className="flex justify-center">
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={handleGoogleError}
            theme="filled_black"
            shape="pill"
            size="large"
            text="signin_with"
            width={300}
          />
        </div>
        <p className="text-gray-600 text-xs mt-8">
          Only accounts with admin roles can access this panel.
        </p>
      </div>
    </div>
  );
};

export default AdminLogin;
