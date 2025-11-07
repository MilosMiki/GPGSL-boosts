// Utility functions for boost filtering, matching, and parsing

export function decodeHTMLEntities(text) {
    const textArea = document.createElement('textarea');
    textArea.innerHTML = text;
    return textArea.value;
}

export function matchVenue(title, venueName, trackName, country){
    return title.includes(venueName) || title.includes(trackName) || title.includes(country)
}

export function containsTeamBoost(title){
    if (typeof title !== 'string' || title.length === 0) return false;
    const parts = title.split('-');
    const lastPart = parts[parts.length - 1];
    const lowerLastPart = lastPart.toLowerCase();
    return lowerLastPart.includes("single") || lowerLastPart.includes("double");
}

export function parseCustomDate(dateString) {
    const now = new Date();
    const nowUTC = new Date(Date.UTC(
        now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(),
        now.getUTCHours(), now.getUTCMinutes(), now.getUTCSeconds()
    ));
    if (dateString.toLowerCase().match(/^(just now|this minute)$/)) {
        return new Date(nowUTC);
    }
    const relativeMatch = dateString.match(/(\d+)\s+(second|minute|hour|day|week)s?\s+ago/i);
    if (relativeMatch) {
        const amount = parseInt(relativeMatch[1], 10);
        const unit = relativeMatch[2].toLowerCase();
        const adjusted = new Date(nowUTC);
        if (unit === "second") adjusted.setUTCSeconds(adjusted.getUTCSeconds() - amount);
        else if (unit === "minute") adjusted.setUTCMinutes(adjusted.getUTCMinutes() - amount);
        else if (unit === "hour") adjusted.setUTCHours(adjusted.getUTCHours() - amount);
        else if (unit === "day") adjusted.setUTCDate(adjusted.getUTCDate() - amount);
        else if (unit === "week") adjusted.setUTCDate(adjusted.getUTCDate() - amount * 7);
        return adjusted;
    }
    const dayMatch = dateString.match(/^(today|yesterday),\s*(\d{1,2}):(\d{2})(AM|PM)$/i);
    if (dayMatch) {
        const [, label, rawHour, rawMinute, ampm] = dayMatch;
        let hours = parseInt(rawHour, 10);
        const minutes = parseInt(rawMinute, 10);
        const modifier = ampm.toUpperCase();
        if (modifier === "PM" && hours !== 12) hours += 12;
        if (modifier === "AM" && hours === 12) hours = 0;
        const candidate = new Date(Date.UTC(
            nowUTC.getUTCFullYear(), nowUTC.getUTCMonth(), nowUTC.getUTCDate(),
            hours, minutes, 0
        ));
        if (label.toLowerCase() === "today") {
            return candidate;
        }
        if (nowUTC < candidate) {
            candidate.setUTCDate(candidate.getUTCDate() - 2);
        } else {
            candidate.setUTCDate(candidate.getUTCDate() - 1);
        }
        return candidate;
    }
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

export function formatDate(date) {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    return `${day}.${month}.${year} ${hours}:${minutes}`;
}

// Optionally, export filterAndLogBoosts if you want to share it too
export function filterAndLogBoosts({ messages, venueName, trackName, country, date, drivers = [], teams = [], cookies, wrongUsername }) {
    messages.forEach((data) => {
        const { title: rawTitle, sender, date: dataDate, body } = data;
        const parsedDate = parseCustomDate(dataDate);
        const lineupDateAt20 = new Date(date);
        lineupDateAt20.setHours(20, 0, 0, 0);
        const title = decodeHTMLEntities(rawTitle);
        var processedTitle = title.replace(/^[^a-zA-Z]+|[^a-zA-Z]+$/g, '');
        processedTitle = processedTitle.replace(
            /^(Driver|Team)\s+Boost(?!\s*[-–—])\s*/i,
            (match) => match.trim() + ' - '
        );
        var isDriverBoost = /driver boost/i.test(title);
        var isTeamBoost = /team boost/i.test(title);
        const isAnyBoost = /boost/i.test(title);
        if(isAnyBoost && !(isDriverBoost || isTeamBoost)){
            if(containsTeamBoost(title))
                isTeamBoost = true;
            else
                isDriverBoost = true;
        }
        const findVenue = matchVenue(title, venueName, trackName, country);
        if (parsedDate > lineupDateAt20) {
            // Deadline boost
        } else {
            if (isDriverBoost && !isTeamBoost) {
                if (findVenue) {
                    console.log(`Matched as a driver boost for title: ${title}`);
                }
            } else if (isTeamBoost && !isDriverBoost) {
                if (findVenue) {
                    console.log(`Matched as a team boost for title: ${title}`);
                }
            }
        }
    });
} 