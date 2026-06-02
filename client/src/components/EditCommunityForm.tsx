import useEditCommunityForm from "../hooks/useEditCommunityForm";
import { useNavigate } from "react-router-dom";
import "./CommunitySummaryView.css";

/**
 *
 * @param community the parameter is the community object that contains the elements that need to be changed
 * @returns a form to change various details of a community
 */
export default function EditCommunityForm({
  communityID,
  communityName,
  communityDescription,
  communityBanner,
}: {
  communityID: string;
  communityName: string;
  communityDescription: string | undefined;
  communityBanner: string | undefined;
}) {
  const navigate = useNavigate();
  const {
    name,
    setName,
    description,
    setDescription,
    banner,
    setBanner,
    err,
    handleSubmit,
    handleBannerFile,
  } = useEditCommunityForm(communityID, communityName, communityDescription, communityBanner);

  return (
    <form className="content spacedSection" onSubmit={handleSubmit}>
      <h2>Edit Community</h2>
      <div className="tightSection">
        <p>Enter new name:</p>
        <input
          type="text"
          placeholder={name}
          value={name}
          className="notTooWide widefill"
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="tightSection">
        <p>Enter new description:</p>
        <textarea
          className="notTooWide"
          placeholder={description}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <p>Select new banner:</p>
      <input
        type="file"
        id="bannerInput"
        style={{ display: "none" }}
        accept="image/png, image/jpeg"
        onChange={(e) => {
          if (e.target.files?.[0]) handleBannerFile(e.target.files[0]);
        }}
      />
      <div>
        <img
          src={banner === undefined || banner === "" ? "/assets/default-banner.jpg" : banner}
          alt="banner"
          className="bannerEdit"
          style={{
            width: "450px",
            height: "150px",
            objectFit: "cover",
          }}
        />
        <small>For best results, choose an image with a 3:1 aspect ratio.</small>
        <br />
        <button
          className="secondary narrow"
          type="button"
          onClick={() => document.getElementById("bannerInput")?.click()}
        >
          Upload Banner
        </button>{" "}
        <button className="secondary narrow" type="button" onClick={() => setBanner(undefined)}>
          Reset
        </button>
      </div>
      {err && <p className="error-message">{err}</p>}
      <div>
        <button type="submit" className="primary narrow">
          Save Changes
        </button>{" "}
        <button className="primary narrow" onClick={() => navigate(`/community/${communityID}`)}>
          Cancel
        </button>
      </div>
    </form>
  );
}
