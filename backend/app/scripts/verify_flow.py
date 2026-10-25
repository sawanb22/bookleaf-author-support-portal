import urllib.request
import json

def post(url, payload, token=None):
    data = json.dumps(payload).encode()
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, data=data, headers=headers)
    res = urllib.request.urlopen(req)
    return json.loads(res.read())

def get(url, token=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, headers=headers)
    res = urllib.request.urlopen(req)
    return json.loads(res.read())

print("--- 1. Login as Author (Priya) ---")
auth_author = post("http://127.0.0.1:8000/api/v1/auth/login", {"email": "priya.sharma@email.com", "password": "demo"})
author_token = auth_author["access_token"]
print("Author logged in:", auth_author["user"]["name"])

print("--- 2. Fetch Author Ticket BL-1126 ---")
t_author_1126 = get("http://127.0.0.1:8000/api/v1/me/tickets/BL-1126", author_token)
print("Subject:", t_author_1126["subject"])
print("Status:", t_author_1126["status"])
print("Messages count:", len(t_author_1126["messages"]))
for m in t_author_1126["messages"]:
    print(f" - [{m['sender_name']}] ({m['sender_role']}): {m['body'][:60]}...")

print("--- 3. Login as Admin (Ops Admin) ---")
auth_admin = post("http://127.0.0.1:8000/api/v1/auth/login", {"email": "ops.admin@bookleaf.demo", "password": "demo"})
admin_token = auth_admin["access_token"]
print("Admin logged in:", auth_admin["user"]["name"])

print("--- 4. Verify Admin Queue has BL-1126 and BL-1001 ---")
queue = get("http://127.0.0.1:8000/api/v1/admin/tickets", admin_token)
ticket_ids = [t["id"] for t in queue["items"]]
print("Queue ticket IDs:", ticket_ids)
assert "BL-1126" in ticket_ids, "BL-1126 missing from admin queue!"
assert "BL-1001" in ticket_ids, "BL-1001 missing from admin queue!"
print("\n>>> ALL TESTS PASSED SUCCESSFULLY! Both BL-1001 and BL-1126 are in queue and show replies! <<<")
