# Python Backend for Business Dashboard

This backend serves the dashboard data used by the React frontend.

## Install
//nstall the requirements 
```bash
cd "business system/backend"
python -m pip install -r requirements.txt
```

## Run
// to run the backend use this
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
# activation source  run source .venv/bin/activate uvicorn main:app --reload

# super admin should not appear in the list of users at all.the user (owner, managers and cashiers)should be available from the same company only.and data should update in the dashboard where needed.managers can only add cashiers. also products can be edited after being stored.data should be update accross the chain only if online otherwise stored locally.and the export button are not working.
```

The dashboard API will be available at `http://127.0.0.1:8000/api/dashboard`.
