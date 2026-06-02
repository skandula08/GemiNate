import type { SafeUserInfo } from "@gamenite/shared";
import useLoginContext from "../hooks/useLoginContext";
import { NavLink } from "react-router-dom";

interface UserLinkProps {
  user: SafeUserInfo;
  capitalize?: boolean;
}

/**
 * Avatar component to display the user's profile picture.
 * Displays a default profile picture if no picture is provided.
 *
 * @param user - The user data containing the profile picture.
 *
 * @returns The rendered user avatar image.
 */
function Avatar({ user }: { user: SafeUserInfo }) {
  return (
    <img
      src={user.profilePic ?? "/assets/default-pfp.jpg"}
      alt=""
      style={{
        display: "inline",
        width: "20px",
        height: "20px",
        objectFit: "cover",
        borderRadius: "50%",
        verticalAlign: "middle",
        marginRight: "4px",
      }}
    />
  );
}

/**
 * Component for displaying a user link with their avatar and name.
 * If the user is the logged-in user, it shows "You" or "you" (based on the `capitalize` prop),
 * otherwise, it links to the user's profile page.
 *
 * @param user - The user data to display (including username and profile picture).
 * @param capitalize - Optional flag to capitalize the word "You" for the logged-in user (defaults to false).
 *
 * @returns {JSX.Element} The rendered user link or "You" if it’s the logged-in user.
 */
export default function UserLink({ user, capitalize }: UserLinkProps) {
  const loggedInUser = useLoginContext();
  if (user.username === loggedInUser.user.username) {
    return (
      <span style={{ display: "inline-block" }}>
        <Avatar user={user} />
        {capitalize ? "You" : "you"}
      </span>
    );
  }
  return (
    <NavLink to={`/profile/${user.username}`}>
      <Avatar user={user} />
      {user.display}
    </NavLink>
  );
}
