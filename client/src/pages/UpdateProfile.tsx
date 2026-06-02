import { useState } from "react";
import useLoginContext from "../hooks/useLoginContext";
import useTimeSince from "../hooks/useTimeSince";
import useEditProfileForm from "../hooks/useEditProfileForm";
import "./Profile.css";

export default function UpdateProfile() {
  const { user } = useLoginContext();
  const timeSince = useTimeSince();
  const [showPass, setShowPass] = useState(false);
  const {
    display,
    setDisplay,
    bio,
    setBio,
    pronouns,
    setPronouns,
    password,
    setPassword,
    confirm,
    setConfirm,
    profilePic,
    setProfilePic,
    handleProfilePicFile,
    err,
    handleSubmit,
  } = useEditProfileForm();
  const [showOtherPronouns, setShowOther] = useState(getDefaultPronounDropdown() === "Other");

  function tryPronouns(value: string) {
    if (value === "Other") {
      setShowOther(true);
      setPronouns("");
    } else {
      setPronouns(value);
      setShowOther(false);
    }
  }

  function getDefaultPronounDropdown(): string {
    const defaultPronouns = ["They/Them", "He/Him", "She/Her", "It/Its", "Ask", "Any/All"];
    if (defaultPronouns.includes(pronouns)) {
      return pronouns;
    } else return "Other";
  }

  return (
    <form className="profilePage" onSubmit={handleSubmit}>
      {/* Card 1: General info — read-only header */}
      <div className="profileCard">
        <div className="profileHeader">
          <img
            className="profileAvatar"
            src={profilePic ?? "/assets/default-pfp.jpg"}
            alt="Profile"
          />
          <div className="profileInfo">
            <span className="profileName">{user.display}</span>
            <span className="profileMeta">@{user.username}</span>
            <span className="profileMeta">Account created {timeSince(user.createdAt)}</span>
          </div>
        </div>
      </div>

      {/* Card 2: Display name */}
      <div className="profileCard profileSection">
        <span className="profileSectionLabel">Display name</span>
        <div className="profileActions">
          <input
            className="widefill notTooWide"
            value={display}
            onChange={(e) => setDisplay(e.target.value)}
          />
          <button
            className="secondary narrow"
            onClick={(e) => {
              e.preventDefault(); // Don't submit form
              setDisplay(user.display);
            }}
          >
            Reset
          </button>
        </div>
      </div>

      {/* Card 3: Bio */}
      <div className="profileCard profileSection">
        <span className="profileSectionLabel">Bio</span>
        <textarea
          className="widefill notTooWide"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
        />
      </div>

      {/* Card 4: Profile picture */}
      <div className="profileCard profileSection">
        <span className="profileSectionLabel">Profile Picture</span>
        <div className="profilePicWrapper">
          <input
            type="file"
            id="profilePicInput"
            style={{ display: "none" }}
            accept="image/png, image/jpeg"
            onChange={(e) => {
              if (e.target.files?.[0]) handleProfilePicFile(e.target.files[0]);
            }}
          />
          <div className="profileActions">
            <button
              className="secondary narrow"
              type="button"
              onClick={() => document.getElementById("profilePicInput")?.click()}
            >
              Upload Profile Picture
            </button>
            <button className="secondary narrow" type="button" onClick={() => setProfilePic(null)}>
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Card 5: Pronouns */}
      <div className="profileCard profileSection">
        <span className="profileSectionLabel">Pronouns</span>
        <div className="profileActions">
          {showOtherPronouns && (
            <textarea
              className="pronounInput"
              rows={1}
              value={pronouns}
              onChange={(e) => setPronouns(e.target.value)}
            />
          )}
          <select
            name="pronouns"
            defaultValue={getDefaultPronounDropdown()}
            id="pronouns"
            onChange={(e) => tryPronouns(e.target.value)}
          >
            <option value="They/Them">They/Them</option>
            <option value="He/Him">He/Him</option>
            <option value="She/Her">She/Her</option>
            <option value="It/Its">It/Its</option>
            <option value="Ask">Ask</option>
            <option value="Any/All">Any/All</option>
            <option value="Other">Other</option>
          </select>
        </div>
      </div>

      {/* Card 6: Password reset */}
      <div className="profileCard profileSection">
        <span className="profileSectionLabel">Reset password</span>
        <div className="profileActions">
          <input
            type={showPass ? "input" : "password"}
            className="widefill notTooWide"
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            className="secondary narrow"
            onClick={(e) => {
              e.preventDefault(); // Don't submit form
              setPassword("");
              setConfirm("");
            }}
          >
            Reset
          </button>
          <button
            className="secondary narrow"
            aria-label="Toggle show password"
            onClick={(e) => {
              e.preventDefault(); // Don't submit form
              setShowPass((v) => !v);
            }}
          >
            {showPass ? "Hide" : "Reveal"}
          </button>
        </div>
        <div className="profileActions">
          <input
            type={showPass ? "input" : "password"}
            className="widefill notTooWide"
            placeholder="Confirm new password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
      </div>

      {err && <p className="error-message">{err}</p>}
      <div className="profileActions">
        <button className="primary narrow">Submit</button>
      </div>
      <div className="smallAndGray">After updating your profile, you will be logged out</div>
    </form>
  );
}
