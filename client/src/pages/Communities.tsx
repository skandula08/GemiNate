import "./Communities.css";
import useMyCommunities from "../hooks/useMyCommunities";
import useJoinableCommunities from "../hooks/useJoinableCommunities";
import usePendingInvites from "../hooks/usePendingInvites";
import CommunitySummaryView from "../components/CommunitySummaryView";
import { useNavigate } from "react-router-dom";
import { acceptInvite, declineInvite } from "../services/communityService";
import useAuth from "../hooks/useAuth";
import { useState } from "react";

/**
 * The Communities component handles the display of the user's communities,
 * pending invitations, and joinable communities. It allows the user to
 * accept or decline community invitations and navigate to create a new community.
 *
 * @returns The rendered Communities page with sections for pending invites, my communities, and joinable communities.
 */
export default function Communities() {
  const myCommunities = useMyCommunities();
  const joinableCommunities = useJoinableCommunities();
  const pendingInvites = usePendingInvites();
  const navigate = useNavigate();
  const auth = useAuth();
  const [inviteError, setInviteError] = useState<string | null>(null);

  async function handleAccept(inviteId: string) {
    const result = await acceptInvite(auth, inviteId);
    if (result && "error" in result) {
      setInviteError(result.error);
    } else {
      navigate(0);
    }
  }

  async function handleDecline(inviteId: string) {
    const result = await declineInvite(auth, inviteId);
    if (result && "error" in result) {
      setInviteError(result.error);
    } else {
      navigate(0);
    }
  }

  const hasPendingInvites = !("error" in pendingInvites) && pendingInvites.length > 0;

  return (
    <div className="content">
      <div className="spacedSection">
        <h1>Communities</h1>
        <div>
          <button className="primary narrow" onClick={() => navigate("/communities/new")}>
            Create New Community
          </button>
        </div>

        {hasPendingInvites && (
          <>
            <h2>Pending Invites</h2>
            {inviteError && <p className="error-message">{inviteError}</p>}
            <div className="dottedList" role="list">
              {pendingInvites.map((invite) => (
                <div key={invite.inviteId} className="inviteRow" role="listitem">
                  <div className="inviteInfo">
                    <span>
                      <strong>{invite.communityName}</strong> — invited by{" "}
                      <strong>{invite.inviterUsername}</strong>
                    </span>
                    <span className="inviteMeta">
                      Expires {new Date(invite.expiresAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="inviteActions">
                    <button
                      className="secondary narrow"
                      onClick={() => void handleAccept(invite.inviteId)}
                    >
                      Accept
                    </button>
                    <button
                      className="ghost narrow"
                      onClick={() => void handleDecline(invite.inviteId)}
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <h2>My Communities</h2>
        <div className="dottedList" role="list">
          {"message" in myCommunities
            ? myCommunities.message
            : myCommunities.map((community) => (
                <CommunitySummaryView {...community} key={community.communityId} />
              ))}
        </div>
        <h2>Joinable Communities</h2>
        <div className="dottedList" role="list">
          {"message" in joinableCommunities
            ? joinableCommunities.message
            : joinableCommunities.map((community) => (
                <CommunitySummaryView {...community} key={community.communityId} />
              ))}
        </div>
      </div>
    </div>
  );
}
