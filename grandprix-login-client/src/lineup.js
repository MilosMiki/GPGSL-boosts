import React, { useEffect, useState } from "react";
import { db } from "./firebase";
import { collection, getDocs, doc, setDoc, deleteDoc } from "firebase/firestore";
import { FaTrash, FaArrowUp, FaArrowDown, FaEdit, FaSave, FaPlus } from 'react-icons/fa';
import './lineup.css';

function Lineup({venueName,htmlContent,trackName,country,date}) {
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
    const [unmatchedBoosts, setUnmatchedBoosts] = useState([]);
    const [otherMessages, setOtherMessages] = useState([]);
    const [deadlineBoosts, setDeadlineBoosts] = useState([]);
    const [warnings, setWarnings] = useState([]);
    const [totals, setTotals] = useState([]);


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

        // Step 2: Reset duplicates for each team
        teams.forEach(team => {
            team.duplicate=false;
        });
        // Step 3: Reset duplicates for each driver
        drivers.forEach(driver => {
            driver.duplicate=false;
        });

        
        // Step 4: Match fields and update boosts
        const newBoosts = [];
        const unmatchedBoosts = []; // For boosts that couldn't be matched
        const otherMessages = []; // For messages that are not boosts for this GP.
        const deadlineBoosts = []; // For messages that are after the deadline
        parsedData.forEach((data) => {
            const { title: rawTitle, sender, date: dataDate } = data;

            // Create a Date object for the parsed data's date
            const parsedDate = parseCustomDate(dataDate);
            //console.log(dataDate + " - " + parsedDate);
            // Create a Date object for the Lineup date at 20:00 hours
            const lineupDateAt20 = new Date(date);
            lineupDateAt20.setHours(20, 0, 0, 0); // Set time to 20:00:00.000
            //console.log(date);
            //console.log(parsedDate + " - " + lineupDateAt20);

            const title = decodeHTMLEntities(rawTitle); // Decode HTML entities in the title
            const isDriverBoost = /driver boost/i.test(title); // Case insensitive check
            const isTeamBoost = /team boost/i.test(title); // Case insensitive check
            const findVenue = matchVenue(title, venueName, trackName, country);

            // Compare the dates
            if (parsedDate > lineupDateAt20) {
                deadlineBoosts.push({ title, sender, date: formatDate(parsedDate) });
            }
            else{
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
                            if (driver.username === sender) {
                                matched = true;
                                const existingBoost = newBoosts.find((b) => b.id === driver.id);
                                if (existingBoost) {
                                    driver.duplicate = true; // Mark as duplicate
                                } else {
                                    newBoosts.push({ id: driver.id, boosted: 1 }); // Single boost for drivers
                                    driver.duplicate=false;
                                }
                            }
                            else{
                                matched = false; //this means somebody else sent in the driver boost
                            }
                        }
                    }
                    if(!matched)
                    {
                        if (findVenue) {
                            // If the boost message contains venueName and it wasnt matched
                            unmatchedBoosts.push({ title, sender, date: formatDate(parsedDate) });
                        }
                        else{
                            otherMessages.push({ title, sender, date: formatDate(parsedDate) });
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
                            if (team.username === sender) {
                                const boosted = boostType.toLowerCase() === "double" ? 2 : 1;
                                matched = true;
                                const existingBoost = newBoosts.find((b) => b.id === team.id);
                                if (existingBoost) {
                                    team.duplicate = true; // Mark as duplicate
                                } else {    
                                    newBoosts.push({ id: team.id, boosted });
                                    team.duplicate=false;
                                }
                            }
                            else{
                                matched = false; //this means somebody else sent in the team boost
                            }
                        }
                    }
                    if(!matched)
                    {
                        if (findVenue) {
                            // If the boost message contains venueName and it wasnt matched
                            unmatchedBoosts.push({ title, sender, date: formatDate(parsedDate) });
                        }
                        else{
                            otherMessages.push({ title, sender, date: formatDate(parsedDate) });
                        }
                    }
                }
                else {
                    // If the message contains venueName but is not a boost, add it to otherMessages
                    otherMessages.push({ title, sender, date: formatDate(parsedDate) });
                }
            }
        });

        // Step 3: Update boosts collection
        setBoosts(newBoosts);
        setUnmatchedBoosts(unmatchedBoosts); // New state for unmatched boosts
        setOtherMessages(otherMessages); // New state for other messages
        setDeadlineBoosts(deadlineBoosts);
    }, [htmlContent, venueName, date]); // only update when the venue updates, or if it finds new PMs sent. 
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
    
    useEffect(() => {
        const fetchWarnings = async () => {
            var docid;
            try {
                const warningsRef = collection(db, "warnings");
                const warningDocs = await getDocs(warningsRef);
                const fetchedWarnings = [];
                const fetchedTotals = [];

                warningDocs.forEach(doc => {
                const data = doc.data();
                //docid = console.log(doc.id);
                
                if (doc.id === "notPosted") {
                    //console.log(data.Data);
                    const notPosted = JSON.parse(data.Data);
                    // the output of my doc is a stringified JSON
                    // here we try to find matches to the usernames
                
                    notPosted.forEach(doc => {
                    fetchedWarnings.push({
                        Username: doc.Username
                    });
                    });
                    setWarnings(fetchedWarnings);
                    //console.log("Warnings: "+ fetchedWarnings);
                }

                if (doc.id === "total") {
                    const total = JSON.parse(data.Data);
                    // the output of my doc is a stringified JSON
                    // here we try to find matches to the usernames
                
                    //console.log("Totals: "+ fetchedTotals);
                    total.forEach(doc => {
                    fetchedTotals.push({
                        Username: doc.Username,
                        Warnings: doc.Warnings
                    });
                    //console.log(doc);
                    });
                    setTotals(fetchedTotals);
                    //console.log("Totals: "+ fetchedTotals);
                }
                });
                
            } catch (error) {
                //console.log("Error on id: " + docid);
                console.error("Error fetching warnings: ", error);
            }
        };
        fetchWarnings();
    }, []);

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
                            <th>Warning</th> {/*note: I (the guy doing the activity check) must not update this resource, 
                                                      in the period between the boost deadline and the perfs being posted*/}
                        </tr>
                    </thead>
                    <tbody>
                        {teams.map(team => (
                            <React.Fragment key={team.id}>
                                {/* Team Row */}
                                <tr className={team.duplicate ? "duplicate-team-row" : "team-row"}>
                                    <td>
                                        {/* Team name and username */}
                                        <div>
                                        {team.id / 100}. {team.name} ({team.username}) {team.duplicate ? " - duplicate entry" : ""}
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
                                    <td
                                        style={{
                                            textAlign: 'center'
                                        }}>
                                        {boosts.find((boost) => boost.id === team.id)?.boosted == 1
                                        ? "4"
                                        : boosts.find((boost) => boost.id === team.id)?.boosted == 2
                                        ? "8"
                                        : "" || ""}
                                    </td>
                                    {/* Warnings Column (fetches the updated warning penalty, AFTER I (the guy doing activity checks) save them to a .txt file with my app.
                                                                                                      In practice, this means after I post with the GPGSL account.) */}
                                    <td style={{ 
                                        textAlign: 'center',
                                        color: warnings.some(warning => warning.Username === team.username) ? 'red' : 'inherit'
                                    }}>
                                        {(() => {
                                            const warningCount = totals.find(total => total.Username === team.username)?.Warnings;
                                            if (warningCount === 0) return "";
                                            if (warningCount === 1) return "10";
                                            if (warningCount === 2) return "25";
                                            if (warningCount >= 3) return "out";
                                            return "";
                                        })()}
                                    </td>
                                </tr>
                                {/* Driver Rows */}
                                {drivers
                                    .filter(driver => Math.floor(driver.id / 100) === Math.floor(team.id / 100))
                                    .map(driver => (
                                        <tr key={driver.id} className={driver.duplicate ? "duplicate-driver-row" : "driver-row"}>
                                            <td style={{ paddingLeft: '20px' }}>#{driver.id % 100}: {driver.name} ({driver.username}) {driver.duplicate ? " - duplicate entry" : ""}</td>
                                            <td
                                            style={{
                                                textAlign: 'center'
                                            }}>
                                            {boosts.find((boost) => boost.id === driver.id)?.boosted == 1 ? "200" : "" || ""}</td>
                                            {/* Warnings Column (fetches the updated warning penalty, AFTER I (the guy doing activity checks) save them to a .txt file with my app.
                                                                                                      In practice, this means after I post with the GPGSL account.) */}
                                            <td style={{ 
                                                textAlign: 'center',
                                                color: warnings.some(warning => warning.Username === driver.username) ? 'red' : 'inherit'
                                            }}>
                                                {(() => {
                                                    const warningCount = totals.find(total => total.Username === driver.username)?.Warnings;
                                                    if (warningCount === 1) return "20";
                                                    if (warningCount === 2) return "40";
                                                    if (warningCount >= 3) return "out";
                                                    return "";
                                                })()}
                                            </td>
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
                <DeadlineBoostsTable boosts={deadlineBoosts} />
                <UnmatchedBoostsTable boosts={unmatchedBoosts} />
                <OtherMessagesTable messages={otherMessages} />
            </div>

        </div>
    );
};

function DeadlineBoostsTable({ boosts }) {
    // If boosts is an empty array, render nothing
    if (boosts.length === 0) {
        return <> </>;
    }
    return (
        <div className="deadline-boosts">
            <h3>Invalid Boosts (after deadline)</h3>
            <table className="deadline-table">
                <thead>
                    <tr>
                        <th>Sender</th>
                        <th>Message</th>
                        <th className="deadline-date">Date</th> {/* New column for date */}
                    </tr>
                </thead>
                <tbody>
                    {boosts.map((boost, index) => (
                        <tr key={index}>
                            <td>{boost.sender}</td>
                            <td>{boost.title}</td>
                            <td className="deadline-date">{boost.date}</td> {/* Display the date */}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function UnmatchedBoostsTable({ boosts }) {
    // If boosts is an empty array, render nothing
    if (boosts.length === 0) {
        return <> </>;
    }
    return (
        <div className="unmatched-boosts">
            <h3>Unmatched Boosts</h3>
            <table className="unmatched-table">
                <thead>
                    <tr>
                        <th>Sender</th>
                        <th>Message</th>
                        <th className="unmatched-date">Date</th> {/* New column for date */}
                    </tr>
                </thead>
                <tbody>
                    {boosts.map((boost, index) => (
                        <tr key={index}>
                            <td>{boost.sender}</td>
                            <td>{boost.title}</td>
                            <td className="unmatched-date">{boost.date}</td> {/* Display the date */}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function OtherMessagesTable({ messages }) {
    // If messages is an empty array, render nothing
    if (messages.length === 0) {
        return <> </>;
    }
    return (
        <div className="other-messages">
            <h3>Other Messages</h3>
            <table className="other-table">
                <thead>
                    <tr>
                        <th>Sender</th>
                        <th>Message</th>
                        <th className="unmatched-date">Date</th> {/* Date column */}
                    </tr>
                </thead>
                <tbody>
                    {messages.map((message, index) => (
                        <tr key={index}>
                            <td>{message.sender}</td>
                            <td>{message.title}</td>
                            <td className="unmatched-date"  >{message.date}</td> {/* Display the date */}
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

function parseCustomDate(dateString) { 
    const nowSys = new Date();
    const now = new Date(nowSys.getUTCFullYear(), nowSys.getUTCMonth(), nowSys.getUTCDate(), nowSys.getUTCHours(), nowSys.getUTCMinutes(), nowSys.getUTCSeconds());


    // Handle relative time formats
    const relativeMatch = dateString.match(/(\d+)\s+(minute|hour|week)s?\s+ago/i);
    if (relativeMatch) {
        const amount = parseInt(relativeMatch[1], 10) + 1;
        const unit = relativeMatch[2];

        if (unit === "minute") {
            now.setMinutes(now.getMinutes() - amount);
        } else if (unit === "hour") {
            now.setHours(now.getHours() - amount);
        } else if (unit === "week") {
            now.setDate(now.getDate() - amount * 7);
        }
        return now; // Return the adjusted Date object
    }

    // Standard date-time format parsing
    // Split the date and time parts
    const [datePart, timePart] = dateString.split(" ");
    const [month, day, year] = datePart.split("/");
    const [time, modifier] = timePart.split(/(?=[AP]M)/); // Split time and AM/PM

    // Split hours and minutes
    let [hours, minutes] = time.split(":");

    // Convert to 24-hour format
    if (modifier === "PM" && hours !== "12") {
        hours = String(Number(hours) + 12);
    }
    if (modifier === "AM" && hours === "12") {
        hours = "00";
    }

    // Create a new Date object in a format the constructor can understand
    const isoDateString = `${year}-${month}-${day}T${hours}:${minutes}:00`;
    return new Date(isoDateString);
}

// Helper function to format the date as "DD-MM-YYYY HH:MM"
function formatDate(date){
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${day}.${month}.${year} ${hours}:${minutes}`;
    //return `${year}-${month}-${day} ${hours}:${minutes}`;
}

export default Lineup;