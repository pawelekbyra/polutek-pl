# Rollback after rough icon client crash

Rolled main back to the last stable illustrated home state after the client-side webpack runtime error on the main page.

Bad changes removed from the production branch:
- RoughIcon imported into active client components
- aggressive comment CSS added after the stable illustrated skin
- Hero/Navbar/ShareButton rewrites from the rough icon pass

Stable target used before this trigger commit:
37e7ec403330d2343b5cf5fa5e4169e3cd160240
