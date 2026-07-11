---
name: ux-ui-design
description: Use when evaluating UX/UI design decisions, visual hierarchy, layout, navigation, interaction patterns, responsive behavior, brand placement, accessibility, and design-system consistency.
---

# UX/UI Design

Use this skill to analyze product UI decisions before implementing visual changes.

## Review Lens

Evaluate proposals through these constraints, in order:

1. User task priority: primary actions and game-critical information must remain visually dominant.
2. Visual hierarchy: branding should support orientation without competing with controls, cards, status, or alerts.
3. Spatial economy: persistent chrome should be compact during focused interaction.
4. Consistency: reuse existing visual language, spacing, typography, surfaces, and icon style before introducing new patterns.
5. State clarity: the user should always understand whether they are in landing, lobby, focus, playing, paused, game-over, or results.
6. Responsiveness: mobile and low-height layouts must not lose primary actions or card readability.
7. Accessibility: decorative branding should be `aria-hidden`; meaningful branding should not interrupt screen-reader flow.

## Brand Placement Guidance

- Landing: brand can be the hero because orientation and acquisition are the primary tasks.
- Lobby/waiting room: brand can be visible but secondary to room actions, player seats, and Start/host state.
- In-game: brand should become environmental, not navigational. Prefer a watermark, table mark, or compact status-adjacent mark over a header.
- Avoid adding new top chrome in-game if it reduces playable area or increases eye travel.
- Prefer one reusable brand component with variants for landing, lobby, and in-game.

## Recommendation Format

When advising, return:

1. Best recommendation.
2. Why it fits the current UI.
3. Alternatives rejected and why.
4. Implementation notes with likely classes/components.
5. Mobile/low-height caveats.
