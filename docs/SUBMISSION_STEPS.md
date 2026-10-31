# How to submit

## 0. Before you push (10 minutes)

1. Start the supplied service (already in `backend/`, unmodified). It needs **Python 3.10+**:
   ```bash
   cd backend
   python -m pip install fastapi uvicorn
   python -m uvicorn simulation_service:app --reload
   ```
2. Start the web app (`cd frontend && npm install && npm run dev`) and click through the demo script below. Remember a simulation takes about 15 seconds.
3. Run `cd frontend && npm test && npm run build`.
4. Confirm there is no `node_modules/`, `venv/` or `dist/` in what you push (the `.gitignore` already excludes them).

## 1. Record the demo (30-90 seconds)

Use any screen recorder: **Windows** Win+G (Xbox Game Bar), **Mac** Shift+Cmd+5, or OBS Studio / Loom. Save as `.mp4` or share a Loom/Drive link.

Suggested script (about 60 s):

1. (5s) Show the starting canvas: Internet → Web Server → Database.
2. (10s) Type `add node Cache`, then `connect Web Server to Cache`.
3. (10s) Type `remove edge Web Server to Cache`, then connect it again; type something invalid (`banana`) to show the error message.
4. (20s) Click **Run simulation**. The service takes ~15 s: point out the "Running… running · 7s" button while you wait (you can type another command meanwhile, e.g. `add node Cache`). Tip: **trim the wait when editing the video**, or talk over it while explaining the async polling.
5. (15s) When the trace appears, point out grey architecture edges vs blue trace edges. Click **Next →** / **← Prev**; point out the orange current step, highlighted nodes and the step description.
6. (5s) Type `remove node Cache` to show the stale-trace warning.

Keep the total between 30 and 90 seconds: if the wait makes it longer, speed up or cut that part.

Do not commit large video files to GitHub. Upload to Google Drive / YouTube (unlisted) / Loom and put the link in the README, or send the file with your submission.

## 2. Publish to GitHub

1. Create an empty repo at https://github.com/new (e.g. `architecture-chat-sim`). Do **not** add a README or .gitignore there.
2. In a terminal, from the project root (the folder containing `README.md`):
   ```bash
   git init
   git add .
   git status            # check: no node_modules, dist or venv listed
   git commit -m "Architecture chat + simulation explorer"
   git branch -M main
   git remote add origin https://github.com/<your-username>/architecture-chat-sim.git
   git push -u origin main
   ```
3. Open the repo in the browser and check the README renders (including the screenshot).
4. Optional: add the demo video link to the top of `README.md` and push again.

If the reviewer needs access and the repo is private, add them as a collaborator (Settings → Collaborators) or make it public.

## 3. Or submit a zip

From the folder that *contains* `architecture-chat-sim/`:

```bash
zip -r architecture-chat-sim.zip architecture-chat-sim -x "*/node_modules/*" "*/dist/*" "*/venv/*" "*/__pycache__/*"
```

On Windows you can right-click the folder, send to compressed folder, **after deleting `node_modules` and `dist`**.

## 4. What to send

- GitHub link (or the zip)
- Demo recording link/file
- Optionally one line pointing the reviewer to the README sections "How the app talks to the simulation API" and "Key design decisions".

## Checklist against the brief

- [ ] Add node / add edge / remove node / remove edge via text
- [ ] Canvas shows nodes with labels and the connections
- [ ] Simulation calls the separate service (nothing hard-coded)
- [ ] Trace edges distinguishable from architecture edges
- [ ] Step number + description, Prev/Next, current nodes + edge highlighted
- [ ] README: run, example inputs, API interaction, design decisions
- [ ] Demo recording 30-90 s
- [ ] No `node_modules/`, `venv/`, build output
