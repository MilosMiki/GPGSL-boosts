import React, { useEffect, useState } from "react";
import { db } from "./firebase";
import { collection, getDocs } from "firebase/firestore";

function CalendarApp() {
    const [data, setData] = useState([]);
  
    useEffect(() => {
      const fetchData = async () => {
        const querySnapshot = await getDocs(collection(db, "calendar")); // collection name
        const items = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setData(items);
      };
  
      fetchData();
    }, []);
  
    return (
      <div>
        <h1>Firestore Data</h1>
        <ul>
          {data.map(item => (
            <li key={item.id}>{JSON.stringify(item)}</li>
          ))}
        </ul>
      </div>
    );
  }
  
  export default CalendarApp;