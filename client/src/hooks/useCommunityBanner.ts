import { useEffect, useState } from "react";
import type { ErrorMsg } from "@gamenite/shared";
import { getCommunityBanner } from "../services/communityService";

export default function useMyCommunities(
  communityId: string,
): { message: string } | string | undefined {
  const [banner, setBanner] = useState<string | undefined | ErrorMsg>(undefined);

  useEffect(() => {
    getCommunityBanner(communityId).then(setBanner);
  }, [communityId]);

  if (banner && typeof banner !== "string" && "error" in banner)
    return { message: `Error: ${banner.error}` };
  return banner;
}
