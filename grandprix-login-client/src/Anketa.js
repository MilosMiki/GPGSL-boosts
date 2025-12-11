import React from "react";
import "./Anketa.css";

function Anketa() {
  const handleAnketaClick = () => {
    window.open("https://1ka.arnes.si/a/df646ccf", "_blank");
  };

  return (
    <div className="anketa-container">
      <button className="anketa-button" onClick={handleAnketaClick}>
        Anketa
      </button>
    </div>
  );
}

export default Anketa;
