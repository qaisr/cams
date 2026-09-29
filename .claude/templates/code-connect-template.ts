// .claude/templates/code-connect-template.ts
// ---------------------------------------------------------------------------
// Template-file Code Connect scaffold (Plan 02b §4.3 / Phase 6 F4).
//
// FRAMEWORK-AGNOSTIC. This uses `@figma/code-connect/html`, the template-file
// mechanism that REPLACES the framework-specific React Code Connect parser.
// The React parser is retired by Figma on **2026-08-17** (BD1 / D20) — every
// Code Connect mapping in this repo is authored this way, never with the old
// `@figma/code-connect/react` parser.
//
// This file is a SCAFFOLD, not a live mapping. `/figma-codeconnect <node>`
// copies it, fills the real values, DRY-RUNS it for human approval, and only
// then publishes the mapping (add_code_connect_map / send_code_connect_mappings).
// Nothing here touches the Figma canvas (D15) — a Code Connect map is metadata.
//
// Field notes (D5): the node id is the **hyphen** form in the URL
// (`299-12006`) and the **colon** form (`299:12006`) everywhere in JSON /
// _index.json / meta sidecars. The URL below carries the hyphen form.
//
// The component name (`DefaultTopAppBarScaffold` below) is NOT guessed — it is
// the Lumen code-name resolved from the Figma name (`TopNavigationBars`)
// through the **verified** entry in `.claude/config/figma-lumen-glossary.json`
// (Phase 5 glossary). An `inferred`/absent entry must be promoted via
// `/figma-glossary add` BEFORE a mapping is scaffolded.
// ---------------------------------------------------------------------------

import figma, { html } from '@figma/code-connect/html';

figma.connect(
  // Figma design URL — hyphen node form (D5). fileKey is the pinned value in
  // .claude/config/figma-sync.config.yml; do not hardcode a second copy.
  'https://www.figma.com/design/2MbwX0rxNA1uhgDwlC7Z6G/Future-State-Exploration?node-id=299-12006',
  {
    // props: map Figma component properties → code props.
    //   figma.string('<Figma property name>')   → text/enum property
    //   figma.boolean('<Figma property name>')  → boolean property
    //   figma.instance('<Figma property name>') → nested instance-swap slot
    // The property NAMES on the left of `=>` come from
    // get_context_for_code_connect (step 2 of the /figma-codeconnect flow).
    props: {
      title: figma.string('Title'),
      hasBackButton: figma.boolean('Has back button'),
    },

    // example: the code the design maps to. Uses the Lumen component name
    // resolved through the glossary; props are interpolated by name.
    example: (props) => html`<DefaultTopAppBarScaffold
      title=${props.title}
      hasBackButton=${props.hasBackButton}
    />`,
  },
);
