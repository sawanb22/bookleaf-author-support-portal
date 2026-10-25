import asyncio
from app.db.session import db
from app.core.security import verify_password

async def verify_all_users():
    await db.connect()
    users = await db.fetch_all("SELECT id, email, role, name, password_hash, bank_name, account_last4 FROM users ORDER BY id")
    print(f"Total users: {len(users)}")
    for u in users:
        pw_ok = verify_password("demo", u["password_hash"])
        print(f"User: {u['id']:<15} {u['email']:<28} role={u['role']:<7} name={u['name']:<18} pass_demo={pw_ok} bank={u['bank_name']} ****{u['account_last4']}")

if __name__ == "__main__":
    asyncio.run(verify_all_users())
