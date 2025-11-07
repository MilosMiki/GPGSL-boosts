import React, { useState, useEffect } from "react";

const loginEndpoint =
  process.env.REACT_APP_API_BASE_URL || "http://localhost:5250/login";

function LoginApp({
  htmlContent,
  setHtmlContent,
  selectedDate,
  setSelectedDate,
  isLoggedIn,
  setIsLoggedIn,
  wrongUsername,
  setWrongUsername,
  wrongLogin,
  setWrongLogin,
  username,
  setUsername,
  cookies,
  setCookie,
}) {
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  // Load saved username from cookie when component mounts
  useEffect(() => {
    if (cookies.username) {
      setUsername(cookies.username);
      setWrongUsername(cookies.username?.toUpperCase() !== "GPGSL");
    }
  }, [cookies.username]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoginError("");
    const formData = {
      Username: username,
      Password: password,
    };
    try {
      // Make the login POST request
      console.log("API URL:", process.env.REACT_APP_API_BASE_URL);
      const response = await fetch(loginEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
        credentials: "include", // This ensures cookies are sent and received
      });

      if (!response.ok) {
        let errorMsg = "Login failed";
        try {
          const errorData = await response.json();
          errorMsg = errorData.message || errorMsg;
        } catch (jsonErr) {
          // If not JSON, try text
          try {
            errorMsg = await response.text();
          } catch (textErr) {
            // fallback to default
          }
        }
        setLoginError(errorMsg);
        setWrongLogin(true);
        setIsLoggedIn(false);
        return;
      }

      const data = await response.json();
      console.log("Login successful:", data);
      setIsLoggedIn(true);
      setLoginError("");

      // Save username to cookie (expires in 30 days)
      setCookie("username", username, { path: "/", maxAge: 2592000 });

      if (data.cookies && data.cookies.phorum_session_v5) {
        setWrongLogin(false);
        setWrongUsername(username.toUpperCase() !== "GPGSL");
      } else {
        setWrongLogin(true);
      }

      const htmlContent = data.message
        .map((item) => `<div>${JSON.stringify(item)}</div>`)
        .join("");
      setHtmlContent(htmlContent);
    } catch (error) {
      console.error("Error:", error);
      setLoginError(error.message || "An unexpected error occurred.");
      setIsLoggedIn(false);
      setWrongLogin(true);
    }
  };

  return (
    <div className="login-container">
      <form onSubmit={handleSubmit}>
        <label className="login-label">
          Username:
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="login-input"
          />
        </label>
        <label className="login-label">
          Password:
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="login-input"
          />
        </label>
        <button type="submit" className="login-button">
          Login
        </button>
        &nbsp;
        {loginError && <span className="logged-in-message">{loginError}</span>}
        {!loginError && isLoggedIn && !wrongLogin && !wrongUsername && (
          <span className="logged-in-message">
            Logged in{username && " as " + username}! Select a venue to view
            boosts.
          </span>
        )}
        {!loginError && isLoggedIn && !wrongLogin && wrongUsername && (
          <span className="logged-in-message">
            Logged in{username && " as " + username}! Log in with the GPGSL
            account to view boosts.
          </span>
        )}
        {!loginError && isLoggedIn && wrongLogin && (
          <span className="logged-in-message">Incorrect credentials.</span>
        )}
      </form>
      <div className="boost-deadline-container">
        <label className="login-label">Boost deadline:</label>
        <input
          type="date"
          onChange={(e) => setSelectedDate(e.target.value)}
          value={selectedDate}
          className="date-picker"
        />
      </div>
    </div>
  );
}

export default LoginApp;
