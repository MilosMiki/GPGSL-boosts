import React, { useEffect, useState } from "react";
import LoginApp from "./Login";
import CalendarApp from "./calendar";
import Lineup from "./lineup";
import { useCookies } from "react-cookie";
import "./App.css"; // Ensure you have this file for styling
import {
  decodeHTMLEntities,
  matchVenue,
  containsTeamBoost,
  parseCustomDate,
  formatDate,
  filterAndLogBoosts,
} from "./boostUtils";

// --- Boost Filtering Utilities (from lineup.js) ---

function App() {
  const [selectedId, setSelectedId] = useState(null);
  const [htmlContent, setHtmlContent] = useState("");
  const [triedLogin, setTriedLogin] = useState(false);
  const [venueName, setVenueName] = useState("");
  const [trackName, setTrackName] = useState("");
  const [country, setCountry] = useState("");
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [wrongUsername, setWrongUsername] = useState(false);
  const [wrongLogin, setWrongLogin] = useState(false);
  const [username, setUsername] = useState("");
  const [cookies, setCookie] = useCookies(["username", "help"]);
  const [showHelp, setShowHelp] = useState(false);
  const checkSessionEndpoint = `${process.env.REACT_APP_API_BASE_URL}/check-session`;

  // Extracted fetch logic for boosts/session
  const fetchBoosts = async () => {
    try {
      if (cookies.username) {
        setUsername(cookies.username);
        setWrongUsername(cookies.username?.toUpperCase() !== "GPGSL");
      }
      const response = await fetch(checkSessionEndpoint, {
        headers: {
          "X-Username": cookies.username,
        },
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setIsLoggedIn(true);
          const htmlContent = data.message
            .map((item) => `<div>${JSON.stringify(item)}</div>`)
            .join("");
          setHtmlContent(htmlContent);
          // Print boosts to console in readable format
          console.log("Refreshed");
          console.log("Messages:", data.message);
          console.log("Boosts:");
          // Run boost filtering/matching logic and print logs
          filterAndLogBoosts({
            messages: data.message,
            venueName,
            trackName,
            country,
            date: selectedDate,
            cookies,
            wrongUsername,
          });
        }
      }
    } catch (error) {
      console.error("Session check failed:", error);
    }
  };

  // Check for existing session on page load
  useEffect(() => {
    // Expose fetchBoosts globally for Lineup to call
    window.fetchBoostsFromApp = fetchBoosts;
    fetchBoosts();
    setShowHelp(!cookies.help);
  }, []);

  const handleHelpClose = () => {
    setCookie("help", true, { path: "/", maxAge: 365 * 24 * 60 * 60 }); // Expires in 1 year
    setShowHelp(false);
  };

  const toggleHelp = () => {
    setShowHelp(!showHelp);
  };

  return (
    <div className="App">
      {/* Help Overlay */}
      {showHelp && (
        <div className="help-overlay">
          <div className="help-modal">
            <h2>Welcome to GPGSL Boosts</h2>
            <div className="help-content">
              <p>This app helps you view whether you successfully boosted.</p>
              <p>
                <strong>For players:</strong>
              </p>
              <ul>
                <li>
                  Make sure when you submit your boost, that "Keep A Copy In My
                  Sent Items" is ticked (important!)
                </li>
                <li>Login with your grandprixgames account credentials</li>
                <li>Select the venue on the left side</li>
                <li>Select the deadline date (in the top right corner)</li>
                <li>Find the boost next to your driver/team name</li>
                <li>
                  Otherwise, you may find the rejection reason on the right side
                  tables
                </li>
                <li>
                  <b>Note:</b> Under certain conditions, this app may mark your
                  private messages as "Read"
                </li>
              </ul>
              <p>
                <strong>For admins:</strong>
              </p>
              <ul>
                <li>Login with GPGSL account credentials</li>
                <li>Select the venue on the left side</li>
                <li>Select the deadline date (in the top right corner)</li>
                <li>You may cycle between race and test driver tables</li>
                <li>Any unmatched boosts may be matched manually</li>
              </ul>
              <p>
                <strong>For debugging:</strong>
              </p>
              <ul>
                <li>
                  Refresh GPG button will load latest messages from
                  grandprixgames.org
                </li>
                <li>
                  Refresh Database button will reload drivers and teams, should
                  any issues occur
                </li>
                <li>
                  List all boosts will display a pop-up in text format,
                  separating race driver, test driver and team boosts. This may
                  then be copied into the boost post.
                </li>
                <li>
                  Tables can be copied to clipboard using the respective
                  buttons, for easier import into Excel
                </li>
              </ul>
            </div>
            <div className="help-footer">
              <button onClick={handleHelpClose}>Don't show this again</button>
              <button onClick={() => setShowHelp(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      <div className="sidebar">
        <CalendarApp
          selectedId={selectedId}
          setSelectedId={setSelectedId}
          setVenueName={setVenueName}
          setTrackName={setTrackName}
          setCountry={setCountry}
          showAdmin={isLoggedIn && !wrongLogin && !wrongUsername}
          toggleHelp={toggleHelp}
        />
        <div className="credits">
          App version 0.5.0
          <br />
          Contact:{" "}
          <a href="mailto:milos.ancevski@student.um.si">
            milos.ancevski@student.um.si
          </a>
          <br />
          GitHub:{" "}
          <a
            href="https://github.com/MilosMiki/GPGSL-boosts"
            target="_blank"
            rel="noopener noreferrer"
          >
            MilosMiki/GPGSL-boosts
          </a>
        </div>
      </div>
      <div className="sidebar-main-container">
        <div className="header">
          <LoginApp
            htmlContent={htmlContent}
            setHtmlContent={setHtmlContent}
            triedLogin={triedLogin}
            setTriedLogin={setTriedLogin}
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            isLoggedIn={isLoggedIn}
            setIsLoggedIn={setIsLoggedIn}
            wrongUsername={wrongUsername}
            setWrongUsername={setWrongUsername}
            wrongLogin={wrongLogin}
            setWrongLogin={setWrongLogin}
            username={username}
            setUsername={setUsername}
            cookies={cookies}
            setCookie={setCookie}
          />
        </div>
        <div className="main-content">
          <Lineup
            venueName={venueName}
            htmlContent={htmlContent}
            trackName={trackName}
            country={country}
            date={selectedDate}
            wrongUsername={wrongUsername}
            cookies={cookies}
            showAdmin={isLoggedIn && !wrongLogin && !wrongUsername}
          />
        </div>
      </div>

      {/* Cookies Notice */}
      <div className="cookies-notice">
        This website uses cookies to enhance user experience. By continuing to
        use this site, you agree to our use of cookies.
      </div>
    </div>
  );
}

export default App;
