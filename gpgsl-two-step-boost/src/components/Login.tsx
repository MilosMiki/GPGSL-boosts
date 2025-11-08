// src/components/Login.tsx
import React, { useState, Dispatch, SetStateAction, useEffect } from "react";
import { LoginRequest, LoginResponse } from "../types";

interface LoginProps {
  onLoginSuccess: (response: LoginResponse) => void;
  setUsername: Dispatch<SetStateAction<string>>;
  setBoostInfo: Dispatch<SetStateAction<string | null>>;
  useCurrentGP: boolean;
  setUseCurrentGP: (value: boolean) => void;
  setBoostCounts: (counts: {
    driverBoostCount: number;
    teamBoostCount: number;
  }) => void;
  setRaceBoosts: (boosts: Record<string, string[]>) => void;
  cancelMode: boolean;
  setCancelMode: Dispatch<SetStateAction<boolean>>;
}

// Simple cookie helpers
function setCookie(name: string, value: string, days: number) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie =
    name +
    "=" +
    encodeURIComponent(value) +
    "; expires=" +
    expires +
    "; path=/";
}

function getCookie(name: string) {
  return document.cookie.split("; ").reduce((r, v) => {
    const parts = v.split("=");
    return parts[0] === name ? decodeURIComponent(parts[1]) : r;
  }, "");
}

export default function Login({
  onLoginSuccess,
  setUsername,
  setBoostInfo,
  useCurrentGP,
  setUseCurrentGP,
  setBoostCounts,
  setRaceBoosts,
  cancelMode,
  setCancelMode,
}: LoginProps) {
  const [credentials, setCredentials] = useState<LoginRequest>({
    username: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingBoost, setLoadingBoost] = useState(true);
  const [boostInfo, setLocalBoostInfo] = useState<string | null>(null);

  useEffect(() => {
    fetchBoostAnnouncement();
    // Pre-fill username from cookie if available
    const savedUsername = getCookie("gpgsl_username");
    if (savedUsername) {
      setCredentials((prev) => ({ ...prev, username: savedUsername }));
    }
  }, []);

  const fetchBoostAnnouncement = async () => {
    try {
      setLoadingBoost(true);
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/boost-announcement`
      );
      const data = await response.json();

      if (data.success) {
        setLocalBoostInfo(data.message);
        setBoostInfo(data.message);
      } else {
        const message = data.message || "Unable to fetch boost information";
        setLocalBoostInfo(message);
        setBoostInfo(message);
        // Disable the switch and set it to OFF when boost info can't be fetched
        setUseCurrentGP(false);
      }
    } catch (err) {
      console.error("Error fetching boost announcement:", err);
      const message = "Unable to fetch boost information";
      setLocalBoostInfo(message);
      setBoostInfo(message);
      // Disable the switch and set it to OFF when there's an error
      setUseCurrentGP(false);
    } finally {
      setLoadingBoost(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/login/get-pm-page`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include", // ensure Set-Cookie from backend is accepted in dev (different origin)
          body: JSON.stringify(credentials),
        }
      );
      setUsername(credentials.username);
      // Save username in cookie for 365 days
      setCookie("gpgsl_username", credentials.username, 365);

      const data: LoginResponse = await response.json();

      if (!data.success) {
        throw new Error(data.message || "Login failed");
      }

      // Fetch boost counts after successful login
      try {
        const boostCountsResponse = await fetch(
          `${import.meta.env.VITE_API_BASE_URL}/login/get-boost-counts`,
          {
            credentials: "include", // Important: Send cookies
          }
        );

        if (boostCountsResponse.ok) {
          const boostCountsData = await boostCountsResponse.json();
          if (boostCountsData.success) {
            setBoostCounts({
              driverBoostCount: boostCountsData.driverBoostCount || 0,
              teamBoostCount: boostCountsData.teamBoostCount || 0,
            });
            setRaceBoosts(boostCountsData.raceBoosts || {});
          } else if (boostCountsData.message === "No session cookie found") {
            // Provide clearer guidance if cookie missing
            setError(
              "Session cookie missing. If this is dev, ensure backend CORS includes localhost:5173 and re-login."
            );
          }
        }
      } catch (boostErr) {
        console.error("Failed to fetch boost counts:", boostErr);
        // Don't fail login if boost counts can't be fetched
        setBoostCounts({ driverBoostCount: 0, teamBoostCount: 0 });
        setRaceBoosts({});
      }

      onLoginSuccess(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unknown error occurred"
      );
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
                onChange={(e) =>
                  setCredentials({ ...credentials, username: e.target.value })
                }
                required
              />
            </div>
            <div className="input-group">
              <label htmlFor="password">Password:</label>
              <input
                type="password"
                id="password"
                value={credentials.password}
                onChange={(e) =>
                  setCredentials({ ...credentials, password: e.target.value })
                }
                required
              />
            </div>
            <button
              type="submit"
              className="btn width-50 ml-auto"
              disabled={loading}
            >
              {loading ? "Logging in..." : "Login"}
            </button>
          </form>

          {/* Cancel Mode Switch Option */}
          <div className="cancel-mode-option">
            <label className="cancel-mode-switch">
              <input
                type="checkbox"
                checked={cancelMode}
                onChange={(e) => setCancelMode(e.target.checked)}
              />
              <span className="switch-slider cancel-slider"></span>
              <span className="switch-label">I want to cancel a boost</span>
            </label>
          </div>

          {/* Current GP Switch Option */}
          {boostInfo && (
            <div className="current-gp-option">
              <label
                className={`current-gp-switch ${
                  boostInfo.includes("Boost post not found") ||
                  boostInfo.includes("Unable to fetch")
                    ? "disabled"
                    : ""
                }`}
              >
                <input
                  type="checkbox"
                  checked={useCurrentGP}
                  onChange={(e) => setUseCurrentGP(e.target.checked)}
                  disabled={
                    boostInfo.includes("Boost post not found") ||
                    boostInfo.includes("Unable to fetch")
                  }
                />
                <span className="switch-slider"></span>
                <span className="switch-label">For most current GP</span>
              </label>
              <div className="boost-info-display">{boostInfo}</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
