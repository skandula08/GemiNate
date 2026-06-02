import { useEffect, useState } from "react";
import type { CommunityPreview, ErrorMsg } from "@gamenite/shared";
import { getMyCommunities } from "../services/communityService";
import useAuth from "./useAuth";

export default function useMyCommunities() {
  const [myCommunities, setMyCommunities] = useState<CommunityPreview[] | ErrorMsg>([]);
  const auth = useAuth();

  useEffect(() => {
    getMyCommunities(auth).then(setMyCommunities);
  }, [auth]);

  if (!myCommunities) return { message: "Loading..." };
  if ("error" in myCommunities) return { message: `Error: ${myCommunities.error}` };
  if (myCommunities.length === 0) return { message: "No communities found..." };
  return myCommunities;
}
