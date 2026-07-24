const TEMPLATES = {
  "founder-mvr": {
    name: "Founder/MVR",
    description: "Founder Mode / Minimum Viable Release",
    content: `# CLAUDE.md — Founder / MVR Mode

## Product Rules
- Ship the smallest complete vertical slice that validates the hypothesis.
- No speculative infrastructure. No features "just in case."
- If it takes more than 2 prompts to implement, decompose the task.
- Every prompt must either ship something or unblock something.

## Code Rules
- Prefer copy-paste over abstraction until the 3rd occurrence.
- Use existing project conventions. Do not introduce new patterns.
- No placeholder comments. Ship real code.

## Guidelines
- Ask if the user wants breadth or depth before diving.
- When stuck, state the blocking question clearly.
`,
  },
  "industrial-engineering": {
    name: "Industrial Engineering",
    description: "Systematic, rigorous engineering process",
    content: `# CLAUDE.md — Industrial Engineering Mode

## Process
- Before writing code, produce a short plan.
- State assumptions clearly.
- Prefer exhaustive error handling over optimistic paths.

## Code Standards
- Use explicit types over inferred types.
- One clear responsibility per function.
- Document why, not what.
- Errors must be actionable, not generic.

## Review Checklist
- [ ] Does this change have tests?
- [ ] Are error cases handled?
- [ ] Are secrets avoided in logs/output?
- [ ] Is the diff minimal?
`,
  },
  "frontend-design": {
    name: "Frontend Design",
    description: "UI/UX focused development",
    content: `# CLAUDE.md — Frontend Design Mode

## Design Principles
- Responsive: test at 375px, 768px, 1024px, 1440px.
- Accessible: semantic HTML, keyboard nav, focus indicators.
- Performance: no unnecessary re-renders, oversized assets, or blocking JS.

## Component Guidelines
- Every interactive element has: default, hover, focus, active, disabled, loading, error states.
- Reuse existing design tokens. Do not introduce new colors or spacing.
- Mobile-first CSS. Use container queries over media queries when possible.

## Review
- Check overflow, text wrapping, touch targets, fixed-position overlap.
`,
  },
  "research-analysis": {
    name: "Research/Analysis",
    description: "Deep analysis and research tasks",
    content: `# CLAUDE.md — Research / Analysis Mode

## Approach
- First, restate the question to confirm understanding.
- Present multiple perspectives, not just the most obvious one.
- Cite sources when making factual claims.
- Distinguish between certainty, high confidence, and speculation.

## Output Format
- Prefer structured output: tables, lists, decision trees.
- Provide concrete examples for abstract concepts.
- End with a summary of open questions or next steps.
`,
  },
  minimal: {
    name: "Minimal",
    description: "Empty template, no constraints",
    content: `# CLAUDE.md
`,
  },
};

const _templates = new Map(Object.entries(TEMPLATES));

export function getTemplate(id) {
  const t = _templates.get(id);
  if (!t) throw new Error(`Unknown template: ${id}`);
  return t;
}

export function getTemplateSafe(id) {
  return _templates.get(id) ?? null;
}

export function allTemplates() {
  return Array.from(_templates.entries()).map(([id, t]) => ({ id, ...t }));
}

export function templateChoices() {
  return allTemplates().map((t) => ({
    name: `${t.name.padEnd(20)} ${t.description}`,
    value: t.id,
  }));
}

export async function applyTemplate(templateId, targetPath) {
  const t = getTemplate(templateId);
  const { writeFile, mkdir } = await import("fs/promises");
  const { dirname } = await import("path");

  await mkdir(dirname(targetPath), { recursive: true });
  await writeFile(targetPath, t.content);
  return targetPath;
}
