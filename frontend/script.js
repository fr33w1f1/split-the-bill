const backendURL = 'http://127.0.0.1:8000';

let billId = null;
let members = [];
let splitWithSet = new Set();
let editIndex = null;

function createBill() {
  const title = document.getElementById('bill-title').value.trim();
  const membersInput = document.getElementById('bill-members').value.trim();
  if (!title || !membersInput) {
    alert("Please enter title and members.");
    return;
  }
  members = membersInput.split(",").map(m => m.trim()).filter(m => m);
  fetch(backendURL + '/create_bill', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ title, members })
  }).then(res => res.json()).then(data => {
    billId = data.bill_id;
    showBillSection();
    refreshSummary();
  });
}

function showBillSection() {
  document.getElementById('create-bill-section').style.display = 'none';
  document.getElementById('bill-section').style.display = 'block';
  document.getElementById('bill-title-display').textContent = document.getElementById('bill-title').value.trim();
  updateMembersUI();
  updatePaidByOptions();
  buildSplitButtons();
  document.getElementById('share-link').value = window.location.origin + '/bill.html?bill=' + billId;
}

function updateMembersUI() {
  const container = document.getElementById('members-list');
  container.innerHTML = '';
  members.forEach(m => {
    const span = document.createElement('span');
    span.textContent = m + " ";
    container.appendChild(span);
  });
}

function updatePaidByOptions() {
  const sel = document.getElementById('paid-by');
  sel.innerHTML = '';
  members.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m;
    opt.textContent = m;
    sel.appendChild(opt);
  });
}

function buildSplitButtons() {
  const container = document.getElementById('split-buttons');
  container.innerHTML = '';
  splitWithSet = new Set();
  members.forEach(m => {
    const btn = document.createElement('button');
    btn.className = 'member-btn';
    btn.textContent = m;
    btn.onclick = () => toggleSplitMember(m, btn);
    container.appendChild(btn);
  });
}

function toggleSplitMember(member, btn) {
  if (splitWithSet.has(member)) {
    splitWithSet.delete(member);
    btn.classList.remove('selected');
  } else {
    splitWithSet.add(member);
    btn.classList.add('selected');
  }
  updateAllButton();
}

function toggleAllSplit() {
  const allBtn = document.getElementById('btn-all');
  const buttons = document.querySelectorAll('#split-buttons button');
  if (splitWithSet.size === members.length) {
    splitWithSet.clear();
    allBtn.classList.remove('selected');
    buttons.forEach(b => b.classList.remove('selected'));
  } else {
    splitWithSet = new Set(members);
    allBtn.classList.add('selected');
    buttons.forEach(b => b.classList.add('selected'));
  }
}

function updateAllButton() {
  const allBtn = document.getElementById('btn-all');
  if (splitWithSet.size === members.length) {
    allBtn.classList.add('selected');
  } else {
    allBtn.classList.remove('selected');
  }
}

function addItem() {
    const name = document.getElementById('item-name').value.trim();
    const cost = parseFloat(document.getElementById('item-cost').value);
    const paid_by = document.getElementById('paid-by').value;
    const split_with = Array.from(splitWithSet);
    const paid_date = document.getElementById('paid-date').value;

    if (!name) return alert("Item name required.");
    if (!cost || cost <= 0) return alert("Cost must be > 0.");
    if (split_with.length === 0) return alert("Select at least one member to split with.");
  
    const itemData = { name, cost, paid_by, split_with, paid_date };
  
    const doAdd = () => {
      fetch(`${backendURL}/bill/${billId}/add_item`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(itemData)
      }).then(res => {
        if (!res.ok) throw new Error("Failed to add item");
        return res.json();
      }).then(() => {
        resetForm();
        refreshSummary();
      }).catch(e => alert(e));
    };
  
    if (editIndex !== null) {
      fetch(`${backendURL}/bill/${billId}/remove_item`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ index: editIndex })
      }).then(res => {
        if (!res.ok) throw new Error("Failed to remove item");
        return res.json();
      }).then(() => {
        doAdd();
      }).catch(e => alert(e));
    } else {
      doAdd();
    }
  }
  
  function resetForm() {
    document.getElementById('item-name').value = '';
    document.getElementById('item-cost').value = '';
    splitWithSet.clear();
    buildSplitButtons();
    updateAllButton();
    editIndex = null;
    document.getElementById('add-item-button').textContent = 'Add Item';
  }
  

function addMember() {
  const newName = document.getElementById('new-member-name').value.trim();
  if (!newName) {
    alert("Enter member name");
    return;
  }
  if (members.includes(newName)) {
    alert("Member already exists");
    return;
  }
  members.push(newName);
  document.getElementById('new-member-name').value = '';
  updateMembersUI();
  updatePaidByOptions();
  buildSplitButtons();
  updateAllButton();
  refreshSummary();
}

function refreshSummary() {
  fetch(`${backendURL}/bill/${billId}/summary`)
    .then(res => res.json())
    .then(data => {
      document.getElementById('total-cost').textContent = data.total_cost.toFixed(2);

      const balancesList = document.getElementById('balances-list');
      balancesList.innerHTML = '';
      for (const [member, balance] of Object.entries(data.balances)) {
        const li = document.createElement('li');
        let text = `${member}: `;
        if (balance > 0) text += `should receive $${balance.toFixed(2)}`;
        else if (balance < 0) text += `owes $${(-balance).toFixed(2)}`;
        else text += 'settled up';
        li.textContent = text;
        balancesList.appendChild(li);
      }

      const itemsList = document.getElementById('items-list');
      itemsList.innerHTML = '';
      data.items.forEach((item, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${item.paid_date || ''}</td>
            <td>${item.name}</td>
            <td>$${item.cost.toFixed(2)}</td>
            <td>${item.paid_by}</td>
            <td>${item.split_with.join(", ")}</td>
            <td><button class="edit-btn">Edit</button></td>
        `;
        const button = tr.querySelector('.edit-btn');
        button.addEventListener('click', () => {
          editItem(index, item.name, item.cost, item.paid_by, item.split_with, item.paidDate);
        });
        itemsList.appendChild(tr);
      });
    });
}

function editItem(index, name, cost, paidBy, splitWith, paidDate = '') {
    document.getElementById('paid-date').value = paidDate || '';
    document.getElementById('item-name').value = name;
    document.getElementById('item-cost').value = cost;
    document.getElementById('paid-by').value = paidBy;

    splitWithSet.clear();
    splitWith.forEach(member => splitWithSet.add(member));
    buildSplitButtons();
    updateAllButton();
  
    editIndex = index;
  
    document.getElementById('add-item-button').textContent = 'Save Changes';
  }
  
