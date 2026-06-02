import "./CommunitySummaryView.css";
import type { CommunityPreview } from "@gamenite/shared";
import { NavLink } from "react-router-dom";

/**
 * Summarizes information for a single community as part of a list of communities
 */
export default function CommunitySummaryView({
  communityId,
  name,
  memberCount,
  description,
}: CommunityPreview) {
  return (
    <div className="communitySummary" role="listitem">
      <div className="memberCount">{`${memberCount} ${memberCount === 1 ? "member" : "members"}`}</div>
      <NavLink to={`/community/${communityId}`} className="communityName">
        {name}
      </NavLink>
      <div className="communityDescription" title={description ?? ""}>
        {description ?? ""}
      </div>
    </div>
  );
}
