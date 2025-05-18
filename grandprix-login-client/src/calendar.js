import React, { useEffect, useState } from "react";
import { db } from "./firebase";
import { collection, getDocs, doc, setDoc, deleteDoc } from "firebase/firestore";
import { FaTrash, FaArrowUp, FaArrowDown, FaEdit, FaSave } from 'react-icons/fa';
import './CalendarApp.css'; // Ensure you have this file for styling
import { FaQuestionCircle } from 'react-icons/fa'; // Import question mark icon
import './App.css';


function CalendarApp({ selectedId, setSelectedId, setVenueName, setTrackName, setCountry, showAdmin, toggleHelp }) {
    const [data, setData] = useState([]);
    const [editMode, setEditMode] = useState(false);
    const [newVenue, setNewVenue] = useState("");
    const [newTrack, setNewTrack] = useState("");
    const [newCountry, setNewCountry] = useState("");

    useEffect(() => {
        const fetchData = async () => {
            const querySnapshot = await getDocs(collection(db, "calendar"));
            const items = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            items.sort((a, b) => a.id - b.id);
            setData(items);
        };

        fetchData();
    }, []);

    const handleAddEntry = async () => {
        if (newVenue.trim() === "") return;
        const newId = data.length + 1;
        const newEntry = { 
          id: newId, 
          venue: newVenue, 
          track: newTrack,
          country: newCountry
        };
        await setDoc(doc(db, "calendar", newId.toString()), newEntry);
        setData([...data, newEntry].sort((a, b) => a.id - b.id));
        setNewVenue("");
        setNewTrack("");
        setNewCountry(""); 
    };

    const handleRemoveEntry = async (id) => {
        await deleteDoc(doc(db, "calendar", id.toString()));
        setData(data.filter(item => item.id !== id).map((item, index) => ({ ...item, id: index + 1 })));
    };

    const handleMoveUp = (index) => {
        if (index === 0) return;
        const newData = [...data];
        [newData[index], newData[index - 1]] = [newData[index - 1], newData[index]];
        setData(newData.map((item, i) => ({ ...item, id: i + 1 })));
    };

    const handleMoveDown = (index) => {
        if (index === data.length - 1) return;
        const newData = [...data];
        [newData[index], newData[index + 1]] = [newData[index + 1], newData[index]];
        setData(newData.map((item, i) => ({ ...item, id: i + 1 })));
    };

    const handleSaveChanges = async () => {
        const batch = [];
        data.forEach((item) => {
            const docRef = doc(db, "calendar", item.id.toString());
            batch.push(setDoc(docRef, item));
        });
        await Promise.all(batch);
        setEditMode(false);
    };

    return (
      <div className="calendar-app">
          <h1>
            Calendar
            <div className="help-button-container">
                <button className="help-button" onClick={toggleHelp}>
                    <FaQuestionCircle /> Help
                </button>
            </div>
          </h1>
          <ul>
              {data.map((item, index) => (
                  <li
                      key={item.id}
                      className={selectedId === item.id ? "selected" : ""}
                      onClick={() => {
                          setSelectedId(item.id);
                          setVenueName(item.venue);
                          setTrackName(item.track);
                          setCountry(item.country);
                      }}
                  >
                      <div className="venue-track-container">
                        <div className="venue-header">
                          <span className="venue-id">{item.id}.</span>
                          <div className="venue-details">
                            <span className="venue-name">{item.venue}</span>
                            <span className="track-name">{item.track} ({item.country})</span>
                          </div>
                        </div>
                      </div>
                      {editMode && (
                          <div className="venue-actions">
                              <button onClick={() => handleMoveUp(index)}><FaArrowUp /></button>
                              <button onClick={() => handleMoveDown(index)}><FaArrowDown /></button>
                              <button onClick={() => handleRemoveEntry(item.id)}><FaTrash /></button>
                          </div>
                      )}
                  </li>
              ))}
          </ul>
          {editMode && (
              <div className="add-entry">
                  <input
                      type="text"
                      value={newVenue}
                      onChange={(e) => setNewVenue(e.target.value)}
                      placeholder="New Venue"
                  />
                  <input
                      type="text"
                      value={newTrack}
                      onChange={(e) => setNewTrack(e.target.value)}
                      placeholder="New Track"
                  />
                  <input
                      type="text"
                      value={newCountry}
                      onChange={(e) => setNewCountry(e.target.value)}
                      placeholder="New Country"
                  />
                  <button onClick={handleAddEntry}>Add Entry</button>
              </div>
          )}
          {
          showAdmin ?
            <div className="edit-actions">
                {!editMode && (
                <button onClick={() => setEditMode(!editMode)}>
                    <FaEdit /> Edit Calendar
                </button>
                )}
                {editMode && <button onClick={handleSaveChanges}><FaSave /> Save Changes</button>}
            </div>
            : ""
          }
      </div>
  );
}

export default CalendarApp;