# folder structure

this document defines the canonical folder structure for this chrome mv3 extension.

the current project is flat. this document defines the target structure that must be followed as the project grows.

## current minimal structure

background.js
content.js
manifest.json
popup.html
popup.js
docs/
  engineering/

## target structure (scalable)

/extension-root
  manifest.json

  /src
    /background
      background.js
      messages.js
      storage.js
      network.js
      offscreen-clipboard.js (optional)

    /content
      content.js
      selectors.js
      normalize.js

      /extractors
        name.js
        headline.js
        company.js
        location.js
        about.js
        experience.js

    /popup
      popup.html
      popup.js
      popup.css
      ui.js
      state.js
      clipboard.js
      prompt.js
      text.js
      constants.js

    /shared
      types.js
      utils.js

  /docs
    /engineering
      *.md

## structural rules

1. each runtime context has its own folder:
   - background
   - content
   - popup

2. content must not import from popup or background.

3. popup must not import dom selectors from content directly.
   - communication happens via message passing only.

4. shared utilities may exist only if used by 2 or more contexts.
   - do not prematurely create shared abstractions.

5. selectors must live in:

   src/content/selectors.js

   never inline complex selectors inside business logic.

6. extractors should be pure where possible.
   - input: dom or text
   - output: structured value + optional confidence metadata

## manifest alignment

when the structure evolves:
- manifest.json must reference built output (if bundling is introduced)
- avoid referencing deep internal files directly from manifest

## growth policy

- do not introduce a build system (vite/webpack) unless complexity requires it.
- when introducing one:
  - source lives in /src
  - output goes to /dist
  - manifest references /dist

until then, keep it simple and explicit.

## documentation rule

any change to structure must:
- update this document
- update architecture.md if responsibilities change
