import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { type AuthContext } from "../contexts/LoginContext.ts";
import { getUserById } from "../services/userService.ts";

interface GoogleCallbackProps {
  setAuth: (auth: AuthContext | null) => void;
}

/**
 * Handles the redirect back from Google OAuth.
 * Reads `?token=` and `?username=` from the URL, fetches the user's profile,
 * sets the auth context, and navigates to the home page.
 */
export default function GoogleCallback({ setAuth }: GoogleCallbackProps) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const token = searchParams.get("token");
    const username = searchParams.get("username");

    if (!token || !username) {
      navigate("/login");
      return;
    }

    getUserById(username)
      .then((user) => {
        if ("error" in user) {
          navigate("/login");
          return;
        }
        setAuth({
          kind: "google",
          user,
          sessionToken: token,
          reset: () => setAuth(null),
        });
        navigate("/");
      })
      .catch(() => navigate("/login"));
  }, [searchParams, navigate, setAuth]);

  return <p>Signing you in...</p>;
}
