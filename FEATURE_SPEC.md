# Resona — Feature Spec v1.0

## Product Context

Resona is an AI-powered UX research document generator. Users input a problem statement and industry, and the app generates a structured research document with multiple sections. The editor allows rich text editing, section reordering, and an "Ask AI" assistant.

**Current Stack:** React 18 + Vite + TypeScript | Supabase (Postgres + Auth + Edge Functions) | TipTap v3 | Tailwind + shadcn/ui  
**AI Model:** google/gemini-3-flash-preview via Lovable AI Gateway  
**Key Files:**
- AI prompts: `supabase/functions/generate-document/index.ts` (lines 9-105: section lists, lines 177-225: system prompt)
- AI Q&A: `supabase/functions/ask-ai/index.ts` (lines 46-72)
- Document analysis: `supabase/functions/analyze-document/index.ts` (lines 230-269)
- Editor: `src/pages/DocumentView.tsx` (745 lines — main editor)
- Rich text: `src/components/RichTextEditor.tsx` (TipTap with StarterKit)
- Auth: `src/contexts/AuthContext.tsx`
- DB tables: `projects` and `sections`

---

## Priority 1: Improve AI Content Quality

### 1.1 Section-Aware Context Chaining

**Problem:** Each section is generated independently — the Design Implications section doesn't reference the specific findings from Conversion Funnel Analysis or User Personas, leading to generic, disconnected content.

**Solution:** When generating content via `generate-document`, modify the prompt to include a sequential context chain.

**Implementation:**
- In `supabase/functions/generate-document/index.ts`, change the generation flow from a single batch call to a sequential generation where each section receives a summary of all previously generated sections.
- Alternative (simpler): Keep the single batch call but restructure the system prompt to explicitly instruct the model: "Each section MUST reference specific data points, metrics, and findings from earlier sections. For example, Design Implications must cite the specific abandonment rates from the Conversion Funnel Analysis and the pain points from User Personas."
- Add a `context_summary` field to the prompt that includes the problem statement, industry, and any user-uploaded document analysis.

**Acceptance Criteria:**
- Generated sections reference specific data from earlier sections (not generic placeholders).
- Design Implications references findings from Research Findings and User Personas by name.
- Competitive Benchmarking references metrics from Market Analysis.

---

### 1.2 Per-Section Regeneration with User Instructions

**Problem:** Users cannot regenerate a single section. If one section is weak, they have no way to improve it without manually rewriting.

**Solution:** Add a "Regenerate" button to each section with an optional instruction input.

**Implementation:**
- Add a regenerate button (icon: RefreshCw from lucide-react) to each section header in `DocumentView.tsx`.
- When clicked, show a small popover/dialog with:
  - A text input: "How should this section be improved?" (optional)
  - A "Regenerate" button
