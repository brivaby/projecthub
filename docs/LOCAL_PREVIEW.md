# Local ProjectHub preview

Open `ProjectHub Preview.html` in your browser to view the catalog and bundled student sites. Keep the HTML file beside `preview-projects` so the project pages and assets resolve. The catalog can display bundled sites on a fresh clone. Links to original submission files require those files beside the ProjectHub folder.

After installing the project's Node dependencies, open `Watch Student Projects.command` on macOS or run `python3 scripts/watch-preview.py` from the project folder. Python 3.8 or later and Node.js must be on your PATH. Keep the watcher running while accepting submissions. To scan once and exit, run `python3 scripts/watch-preview.py --once`.

Place each new submission beside the ProjectHub folder as a standalone HTML file, a folder containing an HTML entry page, or a ZIP archive containing one. Place a multi-file project in its own folder or ZIP so its relative assets are imported together. The watcher prefers an `index.html` entry page and uses the page title for the catalog. It derives the displayed student name from the file or folder name, so use the student's name there. Updated submissions retain their catalog link. Removing a submission removes its card on the next scan. The watcher stages supported web files without running student code.
