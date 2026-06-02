import { useState, useEffect, useRef } from "react";
import useAuth from "./useAuth.ts";
import type { CommunityRole, CommunityUser, DjRequest } from "@gamenite/shared";
import useLoginContext from "./useLoginContext.ts";

export default function useSocketsForCommunity(
  communityId: string,
  initialMembers: CommunityUser[],
) {
  const { socket, user } = useLoginContext();
  const auth = useAuth();
  const [members, setMembers] = useState<CommunityUser[]>(initialMembers);
  const [removalReason, setRemovalReason] = useState<"kicked" | "banned" | null>(null);
  const [promotionRole, setPromotionRole] = useState<"dj" | "owner" | null>(null);
  const [demotionNotice, setDemotionNotice] = useState(false);
  const [djRequests, setDjRequests] = useState<DjRequest[]>([]);
  const [djRequestPending, setDjRequestPending] = useState(false);
  const [djRequestResult, setDjRequestResult] = useState<"accepted" | "denied" | null>(null);
  const prevRoleRef = useRef<CommunityRole | null>(
    initialMembers.find((m) => m.user.username === user.username)?.role ?? null,
  );

  useEffect(() => {
    prevRoleRef.current =
      initialMembers.find((m) => m.user.username === user.username)?.role ?? null;

    function handleMembersUpdated(newMembers: CommunityUser[]) {
      const self = newMembers.find((m) => m.user.username === user.username);
      const newRole = self?.role ?? null;
      const prevRole = prevRoleRef.current;

      if (
        (newRole === "kicked" || newRole === "banned") &&
        prevRole !== null &&
        prevRole !== "kicked" &&
        prevRole !== "banned"
      ) {
        setRemovalReason(newRole);
      }

      if (
        (newRole === "dj" || newRole === "owner") &&
        prevRole !== null &&
        prevRole !== "dj" &&
        prevRole !== "owner"
      ) {
        setPromotionRole(newRole);
      }

      if (prevRole === "dj" && newRole !== "dj" && newRole !== "owner") {
        setPromotionRole(null); // reset so re-promotion fires next time
        setDemotionNotice(true);
      }

      // If we got promoted to DJ, clear the pending request state
      if (newRole === "dj" && prevRole !== "dj") {
        setDjRequestPending(false);
      }

      prevRoleRef.current = newRole;
      setMembers(newMembers);
    }

    function handleDjRequestsUpdated(requests: DjRequest[]) {
      setDjRequests(requests);
      // If our request is no longer in the list, clear pending state
      const hasPending = requests.some((r) => r.username === user.username);
      if (!hasPending) {
        setDjRequestPending(false);
      } else {
        setDjRequestPending(true);
      }
    }

    function handleDjRequestResult(payload: { accepted: boolean }) {
      setDjRequestResult(payload.accepted ? "accepted" : "denied");
    }

    socket.on("communityMembersUpdated", handleMembersUpdated);
    socket.on("communityDjRequestsUpdated", handleDjRequestsUpdated);
    socket.on("communityDjRequestResult", handleDjRequestResult);
    socket.emit("communityPageJoin", { auth, payload: communityId });
    return () => {
      socket.off("communityMembersUpdated", handleMembersUpdated);
      socket.off("communityDjRequestsUpdated", handleDjRequestsUpdated);
      socket.off("communityDjRequestResult", handleDjRequestResult);
      socket.emit("communityPageLeave", { auth, payload: communityId });
    };
  }, [socket, communityId, auth, user, initialMembers]);

  function joinCommunity() {
    socket.emit("communityJoinAsMember", { auth, payload: communityId });
  }

  /** Role management */
  function setRole(role: CommunityRole, member: CommunityUser) {
    socket.emit("communitySetRole", {
      auth,
      payload: { communityId, role, memberUsername: member.user.username },
    });
  }

  function transferOwnership(member: CommunityUser) {
    socket.emit("communityTransferOwnership", {
      auth,
      payload: { communityId, memberUsername: member.user.username },
    });
  }

  function requestDj() {
    socket.emit("communityRequestDj", {
      auth,
      payload: { communityId },
    });
    setDjRequestPending(true);
  }

  function approveDjRequest(requesterUsername: string) {
    socket.emit("communityRespondDjRequest", {
      auth,
      payload: { communityId, requesterUsername, accepted: true },
    });
  }

  function denyDjRequest(requesterUsername: string) {
    socket.emit("communityRespondDjRequest", {
      auth,
      payload: { communityId, requesterUsername, accepted: false },
    });
  }

  function clearDjRequestResult() {
    setDjRequestResult(null);
  }

  const makeDJ = (member: CommunityUser) => setRole("dj", member);
  const makeRegularMember = (member: CommunityUser) => setRole("member", member);
  const kickMember = (member: CommunityUser) => setRole("kicked", member);
  const banMember = (member: CommunityUser) => setRole("banned", member);

  return {
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
  };
}
