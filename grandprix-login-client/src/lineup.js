import React, { useEffect, useState } from "react";
import { db } from "./firebase";
import {
  collection,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
} from "firebase/firestore";
import {
  FaTrash,
  FaArrowUp,
  FaArrowDown,
  FaEdit,
  FaSave,
  FaPlus,
  FaCopy,
  FaWrench,
} from "react-icons/fa";
import "./lineup.css";
import {
  decodeHTMLEntities,
  matchVenue,
  containsTeamBoost,
  parseCustomDate,
  formatDate,
} from "./boostUtils";

// Helper function to suggest corrected title format
function suggestCorrectedTitle(
  originalTitle,
  sender,
  drivers,
  teams,
  venueName,
  trackName,
  country
) {
  try {
    const title = decodeHTMLEntities(originalTitle);

    const isDriverBoost = /driver boost/i.test(title);
    const isTeamBoost = /team boost/i.test(title);

    // Extract venue (including track name) from the original title
    // Pattern: "Driver Boost - (Name/Username) - VenueName - TrackName"
    // We want to capture everything after the second dash (the venue + track)
    let venue = "";

    // Match everything after "boost - something -" to get the venue part
    // This captures "Belgian Grand Prix - Spa" or just "Belgian Grand Prix"
    const venueMatch = title.match(/boost\s*-\s*[^-]+\s*-\s*(.+)$/i);
    if (venueMatch) {
      venue = venueMatch[1].trim();
    }

    // Try to extract name/text from title between dashes
    let extractedName = null;
    const titleMatch = title.match(/boost\s*-\s*([^-]+)/i);
    if (titleMatch) {
      extractedName = titleMatch[1].trim().replace(/[()]/g, "").trim();
    }

    if (isDriverBoost) {
      // Try to find driver by sender username first (most reliable)
      let driver = drivers.find(
        (d) =>
          d.username.localeCompare(sender, undefined, {
            sensitivity: "base",
          }) === 0
      );

      // If not found by username, try multiple approaches with extracted name
      if (!driver && extractedName) {
        // Try exact match on driver name
        driver = drivers.find(
          (d) =>
            d.name.localeCompare(extractedName, undefined, {
              sensitivity: "base",
            }) === 0
        );

        // Try exact match on driver username
        if (!driver) {
          driver = drivers.find(
            (d) =>
              d.username.localeCompare(extractedName, undefined, {
                sensitivity: "base",
              }) === 0
          );
        }

        // Try partial match - check if extracted name is contained in driver name
        if (!driver) {
          driver = drivers.find(
            (d) =>
              d.name.toLowerCase().includes(extractedName.toLowerCase()) ||
              extractedName.toLowerCase().includes(d.name.toLowerCase())
          );
        }

        // Try partial match on username
        if (!driver) {
          driver = drivers.find(
            (d) =>
              d.username.toLowerCase().includes(extractedName.toLowerCase()) ||
              extractedName.toLowerCase().includes(d.username.toLowerCase())
          );
        }

        // Try last name match (split and check last word)
        if (!driver) {
          const extractedWords = extractedName.split(/\s+/);
          const lastWord = extractedWords[extractedWords.length - 1];
          if (lastWord.length > 2) {
            driver = drivers.find(
              (d) =>
                d.name.toLowerCase().includes(lastWord.toLowerCase()) ||
                d.username.toLowerCase().includes(lastWord.toLowerCase())
            );
          }
        }
      }

      if (driver && venue) {
        const result = `Driver Boost - ${driver.name} - ${venue}`;
        return result;
      }
    } else if (isTeamBoost) {
      // Try to find team by sender username first
      let team = teams.find(
        (t) =>
          t.username.localeCompare(sender, undefined, {
            sensitivity: "base",
          }) === 0
      );

      // If not found by username, try multiple approaches with extracted name
      if (!team && extractedName) {
        // Try exact match on team name
        team = teams.find(
          (t) =>
            t.name.localeCompare(extractedName, undefined, {
              sensitivity: "base",
            }) === 0
        );

        // Try exact match on short names
        if (!team) {
          team = teams.find(
            (t) =>
              (t.short1 &&
                t.short1.localeCompare(extractedName, undefined, {
                  sensitivity: "base",
                }) === 0) ||
              (t.short2 &&
                t.short2.localeCompare(extractedName, undefined, {
                  sensitivity: "base",
                }) === 0)
          );
        }

        // Try partial match - check if extracted name is contained in team name
        if (!team) {
          team = teams.find(
            (t) =>
              t.name.toLowerCase().includes(extractedName.toLowerCase()) ||
              extractedName.toLowerCase().includes(t.name.toLowerCase())
          );
        }

        // Try partial match on username
        if (!team) {
          team = teams.find(
            (t) =>
              t.username.toLowerCase().includes(extractedName.toLowerCase()) ||
              extractedName.toLowerCase().includes(t.username.toLowerCase())
          );
        }
      }

      // Try to extract boost type from title
      let boostType = "Single";
      if (/double/i.test(title)) {
        boostType = "Double";
      } else if (/single/i.test(title)) {
        boostType = "Single";
      }

      if (team && venue) {
        const result = `Team Boost - ${team.name} - ${venue} - ${boostType}`;
        return result;
      }
    }

    // If we can't suggest anything, return the original title as fallback
    return originalTitle;
  } catch (error) {
    return originalTitle;
  }
}

