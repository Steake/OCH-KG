Skilgen install notes

- Requires Python `>=3.11` (works on 3.12 as tested).
- Recommended: use a virtual environment to avoid conflicts with Anaconda or system Python.

Quick setup

1) Create and activate a venv

   - macOS/Linux:
     - `python3 -m venv .venv`
     - `source .venv/bin/activate`

2) Upgrade packaging tools

   - `python -m pip install --upgrade pip wheel setuptools`

3) Install skilgen (two options)

   - Fast/pinned (recommended):
     - `python -m pip install -r requirements-skilgen.txt`
       - Uses versions verified to work together on Python 3.12.
   - Fresh resolve:
     - `python -m pip install skilgen`

Notes and troubleshooting

- If you see long install times, it’s normal on a fresh environment due to many first-time downloads (LangChain + providers). Subsequent installs are fast.
- If builds fail on macOS, install Xcode Command Line Tools:
  - `xcode-select --install`
- Ensure `pip` is recent (25+). Old pip versions may fail to find wheels for Python 3.12.
- Confirm Python version:
  - `python3 -V` (must be `>= 3.11`).

What’s pinned

- `requirements-skilgen.txt` captures a working set including:
  - `skilgen==0.1.0`
  - `deepagents==0.4.11`
  - `langchain==1.2.12`
  - `langchain-anthropic==1.4.0`
  - `langchain-google-genai==4.2.1`
  - `langchain-huggingface==1.2.1`
  - `langchain-openai==1.1.11`

