// src/components/BoostPicker.tsx
import React, { useState, Dispatch, SetStateAction, useEffect } from "react";
import { db } from "../firebase";
import { collection, getDocs } from "firebase/firestore";
import { Team } from "../types/team";
import { Driver } from "../types/driver";

interface BoostPickerProps {
  handleBoostSelected: (
    type: "driver" | "team",
    boostType?: "Single" | "Double"
  ) => void;
  driverBoost: boolean;
  teamBoost: boolean;
  username: string;
  boostType: "Single" | "Double" | null;
  setBoostType: (type: "Single" | "Double") => void;
  driver: Driver | null;
  setDriver: Dispatch<SetStateAction<Driver | null>>;
  team: Team | null;
  setTeam: Dispatch<SetStateAction<Team | null>>;
  driverBoostCount: number;
  teamBoostCount: number;
}

export default function BoostPicker({
  handleBoostSelected,
  driverBoost,
  teamBoost,
  username,
  boostType,
  setBoostType,
  driver,
  setDriver,
  team,
  setTeam,
  driverBoostCount,
  teamBoostCount,
}: BoostPickerProps) {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setDriver(null);
        setTeam(null);
        // Fetch drivers
        const driversRef = collection(db, "drivers");
        const driverDocs = await getDocs(driversRef);
        const fetchedDrivers: Driver[] = [];

        driverDocs.forEach((doc) => {
          fetchedDrivers.push({
            id: doc.id,
            name: doc.data().name,
            username: doc.data().username,
            team: doc.data().team,
          });
        });

        // Find matching driver
        const foundDriver = fetchedDrivers.find(
          (d) =>
            d.username.localeCompare(username, undefined, {
              sensitivity: "base",
            }) === 0
        );
        if (foundDriver) setDriver(foundDriver);

        // Fetch teams
        const teamsRef = collection(db, "teams");
        const teamDocs = await getDocs(teamsRef);
        const fetchedTeams: Team[] = [];

        teamDocs.forEach((doc) => {
          fetchedTeams.push({
            id: doc.id,
            name: doc.data().name,
            username: doc.data().username,
            short1: doc.data().short1,
            short2: doc.data().short2,
          });
        });

        // Find matching team
        const foundTeam = fetchedTeams.find(
          (t) =>
            t.username.localeCompare(username, undefined, {
              sensitivity: "base",
            }) === 0
        );
        if (foundTeam) setTeam(foundTeam);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [username]);

  if (loading) {
    return <div className="boost-picker">Loading...</div>;
  }

  return (
    <div className="boost-picker">
      <div className="boost-options">
        <div
          className={`boost-option ${driverBoost ? "selected" : ""} ${
            !driver ? "disabled" : ""
          }`}
          onClick={() => driver && handleBoostSelected("driver")}
        >
          <h3>Driver Boost</h3>
          <p>
            {driver
              ? `Boost ${driver.name}'s performance`
              : "You are not a GPGSL driver"}
          </p>
          {driver && driverBoostCount > 0 && (
            <p>Boosts used: {driverBoostCount}</p>
          )}
        </div>

        <div
          className={`boost-option ${teamBoost ? "selected" : ""} ${
            !team ? "disabled" : ""
          }`}
          onClick={() => team && handleBoostSelected("team")}
        >
          <h3>Team Boost</h3>
          <p>
            {team
              ? `Boost ${team.name}'s performance`
              : "You are not a GPGSL team owner"}
          </p>
          {team && teamBoostCount > 0 && <p>Boosts used: {teamBoostCount}</p>}

          {team && (
            <div className="boost-type-selector">
              <label>
                <input
                  type="radio"
                  name="boostType"
                  checked={boostType === "Single"}
                  onChange={() => setBoostType("Single")}
                />
                Single
              </label>
              <label>
                <input
                  type="radio"
                  name="boostType"
                  checked={boostType === "Double"}
                  onChange={() => setBoostType("Double")}
                />
                Double
              </label>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
