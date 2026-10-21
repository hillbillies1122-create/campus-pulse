# Campus Pulse

A career explorer for VIT engineering students. Live at **https://hillbillies1122-create.github.io/campus-pulse/**

- 60-item O*NET Interest Profiler (Short Form) → six interest scores (RIASEC)
- Self-rating on 12 O*NET skills and 10 knowledge areas
- 32 careers across CSE, IT, ECE, EEE, EIE, Mechanical, Civil, Chemical and Bio, with real O*NET interest, skill and knowledge data
- Match = 0.6 × interest fit (Pearson correlation) + 0.4 × skill readiness
- Roadmaps, shortlist, insights (cohort averages, India Skills Report 2026 by branch, skill-demand heatmap)
- Email + password accounts (Supabase Auth), data synced across devices, row-level security, export and delete
- Light / dark mode and selectable backgrounds

## Structure
- `index.html` – landing page + app shell
- `assets/app.js` – app logic (hash router, scoring, charts)
- `assets/data.js` – career data built from O*NET OnLine (retrieved 21 Oct 2026)
- `assets/items.js` – interest items, branch list, India Skills Report figures
- `sources.html` – full method and citations
- `privacy.html` – privacy notice

## Credits
O*NET OnLine and the O*NET Interest Profiler, U.S. Department of Labor, Employment and Training Administration (CC BY 4.0 / O*NET Tools Developer License). O*NET® is a trademark of USDOL/ETA. India Skills Report 2026 (ETS, CII, AICTE, AIU, Taggd).