- Create a new Supabase Edge Function `regenerate-section` (or extend `ask-ai`) that:
  - Receives: section title, current content, user instruction, full document context (all other sections' content)
  - Returns: new HTML content for that section only
  - System prompt: "You are rewriting the '{section_title}' section of a UX research document. Consider the full document context provided. {user_instruction}. Return only the HTML content for this section."
- On response, replace the section content in the TipTap editor and save to DB.

**Acceptance Criteria:**
- Each section has a visible regenerate button.
- Users can optionally provide instructions like "make this more data-driven" or "add specific metrics."
- Regenerated content takes into account the rest of the document.
- The regeneration replaces only the targeted section, not the entire document.

---

### 1.3 Improved System Prompts for Research-Grade Output

**Problem:** Generated content tends to be generic and surface-level, lacking specific metrics, citations, and actionable insights.

**Solution:** Overhaul the system prompt in `generate-document/index.ts`.

**Implementation:**
Update the system prompt (lines 177-225) to include these instructions:
- "Generate content at the depth of a professional UX research consultant's deliverable."
- "Include specific, realistic metrics and benchmarks relevant to the {industry} industry."
- "Each section must contain at least one actionable insight or specific recommendation."
- "Use precise language — replace vague phrases like 'significant improvement' with specific targets like 'reduce abandonment from 68% to below 45%.'"
- "For User Personas, include demographic details, behavioral patterns, device preferences, and direct quotes that represent the persona's internal monologue."
- "For Competitive Benchmarking, reference real-world companies and their known approaches (e.g., Amazon's 1-Click, Shopify's accelerated checkout)."
- "For Research Methodology, specify exact methods (e.g., 'moderated usability testing with 12 participants' not 'user testing')."

Also increase `max_tokens` from 6000 to 8000 to allow for richer content.

**Acceptance Criteria:**
- Generated content includes specific metrics, not generic placeholders.
- User Personas feel like real people with specific behaviors.
- Competitive Benchmarking references actual companies and strategies.
- Research Methodology specifies concrete methods and sample sizes.

---

## Priority 2: Improve Editor UI/UX

### 2.1 Section Completion Indicators

**Problem:** The sidebar shows all sections but gives no visual feedback on which sections have content and which are empty.

**Solution:** Add completion indicators to sidebar items.

**Implementation:**
- In the sidebar section list within `DocumentView.tsx` (around lines 628-650), add a visual indicator next to each section title:
  - Green checkmark icon (Check from lucide-react) if `section.content` is non-empty and has more than just empty HTML tags.
  - Gray circle/dot if section is empty or has only placeholder content.
  - Optional: Show a small word count badge (e.g., "~450 words") on hover.
- Add a progress summary at the top of the sidebar: "12/16 sections complete."

**Acceptance Criteria:**
- Each sidebar section shows a clear filled/empty indicator.
- Progress count is visible at the top of the sidebar.
- Indicators update in real-time as content is added or removed.

---

### 2.2 Enhanced Rich Text Editor

**Problem:** The current TipTap setup is minimal — only Bold, Italic, H2, H3, Bullet List, Ordered List. No keyboard shortcuts, no slash commands, limited formatting options.

**Solution:** Extend the TipTap editor in `RichTextEditor.tsx`.

**Implementation:**
- Add TipTap extensions:
  - `@tiptap/extension-placeholder` — show placeholder text like "Start writing or use Ask AI to generate content..."
  - `@tiptap/extension-highlight` — for text highlighting
  - `@tiptap/extension-link` — for adding hyperlinks
  - `@tiptap/extension-underline` — for underline formatting
  - `@tiptap/extension-text-align` — for text alignment
- Add keyboard shortcuts display (tooltip on toolbar buttons showing shortcuts like Ctrl+B).
- Add a slash command menu:
  - Type "/" to open a floating command menu.
  - Options: Heading 2, Heading 3, Bullet List, Ordered List, Blockquote, Divider, Ask AI.
  - Use `@tiptap/suggestion` extension for the slash command trigger.
- Improve toolbar styling to match modern editors (grouped buttons with separators).

**Acceptance Criteria:**
- Placeholder text appears in empty sections.
- Slash commands work when typing "/" in the editor.
- Keyboard shortcuts are shown as tooltips on toolbar buttons.
- New formatting options (highlight, link, underline, alignment) are available.

---

### 2.3 Improved Section Navigation and Sidebar

**Problem:** With 16 sections, the sidebar can feel overwhelming. Section names are truncated.

**Solution:** Improve sidebar UX.

**Implementation:**
- Add collapsible section groups (e.g., "Research" group containing Research Objectives, Methodology, Findings; "Analysis" group containing Funnel Analysis, Market Analysis, etc.).
- Show a preview snippet (first ~50 characters of content) under each section title in the sidebar.
- Add smooth scroll-to-section behavior when clicking a sidebar item.
- Highlight the currently active/visible section in the sidebar as the user scrolls.
- Add a search/filter input at the top of the sidebar to quickly find sections.

**Acceptance Criteria:**
- Clicking a section in the sidebar smoothly scrolls to that section.
- The active section is highlighted in the sidebar during scroll.
- Optional: Section groups can be collapsed/expanded.

---

## Implementation Order

1. **1.3** — Improved system prompts (quick win, highest impact on content quality)
2. **2.1** — Section completion indicators (quick win, improves editor usability)
3. **1.1** — Section-aware context chaining (medium effort, big quality improvement)
4. **1.2** — Per-section regeneration (medium effort, key user feature)
5. **2.2** — Enhanced rich text editor (medium effort, polishes the editor)
6. **2.3** — Improved sidebar navigation (lower priority, nice-to-have)

---

## Notes for Claude Code

- Always run `npm run dev` to test changes locally before committing.
- Supabase Edge Functions are in `supabase/functions/` — test with `supabase functions serve` if Supabase CLI is installed, or deploy directly.
- The TipTap editor instance is created per-section in `DocumentView.tsx` — changes to editor config should be in `RichTextEditor.tsx`.
- The sidebar drag-and-drop already uses `@dnd-kit` — don't introduce a second DnD library.
- Content is stored as raw HTML in the `sections.content` column.
- All AI calls go through the Lovable AI Gateway at `https://ai.gateway.lovable.dev/v1/chat/completions`.
- Environment variables are in `.env` (not committed) — Supabase URL and anon key are needed.
