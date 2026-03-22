import { useEffect, useRef } from "react";
import { mountExperience } from "./experience/mountExperience";

export default function App() {
  const hostRef = useRef(null);

  useEffect(() => {
    if (!hostRef.current) return undefined;
    let unmount = () => {};
    let cancelled = false;
    mountExperience(hostRef.current).then((api) => {
      if (cancelled) api.cleanup();
      else unmount = api.cleanup;
    });
    return () => {
      cancelled = true;
      unmount();
    };
  }, []);

  return <div ref={hostRef} className="game-shell" style={{ width: "100vw", height: "100vh", position: "relative" }} />;
}

