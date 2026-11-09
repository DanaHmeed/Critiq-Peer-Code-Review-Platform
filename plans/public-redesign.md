# Critiq public redesign

Audience: developers requesting and giving peer code reviews. Primary job: explain the exchange, let visitors try line feedback, then create an account.

## Direction: review workshop

Palette: blue paper #EDF3FA, ink #172D4B, action cobalt #244DD8, annotation yellow #F5DF77, white #FFFFFF, muted ink #52657D.
Type: Barlow Condensed for large conversational headlines; DM Sans for interface and body; existing monospace only for actual code.
Layout: left aligned split hero, a single annotated code sheet, a broad belief strip, an interactive review workbench, sequential workflow, invitation.

    wordmark       try a review / how it works      sign in / join
    large headline          code sheet + reviewer annotation
    primary action          quiet supporting caption
    shared perspective statement
    demo heading            instructions
    selectable code         feedback + note composer
    workflow heading        three actual steps
    invitation

Review against brief: rejected the existing dark gradient, identical feature cards, version badge, fabricated performance numbers and generic engineering copy. The identifying device is the yellow review question attached to code, rather than ornamental art. Keep motion at zero; an optional annotation reveal can be considered in a future polish phase, but adds little to the current reading experience.

## Phases

1. Landing and scoped public tokens, interactive local demo, real workflow copy.
2. Shared account shell for sign-in, registration, password recovery and OAuth callback. Preserve validation, destination handling and API calls.
3. Authenticated application is a subsequent design phase outside this public-page pass.

## Verification

Responsive CSS covers mobile, tablet and desktop. Visible keyboard focus, semantic controls, labeled demo composer, persistent line selection and polite announcement of new comments. No marketing claims requiring external proof.

## Completed validation

- Landing production build passed before phase 1 commit.
- Final production build passed with no CSS import warnings.
- All 23 existing authentication integration tests passed. Updated role button selectors to follow sentence-case labels and require the selection state attribute.
- Checked public changes for whitespace errors.
- Browser visual preview was attempted, but the browser access host was unavailable. Desktop/mobile screenshot review remains unverified.
- Existing backend/src/app.js edits were excluded from both commits.
