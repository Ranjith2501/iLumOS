import { useState } from "react";
import type { Session } from "./types";
import { createSession } from "./lib/engine";
import { Setup } from "./components/Setup";
import { Workspace } from "./components/Workspace";

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  if (!session) return <Setup onStart={(chart, docs, instr) => setSession(createSession(chart, docs, instr))} />;
  return <Workspace key={session.startedAt} initial={session} onReset={() => setSession(null)} />;
}
