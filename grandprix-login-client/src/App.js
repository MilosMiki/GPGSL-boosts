import React, { useEffect, useState } from "react";
import LoginApp from './Login';
import CalendarApp from './calendar';
import Lineup from './lineup';
import './App.css'; // Ensure you have this file for styling

function App() {
    const [selectedId, setSelectedId] = useState(null);
    const [htmlContent, setHtmlContent] = useState('');
    const [triedLogin, setTriedLogin] = useState(false);
    const [venueName, setVenueName] = useState('');
    const [trackName, setTrackName] = useState('');
    const [country, setCountry] = useState('');
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]); // Default to today's date

    return (
        <div className="App">
            <div className="sidebar">
                <CalendarApp selectedId={selectedId} setSelectedId={setSelectedId} setVenueName={setVenueName} setTrackName={setTrackName} setCountry={setCountry} />
            </div>
            <div className="sidebar-main-container">
                <div className="header">
                    <LoginApp htmlContent={htmlContent} setHtmlContent={setHtmlContent} triedLogin={triedLogin} setTriedLogin={setTriedLogin} 
                        selectedDate={selectedDate} setSelectedDate={setSelectedDate}/>
                </div>
                <div className="main-content">
                    <Lineup venueName={venueName} htmlContent={htmlContent} trackName={trackName} country={country} date={selectedDate}/>
                </div>
            </div>
        </div>
    );
}


export default App;
