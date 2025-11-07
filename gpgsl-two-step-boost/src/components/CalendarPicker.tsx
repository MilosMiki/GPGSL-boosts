// src/components/CalendarPicker.tsx
import { useState, useEffect, useRef } from "react";
import { db } from "../firebase";
import { collection, getDocs } from "firebase/firestore";
import { Race } from "../types/race";

interface CalendarPickerProps {
  onRaceSelected: (race: Race | null) => void;
  boostInfo: string | null;
  useCurrentGP: boolean;
  externalSelectedRace: Race | null;
  raceBoosts: Record<string, string[]>;
}

export default function CalendarPicker({
  onRaceSelected,
  boostInfo,
  useCurrentGP,
  externalSelectedRace,
  raceBoosts,
}: CalendarPickerProps) {
  const [races, setRaces] = useState<Race[]>([]);
  const [loading, setLoading] = useState(true);
  const prevUseCurrentGP = useRef(useCurrentGP);

  useEffect(() => {
    const fetchRaces = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "calendar"));
        const racesData = querySnapshot.docs.map((doc) => ({
          id: parseInt(doc.id),
          venue: doc.data().venue,
          track: doc.data().track,
          country: doc.data().country,
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

  // Auto-select race based on boost info when useCurrentGP is true
  useEffect(() => {
    if (useCurrentGP && boostInfo && races.length > 0) {
      // Extract round number from boost info (e.g., "Next Boost: Round 4 - Portuguese Grand Prix")
      const roundMatch = boostInfo.match(/Round (\d+)/);
      if (roundMatch) {
        const roundNumber = parseInt(roundMatch[1]);
        const targetRace = races.find((race) => race.id === roundNumber);
        if (targetRace) {
          onRaceSelected(targetRace);
        }
      }
    } else if (!useCurrentGP && prevUseCurrentGP.current && races.length > 0) {
      // Only clear selection when switching from ON to OFF and races are loaded
      onRaceSelected(null);
    }

    // Update the ref
    prevUseCurrentGP.current = useCurrentGP;
  }, [useCurrentGP, boostInfo, races, onRaceSelected]);

  // Handle manual race selection
  const handleRaceClick = (race: Race) => {
    onRaceSelected(race);
  };

  if (loading) {
    return <div className="calendar-picker">Loading races...</div>;
  }

  // Filter races based on useCurrentGP
  const displayRaces = useCurrentGP
    ? races
    : races.filter((race) => race.id > 1);

  return (
    <div className="calendar-picker">
      <div
        className="race-list-container"
        style={{ maxHeight: `calc(92vh - 500px)` }}
      >
        <div className="race-list">
          {displayRaces.map((race) => {
            const boostTypes = raceBoosts[race.venue] || [];
            const hasDriverBoost = boostTypes.includes("driver");
            const hasTeamBoost = boostTypes.includes("team");

            return (
              <div
                key={race.id}
                className={`race-item ${
                  externalSelectedRace?.id === race.id ? "selected" : ""
                }`}
                onClick={() => handleRaceClick(race)}
              >
                <div className="race-id">{race.id}.</div>
                <div className="race-details">
                  <div className="race-name">{race.venue}</div>
                  <div className="race-track">
                    {race.track} ({race.country})
                  </div>
                </div>
                <div className="boost-tags">
                  {hasDriverBoost && (
                    <span className="boost-tag driver-tag">driver</span>
                  )}
                  {hasTeamBoost && (
                    <span className="boost-tag team-tag">team</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
