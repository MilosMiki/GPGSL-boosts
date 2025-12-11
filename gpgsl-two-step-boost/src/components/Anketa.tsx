import "./Anketa.css";

export default function Anketa() {
  const handleAnketaClick = () => {
    window.open("https://1ka.arnes.si/a/fd1b5e2d", "_blank");
  };

  return (
    <div className="anketa-container">
      <button className="anketa-button" onClick={handleAnketaClick}>
        Anketa
      </button>
    </div>
  );
}
