# Amazon Advertising ASIN Overrides (Local)

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
