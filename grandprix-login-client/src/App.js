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
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const checkSessionEndpoint = `${process.env.REACT_APP_API_BASE_URL}/check-session`; // backend:port/login/check-session`

    // Check for existing session on page load
    useEffect(() => {
        const checkSession = async () => {
            try {
                //console.log("Making request to check-session.");
                const response = await fetch(checkSessionEndpoint, {
                    credentials: 'include' // Send cookies
                });
                
                if (response.ok) {
                    //console.log(response);
                    const data = await response.json();
                    if (data.success) {
                        console.log(data);
                        setIsLoggedIn(true);
                        const htmlContent = data.message.map(item => `<div>${JSON.stringify(item)}</div>`).join('');
                        setHtmlContent(htmlContent);
                        //setHtmlContent(data.message || '');
                    }
                }
            } catch (error) {
                console.error('Session check failed:', error);
            }
        };

        checkSession();
    }, []);

    return (
        <div className="App">
            <div className="sidebar">
                <CalendarApp selectedId={selectedId} setSelectedId={setSelectedId} setVenueName={setVenueName} setTrackName={setTrackName} setCountry={setCountry} />
                <div className="credits">
                    App version 0.2.3<br />
                    Contact: <a href="mailto:milos.ancevski@student.um.si">milos.ancevski@student.um.si</a><br />
                    GitHub: <a href="https://github.com/MilosMiki/GPGSL-boosts" target="_blank" rel="noopener noreferrer">MilosMiki/GPGSL-boosts</a>
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
                    />             
                </div>
                <div className="main-content">
                    <Lineup venueName={venueName} htmlContent={htmlContent} trackName={trackName} country={country} date={selectedDate}/>
                </div>
            </div>
        </div>
    );
}


export default App;