function Lineup({
  venueName,
  htmlContent,
  trackName,
  country,
  date,
  wrongUsername,
  cookies,
  showAdmin,
}) {
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
    username: "",
  });
  const [driverId, setDriverId] = useState(1);
  const [deleteTeamSelection, setDeleteTeamSelection] = useState("");
  const [deleteDriverSelection, setDeleteDriverSelection] = useState("");
  const [boosts, setBoosts] = useState([]);
  const [unmatchedBoosts, setUnmatchedBoosts] = useState([]);
  const [otherMessages, setOtherMessages] = useState([]);
  const [deadlineBoosts, setDeadlineBoosts] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [totals, setTotals] = useState([]);
  const [displayRace, setDisplayRace] = useState(true);
  const [displayTest, setDisplayTest] = useState(true);
  const [displayTestFullGrid, setDisplayTestFullGrid] = useState(false);
  const [showBoostsPopup, setShowBoostsPopup] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false); // For copy feedback
  const [copyTableSuccess, setCopyTableSuccess] = useState(false); // For table copy feedback
  const [copyDriversSuccess, setCopyDriversSuccess] = useState(false); // For drivers only copy feedback
  const [copyTeamsSuccess, setCopyTeamsSuccess] = useState(false); // For teams only copy feedback
  const [refreshTrigger, setRefreshTrigger] = useState(0); // Trigger to force boost re-processing

  useEffect(() => {
    if (drivers.length === 0 || teams.length === 0) {
      // Wait until data is loaded
      console.log("Waiting for data to load...");
      return;
    }

    // Async function to load fixed messages and process boosts
    const processBoosts = async () => {
      // Load all fixed messages from Firebase
      const fixedMessagesMap = {};
      try {
        const fixedMsgCollection = collection(db, "fixed_msg");
        const fixedMsgSnapshot = await getDocs(fixedMsgCollection);
        fixedMsgSnapshot.forEach((doc) => {
          const data = doc.data();
          fixedMessagesMap[doc.id] = data.fixedTitle;
        });
        console.log("Loaded fixed messages:", fixedMessagesMap);
      } catch (error) {
        console.error("Error loading fixed messages:", error);
      }

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
        .filter(
          (
            data,
            index,
            self // remove duplicate 1st entry
          ) => index === self.findIndex((t) => t && data && t.id === data.id)
        );

      // Step 2: Reset duplicates for each team
      teams.forEach((team) => {
        team.duplicate = false;
      });
      // Step 3: Reset duplicates for each driver
      drivers.forEach((driver) => {
        driver.duplicate = false;
      });

      // Step 4: Match fields and update boosts
      const newBoosts = [];
      const unmatchedBoosts = []; // For boosts that couldn't be matched
      const otherMessages = []; // For messages that are not boosts for this GP.
      const deadlineBoosts = []; // For messages that are after the deadline
      console.log(parsedData);
      parsedData.forEach((data) => {
        let {
          title: rawTitle,
          sender,
          date: dataDate,
          body,
          id: messageId,
        } = data;

        // Check if there's a fixed title for this message
        let isManuallyFixed = false;
        if (fixedMessagesMap[messageId]) {
          rawTitle = fixedMessagesMap[messageId];
          isManuallyFixed = true;
          console.log(
            `Applied fixed title for message ${messageId}: ${rawTitle}`
          );
        }

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
        var processedTitle = title.replace(/^[^a-zA-Z]+|[^a-zA-Z]+$/g, "");
        // this regex trims non-letter characters at the start and end of the title (such as: " . ( ) etc.)

        processedTitle = processedTitle.replace(
          /^(Driver|Team)\s+Boost(?!\s*[-–—])\s*/i,
          (match) => match.trim() + " - "
        );
        // this regex will force a delimiter between "Boost" and the next letter (usually driver or team name)

        var isDriverBoost = /driver boost/i.test(title); // Case insensitive check
        var isTeamBoost = /team boost/i.test(title); // Case insensitive check
        const isAnyBoost = /boost/i.test(title); // Case insensitive check
        if (isAnyBoost && !(isDriverBoost || isTeamBoost)) {
          if (containsTeamBoost(title)) isTeamBoost = true;
          else isDriverBoost = true;
        }
        const findVenue = matchVenue(title, venueName, trackName, country);

        // Check if this is a cancelled boost
        const isCancelled = /[-–—]\s*cancelled\s*$/i.test(title);

        // Compare the dates
        if (parsedDate > lineupDateAt20) {
          deadlineBoosts.push({
            title,
            sender,
            date: formatDate(parsedDate),
            body,
          });
        } else {
          let matched = false;
          let message = "";
          if (isDriverBoost && !isTeamBoost) {
            // Extract driver name/username and venue from title (with optional parentheses)
            const [, nameOrUsername, venue] =
              processedTitle.match(
                /^(?:(?:Driver\s+)?Boost)\s*-\s*\(?([^(]+?)\s*(?:\([^)]*\))?\s*-\s*(\(?.+?\)?)\s*[-,]?\s*$/i
              ) || [];
            if (findVenue) {
              var driver;
              var isDriverInTitle = false;
              if (!nameOrUsername) {
                //2nd pass, match for sender, if driver name is found anywhere in message
                if (!wrongUsername) {
                  driver = drivers.find(
                    (d) =>
                      d.username.localeCompare(sender, undefined, {
                        sensitivity: "base",
                      }) === 0
                  );
                } else if (sender === "GPGSL") {
                  // added check: if not logged in as GPGSL, check if user has sent the boost correctly (sender becomes receiver)
                  driver = drivers.find(
                    (d) =>
                      d.username.localeCompare(cookies.username, undefined, {
                        sensitivity: "base",
                      }) === 0
                  );
                }
                if (driver) {
                  isDriverInTitle = new RegExp(driver.name, "i").test(title); // must check if driver name
                } else {
                  isDriverInTitle = false;
                }
              } else {
                // if the title formatting is correct

                // Remove parentheses from name/username if present
                const cleanedNameOrUsername = nameOrUsername.replace(
                  /[()]/g,
                  ""
                );
                // Find matching driver by name OR username (case insensitive)
                driver = drivers.find(
                  (d) =>
                    d.name.localeCompare(cleanedNameOrUsername, undefined, {
                      sensitivity: "base",
                    }) === 0 ||
                    d.username.localeCompare(cleanedNameOrUsername, undefined, {
                      sensitivity: "base",
                    }) === 0
                );
                if (driver) {
                  isDriverInTitle =
                    (driver.username === sender && !wrongUsername) ||
                    (wrongUsername &&
                      driver.username === cookies.username &&
                      sender === "GPGSL");
                  // check whether the driver name matches the sender
                  // added check: if not logged in as GPGSL, check if user has sent the boost correctly (sender becomes receiver)
                } else {
                  isDriverInTitle = false;
                }
              }

              if (driver) {
                if (isDriverInTitle) {
                  matched = true;
                  const existingBoost = newBoosts.find(
                    (b) => b.id === driver.id
                  );
                  if (existingBoost) {
                    console.log(
                      "Found duplicate boost for driver: " + driver.name
                    );
                    driver.duplicate = true; // Mark as duplicate
                  } else {
                    newBoosts.push({
                      id: driver.id,
                      boosted: 1,
                      manuallyFixed: isManuallyFixed,
                      cancelled: isCancelled,
                    }); // Single boost for drivers
                    driver.duplicate = false;
                  }
                } else {
                  console.log(
                    "Boost for driver: " +
                      driver.username +
                      " unmatched because username is: " +
                      sender
                  );
                  matched = false; //this means somebody else sent in the driver boost
                  message = "Error: incorrect username for driver.";
                }
              } else {
                console.log(
                  "Boost unmatched for user: " +
                    nameOrUsername +
                    " because he is not a driver."
                );
                message = "Error: Driver not found.";
              }
            }
            if (!matched) {
              if (findVenue) {
                // If the boost message contains venueName and it wasnt matched
                unmatchedBoosts.push({
                  id: messageId,
                  title,
                  sender,
                  date: formatDate(parsedDate),
                  body,
                  message,
                });
                console.log(
                  "Unmatched for sender: " +
                    sender +
                    " and name: " +
                    nameOrUsername +
                    " and driver: " +
                    driver
                );
              } else {
                otherMessages.push({
                  title,
                  sender,
                  date: formatDate(parsedDate),
                  body,
                });
              }
            } else {
              console.log("Matched as a driver boost for title: " + title);
            }
          } else if (isTeamBoost && !isDriverBoost) {
            // this if block will append single/double boost from message body, if not present in title.
            if (!containsTeamBoost(processedTitle)) {
              if (/single/i.test(body)) {
                processedTitle += " - single";
              } else if (/double/i.test(body)) {
                processedTitle += " - double";
              }
            }
            // Extract team name, venue, and boost type from title (flexible delimiters and optional parentheses)
            const [, name, venue, boostType] =
              //title.match(/"?Team Boost - (\(?.+?\)?) - (\(?.+?\)?)\s*(?:[-,].+?)?\s*\(?(Single|Double|)\)?"?/i) || [];
              processedTitle.match(
                /"?(?:(?:Team\s+)?Boost)\s*[-,]\s*(\(?.+?\)?)\s*[-,]\s*(\(?.+?\)?)\s*(?:[-,].+?)?\s*\(?(Single|Double)\)?"?/i
              ) || [];
            if (name && findVenue) {
              // Remove parentheses from name if present
              const cleanedName = name.replace(/[()]/g, "");
              // Find matching team (case insensitive)
              const team = teams.find((t) => {
                // Check if the team name matches (case-insensitive)
                const nameMatches =
                  t.name.localeCompare(cleanedName, undefined, {
                    sensitivity: "base",
                  }) === 0;

                // Check if short1 matches, only if short1 exists and is not empty
                const short1Matches =
                  t.short1 &&
                  t.short1.localeCompare(cleanedName, undefined, {
                    sensitivity: "base",
                  }) === 0;

                // Check if short2 matches, only if short2 exists and is not empty
                const short2Matches =
                  t.short2 &&
                  t.short2.localeCompare(cleanedName, undefined, {
                    sensitivity: "base",
                  }) === 0;
                /*
                            // Check if the username matches (case-insensitive)
                            const usernameMatches = t.username.localeCompare(sender, undefined, { sensitivity: 'base' }) === 0;
                            */
                // Return true if either name, short1, or short2 matches, AND the username matches
                return nameMatches || short1Matches || short2Matches; // && usernameMatches;
              });
              if (team) {
                // if the team from the title was found
                if (
                  (team.username === sender && !wrongUsername) ||
                  (wrongUsername &&
                    team.username === cookies.username &&
                    sender === "GPGSL")
                ) {
                  // only here check if the sender is correct
                  // added check: if not logged in as GPGSL, check if user has sent the boost correctly (sender becomes receiver)
                  const boosted = boostType.toLowerCase() === "double" ? 2 : 1;
                  matched = true;
                  const existingBoost = newBoosts.find((b) => b.id === team.id);
                  if (existingBoost) {
                    console.log("Found duplicate boost for team: " + team.name);
                    team.duplicate = true; // Mark as duplicate
                  } else {
                    newBoosts.push({
                      id: team.id,
                      boosted,
                      manuallyFixed: isManuallyFixed,
                      cancelled: isCancelled,
                    });
                    team.duplicate = false;
                  }
                } else {
                  console.log(
                    "Boost for team: " +
                      team.username +
                      " unmatched because username is: " +
                      sender
                  );
                  matched = false; //this means somebody else sent in the team boost
                  message = "Error: incorrect username for team owner.";
                }
              } else {
                console.log(
                  "Boost unmatched for user: " +
                    sender +
                    " because the team is not found."
                );
                message = "Error: Team not found.";
              }
            }
            if (!matched) {
              if (findVenue) {
                // If the boost message contains venueName and it wasnt matched
                unmatchedBoosts.push({
                  id: messageId,
                  title,
                  sender,
                  date: formatDate(parsedDate),
                  body,
                  message,
                });
              } else {
                otherMessages.push({
                  title,
                  sender,
                  date: formatDate(parsedDate),
                  body,
                });
              }
            }
          } else {
            // If the message contains venueName but is not a boost, add it to otherMessages
            otherMessages.push({
              title,
              sender,
              date: formatDate(parsedDate),
              body,
            });
          }
        }
      });

      // Step 5: Update boosts collection
      setBoosts(newBoosts);
      setUnmatchedBoosts(unmatchedBoosts); // New state for unmatched boosts
      setOtherMessages(otherMessages); // New state for other messages
      setDeadlineBoosts(deadlineBoosts);
    };

    // Call the async function
    processBoosts();
  }, [
    htmlContent,
    venueName,
    date,
    drivers,
    teams,
    refreshTrigger,
    cookies.username,
    country,
    trackName,
    wrongUsername,
  ]); // Reprocess when refreshTrigger changes or any dependency updates

  // Fetch Teams
  useEffect(() => {
    const fetchTeams = async () => {
      const teamsRef = collection(db, "teams");
      const teamDocs = await getDocs(teamsRef);
      const fetchedTeams = [];

      teamDocs.forEach((doc) => {
        fetchedTeams.push({
          id: doc.id,
          name: doc.data().name,
          username: doc.data().username,
          short1: doc.data().short1,
          short2: doc.data().short2,
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

      driverDocs.forEach((doc) => {
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
    if (newTeam.trim() === "" || username.trim() === "") {
      console.log("Error: fields are empty");
      return;
    }
    const newId = (teams.length + 1) * 100;
    const newEntry = {
      id: newId,
      name: newTeam,
      username: username,
      short1: short1 ? short1.trim() : "", // Include short1 if present, otherwise empty string
      short2: short2 ? short2.trim() : "", // Include short2 if present, otherwise empty string
    };
    await setDoc(doc(db, "teams", newId.toString()), newEntry);
    setTeams([...teams, newEntry].sort((a, b) => a.id - b.id));

    setNewTeam("");
    setUsername("");
    setShort1("");
    setShort2("");
  };

  const addDriver = async () => {
    if (!newDriverInfo.team || !newDriverInfo.name || !newDriverInfo.username) {
      console.log(newDriverInfo);
      console.log("Error: fields are empty");
      return;
    }
    var found = -1;
    for (var team in teams) {
      if (teams[team].name === newDriverInfo.team) {
        found = teams[team].id;
        break;
      }
    }
    if (found == -1) {
      console.log(
        `Error: team not found. Entered team name is ${newDriverInfo.team}`
      );
      return;
    }
    const newId = parseInt(found) + parseInt(driverId);
    const newEntry = {
      id: newId,
      name: newDriverInfo.name,
      username: newDriverInfo.username,
      team: newDriverInfo.team,
    };
    await setDoc(doc(db, "drivers", newId.toString()), newEntry);
    setDrivers([...drivers, newEntry].sort((a, b) => a.id - b.id));

    setNewDriverInfo({
      team: "",
      name: "",
      username: "",
    });
  };

  const handleDeleteTeam = async () => {
    if (!deleteTeamSelection) {
      console.log("Error: No team selected");
      return;
    }

    const team = teams.find((t) => t.name === deleteTeamSelection);
    if (!team) {
      console.log("Error: Team not found");
      return;
    }

    if (
      !window.confirm(
        `Are you sure you want to delete team "${team.name}" and all its drivers?`
      )
    ) {
      return;
    }

    try {
      // Delete the team
      await deleteDoc(doc(db, "teams", team.id.toString()));

      // Find and delete all drivers associated with this team
      const teamDrivers = drivers.filter((driver) => driver.team === team.name);
      for (const driver of teamDrivers) {
        await deleteDoc(doc(db, "drivers", driver.id.toString()));
      }

      // Update state
      setTeams(teams.filter((t) => t.id !== team.id));
      setDrivers(drivers.filter((driver) => driver.team !== team.name));
      setDeleteTeamSelection("");

      console.log(
        `Deleted team "${team.name}" and ${teamDrivers.length} driver(s)`
      );
    } catch (error) {
      console.error("Error deleting team:", error);
      alert("Error deleting team: " + error.message);
    }
  };

  const handleDeleteDriver = async () => {
    if (!deleteDriverSelection) {
      console.log("Error: No driver selected");
      return;
    }

    const driver = drivers.find(
      (d) => d.id.toString() === deleteDriverSelection
    );
    if (!driver) {
      console.log("Error: Driver not found");
      return;
    }

    if (
      !window.confirm(
        `Are you sure you want to delete driver "${driver.name}"?`
      )
    ) {
      return;
    }

    try {
      // Delete the driver
      await deleteDoc(doc(db, "drivers", driver.id.toString()));

      // Update state
      setDrivers(drivers.filter((d) => d.id !== driver.id));
      setDeleteDriverSelection("");

      console.log(`Deleted driver "${driver.name}"`);
    } catch (error) {
      console.error("Error deleting driver:", error);
      alert("Error deleting driver: " + error.message);
    }
  };

  useEffect(() => {
    const fetchWarnings = async () => {
      var docid;
      try {
        const warningsRef = collection(db, "warnings");
        const warningDocs = await getDocs(warningsRef);
        const fetchedWarnings = [];
        const fetchedTotals = [];

        warningDocs.forEach((doc) => {
          const data = doc.data();
          //docid = console.log(doc.id);

          if (doc.id === "notPosted") {
            //console.log(data.Data);
            const notPosted = JSON.parse(data.Data);
            // the output of my doc is a stringified JSON
            // here we try to find matches to the usernames

            notPosted.forEach((doc) => {
              fetchedWarnings.push({
                Username: doc.Username,
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
            total.forEach((doc) => {
              fetchedTotals.push({
                Username: doc.Username,
                Warnings: doc.Warnings,
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

  const raceDriversBoosts = drivers
    .filter((driver) => {
      const driverIdSuffix = driver.id % 100;
      return (
        (driverIdSuffix === 1 || driverIdSuffix === 2) &&
        boosts.some((b) => b.id === driver.id)
      );
    })
    .map((driver) => driver.name);

  const testDriversBoosts = drivers
    .filter((driver) => {
      const driverIdSuffix = driver.id % 100;
      return driverIdSuffix >= 3 && boosts.some((b) => b.id === driver.id);
    })
    .map((driver) => driver.name);

  const boostedTeams = teams
    .filter((team) => boosts.some((b) => b.id === team.id))
    .map((team) => {
      const boost = boosts.find((b) => b.id === team.id);
      const boostValue = boost.boosted === 2 ? 8 : 4;
      return `${team.name}, +${boostValue}`;
    });

  // Handler to refresh teams and drivers from Firebase
  const handleRefreshDatabase = async () => {
    // Fetch teams
    const teamsRef = collection(db, "teams");
    const teamDocs = await getDocs(teamsRef);
    const fetchedTeams = [];
    teamDocs.forEach((doc) => {
      fetchedTeams.push({
        id: doc.id,
        name: doc.data().name,
        username: doc.data().username,
        short1: doc.data().short1,
        short2: doc.data().short2,
      });
    });
    setTeams(fetchedTeams.sort((a, b) => a.id - b.id));
    // Fetch drivers
    const driversRef = collection(db, "drivers");
    const driverDocs = await getDocs(driversRef);
    const fetchedDrivers = [];
    driverDocs.forEach((doc) => {
      fetchedDrivers.push({
        id: doc.id,
        name: doc.data().name,
        username: doc.data().username,
        team: doc.data().team,
      });
    });
    setDrivers(fetchedDrivers.sort((a, b) => a.id - b.id));
    console.log(
      "Database refreshed: teams and drivers reloaded from Firebase."
    );
  };

  return (
    <div className="lineup-editor">
      <div className="left-container">
        {/* Refresh Buttons */}
        <div
          style={{
            display: "flex",
            gap: "10px",
            marginBottom: "10px",
            alignItems: "center",
          }}
        >
          <button
            className="refresh-gpg-btn"
            onClick={
              window.fetchBoostsFromApp || (() => window.location.reload())
            }
          >
            Refresh GPG
          </button>
          <button className="refresh-gpg-btn" onClick={handleRefreshDatabase}>
            Refresh Database
          </button>
          <button
            onClick={() => setShowBoostsPopup(true)}
            className="list-boosts-btn"
          >
            List all boosts
          </button>
        </div>
        {/* Add the filter buttons */}
        <div className="filter-buttons" style={{ marginBottom: "10px" }}>
          <button
            className={`filter-one-button${
              displayRace && displayTest && !displayTestFullGrid
                ? " selected"
                : ""
            }`}
            onClick={() => {
              setDisplayRace(true);
              setDisplayTest(true);
              setDisplayTestFullGrid(false); // Reset full grid mode
            }}
            title="Show race and test drivers"
          >
            All
          </button>
          <button
            className={`filter-one-button${
              displayRace && !displayTest && !displayTestFullGrid
                ? " selected"
                : ""
            }`}
            onClick={() => {
              setDisplayRace(true);
              setDisplayTest(false);
              setDisplayTestFullGrid(false); // Reset full grid mode
            }}
            title="Show only race drivers"
          >
            Race
          </button>
          <button
            className={`filter-one-button${
              !displayRace && displayTest && !displayTestFullGrid
                ? " selected"
                : ""
            }`}
            onClick={() => {
              setDisplayRace(false);
              setDisplayTest(true);
              setDisplayTestFullGrid(false); // Reset full grid mode
            }}
            title="Show only test drivers"
          >
            Test
          </button>
          {/* New Test (full grid) button */}
          <button
            className={`filter-one-button${
              displayTestFullGrid ? " selected" : ""
            }`}
            onClick={() => {
              setDisplayRace(false);
              setDisplayTest(true);
              setDisplayTestFullGrid(true); // Activate full grid mode
            }}
            title="Show test drivers with full grid (copying race drivers if needed)"
          >
            Test (full grid)
          </button>
        </div>

        {/* Copy to clipboard buttons for the table */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            marginBottom: "10px",
            gap: "10px",
          }}
        >
          {/* All (teams + drivers) */}
          <button
            className="lineup-copy-btn all no-bold"
            onClick={async () => {
              let rows = [];
              rows.push(["User", "Boosts", "Warning"]);
              teams.forEach((team) => {
                // Team row
                const teamWarningCount = totals.find(
                  (total) => total.Username === team.username
                )?.Warnings;
                let teamWarning = "";
                if (teamWarningCount === 1) teamWarning = "10";
                else if (teamWarningCount === 2) teamWarning = "25";
                else if (teamWarningCount >= 3) teamWarning = "out";
                const boost = boosts.find((b) => b.id === team.id);
                const teamBoost = boost?.cancelled
                  ? ""
                  : boost?.boosted === 1
                  ? "4"
                  : boost?.boosted === 2
                  ? "8"
                  : "";
                let userCell = `${team.id / 100}. ${team.name} (${
                  team.username
                })`;
                if (team.short1 || team.short2) {
                  userCell += " [";
                  if (team.short1) userCell += team.short1;
                  if (team.short1 && team.short2) userCell += " · ";
                  if (team.short2) userCell += team.short2;
                  userCell += "]";
                }
                if (boost?.cancelled) {
                  userCell += " - user cancelled boost";
                } else if (boost?.manuallyFixed) {
                  userCell += " - manually matched";
                } else if (team.duplicate) {
                  userCell += " - duplicate boost";
                }
                rows.push([userCell, teamBoost, teamWarning]);
                // Driver rows (filtered)
                const teamDrivers = drivers.filter(
                  (driver) =>
                    Math.floor(driver.id / 100) === Math.floor(team.id / 100)
                );
                const driver1 = displayTestFullGrid
                  ? teamDrivers.find((d) => d.id % 100 === 1)
                  : null;
                const driver2 = displayTestFullGrid
                  ? teamDrivers.find((d) => d.id % 100 === 2)
                  : null;
                let driverRows = teamDrivers
                  .filter((driver) => {
                    const driverType = driver.id % 100;
                    if (displayTestFullGrid) {
                      return driverType >= 3;
                    }
                    return (
                      (displayRace && driverType <= 2) ||
                      (displayTest && driverType >= 3)
                    );
                  })
                  .concat(
                    displayTestFullGrid
                      ? [
                          ...(teamDrivers.some((d) => d.id % 100 === 3)
                            ? []
                            : [
                                driver1
                                  ? {
                                      ...driver1,
                                      id: team.id + 3,
                                      raceDriver: true,
                                    }
                                  : null,
                              ]),
                          ...(teamDrivers.some((d) => d.id % 100 === 4)
                            ? []
                            : [
                                driver2
                                  ? {
                                      ...driver2,
                                      id: team.id + 4,
                                      raceDriver: true,
                                    }
                                  : null,
                              ]),
                        ].filter(Boolean)
                      : []
                  );
                driverRows.forEach((driver) => {
                  if (!driver) return;
                  const driverWarningCount = totals.find(
                    (total) => total.Username === driver.username
                  )?.Warnings;
                  let driverWarning = "";
                  if (driverWarningCount === 1) driverWarning = "20";
                  else if (driverWarningCount === 2) driverWarning = "40";
                  else if (driverWarningCount >= 3) driverWarning = "out";
                  let driverCell = `#${driver.id % 100}: ${driver.name} (${
                    driver.username
                  })`;
                  const boost = boosts.find((b) => b.id === driver.id);
                  if (boost?.cancelled) {
                    driverCell += " - user cancelled boost";
                  } else if (boost?.manuallyFixed) {
                    driverCell += " - manually matched";
                  } else if (driver.duplicate) {
                    driverCell += " - duplicate boost";
                  }
                  if (driver.raceDriver) driverCell += " - race";
                  const driverBoost = boost?.cancelled
                    ? ""
                    : boost?.boosted === 1
                    ? "200"
                    : "";
                  rows.push([driverCell, driverBoost, driverWarning]);
                });
              });
              const text = rows.map((row) => row.join("\t")).join("\n");
              try {
                await navigator.clipboard.writeText(text);
                setCopyTableSuccess(true);
                setTimeout(() => setCopyTableSuccess(false), 1500);
              } catch (err) {
                setCopyTableSuccess(false);
              }
            }}
            title="Copy lineup table to clipboard for Excel"
          >
            <FaCopy /> Copy table to clipboard
          </button>
          {copyTableSuccess && (
            <span style={{ color: "#4CAF50", fontWeight: "bold" }}>
              Copied!
            </span>
          )}

          {/* Drivers only */}
          <button
            className="lineup-copy-btn drivers no-bold"
            onClick={async () => {
              let rows = [];
              rows.push(["User", "Boosts", "Warning"]);
              teams.forEach((team) => {
                const teamDrivers = drivers.filter(
                  (driver) =>
                    Math.floor(driver.id / 100) === Math.floor(team.id / 100)
                );
                const driver1 = displayTestFullGrid
                  ? teamDrivers.find((d) => d.id % 100 === 1)
                  : null;
                const driver2 = displayTestFullGrid
                  ? teamDrivers.find((d) => d.id % 100 === 2)
                  : null;
                let driverRows = teamDrivers
                  .filter((driver) => {
                    const driverType = driver.id % 100;
                    if (displayTestFullGrid) {
                      return driverType >= 3;
                    }
                    return (
                      (displayRace && driverType <= 2) ||
                      (displayTest && driverType >= 3)
                    );
                  })
                  .concat(
                    displayTestFullGrid
                      ? [
                          ...(teamDrivers.some((d) => d.id % 100 === 3)
                            ? []
                            : [
                                driver1
                                  ? {
                                      ...driver1,
                                      id: team.id + 3,
                                      raceDriver: true,
                                    }
                                  : null,
                              ]),
                          ...(teamDrivers.some((d) => d.id % 100 === 4)
                            ? []
                            : [
                                driver2
                                  ? {
                                      ...driver2,
                                      id: team.id + 4,
                                      raceDriver: true,
                                    }
                                  : null,
                              ]),
                        ].filter(Boolean)
                      : []
                  );
                driverRows.forEach((driver) => {
                  if (!driver) return;
                  const driverWarningCount = totals.find(
                    (total) => total.Username === driver.username
                  )?.Warnings;
                  let driverWarning = "";
                  if (driverWarningCount === 1) driverWarning = "20";
                  else if (driverWarningCount === 2) driverWarning = "40";
                  else if (driverWarningCount >= 3) driverWarning = "out";
                  let driverCell = `#${driver.id % 100}: ${driver.name} (${
                    driver.username
                  })`;
                  const boost = boosts.find((b) => b.id === driver.id);
                  if (boost?.cancelled) {
                    driverCell += " - user cancelled boost";
                  } else if (boost?.manuallyFixed) {
                    driverCell += " - manually matched";
                  } else if (driver.duplicate) {
                    driverCell += " - duplicate boost";
                  }
                  if (driver.raceDriver) driverCell += " - race";
                  const driverBoost = boost?.cancelled
                    ? ""
                    : boost?.boosted === 1
                    ? "200"
                    : "";
                  rows.push([driverCell, driverBoost, driverWarning]);
                });
              });
              const text = rows.map((row) => row.join("\t")).join("\n");
              try {
                await navigator.clipboard.writeText(text);
                setCopyDriversSuccess(true);
                setTimeout(() => setCopyDriversSuccess(false), 1500);
              } catch (err) {
                setCopyDriversSuccess(false);
              }
            }}
            title="Copy only drivers to clipboard for Excel"
          >
            <FaCopy /> Copy drivers only
          </button>
          {copyDriversSuccess && (
            <span style={{ color: "#2196F3", fontWeight: "bold" }}>
              Copied!
            </span>
          )}

          {/* Teams only */}
          <button
            className="lineup-copy-btn teams no-bold"
            onClick={async () => {
              let rows = [];
              rows.push(["User", "Boosts", "Warning"]);
              teams.forEach((team) => {
                const teamWarningCount = totals.find(
                  (total) => total.Username === team.username
                )?.Warnings;
                let teamWarning = "";
                if (teamWarningCount === 1) teamWarning = "10";
                else if (teamWarningCount === 2) teamWarning = "25";
                else if (teamWarningCount >= 3) teamWarning = "out";
                const boost = boosts.find((b) => b.id === team.id);
                const teamBoost = boost?.cancelled
                  ? ""
                  : boost?.boosted === 1
                  ? "4"
                  : boost?.boosted === 2
                  ? "8"
                  : "";
                let userCell = `${team.id / 100}. ${team.name} (${
                  team.username
                })`;
                if (team.short1 || team.short2) {
                  userCell += " [";
                  if (team.short1) userCell += team.short1;
                  if (team.short1 && team.short2) userCell += " · ";
                  if (team.short2) userCell += team.short2;
                  userCell += "]";
                }
                if (boost?.cancelled) {
                  userCell += " - user cancelled boost";
                } else if (boost?.manuallyFixed) {
                  userCell += " - manually matched";
                } else if (team.duplicate) {
                  userCell += " - duplicate boost";
                }
                rows.push([userCell, teamBoost, teamWarning]);
              });
              const text = rows.map((row) => row.join("\t")).join("\n");
              try {
                await navigator.clipboard.writeText(text);
                setCopyTeamsSuccess(true);
                setTimeout(() => setCopyTeamsSuccess(false), 1500);
              } catch (err) {
                setCopyTeamsSuccess(false);
              }
            }}
            title="Copy only teams to clipboard for Excel"
          >
            <FaCopy /> Copy teams only
          </button>
          {copyTeamsSuccess && (
            <span style={{ color: "#FF9800", fontWeight: "bold" }}>
              Copied!
            </span>
          )}
        </div>

        {showBoostsPopup && (
          <div
            className="help-overlay"
            onClick={() => setShowBoostsPopup(false)}
          >
            <div className="help-modal" onClick={(e) => e.stopPropagation()}>
              <div className="help-content">
                {raceDriversBoosts.length > 0 && (
                  <div>
                    {raceDriversBoosts.map((driver, index) => (
                      <div key={index}>{driver}</div>
                    ))}
                  </div>
                )}
                {testDriversBoosts.length > 0 && (
                  <div>
                    <br />
                    {testDriversBoosts.map((driver, index) => (
                      <div key={index}>{driver}</div>
                    ))}
                  </div>
                )}
                {boostedTeams.length > 0 && (
                  <div>
                    <br />
                    {boostedTeams.map((team, index) => (
                      <div key={index}>{team}</div>
                    ))}
                  </div>
                )}
              </div>
              <div
                className="help-footer"
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <button
                  onClick={async () => {
                    // Build the text to copy
                    let text = "";
                    if (raceDriversBoosts.length > 0) {
                      text += raceDriversBoosts.join("\n");
                    }
                    if (testDriversBoosts.length > 0) {
                      if (text) text += "\n\n";
                      text += testDriversBoosts.join("\n");
                    }
                    if (boostedTeams.length > 0) {
                      if (text) text += "\n\n";
                      text += boostedTeams.join("\n");
                    }
                    try {
                      await navigator.clipboard.writeText(text);
                      setCopySuccess(true);
                      setTimeout(() => setCopySuccess(false), 1500);
                    } catch (err) {
                      setCopySuccess(false);
                    }
                  }}
                  className="lineup-copy-btn all no-bold"
                  title="Copy all boosts to clipboard"
                >
                  <FaCopy /> Copy to clipboard
                </button>
                {copySuccess && (
                  <span
                    style={{
                      color: "#4CAF50",
                      marginLeft: "10px",
                      fontWeight: "bold",
                    }}
                  >
                    Copied!
                  </span>
                )}
                <button onClick={() => setShowBoostsPopup(false)}>Close</button>
              </div>
            </div>
          </div>
        )}

        <table>
          <thead>
            <tr>
              <th>User</th>
              <th>Boosts</th>
              <th>Warning</th>{" "}
              {/*note: I (the guy doing the activity check) must not update this resource, 
                                                    in the period between the boost deadline and the perfs being posted*/}
            </tr>
          </thead>
          <tbody>
            {teams.map((team) => (
              <React.Fragment key={team.id}>
                {/* Team Row - always visible */}
                <tr
                  className={(() => {
                    const boost = boosts.find((b) => b.id === team.id);
                    if (boost?.cancelled) {
                      return "cancelled-team-row";
                    } else if (boost?.manuallyFixed) {
                      return "manually-fixed-team-row";
                    } else if (team.duplicate) {
                      return "duplicate-team-row";
                    } else {
                      return "team-row";
                    }
                  })()}
                >
                  <td>
                    {/* Team name and username */}
                    <div>
                      {team.id / 100}. {team.name} ({team.username}){" "}
                      {(() => {
                        const boost = boosts.find((b) => b.id === team.id);
                        if (boost?.cancelled) return " - user cancelled boost";
                        if (boost?.manuallyFixed) return " - manually matched";
                        if (team.duplicate) return " - duplicate boost";
                        return "";
                      })()}
                    </div>
                    {/* Display short1 and short2 if they exist */}
                    {(team.short1 || team.short2) && (
                      <div style={{ fontSize: "0.6em", color: "gray" }}>
                        {team.short1 && <span>{team.short1}</span>}
                        {team.short1 && team.short2 && <span> · </span>}{" "}
                        {/* Add a separator if both exist */}
                        {team.short2 && <span>{team.short2}</span>}
                      </div>
                    )}
                  </td>
                  <td style={{ textAlign: "center" }}>
                    {(() => {
                      const boost = boosts.find((b) => b.id === team.id);
                      if (boost?.cancelled) {
                        return "";
                      }
                      if (boost?.boosted === 1) {
                        return "4";
                      } else if (boost?.boosted === 2) {
                        return "8";
                      }
                      return "";
                    })()}
                  </td>
                  {/* Warnings Column (fetches the updated warning penalty, AFTER I (the guy doing activity checks) save them to a .txt file with my app.
                                                                                                In practice, this means after I post with the GPGSL account.) */}
                  <td
                    style={{
                      textAlign: "center",
                      color: warnings.some(
                        (warning) => warning.Username === team.username
                      )
                        ? "red"
                        : "inherit",
                    }}
                  >
                    {(() => {
                      const warningCount = totals.find(
                        (total) => total.Username === team.username
                      )?.Warnings;
                      if (warningCount === 0) return "";
                      if (warningCount === 1) return "10";
                      if (warningCount === 2) return "25";
                      if (warningCount >= 3) return "out";
                      return "";
                    })()}
                  </td>
                </tr>
                {/* Driver Rows - filtered based on displayRace and displayTest */}
                {(() => {
                  // Get all drivers for this team
                  const teamDrivers = drivers.filter(
                    (driver) =>
                      Math.floor(driver.id / 100) === Math.floor(team.id / 100)
                  );

                  // Find the race drivers (1 and 2) if we need them for full grid mode
                  const driver1 = displayTestFullGrid
                    ? teamDrivers.find((d) => d.id % 100 === 1)
                    : null;
                  const driver2 = displayTestFullGrid
                    ? teamDrivers.find((d) => d.id % 100 === 2)
                    : null;

                  // Process drivers based on current filter mode
                  return (
                    teamDrivers
                      .filter((driver) => {
                        const driverType = driver.id % 100;

                        // In full grid mode, we only want test drivers (3+)
                        if (displayTestFullGrid) {
                          return driverType >= 3;
                        }

                        // Normal filter mode
                        return (
                          (displayRace && driverType <= 2) ||
                          (displayTest && driverType >= 3)
                        );
                      })
                      // Add copied drivers in full grid mode if needed
                      .concat(
                        displayTestFullGrid
                          ? [
                              // Add driver 3 (copy of 1 if doesn't exist)
                              ...(teamDrivers.some((d) => d.id % 100 === 3)
                                ? []
                                : [
                                    {
                                      ...driver1,
                                      raceDriver: true, // Mark as race
                                    },
                                  ]),
                              // Add driver 4 (copy of 2 if doesn't exist)
                              ...(teamDrivers.some((d) => d.id % 100 === 4)
                                ? []
                                : [
                                    {
                                      ...driver2,
                                      raceDriver: true, // Mark as race
                                    },
                                  ]),
                            ].filter(Boolean)
                          : []
                      ) // Filter out undefined if driver1/driver2 don't exist
                      .map((driver) => (
                        <tr
                          key={driver.id}
                          className={(() => {
                            const boost = boosts.find(
                              (b) => b.id === driver.id
                            );
                            if (boost?.cancelled) {
                              return "cancelled-driver-row";
                            } else if (boost?.manuallyFixed) {
                              return "manually-fixed-driver-row";
                            } else if (driver.duplicate) {
                              return "duplicate-driver-row";
                            } else if (driver.raceDriver) {
                              return "race-driver-row";
                            } else {
                              return "driver-row";
                            }
                          })()}
                        >
                          <td style={{ paddingLeft: "20px" }}>
                            #{driver.id % 100}: {driver.name} ({driver.username}
                            )
                            {(() => {
                              const boost = boosts.find(
                                (b) => b.id === driver.id
                              );
                              if (boost?.cancelled)
                                return " - user cancelled boost";
                              if (boost?.manuallyFixed)
                                return " - manually matched";
                              if (driver.duplicate) return " - duplicate boost";
                              if (driver.raceDriver) return " - race";
                              return "";
                            })()}
                          </td>
                          <td style={{ textAlign: "center" }}>
                            {(() => {
                              const boost = boosts.find(
                                (b) => b.id === driver.id
                              );
                              if (boost?.cancelled) {
                                return "";
                              }
                              if (boost?.boosted === 1) {
                                return "200";
                              }
                              return "";
                            })()}
                          </td>
                          {/* Warnings Column (fetches the updated warning penalty, AFTER I (the guy doing activity checks) save them to a .txt file with my app.
                                                                                                    In practice, this means after I post with the GPGSL account.) */}
                          <td
                            style={{
                              textAlign: "center",
                              color: warnings.some(
                                (warning) =>
                                  warning.Username === driver.username
                              )
                                ? "red"
                                : "inherit",
                            }}
                          >
                            {(() => {
                              const warningCount = totals.find(
                                (total) => total.Username === driver.username
                              )?.Warnings;
                              if (warningCount === 1) return "20";
                              if (warningCount === 2) return "40";
                              if (warningCount >= 3) return "out";
                              return "";
                            })()}
                          </td>
                        </tr>
                      ))
                  );
                })()}
              </React.Fragment>
            ))}
          </tbody>
        </table>

        {showAdmin ? (
          !editMode ? (
            <button onClick={() => setEditMode(!editMode)}>
              <FaEdit /> Edit Lineup
            </button>
          ) : (
            <>
              <button onClick={editLineup}>Close Edit Mode</button>

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
                <button onClick={addTeam}>Add Team</button>
              </div>
              <div className="add-section">
                <select
                  value={newDriverInfo.team}
                  onChange={(e) =>
                    setNewDriverInfo({ ...newDriverInfo, team: e.target.value })
                  }
                >
                  <option value="" disabled>
                    Select a team
                  </option>{" "}
                  {/* Default blank option */}
                  {teams.map((team) => (
                    <option key={team.id} value={team.name}>
                      {team.name}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Name"
                  value={newDriverInfo.name}
                  onChange={(e) =>
                    setNewDriverInfo({ ...newDriverInfo, name: e.target.value })
                  }
                />
                <input
                  type="text"
                  placeholder="Username"
                  value={newDriverInfo.username}
                  onChange={(e) =>
                    setNewDriverInfo({
                      ...newDriverInfo,
                      username: e.target.value,
                    })
                  }
                />
                <input
                  type="number"
                  placeholder="1"
                  value={driverId}
                  onChange={(e) => setDriverId(e.target.value)}
                />
                <button onClick={addDriver}>Add Driver</button>
              </div>

              <div
                className="delete-section"
                style={{
                  marginTop: "20px",
                  borderTop: "2px solid #ddd",
                  paddingTop: "20px",
                }}
              >
                <h3>Remove Team (with all drivers)</h3>
                <select
                  value={deleteTeamSelection}
                  onChange={(e) => setDeleteTeamSelection(e.target.value)}
                >
                  <option value="" disabled>
                    Select a team to delete
                  </option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.name}>
                      {team.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleDeleteTeam}
                  style={{ backgroundColor: "#dc3545" }}
                >
                  <FaTrash /> Delete Team
                </button>
              </div>

              <div className="delete-section" style={{ marginTop: "20px" }}>
                <h3>Remove Driver</h3>
                <select
                  value={deleteDriverSelection}
                  onChange={(e) => setDeleteDriverSelection(e.target.value)}
                >
                  <option value="" disabled>
                    Select a driver to delete
                  </option>
                  {drivers.map((driver) => (
                    <option key={driver.id} value={driver.id.toString()}>
                      {driver.name} ({driver.team})
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleDeleteDriver}
                  style={{ backgroundColor: "#dc3545" }}
                >
                  <FaTrash /> Delete Driver
                </button>
              </div>
            </>
          )
        ) : (
          ""
        )}
      </div>

      <div className="side-tables">
        <DeadlineBoostsTable
          boosts={deadlineBoosts}
          wrongUsername={wrongUsername}
        />
        <UnmatchedBoostsTable
          boosts={unmatchedBoosts}
          wrongUsername={wrongUsername}
          showAdmin={showAdmin}
          drivers={drivers}
          teams={teams}
          venueName={venueName}
          trackName={trackName}
          country={country}
          onRefresh={() => setRefreshTrigger((prev) => prev + 1)}
        />
        <OtherMessagesTable
          messages={otherMessages}
          wrongUsername={wrongUsername}
        />
      </div>
    </div>
  );
}

function DeadlineBoostsTable({ boosts, wrongUsername }) {
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
            <th>{wrongUsername ? "Receiver" : "Sender"}</th>
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
                <div style={{ fontSize: "0.8em", color: "#666" }}>
                  {boost.body}
                </div>
              </td>
              <td className="deadline-date">{boost.date}</td>{" "}
              {/* Display the date */}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function UnmatchedBoostsTable({
  boosts,
  wrongUsername,
  showAdmin,
  drivers,
  teams,
  venueName,
  trackName,
  country,
  onRefresh,
}) {
  const [showFixModal, setShowFixModal] = useState(false);
  const [selectedBoost, setSelectedBoost] = useState(null);
  const [fixedTitle, setFixedTitle] = useState("");
  const [saving, setSaving] = useState(false);

  const handleFixClick = (boost) => {
    setSelectedBoost(boost);
    // Auto-suggest corrected title
    const suggestion = suggestCorrectedTitle(
      boost.title,
      boost.sender,
      drivers,
      teams,
      venueName,
      trackName,
      country
    );
    setFixedTitle(suggestion);
    setShowFixModal(true);
  };

  const handleApprove = async () => {
    if (!fixedTitle.trim()) {
      alert("Please enter a fixed title");
      return;
    }

    setSaving(true);
    try {
      // Save to Firebase fixed_msg collection
      const fixedMsgRef = doc(db, "fixed_msg", selectedBoost.id);
      await setDoc(fixedMsgRef, {
        originalTitle: selectedBoost.title,
        fixedTitle: fixedTitle,
        messageId: selectedBoost.id,
        sender: selectedBoost.sender,
        timestamp: new Date().toISOString(),
      });

      // Close modal first
      setShowFixModal(false);
      setSelectedBoost(null);
      setFixedTitle("");

      // Trigger refresh to reprocess boosts with new fixed message
      if (onRefresh) {
        onRefresh();
      }
    } catch (error) {
      console.error("Error saving fixed title:", error);
      alert("Error saving fixed title: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeny = () => {
    setShowFixModal(false);
    setSelectedBoost(null);
    setFixedTitle("");
  };

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
            <th>{wrongUsername ? "Receiver" : "Sender"}</th>
            <th>Message</th>
            <th className="unmatched-date">Date</th>
            {showAdmin && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {boosts.map((boost, index) => (
            <tr key={index}>
              <td>{boost.sender}</td>
              <td>
                <div>{boost.title}</div>
                <div style={{ fontSize: "0.8em", color: "#666" }}>
                  {boost.body}
                </div>
                <div style={{ fontSize: "0.8em", color: "#666" }}>
                  {boost.message}
                </div>
              </td>
              <td className="unmatched-date">{boost.date}</td>
              {showAdmin && (
                <td>
                  <button
                    className="fix-button"
                    onClick={() => handleFixClick(boost)}
                    title="Fix this boost"
                  >
                    <FaWrench /> Fix
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Fix Modal */}
      {showFixModal && selectedBoost && (
        <div className="modal-overlay" onClick={handleDeny}>
          <div
            className="modal-content fix-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>Fix Boost Message</h3>
            <div className="modal-body">
              <div className="form-group">
                <label>Current Title (read-only):</label>
                <input
                  type="text"
                  value={selectedBoost.title}
                  readOnly
                  className="readonly-input"
                />
              </div>
              <div className="form-group">
                <label>Fixed Title:</label>
                <input
                  type="text"
                  value={fixedTitle}
                  onChange={(e) => setFixedTitle(e.target.value)}
                  placeholder="Enter corrected title"
                  className="fixed-title-input"
                />
                <small
                  style={{ color: "#666", marginTop: "5px", display: "block" }}
                >
                  Format: "Driver Boost - [Driver Name] - [Venue]" or "Team
                  Boost - [Team Name] - [Venue] - [Single/Double]"
                </small>
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn-approve"
                onClick={handleApprove}
                disabled={saving}
              >
                {saving ? "Saving..." : "Approve"}
              </button>
              <button
                className="btn-deny"
                onClick={handleDeny}
                disabled={saving}
              >
                Deny
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function OtherMessagesTable({ messages, wrongUsername }) {
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
            <th>{wrongUsername ? "Receiver" : "Sender"}</th>
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
                <div style={{ fontSize: "0.8em", color: "#666" }}>
                  {message.body}
                </div>
              </td>
              <td className="unmatched-date">{message.date}</td>{" "}
              {/* Display the date */}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default Lineup;
