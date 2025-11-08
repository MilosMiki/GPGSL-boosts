// src/App.tsx
import { useState, useEffect } from "react";
import Login from "./components/Login";
import BoostPicker from "./components/BoostPicker";
import CalendarPicker from "./components/CalendarPicker";
import PmForm from "./components/PmForm";
import { LoginResponse } from "./types";
import { FaCheck } from "react-icons/fa";
import "./App.css";
import { Race } from "./types/race";
import { Team } from "./types/team";
import { Driver } from "./types/driver";

export default function App() {
  const [step, setStep] = useState<number>(0);
  const [loginData, setLoginData] = useState<LoginResponse | null>(null);
  const [driverBoost, setDriverBoost] = useState(false);
  const [teamBoost, setTeamBoost] = useState(false);
  const [selectedRace, setSelectedRace] = useState<Race | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [teamBoostType, setTeamBoostType] = useState<
    "Single" | "Double" | null
  >(null);
  const [driver, setDriver] = useState<Driver | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [boostInfo, setBoostInfo] = useState<string | null>(null);
  const [useCurrentGP, setUseCurrentGP] = useState(false); // Start with OFF
  const [isFirstLoad, setIsFirstLoad] = useState(true);
  const [hasUserInteractedWithSwitch, setHasUserInteractedWithSwitch] =
    useState(false);
  const [boostCounts, setBoostCounts] = useState<{
    driverBoostCount: number;
    teamBoostCount: number;
  }>({ driverBoostCount: 0, teamBoostCount: 0 });
  const [raceBoosts, setRaceBoosts] = useState<Record<string, string[]>>({});
  const [cancelMode, setCancelMode] = useState(false); // Cancel mode state

  // Clear selected race when useCurrentGP is turned OFF
  useEffect(() => {
    if (!useCurrentGP) {
      setSelectedRace(null);
    }
  }, [useCurrentGP]);

  // Set switch to ON when boost info is loaded (only on first load)
  useEffect(() => {
    if (boostInfo && isFirstLoad && !hasUserInteractedWithSwitch) {
      setUseCurrentGP(true);
    }
  }, [boostInfo, isFirstLoad, hasUserInteractedWithSwitch]);

  // Track when user interacts with the switch
  const handleUseCurrentGPChange = (value: boolean) => {
    setHasUserInteractedWithSwitch(true);
    setUseCurrentGP(value);
  };

  const steps = [
    {
      title: "Login",
      component: (
        <Login
          onLoginSuccess={handleLoginSuccess}
          setUsername={setUsername}
          setBoostInfo={setBoostInfo}
          useCurrentGP={useCurrentGP}
          setUseCurrentGP={handleUseCurrentGPChange}
          setBoostCounts={setBoostCounts}
          setRaceBoosts={setRaceBoosts}
          cancelMode={cancelMode}
          setCancelMode={setCancelMode}
        />
      ),
    },
    {
      title: "Boost Type",
      component: (
        <BoostPicker
          handleBoostSelected={handleBoostSelected}
          driverBoost={driverBoost}
          teamBoost={teamBoost}
          username={username}
          boostType={teamBoostType}
          setBoostType={handleTeamBoostType}
          driver={driver}
          setDriver={setDriver}
          team={team}
          setTeam={setTeam}
          driverBoostCount={boostCounts.driverBoostCount}
          teamBoostCount={boostCounts.teamBoostCount}
        />
      ),
    },
    {
      title: "Select Race",
      component: (
        <CalendarPicker
          onRaceSelected={handleRaceSelected}
          boostInfo={boostInfo}
          useCurrentGP={useCurrentGP}
          externalSelectedRace={selectedRace}
          raceBoosts={raceBoosts}
        />
      ),
    },
    {
      title: "Confirm",
      component: (
        <PmForm
          loginData={loginData!}
          driverBoost={driverBoost}
          teamBoost={teamBoost}
          race={selectedRace!}
          teamBoostType={teamBoostType}
          onSendSuccess={handleSendSuccess}
          driver={driver}
          team={team}
          cancelMode={cancelMode}
        />
      ),
    },
  ];

  function handleLoginSuccess(data: LoginResponse) {
    setLoginData(data);
    nextStep();
  }

  function handleTeamBoostType(type: "Single" | "Double") {
    setTeamBoostType(type);
    setTeamBoost(true);
  }

  function handleBoostSelected(type: "driver" | "team") {
    if (type === "driver") {
      setDriverBoost(!driverBoost);
    } else if (type === "team") {
      if (teamBoost) {
        setTeamBoostType(null);
      }
      setTeamBoost(!teamBoost);
    }
    //setBoostType(type);
    //nextStep();
  }

  function handleRaceSelected(race: Race | null) {
    setSelectedRace(race);
  }

  function handleSendSuccess() {
    nextStep();
  }

  function nextStep() {
    if (step === 0 && isFirstLoad) {
      setDriverBoost(false);
      setTeamBoost(false);
      setTeamBoostType(null);
      if (!hasUserInteractedWithSwitch) {
        setUseCurrentGP(true); // Only reset if user hasn't interacted with it
      }
      setIsFirstLoad(false);
    }
    if (step === 1) {
      if (!driverBoost && !teamBoost) {
        setError("Please select at least one boost type (Driver or Team)");
        return;
      }
      if (!teamBoostType && teamBoost) {
        setError("Please select Single or Double team boost");
        return;
      }

      // If switch is ON and we have boost info, skip to step 3 (Confirm)
      // But only if a race was successfully auto-selected
      if (useCurrentGP && boostInfo) {
        if (selectedRace === null) {
          setError(
            'Could not find the venue from boost info in the calendar. Please turn off "Use Current GP" and select manually.'
          );
          return;
        }
        setStep(3);
        return;
      }
    }
    if (step === 2) {
      if (useCurrentGP && selectedRace === null) {
        setError("Please select a race");
        return;
      }
      if (!useCurrentGP && selectedRace === null) {
        setError("Please select a race manually");
        return;
      }
    }

    // Clear any existing error if validation passes
    setError(null);
    setStep((prev) => Math.min(prev + 1, steps.length));
  }

  function prevStep() {
    setError(null);
    // If switch is ON and we have boost info, skip to step 2 (Boost Type)
    if (useCurrentGP && boostInfo && step === 3) {
      setStep(1);
      return;
    }
    setStep((prev) => Math.max(prev - 1, 0));
  }

  return (
    <div className={`form-container ${cancelMode ? "cancel-mode" : ""}`}>
      <h1 className="text-center">
        {cancelMode
          ? boostInfo && useCurrentGP
            ? "Three Step Cancel"
            : "Four Step Cancel"
          : boostInfo && useCurrentGP
          ? "Three Step Boost"
          : "Four Step Boost"}
      </h1>

      {/* Progress bar */}
      <div className="progressbar">
        <div
          className="progress"
          style={{
            width: `${
              (Math.min(step, steps.length - 1) / (steps.length - 1)) * 100
            }%`,
          }}
        ></div>

        {steps.map((stepItem, index) => {
          const isFinalCircle = index === steps.length - 1;
          const isCompleted = index < step;
          const isFinalAndDone = isFinalCircle && step === steps.length;

          return (
            <div
              key={index}
              className={`progress-step ${
                index <= step ? "progress-step-active" : ""
              }`}
              data-title={stepItem.title}
            >
              {isFinalAndDone || isCompleted ? <FaCheck /> : index + 1}
            </div>
          );
        })}
      </div>

      {error && <div className="error-message">{error}</div>}

      {/* Steps */}
      <div className="form-steps">
        {step < steps.length ? (
          steps.map((stepItem, index) => (
            <div
              key={index}
              className={`form-step ${
                index === step ? "form-step-active" : ""
              }`}
            >
              {stepItem.component}

              {index > 0 && index < steps.length - 1 && (
                <div className="btns-group">
                  <button
                    type="button"
                    className="btn btn-prev"
                    onClick={prevStep}
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    className="btn btn-next"
                    onClick={nextStep}
                  >
                    Next
                  </button>
                </div>
              )}

              {index === steps.length - 1 && (
                <div className="btns-group">
                  <button
                    type="button"
                    className="btn btn-prev"
                    onClick={prevStep}
                  >
                    Previous
                  </button>
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="form-step form-step-active success-message">
            <h2>✅ Boost successfully sent to GPGSL!</h2>
            <p>Thank you for your submission.</p>
          </div>
        )}
      </div>
      <div className="credits">
        App version 0.2.1
        <br />
        Contact:{" "}
        <a href="mailto:milos.ancevski@student.um.si">
          milos.ancevski@student.um.si
        </a>
        <br />
        GitHub:{" "}
        <a
          href="https://github.com/MilosMiki/GPGSL-boosts/tree/master/gpgsl-two-step-boost"
          target="_blank"
          rel="noopener noreferrer"
        >
          MilosMiki/GPGSL-boosts
        </a>
      </div>
    </div>
  );
}
