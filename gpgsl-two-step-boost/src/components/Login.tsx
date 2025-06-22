// src/components/Login.tsx
import React, { useState, Dispatch, SetStateAction, useEffect } from 'react';
import { LoginRequest, LoginResponse } from '../types';

interface LoginProps {
  onLoginSuccess: (response: LoginResponse) => void;
  setUsername: Dispatch<SetStateAction<string>>;
  setBoostInfo: Dispatch<SetStateAction<string | null>>;
  useCurrentGP: boolean;
  setUseCurrentGP: (value: boolean) => void;
}

// Simple cookie helpers
function setCookie(name: string, value: string, days: number) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = name + '=' + encodeURIComponent(value) + '; expires=' + expires + '; path=/';
}

function getCookie(name: string) {
  return document.cookie.split('; ').reduce((r, v) => {
    const parts = v.split('=');
    return parts[0] === name ? decodeURIComponent(parts[1]) : r
  }, '');
}

export default function Login({ onLoginSuccess, setUsername, setBoostInfo, useCurrentGP, setUseCurrentGP }: LoginProps) {
  const [credentials, setCredentials] = useState<LoginRequest>({
    username: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingBoost, setLoadingBoost] = useState(true);
  const [boostInfo, setLocalBoostInfo] = useState<string | null>(null);

  useEffect(() => {
    fetchBoostAnnouncement();
    // Pre-fill username from cookie if available
    const savedUsername = getCookie('gpgsl_username');
    if (savedUsername) {
      setCredentials((prev) => ({ ...prev, username: savedUsername }));
    }
  }, []);

  const fetchBoostAnnouncement = async () => {
    try {
      setLoadingBoost(true);
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/boost-announcement`);
      const data = await response.json();
      
      if (data.success) {
        setLocalBoostInfo(data.message);
        setBoostInfo(data.message);
      } else {
        const message = data.message || 'Unable to fetch boost information';
        setLocalBoostInfo(message);
        setBoostInfo(message);
      }
    } catch (err) {
      console.error('Error fetching boost announcement:', err);
      const message = 'Unable to fetch boost information';
      setLocalBoostInfo(message);
      setBoostInfo(message);
    } finally {
      setLoadingBoost(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/login/get-pm-page`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });
      setUsername(credentials.username);
      // Save username in cookie for 30 days
      setCookie('gpgsl_username', credentials.username, 30);

      const data: LoginResponse = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Login failed');
      }
      onLoginSuccess(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-form">
      {error && <div className="error-message">{error}</div>}
      
      {loadingBoost ? (
        <div className="boost-info">
          <p>Loading boost information...</p>
        </div>
      ) : (
        <>
          <form onSubmit={handleSubmit}>
            <div className="input-group">
              <label htmlFor="username">Username:</label>
              <input
                type="text"
                id="username"
                value={credentials.username}
                onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
                required
              />
            </div>
            <div className="input-group">
              <label htmlFor="password">Password:</label>
              <input
                type="password"
                id="password"
                value={credentials.password}
                onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                required
              />
            </div>
            <button 
              type="submit" 
              className="btn width-50 ml-auto"
              disabled={loading}
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>
          
          {/* Current GP Switch Option */}
          {boostInfo && (
            <div className="current-gp-option">
              <label className="current-gp-switch">
                <input
                  type="checkbox"
                  checked={useCurrentGP}
                  onChange={(e) => setUseCurrentGP(e.target.checked)}
                />
                <span className="switch-slider"></span>
                <span className="switch-label">For most current GP</span>
              </label>
              <div className="boost-info-display">
                {boostInfo}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}