// src/App.tsx
import { useState } from 'react';
import Login from './components/Login';
import BoostPicker from './components/BoostPicker';
import CalendarPicker from './components/CalendarPicker';
import PmForm from './components/PmForm';
import { LoginResponse } from './types';
import { FaCheck } from 'react-icons/fa';
import './App.css';
import { Race } from './types/race';
import { Team } from './types/team';
import { Driver } from './types/driver';


export default function App() {
  const [step, setStep] = useState<number>(0);
  const [loginData, setLoginData] = useState<LoginResponse | null>(null);
  const [driverBoost, setDriverBoost] = useState(false);
  const [teamBoost, setTeamBoost] = useState(false);
  const [selectedRace, setSelectedRace] = useState<Race | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [teamBoostType, setTeamBoostType] = useState<'single' | 'double' | null>(null);
  const [driver, setDriver] = useState<Driver | null>(null);
  const [team, setTeam] = useState<Team | null>(null);

  const steps = [
    { title: 'Login', component: <Login onLoginSuccess={handleLoginSuccess} setUsername={setUsername} /> },
    { title: 'Boost Type', component: 
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
    /> },
    { title: 'Select Race', component: <CalendarPicker onRaceSelected={handleRaceSelected} /> },
    { title: 'Confirm', component: (
      <PmForm 
        loginData={loginData!} 
        driverBoost={driverBoost}
        teamBoost={teamBoost}
        race={selectedRace!}
        teamBoostType={teamBoostType}
        onSendSuccess={handleSendSuccess}
        driver={driver}
        team={team}
      />
    )}
  ];

  function handleLoginSuccess(data: LoginResponse) {
    setLoginData(data);
    nextStep();
  }

  function handleTeamBoostType(type: 'single' | 'double'){
    setTeamBoostType(type);
    setTeamBoost(true);
  }

  function handleBoostSelected(type: 'driver' | 'team') {
    if(type==='driver'){
      setDriverBoost(!driverBoost);
    }
    else if(type==='team'){
      if(teamBoost){
        setTeamBoostType(null);
      }
      setTeamBoost(!teamBoost);
    }
    //setBoostType(type);
    //nextStep();
  }

  function handleRaceSelected(race: Race) {
    setSelectedRace(race);
    //nextStep();
  }

  function handleSendSuccess() {
    nextStep();
  }

  function nextStep() {
    if(step === 0){
      setDriverBoost(false);
      setTeamBoost(false);
    }
    if (step === 1) {
      if(!driverBoost && !teamBoost)
      {
        setError('Please select at least one boost type (Driver or Team)');
        return;
      }
      if(!teamBoostType && teamBoost){
        setError('Please select Single or Double team boost');
        return;
      }
    }
    if (step===2 && selectedRace === null){
      setError('Please select a race');
      return;
    }
    
    // Clear any existing error if validation passes
    setError(null);
    setStep(prev => Math.min(prev + 1, steps.length));
  }

  function prevStep() {
    setError(null);
    setStep(prev => Math.max(prev - 1, 0));
  }

  return (
    <div className="form-container">
      <h1 className="text-center">Four Step Boost</h1>
      
      {/* Progress bar */}
      <div className="progressbar">
        <div 
          className="progress" 
          style={{ width: `${Math.min(step, steps.length - 1) / (steps.length - 1) * 100}%` }}
        ></div>
        
        {steps.map((stepItem, index) => {
          const isFinalCircle = index === steps.length - 1;
          const isCompleted = index < step;
          const isFinalAndDone = isFinalCircle && step === steps.length;

          return (
            <div
              key={index}
              className={`progress-step ${index <= step ? 'progress-step-active' : ''}`}
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
              className={`form-step ${index === step ? 'form-step-active' : ''}`}
            >
              {stepItem.component}

              {index > 0 && index < steps.length - 1 && (
                <div className="btns-group">
                  <button type="button" className="btn btn-prev" onClick={prevStep}>
                    Previous
                  </button>
                  <button type="button" className="btn btn-next" onClick={nextStep}>
                    Next
                  </button>
                </div>
              )}

              {index === steps.length - 1 && (
                <div className="btns-group">
                  <button type="button" className="btn btn-prev" onClick={prevStep}>
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
    </div>
  );
}