import { useEffect, useState } from "react";
import type { CommunityInvite, ErrorMsg } from "@gamenite/shared";
import { getMyInvites } from "../services/communityService";
import useAuth from "./useAuth";

export default function usePendingInvites(): CommunityInvite[] | ErrorMsg {
  const [invites, setInvites] = useState<CommunityInvite[] | ErrorMsg>([]);
  const auth = useAuth();

  useEffect(() => {
    getMyInvites(auth).then((result) => {
      if (result !== undefined) setInvites(result);
    });
  }, [auth]);

  return invites;
}
