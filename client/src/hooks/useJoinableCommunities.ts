import { useEffect, useState } from "react";
import type { CommunityPreview, ErrorMsg } from "@gamenite/shared";
import { getJoinableCommunties } from "../services/communityService";
import useAuth from "./useAuth";

export default function useJoinableCommunities() {
  const [joinableCommunities, setJoinableCommunities] = useState<CommunityPreview[] | ErrorMsg>([]);
  const auth = useAuth();

  useEffect(() => {
    getJoinableCommunties(auth).then(setJoinableCommunities);
  }, [auth]);

  if (!joinableCommunities) return { message: "Loading..." };
  if ("error" in joinableCommunities) return { message: `Error: ${joinableCommunities.error}` };
  if (joinableCommunities.length === 0) return { message: "No communities found..." };
  return joinableCommunities;
}
