# project-setup

A Claude Code plugin holding my new-project setup process — skills that stand up
new projects on a blessed, agent-first path. First skill:
`standing-up-a-web-data-project`.

## Enable

- `/plugin marketplace add ~/workspace/dotfiles/claude`
- `/plugin install project-setup@vcarl-setup`

## Layout

- `.claude-plugin/plugin.json` — plugin manifest
- `skills/standing-up-a-web-data-project/SKILL.md` — the setup skill
- `skills/standing-up-a-web-data-project/templates/` — files copied into a scaffolded project
  (`effect-conventions.md` + `effect/` code stubs, distilled from `roci`)
