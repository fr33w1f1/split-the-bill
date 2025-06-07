from datetime import date
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional
import uuid

app = FastAPI()

# Enable CORS for local testing (frontend will run on file:// or localhost)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class Item(BaseModel):
    name: str
    cost: float
    paid_by: str
    split_with: List[str]
    paid_date: date

class BillCreate(BaseModel):
    title: str
    members: List[str]

class RemoveItem(BaseModel):
    index: int

class AddItemRequest(BaseModel):
    item_data: Item
    index: Optional[int] = None

# In-memory "database"
bills = {}

@app.post("/create_bill")
def create_bill(data: BillCreate):
    bill_id = str(uuid.uuid4())[:8]
    bills[bill_id] = {
        "title": data.title,
        "members": data.members,
        "items": []
    }
    return {"bill_id": bill_id}

@app.post("/bill/{bill_id}/add_item")
def add_item(bill_id: str,  request: AddItemRequest):
    if bill_id not in bills:
        raise HTTPException(404, "Bill not found")
    bill = bills[bill_id]
    item = request.item_data

    if item.paid_by not in bill["members"]:
        raise HTTPException(400, "payer must be a member")
    for m in item.split_with:
        if m not in bill["members"]:
            raise HTTPException(400, f"split member {m} not in members")

    # This is the key logic change
    if request.index is not None:
        # If an index is provided, insert the item there
        bill["items"].insert(request.index, item.dict())
    else:
        # Otherwise, append it to the end (for new items)
        bill["items"].append(item.dict())

    return {"success": True}

@app.post("/bill/{bill_id}/remove_item")
def remove_item(bill_id: str, data: RemoveItem):
    if bill_id not in bills:
        raise HTTPException(404, "Bill not found")
    bill = bills[bill_id]
    
    if data.index < 0 or data.index >= len(bill["items"]):
        raise HTTPException(400, "Invalid item index")
        
    bill["items"].pop(data.index)
    return {"success": True}

@app.get("/bill/{bill_id}/summary")
def bill_summary(bill_id: str):
    if bill_id not in bills:
        raise HTTPException(404, "Bill not found")
    bill = bills[bill_id]

    total_cost = sum(item["cost"] for item in bill["items"])

    # Calculate per person net balance
    balances = {m: 0.0 for m in bill["members"]}
    for item in bill["items"]:
        split_count = len(item["split_with"])
        share = item["cost"] / split_count if split_count > 0 else 0
        for m in item["split_with"]:
            balances[m] -= share  # owes share
        balances[item["paid_by"]] += item["cost"]  # paid full amount

    # Round to 2 decimals
    for m in balances:
        balances[m] = round(balances[m], 2)

    return {
        "title": bill["title"],
        "members": bill["members"],
        "total_cost": round(total_cost, 2),
        "balances": balances,
        "items": bill["items"]
    }
