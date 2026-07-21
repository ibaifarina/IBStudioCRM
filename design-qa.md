# Desktop theme selector design QA

- Source visual truth: `/var/folders/12/4z45d6r563lfzlkqz3s55h980000gn/T/codex-clipboard-4085a4a7-c95e-4fba-a58a-e67fb6e298a5.png`
- Implementation screenshot: `/private/tmp/crm-theme-segment-auth-blocked-3.png`
- Viewport: 1280 × 720 desktop
- Intended state: authenticated sidebar, dark theme, segmented theme selector below the account block
- Browser route: `http://localhost:3012/`

## Full-view comparison evidence

The source shows a focused crop of the authenticated desktop sidebar. The implementation route redirected to `/login?next=%2F`, so the matching authenticated sidebar state could not be captured.

## Focused region comparison evidence

The focused selector comparison is blocked by authentication. Code inspection confirms a full-width three-item shadcn Toggle Group with Light, Dark, and System icons, placed after the account link in the footer.

## Findings

- [P1] Authenticated selector cannot be visually compared.
  - Evidence: the browser-rendered implementation screenshot contains the login screen rather than the sidebar.
  - Impact: exact pixel fidelity, selected-state contrast, and footer spacing cannot be confirmed from rendered evidence.
  - Resolution required: sign into the local app in the in-app browser, then recapture the desktop sidebar.

## Required fidelity surfaces

- Fonts and typography: no text is present in the target control.
- Spacing and layout rhythm: implemented as a full-width footer control below the account block; rendered comparison blocked.
- Colors and visual tokens: implemented with semantic sidebar background, border, foreground, and selected-state tokens.
- Image quality and asset fidelity: no raster assets; existing Lucide Sun, Moon, and Monitor icons are used.
- Copy and content: icon-only selector with accessible labels for Claro, Oscuro, and Sistema.

## Interaction and console checks

- Primary interaction: blocked because the authenticated control was unavailable.
- Console errors/warnings on the rendered login state: none.
- Framework overlay: none.

## Comparison history

- Initial target: desktop segmented selector below the account block.
- Implementation: replaced the desktop dropdown row with a controlled three-option shadcn Toggle Group and moved it below the profile link.
- Post-fix evidence: authenticated capture unavailable; browser redirected to login.

final result: blocked
