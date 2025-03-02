import React, { useEffect, useState } from "react";
import { db } from "./firebase";
import { collection, getDocs, doc, setDoc, deleteDoc } from "firebase/firestore";
import { FaTrash, FaArrowUp, FaArrowDown, FaEdit, FaSave, FaPlus } from 'react-icons/fa';
import './lineup.css';

function Lineup({venueName,htmlContent,trackName,country}) {
    const [teams, setTeams] = useState([]);
    const [drivers, setDrivers] = useState([]);
    const [editMode, setEditMode] = useState(false);
    const [newTeam, setNewTeam] = useState("");
    const [username, setUsername] = useState("");
    const [short1, setShort1] = useState("");
    const [short2, setShort2] = useState("");
    const [newDriverInfo, setNewDriverInfo] = useState({
        team: "",
        name: "",
        username: ""
    });
    const [driverId, setDriverId] = useState(1);
    const [boosts, setBoosts] = useState([]);
    const [unmatchedBoosts, setUnmatchedBoosts] = useState([]); // New state for unmatched boosts
    const [otherMessages, setOtherMessages] = useState([]); // New state for other messages

    useEffect(() => {
        // Step 1: Parse the JSON dump
        const divElements = htmlContent.split("</div>");
        const parsedData = divElements
            .map((div) => {
                const jsonString = div.replace(/<div>/g, "").trim();
                if (jsonString) {
                    try {
                        return JSON.parse(jsonString);
                    } catch (error) {
                        console.error("Failed to parse JSON:", jsonString);
                        return null;
                    }
                }
                return null;
            })
            .filter((data) => data !== null);

        // Step 2: Match fields and update boosts
        const newBoosts = [];
        const unmatchedBoosts = []; // For boosts that couldn't be matched
        const otherMessages = []; // For messages that are not boosts for this GP.
        
        parsedData.forEach((data) => {
            const { title: rawTitle, sender, date } = data;
            const title = decodeHTMLEntities(rawTitle); // Decode HTML entities in the title
            const isDriverBoost = /driver boost/i.test(title); // Case insensitive check
            const isTeamBoost = /team boost/i.test(title); // Case insensitive check
            const findVenue = matchVenue(title, venueName, trackName, country);

            let matched = false;
            if (isDriverBoost) {
                // Extract driver name/username and venue from title (with optional parentheses)
                const [, nameOrUsername, venue] =
                    title.match(/"?Driver Boost - \(?([^(]+?)\s*(?:\([^)]*\))? - (\(?.+?\)?)\s*[-,]\s*/i) || [];
                if (nameOrUsername && findVenue) {
                    // Remove parentheses from name/username if present
                    const cleanedNameOrUsername = nameOrUsername.replace(/[()]/g, "");
                    // Find matching driver by name OR username (case insensitive)
                    const driver = drivers.find(
                        (d) =>
                            d.name.localeCompare(cleanedNameOrUsername, undefined, { sensitivity: 'base' }) === 0 ||
                            d.username.localeCompare(cleanedNameOrUsername, undefined, { sensitivity: 'base' }) === 0
                    );
                    if (driver) {
                        newBoosts.push({ id: driver.id, boosted: 1 }); // Single boost for drivers
                        matched = true;
                    }
                }
                if(!matched)
                {
                    if (findVenue) {
                        // If the boost message contains venueName and it wasnt matched
                        unmatchedBoosts.push({ title, sender, date });
                    }
                    else{
                        otherMessages.push({ title, sender, date });
                    }
                }
            } else if (isTeamBoost) {
                // Extract team name, venue, and boost type from title (flexible delimiters and optional parentheses)
                const [, name, venue, boostType] =
                    //title.match(/"?Team Boost - (\(?.+?\)?) - (\(?.+?\)?)\s*(?:[-,].+?)?\s*\(?(Single|Double|)\)?"?/i) || [];
                    title.match(/"?Team Boost\s*[-,]\s*(\(?.+?\)?)\s*[-,]\s*(\(?.+?\)?)\s*(?:[-,].+?)?\s*\(?(Single|Double)\)?"?/i) || [];
                if (name && findVenue) {
                    // Remove parentheses from name if present
                    const cleanedName = name.replace(/[()]/g, "");
                    // Find matching team (case insensitive)
                    const team = teams.find((t) => {
                        // Check if the team name matches (case-insensitive)
                        const nameMatches = t.name.localeCompare(cleanedName, undefined, { sensitivity: 'base' }) === 0;
                    
                        // Check if short1 matches, only if short1 exists and is not empty
                        const short1Matches = t.short1 && t.short1.localeCompare(cleanedName, undefined, { sensitivity: 'base' }) === 0;
                    
                        // Check if short2 matches, only if short2 exists and is not empty
                        const short2Matches = t.short2 && t.short2.localeCompare(cleanedName, undefined, { sensitivity: 'base' }) === 0;
                    
                        // Check if the username matches (case-insensitive)
                        const usernameMatches = t.username.localeCompare(sender, undefined, { sensitivity: 'base' }) === 0;
                    
                        // Return true if either name, short1, or short2 matches, AND the username matches
                        return (nameMatches || short1Matches || short2Matches) && usernameMatches;
                    });
                    if (team) {
                        const boosted = boostType.toLowerCase() === "double" ? 2 : 1;
                        newBoosts.push({ id: team.id, boosted });
                        matched = true;
                    }
                }
                if(!matched)
                {
                    if (findVenue) {
                        // If the boost message contains venueName and it wasnt matched
                        unmatchedBoosts.push({ title, sender, date });
                    }
                    else{
                        otherMessages.push({ title, sender, date });
                    }
                }
            }
            
            else {
                // If the message contains venueName but is not a boost, add it to otherMessages
                otherMessages.push({ title, sender, date });
            }
        });

        // Step 3: Update boosts collection
        setBoosts(newBoosts);
        setUnmatchedBoosts(unmatchedBoosts); // New state for unmatched boosts
        setOtherMessages(otherMessages); // New state for other messages
    }, [htmlContent, venueName]); // only update when the venue updates, or if it finds new PMs sent. 
                                  // If you update the teams/drivers list, the behaviour may break, and a reload is recommended

    // Fetch Teams
    useEffect(() => {
        const fetchTeams = async () => {
            const teamsRef = collection(db, "teams");
            const teamDocs = await getDocs(teamsRef);
            const fetchedTeams = [];
            
            teamDocs.forEach(doc => {
                fetchedTeams.push({
                    id: doc.id,
                    name: doc.data().name,
                    username: doc.data().username,
                    short1: doc.data().short1,
                    short2: doc.data().short2
                });
            });

            setTeams(fetchedTeams.sort((a, b) => a.id - b.id));
        };

        fetchTeams();
    }, []);

    // Fetch Drivers for selected Team
    useEffect(() => {
        const fetchDrivers = async () => {
            const driversRef = collection(db, `drivers`);
            const driverDocs = await getDocs(driversRef);
            const fetchedDrivers = [];
            
            driverDocs.forEach(doc => {
                fetchedDrivers.push({
                    id: doc.id,
                    name: doc.data().name,
                    username: doc.data().username,
                    team: doc.data().team,
                });
            });

            setDrivers(fetchedDrivers.sort((a, b) => a.id - b.id));
        };

        fetchDrivers();
    }, []);

    const addTeam = async () => {
        if (newTeam.trim() === "" || username.trim() === "") 
        {
            console.log("Error: fields are empty");
            return;
        }
        const newId = (teams.length + 1) * 100;
        const newEntry = {
            id: newId,
            name: newTeam,
            username: username,
            short1: short1 ? short1.trim() : "", // Include short1 if present, otherwise empty string
            short2: short2 ? short2.trim() : ""  // Include short2 if present, otherwise empty string
        };
        await setDoc(doc(db, "teams", newId.toString()), newEntry);
        setTeams([...teams, newEntry].sort((a, b) => a.id - b.id));

        setNewTeam("");
        setUsername("");
        setShort1("");
        setShort2("");
    };

    const addDriver = async () => {
        if (!newDriverInfo.team || !newDriverInfo.name || !newDriverInfo.username) 
        {
            console.log(newDriverInfo);
            console.log("Error: fields are empty");
            return;
        } 
        var found = -1;
        for(var team in teams){
            if(teams[team].name === newDriverInfo.team){
                found = teams[team].id;
                break;
            }
        }
        if(found == -1)
        {
            console.log(`Error: team not found. Entered team name is ${newDriverInfo.team}`);
            return;
        }
        const newId = parseInt(found) + parseInt(driverId);
        const newEntry = {
            id: newId,
            name: newDriverInfo.name,
            username: newDriverInfo.username,
            team: newDriverInfo.team
        };
        await setDoc(doc(db, "drivers", newId.toString()), newEntry);
        setDrivers([...drivers, newEntry].sort((a, b) => a.id - b.id));

        setNewDriverInfo({
            team: "",
            name: "",
            username: ""
        });
    };

    const editLineup = () => {
        setEditMode(!editMode);
    };

    return (
        <div className="lineup-editor">
            <div className="left-container">
                <table>
                    <thead>
                        <tr>
                            <th>User</th>
                            <th>Boosts</th>
                        </tr>
                    </thead>
                    <tbody>
                        {teams.map(team => (
                            <React.Fragment key={team.id}>
                                {/* Team Row */}
                                <tr className="team-row">
                                    <td>
                                        {/* Team name and username */}
                                        <div>
                                        {team.id / 100}. {team.name} ({team.username})
                                        </div>
                                        {/* Display short1 and short2 if they exist */}
                                        {(team.short1 || team.short2) && (
                                        <div style={{ fontSize: "0.6em", color: "gray" }}>
                                            {team.short1 && <span>{team.short1}</span>}
                                            {team.short1 && team.short2 && <span> · </span>} {/* Add a separator if both exist */}
                                            {team.short2 && <span>{team.short2}</span>}
                                        </div>
                                        )}
                                    </td>
                                    <td>
                                        {boosts.find((boost) => boost.id === team.id)?.boosted == 1
                                        ? "+"
                                        : boosts.find((boost) => boost.id === team.id)?.boosted == 2
                                        ? "+ + +"
                                        : "" || ""}
                                    </td>
                                </tr>
                                {/* Driver Rows */}
                                {drivers
                                    .filter(driver => Math.floor(driver.id / 100) === Math.floor(team.id / 100))
                                    .map(driver => (
                                        <tr key={driver.id} className="driver-row">
                                            <td style={{ paddingLeft: '20px' }}>#{driver.id % 100}: {driver.name} ({driver.username})</td>
                                            <td>
                                            {boosts.find((boost) => boost.id === driver.id)?.boosted == 1 ? "+" : "" || ""}</td>
                                        </tr>
                                    ))}
                            </React.Fragment>
                        ))}
                    </tbody>
                </table>
                
                {!editMode ? (
                    <button onClick={() => setEditMode(!editMode)}>
                        <FaEdit /> Edit Lineup
                    </button>
                ) : (
                    <>
                        <button onClick={editLineup}>
                            Close Edit Mode
                        </button>

                        <div className="add-section">
                            <input
                                type="text"
                                placeholder="Team Name"
                                value={newTeam}
                                onChange={(e) => setNewTeam(e.target.value)}
                            />
                            <input
                                type="text"
                                placeholder="Username"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                            />
                            <input
                                type="text"
                                placeholder="Short name 1"
                                value={short1}
                                onChange={(e) => setShort1(e.target.value)}
                            />
                            <input
                                type="text"
                                placeholder="Short name 2"
                                value={short2}
                                onChange={(e) => setShort2(e.target.value)}
                            />
                            <button onClick={addTeam}>
                                Add Team
                            </button>
                        </div>
                        <div className="add-section">
                            <select
                                value={newDriverInfo.team}
                                onChange={(e) => setNewDriverInfo({ ...newDriverInfo, team: e.target.value })}
                            >
                                <option value="" disabled>Select a team</option> {/* Default blank option */}
                                {teams.map(team => (
                                    <option key={team.id} value={team.name}>
                                        {team.name}
                                    </option>
                                ))}
                            </select>
                            <input
                                type="text"
                                placeholder="Name"
                                value={newDriverInfo.name}
                                onChange={(e) => setNewDriverInfo({...newDriverInfo, name: e.target.value})}
                            />
                            <input
                                type="text"
                                placeholder="Username"
                                value={newDriverInfo.username}
                                onChange={(e) => setNewDriverInfo({...newDriverInfo, username: e.target.value})}
                            />
                            <input
                                type="number"
                                placeholder="1"
                                value={driverId}
                                onChange={(e) => setDriverId(e.target.value)}
                            />
                            <button onClick={addDriver}>
                                Add Driver
                            </button>
                        </div>
                    </>
                )}
            </div>
            

            <div className="side-tables">
                <UnmatchedBoostsTable boosts={unmatchedBoosts} />
                <OtherMessagesTable messages={otherMessages} />
            </div>

        </div>
    );
};

function UnmatchedBoostsTable({ boosts }) {
    return (
        <div className="unmatched-boosts">
            <h3>Unmatched Boosts</h3>
            <table className="unmatched-table">
                <thead>
                    <tr>
                        <th>Sender</th>
                        <th>Message</th>
                        <th>Date</th> {/* New column for date */}
                    </tr>
                </thead>
                <tbody>
                    {boosts.map((boost, index) => (
                        <tr key={index}>
                            <td>{boost.sender}</td>
                            <td>{boost.title}</td>
                            <td>{boost.date}</td> {/* Display the date */}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
function OtherMessagesTable({ messages }) {
    return (
        <div className="other-messages">
            <h3>Other Messages</h3>
            <table className="other-table">
                <thead>
                    <tr>
                        <th>Sender</th>
                        <th>Message</th>
                        <th>Date</th> {/* Date column */}
                    </tr>
                </thead>
                <tbody>
                    {messages.map((message, index) => (
                        <tr key={index}>
                            <td>{message.sender}</td>
                            <td>{message.title}</td>
                            <td>{message.date}</td> {/* Display the date */}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
function decodeHTMLEntities(text) {
    const textArea = document.createElement('textarea');
    textArea.innerHTML = text;
    return textArea.value;
}

function matchVenue(title, venueName, trackName, country){
    return title.includes(venueName) || title.includes(trackName) || title.includes(country)
}

export default Lineup;