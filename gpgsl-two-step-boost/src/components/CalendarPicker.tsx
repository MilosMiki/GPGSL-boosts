// src/components/CalendarPicker.tsx
import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';
import { Race } from '../types/race';

interface CalendarPickerProps {
  onRaceSelected: (race: Race) => void;
}

export default function CalendarPicker({ onRaceSelected }: CalendarPickerProps) {
  const [selectedRace, setSelectedRace] = useState<number | null>(null);
  const [races, setRaces] = useState<Race[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRaces = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "calendar"));
        const racesData = querySnapshot.docs.map(doc => ({
          id: parseInt(doc.id),
          venue: doc.data().venue,
          track: doc.data().track,
          country: doc.data().country
        }));
        racesData.sort((a, b) => a.id - b.id);
        setRaces(racesData);
      } catch (error) {
        console.error("Error fetching races: ", error);
      } finally {
        setLoading(false);
      }
    };

    fetchRaces();
  }, []);

  if (loading) {
    return <div className="calendar-picker">Loading races...</div>;
  }

  return (
    <div className="calendar-picker">
      <div className="race-list-container" style={{ maxHeight: `calc(100vh - 500px)` }}>
        <div className="race-list">
          {races.map(race => (
            <div 
              key={race.id}
              className={`race-item ${selectedRace === race.id ? 'selected' : ''}`}
              onClick={() => {
                setSelectedRace(race.id);
                onRaceSelected(race);
              }}
            >
              <div className="race-id">{race.id}.</div>
              <div className="race-details">
                <div className="race-name">{race.venue}</div>
                <div className="race-track">{race.track} ({race.country})</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}