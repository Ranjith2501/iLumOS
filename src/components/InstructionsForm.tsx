import { Lock } from "lucide-react";
import type { Instructions } from "../types";
import { SOURCE_LABEL, SOURCE_RANK } from "../lib/corpus";
import { wantsConcise } from "../lib/engine";

const EXAMPLE = "This chart supports a litigation funding memo. Keep reasoning concise and cite page and line for every quote.";

const PREVIEW = {
  formal: "Auto-Schedule is a gradient-boosted decision tree regressor, which is a supervised machine learning algorithm. Its training target is the setpoint the occupant selects by hand, so what the model learns is the user’s temperature preference.",
  plain: "Auto-Schedule is a real machine learning model, not a fixed scheduling rule. It’s trained on the temperatures the user sets by hand, and those settings are the user’s preferences.",
};

export function InstructionsForm({ value, onChange }: { value: Instructions; onChange: (v: Instructions) => void }) {
  const set = <K extends keyof Instructions>(k: K, v: Instructions[K]) => onChange({ ...value, [k]: v });
  const concise = wantsConcise(value.custom);
  return (
    <>
      <div className="form-grid">
        <div className="field">
          <span className="field__label">Reasoning style</span>
          <div className="segmented" role="group" aria-label="Reasoning style">
            <button type="button" aria-pressed={value.tone === "formal"} onClick={() => set("tone", "formal")}>Formal legal</button>
            <button type="button" aria-pressed={value.tone === "plain"} onClick={() => set("tone", "plain")}>Plain English</button>
          </div>
          <p className="field__hint">How proposed reasoning reads. Example for element 3:</p>
          <p className="preview-quote">{PREVIEW[value.tone]}</p>
        </div>

        <div className="field" style={{ alignContent: "start", gap: 18 }}>
          <div className="toggle-row">
            <div>
              <span className="field__label">Flag claim construction risks</span>
              <p>Each proposal names the argument opposing counsel is most likely to make against it.</p>
            </div>
            <label className="switch">
              <input type="checkbox" checked={value.flagClaimConstruction} onChange={(e) => set("flagClaimConstruction", e.target.checked)} aria-label="Flag claim construction risks" />
              <span />
            </label>
          </div>
          <div className="toggle-row">
            <div>
              <span className="field__label">Require my approval for every change</span>
              <p>The AI proposes; only you change the chart. You sign this document, so nothing reaches it unread.</p>
              <span className="locked"><Lock /> Always on in this product</span>
            </div>
            <label className="switch">
              <input type="checkbox" checked disabled aria-label="Require approval for every change (always on)" />
              <span />
            </label>
          </div>
        </div>
      </div>

      <div className="form-grid">
        <div className="field">
          <span className="field__label">Evidence ranking</span>
          <p className="field__hint">When sources disagree or overlap, the AI cites the stronger class first. Marketing copy is used only as supporting context.</p>
          <ol className="rank">
            {SOURCE_RANK.map((c) => <li key={c}>{SOURCE_LABEL[c]}</li>)}
          </ol>
        </div>
        <div className="field">
          <label className="field__label" htmlFor="custom-instr">Additional instructions</label>
          <textarea
            id="custom-instr"
            className="text"
            value={value.custom}
            placeholder="Anything the AI should keep in mind for this matter."
            onChange={(e) => set("custom", e.target.value)}
          />
          <div className="detected">
            {value.custom.trim() === "" ? (
              <button type="button" className="linkish" onClick={() => set("custom", EXAMPLE)}>Insert an example</button>
            ) : concise ? (
              <>Applied in this demo: <span className="pill pill--neutral">Concise reasoning</span></>
            ) : (
              <>Pinned to the session. This demo build acts on requests for concise reasoning.</>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
