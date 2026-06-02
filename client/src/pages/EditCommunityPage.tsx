import { useParams } from "react-router-dom";
import useMyCommunities from "../hooks/useMyCommunities";
import type { CommunityPreview } from "@gamenite/shared";
import { getCommunityBanner } from "../services/communityService";
import { useEffect, useState } from "react";
import EditCommunityForm from "../components/EditCommunityForm";

/**
 * A component that represents a community page where users can edit community details.
 * It fetches the current user's communities and the banner for the selected community.
 * If the community exists and is found, it renders the community's edit form with the
 * existing details such as the community name, description, and banner.
 *
 * If the community is still loading or not found, it shows a "Loading..." message.
 *
 * @returns A page that either displays the community edit form or a loading message.
 */
export default function CommunityPage() {
  const { communityID } = useParams();
  let myCommunities = useMyCommunities();
  const [banner, setBanner] = useState<string | undefined | null>(null);

  useEffect(() => {
    let ignore = false;
    (async () => {
      // non-nullish assertion is ok here given that Game is only called in a
      // route with `:gameId`
      const banner = await getCommunityBanner(communityID!);
      if (ignore || (banner && typeof banner !== "string")) return;
      setBanner(banner);
    })();
    return () => {
      ignore = true;
    };
  }, [communityID]);

  if (!Array.isArray(myCommunities)) {
    myCommunities = new Array<CommunityPreview>();
  }

  const communityIds = myCommunities
    ? myCommunities.map((communityPreview) => communityPreview.communityId)
    : null;
  if (communityID && myCommunities && communityIds && communityIds.includes(communityID)) {
    const communityPreview = myCommunities.find(
      (community) => community.communityId === communityID,
    );
    if (!(!communityPreview || (banner && typeof banner !== "string") || banner === null))
      return (
        <EditCommunityForm
          {...{
            communityID,
            communityName: communityPreview.name,
            communityDescription: communityPreview.description,
            communityBanner: banner,
          }}
        />
      );
  }
  return <p>Loading...</p>;
}
