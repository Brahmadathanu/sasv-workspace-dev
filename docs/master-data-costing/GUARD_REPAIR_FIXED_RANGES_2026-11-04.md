# Guard repair: historical "package scope" tests use immutable ranges — 4 Nov 2026

Test-only. Three guards merged with #149 and #151 compared the **working tree** with a base commit (`git diff --name-only BASE` plus untracked files) to prove their package touched only its own files. They pass on the merge commit but fail for *any* later package that legitimately edits another `public/` file (for example the WP06 concurrency fixes), and a working-tree comparison also lets unrelated edits hide inside the allowed set. They now compare the immutable range *base → squash merge* of the package, as the W6 guard already does:
- `draft-run-evidence.test.mjs`: "flag-OFF parity … nothing else changed" and "no new tab, module, route or HTML" use `195b13c..43a93ef` (PR #149); the commit must exist or the test fails loudly.
- `wp05-closure.test.mjs`: "test-only package" uses `195b13c..22126c8` (PR #151).
No production file changed. Needed by every following code PR (WP06-G1d, F-7, F-9, F-8).
