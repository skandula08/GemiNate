import { useState, type SyntheticEvent } from "react";
import { useNavigate } from "react-router-dom";
import useAuth from "./useAuth";
import { editCommunity } from "../services/communityService";

export default function useEditCommunityForm(
  communityId: string,
  initialName: string,
  initialDescription: string | undefined,
  initialBanner: string | undefined,
) {
  const auth = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [banner, setBanner] = useState(initialBanner);
  const [err, setErr] = useState<string | null>(null);

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleBannerFile = (file: File) => {
    fileToBase64(file)
      .then(setBanner)
      .catch(() => setErr("Failed to read image"));
  };

  const handleSubmit = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();

    const savedBanner = initialBanner ?? undefined;
    const bannerChanged = banner !== savedBanner;

    if (initialName === name && initialDescription === description && !bannerChanged) {
      setErr("No changes to submit");
      return;
    }

    const response = await editCommunity(auth, name, description, banner, communityId);
    if ("error" in response) {
      setErr(response.error ?? "ERROR");
      return;
    }

    navigate(`/community/${communityId}`);
  };

  return {
    name,
    setName,
    description,
    setDescription,
    banner,
    setBanner,
    err,
    handleSubmit,
    handleBannerFile,
  };
}
