import useCreateCommunityForm from "../hooks/useCreateCommunityForm";

/**
 *
 * @returns a editable form to enter the details needed to create a community
 */
export default function CreateCommunityForm() {
  const { name, setName, description, setDescription, isPrivate, setIsPrivate, err, handleSubmit } =
    useCreateCommunityForm();

  return (
    <form className="content spacedSection" onSubmit={handleSubmit}>
      <h2>Create a Community</h2>
      <div className="tightSection">
        <input
          type="text"
          placeholder="Community name"
          value={name}
          className="notTooWide widefill"
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="tightSection">
        <textarea
          className="notTooWide"
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <label>
        <input
          type="checkbox"
          checked={isPrivate}
          onChange={(e) => setIsPrivate(e.target.checked)}
        />{" "}
        Private
      </label>
      {err && <p className="error-message">{err}</p>}
      <div>
        <button type="submit" className="primary narrow">
          Create Community
        </button>
      </div>
    </form>
  );
}
