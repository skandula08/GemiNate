import useLoginContext from "../hooks/useLoginContext.ts";
import "./Header.css";
import { useNavigate } from "react-router-dom";

/**
 * Header component that renders the main title.
 */
export default function Header() {
  const { user, reset } = useLoginContext();
  const navigate = useNavigate();

  return (
    <div style={{ color: "white" }} id="header" className="header">
      <div className="titular">GemiNate ♊</div>
      signed in as {user.display}
      <button className="narrowcenter" onClick={() => navigate(`/profile/${user.username}`)}>
        View Profile
      </button>
      <button
        className="narrowcenter"
        onClick={() => {
          reset();
          navigate("/login");
        }}
      >
        Log Out
      </button>
    </div>
  );
}
