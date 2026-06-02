import { useParams } from "react-router-dom";
import { useContext, useEffect } from "react";
import CommunityNotFound from "./CommunityNotFound";
import { Community } from "./Community";
import useMyCommunities from "../hooks/useMyCommunities";
import useJoinableCommunities from "../hooks/useJoinableCommunities";
import type { CommunityPreview } from "@gamenite/shared";
import { MusicBarContext } from "../contexts/MusicBarContext";

/**
 * A component that represents a community page. It fetches the current user's communities
 * (both their own and the ones they can join) and validates whether the community ID
 * passed in the URL exists. If valid, it displays the community's details; otherwise,
 * it shows a "Community Not Found" message.
 *
 * The component also updates the persistent music bar with the selected community ID.
 *
 * @returns A page that either displays the community page or a "Community Not Found" message.
 */
export default function CommunityPage() {
  const { communityID } = useParams();
  const { setCommunityID } = useContext(MusicBarContext);
  let myCommunities = useMyCommunities();
  let joinableCommunities = useJoinableCommunities();

  if (!Array.isArray(myCommunities)) {
    myCommunities = new Array<CommunityPreview>();
  }
  if (!Array.isArray(joinableCommunities)) {
    joinableCommunities = new Array<CommunityPreview>();
  }

  const communities = [...myCommunities, ...joinableCommunities];

  const communityIds = communities
    ? communities.map((communityPreview) => communityPreview.communityId)
    : null;

  const isValid = communityID && communities && communityIds && communityIds.includes(communityID);

  // Update the persistent music bar with the current community ID
  useEffect(() => {
    if (isValid) {
      setCommunityID(communityID);
    }
  }, [communityID, isValid, setCommunityID]);

  if (isValid) {
    return <Community {...communities[communityIds.findIndex((id) => id === communityID, 0)]} />;
  } else
    return (
      <div>
        <CommunityNotFound />
      </div>
    );
}
