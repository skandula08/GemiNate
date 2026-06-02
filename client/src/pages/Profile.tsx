import useLoginContext from "../hooks/useLoginContext.ts";
import { useParams } from "react-router-dom";
import UpdateProfile from "./UpdateProfile.tsx";
import ViewProfile from "./ViewProfile.tsx";

/** Route to the appropriate page based on username */
export default function Profile() {
  const { username } = useParams();
  const { user } = useLoginContext();
  return username && username !== user.username ? (
    <ViewProfile username={username} />
  ) : (
    <UpdateProfile />
  );
}
