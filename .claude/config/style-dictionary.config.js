// .claude/config/style-dictionary.config.js
// ---------------------------------------------------------------------------
// Style Dictionary config for token-drift detection (Plan 02b §3.6 / Phase 6 F3).
//
// DETECTION ONLY. Style Dictionary resolves the committed Figma DTCG token
// export (`figma/tokens/figma-tokens.json`) into a flat, comparable set that
// the /figma-token-drift pipeline (step 3) diffs against the Lumen-consumed
// tokens. The build output goes to `.claude/.token-drift/` (GITIGNORED — a
// throwaway resolved snapshot, never committed, never hand-edited). This
// config NEVER rewrites the source tokens or any Lumen config (BD4 / D21).
//
// Run (inside /figma-token-drift, offline once tokens are on disk):
//   node_modules/.bin/style-dictionary build --config .claude/config/style-dictionary.config.js
// ---------------------------------------------------------------------------

export default {
  source: ['figma/tokens/figma-tokens.json'],
  platforms: {
    css: {
      transformGroup: 'css',
      prefix: 'lmn',
      buildPath: '.claude/.token-drift/',
      files: [{ destination: 'tokens.css', format: 'css/variables' }],
    },
  },
};
