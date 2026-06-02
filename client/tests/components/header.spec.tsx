import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import Header from "../../src/components/Header.tsx";
import { LoginContext } from "../../src/contexts/LoginContext.ts";
import type { GameSocket } from "../../src/util/types.ts";

const mockedUseNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const mod = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...mod, useNavigate: () => mockedUseNavigate };
});
const mockedReset = vi.fn();

describe("Header component", () => {
  beforeEach(() => {
    mockedUseNavigate.mockReset();
    mockedReset.mockReset();
  });

  it("displays the display name, not the username", () => {
    render(
      <LoginContext
        value={{
          user: { username: "username", display: "displayname", createdAt: new Date("01-02-2025") },
          kind: "password",
          pass: "pwd",
          socket: {} as GameSocket,
          reset: mockedReset,
        }}
      >
        <Header />
      </LoginContext>,
    );

    expect(screen.getByText(/displayname/)).not.toBeNull();
  });

  it("pressing Log Out causes a state reset and navigation", () => {
    render(
      <LoginContext
        value={{
          user: {
            username: "username123",
            display: "displayname",
            createdAt: new Date("01-02-2025"),
          },
          kind: "password",
          pass: "pwd",
          socket: {} as GameSocket,
          reset: mockedReset,
        }}
      >
        <Header />
      </LoginContext>,
    );

    fireEvent.click(screen.getByText(/Log Out/i));
    expect(mockedReset).toHaveBeenCalledOnce();
    expect(mockedUseNavigate).toHaveBeenCalledExactlyOnceWith("/login");
  });

  it("pressing View Profile navigates to the current user profile", () => {
    render(
      <LoginContext
        value={{
          user: {
            username: "username123",
            display: "displayname",
            createdAt: new Date("01-02-2025"),
          },
          kind: "password",
          pass: "pwd",
          socket: {} as GameSocket,
          reset: mockedReset,
        }}
      >
        <Header />
      </LoginContext>,
    );

    fireEvent.click(screen.getByText(/View Profile/i));
    expect(mockedUseNavigate).toHaveBeenCalledExactlyOnceWith("/profile/username123");
  });
});
