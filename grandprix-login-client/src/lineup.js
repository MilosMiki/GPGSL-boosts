import React, { useEffect, useState } from "react";
import { db } from "./firebase";
import { collection, getDocs, doc, setDoc, deleteDoc } from "firebase/firestore";
import { FaTrash, FaArrowUp, FaArrowDown, FaEdit, FaSave, FaPlus } from 'react-icons/fa';
import './CalendarApp.css';

function Lineup() {
    const [teams, setTeams] = useState([]);
    const [drivers, setDrivers] = useState([]);
    const [users, setUsers] = useState([]);
    const [editMode, setEditMode] = useState(false);
    const [newTeam, setNewTeam] = useState("");
    const [newName, setNewName] = useState("");
    const [username, setUsername] = useState("");
    const [selectedId, setSelectedId] = useState();
    const [newDriverInfo, setNewDriverInfo] = useState({
        team: "",
        name: "",
        username: ""
    });
    const [driverId, setDriverId] = useState(1);
    /*
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
                    username: doc.data().username
                });
            });

            setTeams(fetchedTeams.sort((a, b) => a.id - b.id));
        };

        fetchTeams();
    }, []);

    // Fetch Drivers for selected Team
    useEffect(() => {
        const fetchDrivers = async () => {
            if (!selectedId) return;
            
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
        console.log(drivers);
    }, [selectedId]);*/
    useEffect(() => {
        const fetchUsers = async () => {
            const driversRef = collection(db, "drivers");
            const driverDocs = await getDocs(driversRef);
            const fetchedUsers = [];
            
            driverDocs.forEach(doc => {
                fetchedUsers.push({
                    id: doc.id,
                    name: doc.data().name,
                    username: doc.data().username,
                    team: doc.data().team,
                });
            });

            const teamsRef = collection(db, "teams");
            const teamDocs = await getDocs(teamsRef);
            
            teamDocs.forEach(doc => {
                fetchedUsers.push({
                    id: doc.id,
                    name: doc.data().name,
                    username: doc.data().username
                });
            });
    
            setUsers(fetchedUsers.sort((a, b) => a.id - b.id));
        };
    
        fetchUsers();
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
            username: username
        };
        await setDoc(doc(db, "teams", newId.toString()), newEntry);
        setTeams([...teams, newEntry].sort((a, b) => a.id - b.id));

        setNewTeam("");
        setUsername("");
    };

    const addDriver = async () => {
        if (!newDriverInfo.team || !newDriverInfo.name || !newDriverInfo.username) 
        {
            console.log(newDriverInfo);
            console.log("Error: fields are empty");
            return;
        } /*
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
        }*/
        const newId = selectedId * 100 + driverId;
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
            {users.map(user => ( (user.id % 100 == 0) ?
                <div key={user.id} className="team-item">
                    <span>{user.id/100}. {user.name} ({user.username})</span>
                </div>
                :
                <div className="driver-item">
                    <span>- {user.name} ({user.username}) </span>
                </div>
            ))}
            {teams.map(team => (
                <div key={team.id} className="team-item">
                    <span>{team.id/100}. {team.name} ({team.username})</span>
                </div>
            ))}
            
            {Object.entries(drivers).map(([id, driver]) => (
                <div key={id} className="driver-item">
                    <span>- {driver.name} ({driver.username}) </span>
                </div>
            ))}
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
                        <button onClick={addTeam}>
                            Add Team
                        </button>
                    </div>
                    <div className="add-section">
                        <select
                            value={newDriverInfo.team}
                            onChange={(e) => {
                                const selectedTeam = users.find(users => users.name === e.target.value);
                                setNewDriverInfo({
                                    ...newDriverInfo,
                                    team: selectedTeam.name, // Keep team name as is
                                });
                                setSelectedId(selectedTeam.id); // New property for team ID
                            }}
                        >
                            <option value="" disabled>Select a team</option> {/* Default blank option */}
                            {users.map(user => (
                                (user.id % 100 == 0) ?
                                <option key={user.id} value={user.name}>
                                    {user.name}
                                </option>
                                : <></> //no option to select drivers
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
    );
};

export default Lineup;