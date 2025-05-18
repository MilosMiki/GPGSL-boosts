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
        //console.log(divElements);
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
            .filter((data) => data !== null)
            .filter((data, index, self) => // remove duplicate 1st entry
                index === self.findIndex((t) => (t && data && t.id === data.id))
            );

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
        console.log(parsedData);
        parsedData.forEach((data) => {
            const { title: rawTitle, sender, date: dataDate, body } = data;

            // Create a Date object for the parsed data's date
            const parsedDate = parseCustomDate(dataDate);
            //console.log(parsedDate);
            //console.log(dataDate + " - " + parsedDate);
            // Create a Date object for the Lineup date at 20:00 hours
            const lineupDateAt20 = new Date(date);
            lineupDateAt20.setHours(20, 0, 0, 0); // Set time to 20:00:00.000
            //console.log(date);
            //console.log(parsedDate + " - " + lineupDateAt20);

            const title = decodeHTMLEntities(rawTitle); // Decode HTML entities in the title
            var processedTitle = title.replace(/^[^a-zA-Z]+|[^a-zA-Z]+$/g, ''); 
            // this regex trims non-letter characters at the start and end of the title (such as: " . ( ) etc.)
            
            processedTitle = processedTitle.replace(
                /^(Driver|Team)\s+Boost(?!\s*[-–—])\s*/i,
                (match) => match.trim() + ' - '
            );
            // this regex will force a delimiter between "Boost" and the next letter (usually driver or team name)

            var isDriverBoost = /driver boost/i.test(title); // Case insensitive check
            var isTeamBoost = /team boost/i.test(title); // Case insensitive check
            const isAnyBoost = /boost/i.test(title); // Case insensitive check
            if(isAnyBoost && !(isDriverBoost || isTeamBoost)){
                if(containsTeamBoost(title))
                    isTeamBoost = true;
                else
                    isDriverBoost = true;
            }
            const findVenue = matchVenue(title, venueName, trackName, country);

            // Compare the dates
            if (parsedDate > lineupDateAt20) {
                deadlineBoosts.push({ title, sender, date: formatDate(parsedDate), body });
            }
            else{
                let matched = false;
                let message = "";
                if (isDriverBoost) {
                    // Extract driver name/username and venue from title (with optional parentheses)
                    const [, nameOrUsername, venue] =
                        processedTitle.match(/^(?:(?:Driver\s+)?Boost)\s*-\s*\(?([^(]+?)\s*(?:\([^)]*\))?\s*-\s*(\(?.+?\)?)\s*[-,]?\s*$/i) || [];
                    if(findVenue){
                        var driver;
                        var isDriverInTitle = false;
                        if(!nameOrUsername){ //2nd pass, match for sender, if driver name is found anywhere in message
                            driver = drivers.find(
                                (d) =>
                                    d.username.localeCompare(sender, undefined, { sensitivity: 'base' }) === 0
                            );
                            isDriverInTitle = new RegExp(driver.name, "i").test(title); // must check if driver name
                        }
                        else{ // if the title formatting is correct

                            // Remove parentheses from name/username if present
                            const cleanedNameOrUsername = nameOrUsername.replace(/[()]/g, "");
                            // Find matching driver by name OR username (case insensitive)
                            driver = drivers.find(
                                (d) =>
                                    d.name.localeCompare(cleanedNameOrUsername, undefined, { sensitivity: 'base' }) === 0 ||
                                    d.username.localeCompare(cleanedNameOrUsername, undefined, { sensitivity: 'base' }) === 0
                            );
                            isDriverInTitle = driver.username === sender; // check whether the driver name matches the sender
                        }
                        
                        if (driver) {
                            if (isDriverInTitle) {
                                matched = true;
                                const existingBoost = newBoosts.find((b) => b.id === driver.id);
                                if (existingBoost) {
                                    console.log("Found duplicate boost for driver: " + driver.name);
                                    driver.duplicate = true; // Mark as duplicate
                                } else {
                                    newBoosts.push({ id: driver.id, boosted: 1 }); // Single boost for drivers
                                    driver.duplicate=false;
                                }
                            }
                            else{
                                console.log("Boost for driver: " + driver.username + " unmatched because username is: " + sender);
                                matched = false; //this means somebody else sent in the driver boost
                                message = "Error: incorrect username for driver.";
                            }
                        }
                        else{
                            console.log("Boost unmatched for user: " + nameOrUsername + " because he is not a driver.");
                            message = "Error: Driver not found.";
                        }
                    }
                    if(!matched)
                    {
                        if (findVenue) {
                            // If the boost message contains venueName and it wasnt matched
                            unmatchedBoosts.push({ title, sender, date: formatDate(parsedDate), body, message});
                            console.log("Unmatched for sender: " + sender + " and name: " + nameOrUsername + " and driver: " + driver);
                        }
                        else{
                            otherMessages.push({ title, sender, date: formatDate(parsedDate), body });
                        }
                    }
                } else if (isTeamBoost) {
                    // this if block will append single/double boost from message body, if not present in title.
                    if(!containsTeamBoost(processedTitle)){
                        if (/single/i.test(body)) {
                            processedTitle += " - single";
                        } else if (/double/i.test(body)) {
                            processedTitle += " - double";
                        }
                    }
                    // Extract team name, venue, and boost type from title (flexible delimiters and optional parentheses)
                    const [, name, venue, boostType] =
                        //title.match(/"?Team Boost - (\(?.+?\)?) - (\(?.+?\)?)\s*(?:[-,].+?)?\s*\(?(Single|Double|)\)?"?/i) || [];
                        processedTitle.match(/"?(?:(?:Team\s+)?Boost)\s*[-,]\s*(\(?.+?\)?)\s*[-,]\s*(\(?.+?\)?)\s*(?:[-,].+?)?\s*\(?(Single|Double)\)?"?/i) || [];
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
                            /*
                            // Check if the username matches (case-insensitive)
                            const usernameMatches = t.username.localeCompare(sender, undefined, { sensitivity: 'base' }) === 0;
                            */
                            // Return true if either name, short1, or short2 matches, AND the username matches
                            return (nameMatches || short1Matches || short2Matches);// && usernameMatches;
                        });
                        if (team) { // if the team from the title was found
                            if (team.username === sender) { // only here check if the sender is correct
                                const boosted = boostType.toLowerCase() === "double" ? 2 : 1;
                                matched = true;
                                const existingBoost = newBoosts.find((b) => b.id === team.id);
                                if (existingBoost) {
                                    console.log("Found duplicate boost for team: " + team.name);
                                    team.duplicate = true; // Mark as duplicate
                                } else {    
                                    newBoosts.push({ id: team.id, boosted });
                                    team.duplicate=false;
                                }
                            }
                            else{
                                console.log("Boost for team: " + team.username + " unmatched because username is: " + sender);
                                matched = false; //this means somebody else sent in the team boost
                                message = "Error: incorrect username for team owner.";
                            }
                        }
                        else{
                            console.log("Boost unmatched for user: " + sender + " because the team is not found.");
                            message = "Error: Team not found.";
                        }
                    }
                    if(!matched)
                    {
                        if (findVenue) {
                            // If the boost message contains venueName and it wasnt matched
                            unmatchedBoosts.push({ title, sender, date: formatDate(parsedDate), body, message });
                        }
                        else{
                            otherMessages.push({ title, sender, date: formatDate(parsedDate), body });
                        }
                    }
                }
                else {
                    // If the message contains venueName but is not a boost, add it to otherMessages
                    otherMessages.push({ title, sender, date: formatDate(parsedDate), body });
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
                            <td>
                                <div>{boost.title}</div>
                                <div style={{ fontSize: '0.8em', color: '#666' }}>{boost.body}</div>
                            </td>
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
                            <td>
                                <div>{boost.title}</div>
                                <div style={{ fontSize: '0.8em', color: '#666' }}>{boost.body}</div>
                                <div style={{ fontSize: '0.8em', color: '#666' }}>{boost.message}</div>
                            </td>
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
                            <td>
                                <div>{message.title}</div>
                                <div style={{ fontSize: '0.8em', color: '#666' }}>{message.body}</div>
                            </td>
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

function containsTeamBoost(title){
    // Handle cases where title is null, undefined, or not a string
    if (typeof title !== 'string' || title.length === 0) {
      return false;
    }
  
    // Split the title by the '-' delimiter
    const parts = title.split('-');
  
    // Get the last part of the split array
    // If there's no '-', parts will be an array with the original title as the only element
    const lastPart = parts[parts.length - 1];
  
    // Convert the last part to lowercase for case-insensitive comparison
    const lowerLastPart = lastPart.toLowerCase();
  
    // Check if the lowercase last part includes "single" or "double"
    return lowerLastPart.includes("single") || lowerLastPart.includes("double");
}

function parseCustomDate(dateString) {
    const now = new Date();
    const nowUTC = new Date(Date.UTC(
        now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(),
        now.getUTCHours(), now.getUTCMinutes(), now.getUTCSeconds()
    ));

    // Relative time (e.g., "3 hours ago")
    const relativeMatch = dateString.match(/(\d+)\s+(minute|hour|day|week)s?\s+ago/i);
    if (relativeMatch) {
        const amount = parseInt(relativeMatch[1], 10);
        const unit = relativeMatch[2];
        const adjusted = new Date(nowUTC);

        if (unit === "minute") adjusted.setUTCMinutes(adjusted.getUTCMinutes() - amount);
        else if (unit === "hour") adjusted.setUTCHours(adjusted.getUTCHours() - amount);
        else if (unit === "day") adjusted.setUTCDate(adjusted.getUTCDate() - amount);
        else if (unit === "week") adjusted.setUTCDate(adjusted.getUTCDate() - amount * 7);

        return adjusted;
    }

    // Handle "today, 10:38PM" or "yesterday, 10:38PM"
    const dayMatch = dateString.match(/^(today|yesterday),\s*(\d{1,2}):(\d{2})(AM|PM)$/i);
    if (dayMatch) {
        const [, label, rawHour, rawMinute, ampm] = dayMatch;
        let hours = parseInt(rawHour, 10);
        const minutes = parseInt(rawMinute, 10);
        const modifier = ampm.toUpperCase();

        if (modifier === "PM" && hours !== 12) hours += 12;
        if (modifier === "AM" && hours === 12) hours = 0;

        // Create candidate datetime for "today" with target time
        const candidate = new Date(Date.UTC(
            nowUTC.getUTCFullYear(), nowUTC.getUTCMonth(), nowUTC.getUTCDate(),
            hours, minutes, 0
        ));

        if (label.toLowerCase() === "today") {
            return candidate;
        }

        // For "yesterday", determine whether to subtract 1 or 2 days
        if (nowUTC < candidate) {
            // If now is before 10:38PM, then "yesterday at 10:38PM" is actually two days ago
            candidate.setUTCDate(candidate.getUTCDate() - 2);
        } else {
            candidate.setUTCDate(candidate.getUTCDate() - 1);
        }

        return candidate;
    }

    // Handle MM/DD/YYYY or MM/DD/YYYY HH:MMAM/PM
    const [datePart, timePart] = dateString.split(" ");
    if (!timePart) {
        const [month, day, year] = datePart.split("/");
        return new Date(`${year}-${month}-${day}T00:00:00Z`);
    }

    const [month, day, year] = datePart.split("/");
    const [time, modifier] = timePart.split(/(?=[AP]M)/);
    let [hours, minutes] = time.split(":").map(n => parseInt(n, 10));

    const upperMod = modifier.toUpperCase();
    if (upperMod === "PM" && hours !== 12) hours += 12;
    if (upperMod === "AM" && hours === 12) hours = 0;

    return new Date(Date.UTC(year, month - 1, day, hours, minutes, 0));
}




// Helper function to format the date as "DD.MM.YYYY HH:MM" in GMT/UTC
function formatDate(date) {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0'); // Months are 0-indexed
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    return `${day}.${month}.${year} ${hours}:${minutes}`;
}

export default Lineup;