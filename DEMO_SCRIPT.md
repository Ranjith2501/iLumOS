# Demo script

## 1. Setup

1. Click **Load the demo set**. The claim chart and three product PDFs load.
2. Look at the column mapping under the chart, then tick **The column mapping is right**.
   You have to confirm it before continuing, because a mis-mapped evidence column would affect every later suggestion.
3. Optionally change a document's source type with its dropdown. This sets how strongly it ranks as evidence.
4. **Continue → Session instructions.** This is the analyst's system prompt.
   - Try **Plain English** and watch the preview sentence change.
   - **Require my approval for every change** is locked on by design.
   - Typing *"keep reasoning concise"* in Additional instructions makes every proposal shorter.
     The detection chip confirms the app picked it up.
5. **Continue → Start refining.** The AI opens with a diagnosis of the chart before you type anything.

## 2. Core refinement loop

| Type this | What to look for |
|---|---|
| `The AI reasoning for the ML algorithm element is weak - add more technical details` | A proposal card for element 3, sourced from the whitepaper. Click any citation: the source opens at the highlighted line. |
| `Make it more concise` | A revised proposal, revision 2. The citations are unchanged |
| `Use plain English` | The same evidence, with the reasoning rewritten in plain English |
| `Also mention that it runs on the device` | Adds a sentence, plus one new citation for it |
| `Reject, too long` | Rejected with a reason. The retry is shorter, not a reroll |
| `Accept` | Row 3 updates: the old text is struck through, the row flashes, and the chart goes to v2 |
| `Add technical documentation for the motion sensor claim` | Element 2 is upgraded to component-level evidence |
| `Looks good, apply it` | Accepting in your own words works too |

## 3. Edge cases

**Wrong evidence, corrected in chat**

| Type this | What to look for |
|---|---|
| `Strengthen the evidence for element 1` | Confidence is Medium. The "couldn't verify" note says the spec sheet covers two models. Open the citation. |
| `Accept` | Applied. It looks plausible, which is the point of this case |
| `That's the SmartTherm Lite spec, not the Pro` | The AI accepts the correction without arguing and marks element 1 **Disputed**. It saves a session rule, then proposes a corrected version. History logs a wrong-variant event |
| `Accept` | The dispute clears |

**Missing claim element**

| Type this | What to look for |
|---|---|
| `AI missed that Acme also has a temperature sensor array` | A new row for [1d]. The claim construction note flags that the sensors are sold separately |
| `Accept` | The striped "not mapped" row becomes row 4 |

**No evidence found**

| Type this | What to look for |
|---|---|
| `Add evidence that the shipping firmware actually runs this model` | **No supporting evidence found.** The card says what was searched and shows the closest passages. It offers three ways forward |
| Click **Provide a URL**, then paste `https://developer.acme-home.example/api/v3/autoschedule` | A web capture card with the capture date. Nothing is cited until you approve it |
| Click **Approve and use**, then `Accept` | The API evidence is added to element 3, closing the "couldn't verify" gap from earlier |

Alternatives for this case:

- Click **Upload a document**, then **Use the demo file**. This loads the held-back API PDF.
- Click **Mark as evidence gap**. The gap then shows in the export check.

**Undo**

| Type this | What to look for |
|---|---|
| `Undo the last change` | A revert preview. Nothing changes until you click **Confirm revert** |
| `Undo element 3` | A version picker for the row. The preview warns when later changes depend on the version you pick |
| `Show the version history for element 3` | Every version, with its author and time |

## 4. Clarification, scope and legal language

| Type this | What to look for |
|---|---|
| `Strengthen the evidence` (with no proposal open) | One clarifying question, with the rows offered as clickable choices |
| `Rewrite the reasoning to address potential claim construction arguments` | Asks which element, recommending element 3. Then it proposes reasoning written to hold under either reading of "over time" |
| `hi` / `thanks` / `What can you do?` | Conversational replies with next steps |
| `What's the weather in Bangalore?` | States what the assistant is scoped to do and suggests commands |
| `Will we win this case?` | Declines to predict outcomes: that's counsel's call |

## 5. Export

`Export to Word`. The pre-export check lists anything unresolved, with a **Fix** button for each item. To export with open items you have to give a reason, and that reason is recorded in the document. The `.docx` contains:

- the refined chart, with each row's provenance
- open items for counsel
- a citation appendix
- the change log
- the session record

## Other things to try

- Click the **pencil** on any chart row to edit it yourself. If you untick "existing citations still back my wording", the row is labelled analyst-asserted.
- Click the **chat icon** on a row to pin it to your next message.
- Open **Instructions** mid-session and switch the tone. If a proposal is open, the AI offers to redo it.
- Narrow the window below 980px to see the mobile layout, with Chat and Chart tabs.
