import React, { useEffect, useState } from "react";
import { db } from "./firebase";
import { collection, getDocs, doc, setDoc, deleteDoc } from "firebase/firestore";
import { FaTrash, FaArrowUp, FaArrowDown, FaEdit, FaSave } from 'react-icons/fa';
import './CalendarApp.css'; // Ensure you have this file for styling


function CalendarApp({ selectedId, setSelectedId }) {
    const [data, setData] = useState([]);
    const [editMode, setEditMode] = useState(false);
    const [newVenue, setNewVenue] = useState("");

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
        const newEntry = { id: newId, venue: newVenue };
        await setDoc(doc(db, "calendar", newId.toString()), newEntry);
        setData([...data, newEntry].sort((a, b) => a.id - b.id));
        setNewVenue("");
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
          <h1>Calendar</h1>
          <ul>
              {data.map((item, index) => (
                  <li
                      key={item.id}
                      className={selectedId === item.id ? "selected" : ""}
                      onClick={() => setSelectedId(item.id)}
                  >
                      <span className="venue-id">{item.id}.</span>
                      <span className="venue-name">{item.venue}</span>
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
                  <button onClick={handleAddEntry}>Add Entry</button>
              </div>
          )}
          <div className="edit-actions">
            {!editMode && (
              <button onClick={() => setEditMode(!editMode)}>
                <FaEdit /> Edit Calendar
              </button>
            )}
              {editMode && <button onClick={handleSaveChanges}><FaSave /> Save Changes</button>}
          </div>
      </div>
  );
}

export default CalendarApp;