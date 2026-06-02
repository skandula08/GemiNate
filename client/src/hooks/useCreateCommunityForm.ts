import { useState, type SyntheticEvent } from "react";
import { useNavigate } from "react-router-dom";
import useAuth from "./useAuth";
import { createCommunity } from "../services/communityService";
import { createPlaylistForCommunity } from "../services/musicService";

export default function useCreateCommunityForm() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleSubmit = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();

    const res = await createCommunity(auth, name, description, isPrivate);
    const communityId = `${Object.values(res).at(0)}`;
    await createPlaylistForCommunity(communityId);

    if ("error" in res) {
      setErr(res.error);
      return;
    }

    navigate("/communities");
  };

  return {
    name,
    setName,
    description,
    setDescription,
    isPrivate,
    setIsPrivate,
    err,
    handleSubmit,
  };
}
