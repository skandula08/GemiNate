import type { CommunityPreview, CommunityRole, CommunityUser } from "@gamenite/shared";
import ChatPanel from "../components/ChatPanel";
import "./Community.css";
import UserLink from "../components/UserLink";
import useLoginContext from "../hooks/useLoginContext";
import useSocketsForCommunity from "../hooks/useSocketsForCommunity";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import useCommunityBanner from "../hooks/useCommunityBanner";
import useAuth from "../hooks/useAuth";
import { createInvite } from "../services/communityService";
import { RemovalNotice } from "../components/RemovalNotice";
import { PromotionToast } from "../components/PromotionToast";

/**
 * The Community component renders the detailed view of a community including
 * its members, chat, ownership controls, and other community actions such as
 * DJ requests, invites, and more.
 *
 * @param community - The community data containing information
 *                                       like name, description, members, etc.
 * @returns The rendered community page displaying the chat panel,
 *                        members list, and options for managing the community.
 */
export function Community(community: CommunityPreview) {
  const { user } = useLoginContext();
  const auth = useAuth();
  const {
    members,
    removalReason,
    promotionRole,
    demotionNotice,
    djRequests,
    djRequestPending,
    djRequestResult,
    joinCommunity,
    transferOwnership,
    makeDJ,
    makeRegularMember,
    kickMember,
    banMember,
    requestDj,
    approveDjRequest,
    denyDjRequest,
    clearDjRequestResult,
  } = useSocketsForCommunity(community.communityId, community.members);

  const banner = useCommunityBanner(community.communityId);
  const navigate = useNavigate();

  const [warnUser, setWarnUser] = useState<CommunityUser | null>(null);
  const [inviteUsername, setInviteUsername] = useState("");
  const [inviteMsg, setInviteMsg] = useState<string | null>(null);
  const [activePromotion, setActivePromotion] = useState<"dj" | "owner" | "demotion" | null>(null);
  const [seenPromotionRole, setSeenPromotionRole] = useState<"dj" | "owner" | null>(null);
  const [seenDemotionNotice, setSeenDemotionNotice] = useState(demotionNotice);

  if (promotionRole !== seenPromotionRole) {
    setSeenPromotionRole(promotionRole);
    if (promotionRole !== null) setActivePromotion(promotionRole);
  }
  if (demotionNotice !== seenDemotionNotice) {
    setSeenDemotionNotice(demotionNotice);
    if (demotionNotice) setActivePromotion("demotion");
  }

  /**
   * Sends an invite to a user to join the community.
   *
   * @returns A promise that resolves when the invite has been sent.
   */
  async function handleSendInvite() {
    if (!inviteUsername.trim()) return;
    const result = await createInvite(auth, community.communityId, inviteUsername.trim());
    if (result && "error" in result) {
      setInviteMsg(`Error: ${result.error}`);
    } else {
      setInviteMsg(`Invite sent to ${inviteUsername.trim()}`);
      setInviteUsername("");
    }
  }

  /**
   * Checks if the current user has joined the community.
   *
   * @returns True if the user is a member of the community, false otherwise.
   */
  function hasJoinedCommunity() {
    return members.some(
      (member) => member.user.username === user.username && member.role !== "kicked",
    );
  }

  /**
   * Gets the username of the community owner.
   *
   * @returns The owner's username, or undefined if no owner is found.
   */
  function getOwner() {
    return members.find((member) => member.role === "owner")?.user.username;
  }

  /**
   * Gets the role of the current user in the community.
   *
   * @returns The current user's role, or null if not a member.
   */
  function getMyRole(): CommunityRole | null {
    return members.find((m) => m.user.username === user.username)?.role ?? null;
  }

  /**
   * Gets the emoji representation of a user's role in the community.
   *
   * @param role - The role of the user (e.g., 'owner', 'dj').
   * @returns A string representing the emoji of the user's role.
   */
  function getRoleEmoji(role: CommunityRole) {
    switch (role) {
      case "owner":
        return "👑";
      case "dj":
        return "🎧";
      default:
        return "";
    }
  }
  // Set the banner image source
  const bannerSrc =
    typeof banner === "string" && banner !== "" ? banner : "/assets/default-banner.jpg";

  return (
    <div className="communityPage">
      {removalReason && (
        <RemovalNotice reason={removalReason} onLeave={() => navigate("/communities")} />
      )}
      {activePromotion && (
        <PromotionToast role={activePromotion} onDismiss={() => setActivePromotion(null)} />
      )}
      <div className="communityHeader">
        <img src={bannerSrc} alt="Community banner" className="communityBanner" />
        <div className="communityBannerOverlay" />
        <div className="communityHeaderContent">
          <div className="communityHeaderText">
            <h1>👥 {community.name}</h1>
            <p className="communityDescription">{community.description}</p>
          </div>
          {getOwner() === user.username && (
            <button
              className="secondary narrow"
              onClick={() => navigate(`/community/edit/${community.communityId}`)}
            >
              Edit Community
            </button>
          )}
        </div>
      </div>

      {hasJoinedCommunity() ? (
        <div className="communityContainer">
          <div className="chatWrapper">
            <ChatPanel chatId={community.chat} />
          </div>

          <div className="membersContainer">
            <h3>Members List</h3>
            {members.map(
              (member) =>
                member.role !== "kicked" &&
                member.role !== "banned" && (
                  <div key={member.user.username} className="memberRow">
                    <div className="memberInfo">
                      <UserLink user={member.user} />
                      {getRoleEmoji(member.role)}
                      {member.user.pronouns && (
                        <small className="memberPronouns">{member.user.pronouns}</small>
                      )}
                    </div>

                    {getOwner() === user.username && member.user.username !== getOwner() && (
                      <div className="memberActions">
                        {member.role !== "dj" ? (
                          <button className="ghost narrow" onClick={() => makeDJ(member)}>
                            Make DJ
                          </button>
                        ) : (
                          <button
                            className="ghost narrow"
                            onClick={() => makeRegularMember(member)}
                          >
                            Remove DJ
                          </button>
                        )}
                        <button className="danger narrow" onClick={() => kickMember(member)}>
                          Kick
                        </button>
                        <button className="danger narrow" onClick={() => banMember(member)}>
                          Ban
                        </button>
                        <button className="danger narrow" onClick={() => setWarnUser(member)}>
                          Make Owner
                        </button>

                        <dialog
                          open={warnUser === member}
                          onClose={() => setWarnUser(null)}
                          className="transferDialog"
                        >
                          <p>
                            WARNING: You are{" "}
                            <span className="transferWarningText">TRANSFERRING OWNERSHIP!</span>
                            <br />
                            Are you sure you want to transfer ownership of this community to{" "}
                            {member.user.display}?
                            <br />
                            You cannot undo this action!
                          </p>
                          <div className="transferDialogActions">
                            <button className="secondary narrow" onClick={() => setWarnUser(null)}>
                              Cancel
                            </button>
                            <button
                              className="danger narrow"
                              onClick={() => transferOwnership(member)}
                            >
                              Transfer
                            </button>
                          </div>
                        </dialog>
                      </div>
                    )}
                  </div>
                ),
            )}
            {getMyRole() === "member" && (
              <div className="djRequestSection">
                {djRequestResult === "denied" && (
                  <small className="djRequestDenied">
                    Your DJ request was denied.{" "}
                    <button className="ghost narrow" onClick={clearDjRequestResult}>
                      Dismiss
                    </button>
                  </small>
                )}
                <button className="primary narrow" onClick={requestDj} disabled={djRequestPending}>
                  {djRequestPending ? "DJ Request Pending..." : "Request DJ"}
                </button>
              </div>
            )}
            {getOwner() === user.username && djRequests.length > 0 && (
              <div className="djRequestsOwnerSection">
                <h4>DJ Requests</h4>
                {djRequests.map((req) => (
                  <div key={req.username} className="djRequestRow">
                    <span className="djRequestName">{req.displayName}</span>
                    <div className="djRequestActions">
                      <button
                        className="secondary narrow"
                        onClick={() => approveDjRequest(req.username)}
                      >
                        Approve
                      </button>
                      <button className="danger narrow" onClick={() => denyDjRequest(req.username)}>
                        Deny
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {getOwner() === user.username && community.isPrivate && (
              <div className="inviteSection">
                <h4>Invite a User</h4>
                <div className="inviteForm">
                  <input
                    type="text"
                    placeholder="Username"
                    value={inviteUsername}
                    onChange={(e) => setInviteUsername(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void handleSendInvite();
                    }}
                  />
                  <button
                    className="primary narrow"
                    onClick={() => void handleSendInvite()}
                    disabled={!inviteUsername.trim()}
                  >
                    Send Invite
                  </button>
                </div>
                {inviteMsg && (
                  <small className={`inviteMsg${inviteMsg?.startsWith("Error:") ? " error" : ""}`}>
                    {inviteMsg}
                  </small>
                )}
              </div>
            )}
          </div>
        </div>
      ) : community.isPrivate ? (
        <div className="joinCommunityContainer">
          <p>This is a private community. You need an invite to join.</p>
        </div>
      ) : (
        <div className="joinCommunityContainer">
          <button className="primary narrow" onClick={() => joinCommunity()}>
            Join Community
          </button>
        </div>
      )}
    </div>
  );
}
