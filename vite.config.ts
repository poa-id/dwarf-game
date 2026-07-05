import { defineConfig } from "vite";

// GitHub Pages serves project repos (as opposed to a user/org root page)
// from https://<username>.github.io/<repo-name>/ — every asset URL in
// the built output needs to be relative to that subpath, not the domain
// root, or JS/CSS/images will 404 once deployed. `base` handles that.
// If a custom domain is ever set up instead, change this back to "/".
export default defineConfig({
  base: "/dwarf-game/",
});
