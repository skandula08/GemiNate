import "./Layout.css";
import { useState } from "react";
import { Outlet } from "react-router-dom";
import Header from "./Header.tsx";
import SideBarNav from "./SideBarNav.tsx";
import MusicBar from "./MusicBar.tsx";
import { MusicBarContext } from "../contexts/MusicBarContext.ts";

/**
 * Main component represents the layout of the main page, including a sidebar
 * and the main content area.
 */
export default function Layout() {
  const [communityID, setCommunityID] = useState<string | null>(null);

  return (
    <MusicBarContext.Provider value={{ communityID, setCommunityID }}>
      <div id="main" className="main">
        <Header />
        <SideBarNav />
        <div id="right_main" className="right_main">
          <Outlet />
        </div>
      </div>
      {communityID && <MusicBar key={communityID} communityID={communityID} />}
    </MusicBarContext.Provider>
  );
}
