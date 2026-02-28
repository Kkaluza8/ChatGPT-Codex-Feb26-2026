# Amazon Advertising ASIN Overrides (Local)

## Quick clarity: `not a git repository` on Windows
If you downloaded the project using **Download ZIP** from GitHub, your folder will not contain the `.git` directory. In that case, this message is expected:

`fatal: not a git repository (or any of the parent directories): .git`

You can still run the app normally with `python backend.py`; you just cannot run Git commands (`git status`, `git remote -v`, etc.) inside a ZIP download.

If you want a folder that supports Git commands and branches, clone instead of ZIP:

```bat
cd /d C:\Users\<you>\Downloads
git clone <your-github-repo-url>
cd ChatGPT-Codex-Feb26-2026
```

Then `git status` and `git remote -v` will work.

## Run locally (Windows CMD)
```bat
cd /d C:\Users\<you>\Downloads\ChatGPT-Codex-Feb26-2026-main\ChatGPT-Codex-Feb26-2026-main
python backend.py
```
Open `http://127.0.0.1:4173`.

## If you see `IndentationError`
That means your local `backend.py` is an older/broken copy.

1. Re-download or pull the latest repo files.
2. Validate syntax before running:
   ```bat
   python -m py_compile backend.py
   ```
3. Start again:
   ```bat
   python backend.py
   ```

## Useful API checks
```bat
curl http://127.0.0.1:4173/api/asin-overrides
curl http://127.0.0.1:4173/api/suppliers
curl http://127.0.0.1:4173/api/health
```


## If your local `backend.py` was manually edited
Use this hard reset flow in CMD:
```bat
cd /d C:\Users\<you>\Downloads\ChatGPT-Codex-Feb26-2026-main\ChatGPT-Codex-Feb26-2026-main
del backend.py
:: re-extract/download the repo zip so backend.py is restored
python -m py_compile backend.py
python backend.py
```

If `py_compile` fails, do not keep editing indentation manually; replace the file from the latest repo snapshot.


## Loading backend data into the UI
1. Start backend: `python backend.py`
2. Open `http://127.0.0.1:4173`
3. Click **Reload Data** to pull latest rows from SQLite.
4. If DB is empty, click **Load Default Data** once.
5. Click **Save Changes** after edits, including newly created ASIN rows.


## If buttons are missing or not working
This is usually a stale browser cache or a bad conflict merge.

1. Do a hard refresh in browser (`Ctrl+F5`).
2. Confirm these IDs exist in `index.html`: `reloadData`, `addAsin`, `seedDefaults`, `saveAll`.
3. Confirm there are no conflict markers left in any file:
   ```bat
   findstr /n "<<<<<<< ======= >>>>>>>" index.html app.js styles.css backend.py
   ```
4. Re-run:
   ```bat
   python -m py_compile backend.py
   python backend.py
   ```


## If UI still looks old after merge
The backend now sends no-cache headers, but your browser may still hold stale files.

1. Stop server (`Ctrl+C`) and start again: `python backend.py`
2. Open `http://127.0.0.1:4173`
3. Hard refresh: `Ctrl+F5`
4. Verify health/version:
   ```bat
   curl http://127.0.0.1:4173/api/health
   ```
