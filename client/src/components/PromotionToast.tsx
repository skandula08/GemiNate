import { useState, useEffect } from "react";
import "./PromotionToast.css";

interface Props {
  role: "dj" | "owner" | "demotion";
  onDismiss: () => void;
}

const DURATION = 4000;
const EXIT_LEAD = 300;

/**
 * PromotionToast component displays a toast notification informing the user of role changes.
 * The toast automatically dismisses after a set duration and provides feedback based on the user's new role.
 *
 * @param {Object} props - Component properties.
 * @param {"dj" | "owner" | "demotion"} props.role - The role that the user has been assigned (DJ, Owner, or Demotion).
 * @param {Function} props.onDismiss - A callback function to be called when the toast is dismissed.
 *
 * @returns {JSX.Element} The rendered PromotionToast component.
 */

export function PromotionToast({ role, onDismiss }: Props) {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    // Set a timer to trigger the toast exit animation before dismissal
    const exitTimer = setTimeout(() => setExiting(true), DURATION - EXIT_LEAD);
    const dismissTimer = setTimeout(onDismiss, DURATION); // Dismiss toast after the total duration
    return () => {
      clearTimeout(exitTimer);
      clearTimeout(dismissTimer);
    };
  }, [onDismiss]);

  // Determine the content for the toast based on the role
  const content = {
    dj: {
      emoji: "🎧",
      heading: "You're now a DJ",
      subtext: "You can manage the community jukebox queue.",
    },
    owner: {
      emoji: "👑",
      heading: "You're the new owner",
      subtext: "You now have full control of this community.",
    },
    demotion: {
      emoji: "🎧",
      heading: "You're no longer a DJ",
      subtext: "Your DJ role has been removed.",
    },
  }[role];

  return (
    <div
      className={`promotionToast${exiting ? " exiting" : ""}${role === "demotion" ? " demotion" : ""}`}
      role="status"
      aria-live="polite"
    >
      <div className="promotionToastBadge" aria-hidden="true">
        {content.emoji}
      </div>
      <div className="promotionToastContent">
        <strong>{content.heading}</strong>
        <span>{content.subtext}</span>
      </div>
      <div className="promotionToastProgress" aria-hidden="true" />
    </div>
  );
}
