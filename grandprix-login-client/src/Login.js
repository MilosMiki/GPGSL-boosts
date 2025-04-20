import React, { useState } from 'react';

const loginEndpoint = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5250/login';

function LoginApp({htmlContent,setHtmlContent, selectedDate, setSelectedDate, isLoggedIn, setIsLoggedIn}) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [wrongLogin, setWrongLogin] = useState(false);
    const [wrongUsername, setWrongUsername] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const formData = {
            Username: username,
            Password: password
        };
        try {
            // Make the login POST request
            console.log('API URL:', process.env.REACT_APP_API_BASE_URL);
            const response = await fetch(loginEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData),
                credentials: 'include' // This ensures cookies are sent and received
            });

            if (!response.ok) {
                throw new Error('Login failed');
            }

            const data = await response.json();
            console.log('Login successful:', data);
            setIsLoggedIn(true);
            if (data.cookies && data.cookies.phorum_session_v5) {
                setWrongLogin(false);
                setWrongUsername(username !== "GPGSL");
            } else {
                setWrongLogin(true);
            }

            const htmlContent = data.message.map(item => `<div>${JSON.stringify(item)}</div>`).join('');
            setHtmlContent(htmlContent);
        } catch (error) {
            console.error('Error:', error);
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

                <button type="submit" className="login-button">Login</button>
                &nbsp;
                {isLoggedIn && !wrongLogin && !wrongUsername && <span className="logged-in-message">Logged in{username && " as " + username}! Select a venue to view boosts.</span>}
                {isLoggedIn && !wrongLogin && wrongUsername && <span className="logged-in-message">Logged in{username && " as " + username}! Log in with the GPGSL account to view boosts.</span>}
                {isLoggedIn && wrongLogin && <span className="logged-in-message">Incorrect credentials.</span>}
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