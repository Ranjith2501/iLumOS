# iLumos — conversational claim chart refinement (prototype)

A working prototype of the chat-based claim chart refinement experience for iLumos.
An analyst uploads a claim chart and product documents, sets session instructions,
and refines the chart in conversation. Every change arrives as a proposal with
page-and-line citations, and only the analyst applies it. The refined chart
exports to Word.

It runs entirely in the browser. **No API key, no backend, no network calls.**
Uploaded files never leave the tab.

---

## Run it locally

Requires Node 18.18 or newer.

```bash
npm install
npm run dev
```

Open http://localhost:5173, click **Load the demo set**, tick the column-mapping
confirmation, and continue through setup. Then follow [`DEMO_SCRIPT.md`](./DEMO_SCRIPT.md).

To check the production build locally:

```bash
npm run build
npm run preview      # http://localhost:4173
```

## Deploy to Vercel

1. Push this folder to a new GitHub repository:
   ```bash
   git init
   git add .
   git commit -m "iLumos claim chart refinement prototype"
   git branch -M main
   git remote add origin https://github.com/<you>/<repo>.git
   git push -u origin main
   ```
2. In Vercel, choose **Add New → Project** and import the repository.
3. Vercel detects Vite from `vercel.json`. Keep the defaults
   (build `npm run build`, output `dist`) and deploy.

No environment variables are needed. Alternatively, run `npx vercel` from this folder.

---

## What the demo shows

| Requirement | Where to see it |
|---|---|
| Uploading a claim chart and product docs | Setup step 1: drag and drop, or **Load the demo set** |
| Setting system prompts and instructions | Setup step 2, and **Instructions** in the workspace at any time |
| The 3-column claim chart | Right-hand pane: claim element, evidence, reasoning |
| Requesting a refinement in chat | e.g. *"The AI reasoning for the ML algorithm element is weak - add more technical details"* |
| AI responds with specific suggestions | A proposal card: before and after text, citations to page and line, a claim construction note, and what the AI couldn't verify |
| Accept, reject or modify through conversation | Type *Accept*, *Reject, too long*, *Make it more concise*, *Use plain English*… or use the card buttons |
| The updated chart showing changes | The row flashes, previous text is struck through, and a version badge is shown. History tab has the full log |
| Edge cases from the user flow | Wrong citation corrected in chat; undo with preview; no evidence found, then upload or URL capture or mark as gap |
| Export | **Export to Word** runs a pre-export check, then downloads a `.docx` with the chart, a citation appendix and a change log |

## What's real and what's scripted

Being explicit, because it matters for judging the prototype:

**Real.** The parts that carry the product's trust model all actually work.

- **Parsing.** The Word claim chart is parsed with mammoth, and PDFs with pdf.js.
- **Retrieval.** It runs over the documents you uploaded and returns real page and line numbers.
- **Source viewer.** Every citation opens a source viewer at the highlighted line.
- **Honest failure.** If a document isn't uploaded, the proposal that depends on it does not appear. The AI says it can't find support, names what it searched, and offers ways forward.
- **Chart mechanics.** Versioning is append-only, so a revert is itself a version. Undo, dispute flags, gaps, the export check and the Word export are all functional.

**Scripted.** The *wording* of proposals is pre-written for the sample matter, US 123,456 v. Acme SmartTherm Pro, and selected by a rule-based intent engine (`src/lib/engine.ts`). That stands in for an LLM so the demo needs no API key and behaves the same on every run.

If you upload a different claim chart, it parses and displays, and it can be exported. The assistant then tells you that refinements are only wired for the sample matter.

Any message outside the supported commands gets a reply that says what the assistant is scoped to do and suggests the commands it supports. Greetings, thanks and "what can you do" are handled conversationally.

## Assumptions

- **Brand palette.** Navy `#0B1F3F` and orange `#F26B21` are approximated from lumenci.com. I couldn't read their stylesheet directly. Every colour is a variable at the top of `src/styles.css`, so exact brand values can be swapped there.
- **Typefaces.** IBM Plex Sans is used for the interface. IBM Plex Serif is used for claim language and reasoning, so the legal artifact reads differently from the tool around it. Both are self-hosted via `@fontsource`, so the app works offline.
- **Unnamed targets.** If a request names no element, it applies to the row of the open proposal. If no proposal is open, the AI asks one clarifying question with the rows offered as choices.
- **One open proposal.** Only one proposal is open at a time. A new request replaces the open one, which stays visible in the chat but can't be applied.
- **Undo scope.** Undo defaults to the narrowest scope that matches what you said: the last change, or the named row. It is always previewed before anything changes.
- **Corrections are logged.** Corrections and rejections with a reason are recorded as graded events in History. They're the evaluation signal a production version would learn from.

## Project structure

```
src/
  lib/
    engine.ts       conversation engine: intents, proposals, accept/reject/modify,
                    undo, disputes, evidence gaps, export check, scoping replies
    scenarios.ts    proposal content for the sample matter, with variants for tone,
                    length and claim construction notes
    corpus.ts       retrieval over uploaded documents, source ranking
    parse.ts        in-browser PDF / Word / text parsing with page and line tracking
    chart.ts        claim chart table parser, column mapping
    exportDocx.ts   Word export
  components/       Setup, Workspace, ChatPanel, ProposalCard, ChartPanel, Overlays
public/demo-files/  sample claim chart and product documents (fictional)
tools/demo-files/   scripts that generated the demo documents (not needed to run)
```

## Demo documents

All in `public/demo-files/`, and downloadable from the setup screen. They are fictional.

| File | Role |
|---|---|
| `US123456_vs_Acme_SmartTherm_Claim_Chart_DRAFT.docx` | The draft chart: 3 rows, plus Claim 1 text with a fourth element [1d] that has no row |
| `Acme_SmartTherm_Technical_Specifications_AT-SPEC-3200.pdf` | Technical evidence. It covers two models, which sets up the wrong-citation case |
| `Acme_AutoSchedule_Engineering_Whitepaper_AT-WP-07.pdf` | Technical evidence for the machine learning element |
| `Acme_SmartTherm_Pro_Brochure.pdf` | Marketing copy, ranked lowest |
| `Acme_Developer_API_Reference_v3.pdf` | **Held back.** Upload it mid-chat to resolve the "no evidence found" case |

## Known limitations

- The refinement wording is scripted for one sample matter, as described above.
- URL capture is simulated. The only URL it accepts is `https://developer.acme-home.example/api/v3/autoschedule`, served from a bundled snapshot. Other URLs get an honest "can't reach that from this offline build" reply.
- Sessions live in memory. Refreshing the page starts over.
- The JavaScript bundle is about 1.3 MB, almost all of it the PDF parser.
