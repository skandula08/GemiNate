import useLoginForm from "../hooks/useLoginForm.ts";
import "./Login.css";
import { useState } from "react";
import { type AuthContext } from "../contexts/LoginContext.ts";

interface LoginProps {
  setAuth: (s: AuthContext | null) => void;
}

/**
 * Renders a login form with username and password inputs, password visibility toggle,
 * and error handling.
 */
export default function Login({ setAuth }: LoginProps) {
  const { mode, username, password, confirm, err, handleInputChange, handleSubmit, toggleMode } =
    useLoginForm(setAuth);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div>
      <div className="container">
        {/* <div className="starDrift" /> */}
        <section className="shootingStars">
          <span className="meteor"></span>
          <span className="meteor"></span>
          <span className="meteor"></span>
          <span className="meteor"></span>
          <span className="meteor"></span>
          <span className="meteor"></span>
          <span className="meteor"></span>
          <span className="meteor"></span>
          <span className="meteor"></span>
          <span className="meteor"></span>
        </section>
        <div className="frame">
          <div className="glow" />
        </div>
        <h1 className="titular">GemiNate ♊</h1>
        <div className="wrapper">
          <form className="login" onSubmit={(e) => handleSubmit(e)}>
            <h2 className="login-header">Log into GemiNate</h2>
            <input
              type="text"
              value={username}
              onChange={(event) => handleInputChange(event, "username")}
              placeholder="Username"
              aria-label="Username"
              className="widefill"
            />
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => handleInputChange(event, "password")}
              placeholder="Password"
              aria-label="Password"
              className="widefill"
            />
            {mode === "signup" && (
              <input
                type={showPassword ? "text" : "password"}
                value={confirm}
                onChange={(event) => handleInputChange(event, "confirm")}
                placeholder="Confirm Password"
                aria-label="Confirm Password"
                className="widefill"
              />
            )}
            <div className="labeled-section">
              <input
                type="checkbox"
                id="showPasswordToggle"
                checked={showPassword}
                onChange={() => setShowPassword((prevShowPassword) => !prevShowPassword)}
              />
              <label htmlFor="showPasswordToggle">Show Password</label>
            </div>
            {err && <p className="error-message centered">{err}</p>}
            <button type="submit" className="widefill primary">
              {mode === "signup" ? "Sign Up" : "Log In"}
            </button>
            <div className="intertext">or</div>
            <button
              className="narrowcenter secondary"
              onClick={(e) => {
                e.preventDefault();
                toggleMode();
              }}
            >
              {mode === "signup" ? "Use Existing Account" : "Create New Account"}
            </button>
            <div className="intertext">or</div>
            <a href="/api/auth/google" className="btn-google widefill">
              Sign in with Google
            </a>
          </form>
        </div>
        <div className="smallAndGray" style={{ marginTop: "1rem" }}>
          GemiNate stores passwords in cleartext;
          <br />
          Reusing passwords here is a catastrophically bad idea
        </div>
      </div>
    </div>
  );
}
