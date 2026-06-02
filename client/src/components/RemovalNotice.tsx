import { useState, useEffect } from "react";
import "./RemovalNotice.css";

interface Props {
  reason: "kicked" | "banned";
  onLeave: () => void;
}

const COUNTDOWN = 5;
const RADIUS = 22;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * RemovalNotice component displays a countdown timer and a notice when a user is either kicked or banned from a community.
 * The countdown indicates the time left before the user is redirected or removed from the community.
 *
 * @param {Object} props - Component properties.
 * @param {"kicked" | "banned"} props.reason - The reason for the removal: either "kicked" or "banned".
 * @param {Function} props.onLeave - A callback function that is called when the user leaves the notice or the countdown reaches 0.
 *
 * @returns {JSX.Element} The rendered RemovalNotice component.
 */
export function RemovalNotice({ reason, onLeave }: Props) {
  const [seconds, setSeconds] = useState(COUNTDOWN);

  useEffect(() => {
    if (seconds <= 0) {
      // Wait for the SVG ring's 1000ms CSS transition to finish before unmounting
      const id = setTimeout(onLeave, 1000);
      return () => clearTimeout(id);
    }
    const id = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [seconds, onLeave]);

  const dashOffset = CIRCUMFERENCE * (1 - seconds / COUNTDOWN);
  const isBan = reason === "banned";

  return (
    <div className="removalOverlay" role="alertdialog" aria-modal="true">
      <div className="removalCard">
        <div className={`removalIconBadge ${isBan ? "ban" : "kick"}`}>
          <span aria-hidden="true">{isBan ? "🚫" : "⚡"}</span>
        </div>

        <div className="removalText">
          <h2>{isBan ? "You've been banned" : "You've been kicked"}</h2>
          <p>
            {isBan
              ? "You no longer have access to this community."
              : "You've been removed from this community. You may rejoin later."}
          </p>
        </div>

        <div className="removalCountdownWrapper" aria-label={`Redirecting in ${seconds} seconds`}>
          <svg className="removalCountdownRing" viewBox="0 0 56 56" aria-hidden="true">
            <circle className="removalCountdownTrack" cx="28" cy="28" r={RADIUS} />
            <circle
              className="removalCountdownProgress"
              cx="28"
              cy="28"
              r={RADIUS}
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={dashOffset}
            />
          </svg>
          <span className="removalCountdownNumber">{seconds}</span>
        </div>

        <button className="danger removalLeaveBtn" onClick={onLeave}>
          Leave Now
        </button>
      </div>
    </div>
  );
}
