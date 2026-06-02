import { type SyntheticEvent, useState } from "react";
import useLoginContext from "./useLoginContext.ts";
import useAuth from "./useAuth.ts";
import { updateUser } from "../services/userService.ts";
import type { UserUpdateRequest } from "@gamenite/shared";

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

/**
 * Custom hook to manage profile form logic
 * @returns an object containing
 *  - Form values `display`, `bio`, `password`, and `confirm`
 *  - Form setters `setDisplay`, `setBio`, `setPassword`, and `setConfirm`
 *  - `profilePic` — the current profile picture as a base64 data URL, or null if cleared/absent
 *  - `setProfilePic` — set to null to remove the profile picture
 *  - `handleProfilePicFile` — call with a File to convert and set as the new profile picture
 *  - Possibly-null error message `err`
 *  - Submission handler `handleSubmit`
 */
export default function useEditProfileForm() {
  const { user, reset } = useLoginContext();
  const [display, setDisplay] = useState(user.display);
  const [pronouns, setPronouns] = useState(user.pronouns ?? "");
  const [bio, setBio] = useState(user.bio ?? "");
  const [password, setPassword] = useState("");
  const [profilePic, setProfilePic] = useState<string | null>(user.profilePic ?? null);
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState<null | string>(null);
  const auth = useAuth();

  const handleProfilePicFile = (file: File) => {
    fileToBase64(file)
      .then(setProfilePic)
      .catch(() => setErr("Failed to read image"));
  };

  /**
   * Handles submission of the form
   */
  const handleSubmit = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();

    const savedPic = user.profilePic ?? null;
    const picChanged = profilePic !== savedPic;

    if (
      user.display === display &&
      user.bio === bio &&
      user.pronouns === pronouns &&
      password === confirm &&
      password === "" &&
      !picChanged
    ) {
      setErr("No changes to submit");
      return;
    }

    if (display.trim() !== display) {
      setErr("Display names can't begin or end with whitespace");
      return;
    }

    if (display.trim() === "") {
      setErr("Please enter a display name");
      return;
    }

    if (password.trim() !== password) {
      setErr("Passwords can't begin or end with whitespace");
      return;
    }

    if (password !== confirm) {
      setErr("Passwords don't match");
      return;
    }

    const updates: UserUpdateRequest = {};
    if (display !== user.display) updates.display = display;
    if (bio !== user.bio) updates.bio = bio || undefined; // treat empty as no bio
    if (pronouns !== user.pronouns) updates.pronouns = pronouns || undefined; // treat empty as no pronouns
    if (password !== "") updates.password = password;
    if (picChanged) updates.profilePic = profilePic ?? ""; // null → "" clears the picture
    const response = await updateUser(auth, updates);
    if ("error" in response) {
      setErr(response.error);
      return;
    }

    // We need to do this — or do something else that resets the login context
    reset();
  };

  return {
    display,
    setDisplay,
    bio,
    setBio,
    pronouns,
    setPronouns,
    password,
    setPassword,
    profilePic,
    setProfilePic,
    handleProfilePicFile,
    confirm,
    setConfirm,
    err,
    handleSubmit,
  };
}
