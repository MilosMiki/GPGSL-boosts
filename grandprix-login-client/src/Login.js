import React, { useState } from 'react';

require('dotenv').config(); // Load environment variables

const loginEndpoint = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5250/login';

function LoginApp() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [htmlContent, setHtmlContent] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        const formData = {
            Username: username,
            Password: password
        };
        try {
            // Make the login POST request
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
            setHtmlContent(data.message);
        } catch (error) {
            console.error('Error:', error);
        }
    };

    return (
        <div>
            <form onSubmit={handleSubmit}>
                <label>
                    Username: 
                    <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                    />
                </label>
                
                <label>
                    Password:
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                </label>

                <button type="submit">Login</button>
            </form>

            {htmlContent && (
                <div>
                    <h3>Response HTML:</h3>
                    <div 
                        dangerouslySetInnerHTML={{ __html: htmlContent }}
                        style={{
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            overflow: 'auto'
                        }}
                    />
                </div>
            )}
        </div>
    );
}

export default LoginApp;