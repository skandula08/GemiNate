import type { SafeUserInfo } from "@gamenite/shared";
import { useEffect, useState } from "react";
import useTimeSince from "../hooks/useTimeSince";
import { getUserById } from "../services/userService";
import "./Profile.css";

interface ViewProfileProps {
  username: string;
}
export default function ViewProfile({ username }: ViewProfileProps) {
  const [componentState, setComponentState] = useState<
    { type: "waiting" } | { type: "error"; msg: string } | { type: "profile"; user: SafeUserInfo }
  >({ type: "waiting" });
  const timeSince = useTimeSince();

  useEffect(() => {
    let cancel = false;

    getUserById(username)
      .then((response) => {
        if (cancel) return;
        if ("error" in response) {
          setComponentState({ type: "error", msg: response.error });
        } else {
          setComponentState({ type: "profile", user: response });
        }
      })
      .catch((err) => {
        if (cancel) return;
        setComponentState({ type: "error", msg: `${err}` });
      });

    return () => {
      cancel = true;
    };
  }, [username]);

  switch (componentState.type) {
    case "error":
      return <div style={{ color: "#f00" }}>{componentState.msg}</div>;
    case "waiting":
      return <div>Loading...</div>;
    case "profile":
      return (
        <div className="profilePage">
          <div className="profileCard">
            <div className="profileHeader">
              <img
                className="profileAvatar"
                src={componentState.user.profilePic ?? "/assets/default-pfp.jpg"}
                alt="Profile"
              />
              <div className="profileInfo">
                <span className="profileName">{componentState.user.display}</span>
                <span className="profileMeta">@{componentState.user.username}</span>
                {componentState.user.pronouns && (
                  <span className="profileMeta">{componentState.user.pronouns}</span>
                )}
                <span className="profileMeta">
                  Account created {timeSince(componentState.user.createdAt)}
                </span>
                {componentState.user.bio ? (
                  <div className="profileBio">{componentState.user.bio}</div>
                ) : (
                  <em className="profileMeta">No bio</em>
                )}
              </div>
            </div>
          </div>
        </div>
      );
  }
}
