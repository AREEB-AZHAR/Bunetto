let liveData = null;

// Initialize settings
document.getElementById('gh-owner').value = localStorage.getItem('bunetto_gh_owner') || '';
document.getElementById('gh-repo').value = localStorage.getItem('bunetto_gh_repo') || '';
document.getElementById('gh-path').value = localStorage.getItem('bunetto_gh_path') || 'data.json';
document.getElementById('gh-token').value = localStorage.getItem('bunetto_gh_token') || '';

function saveSettings() {
    localStorage.setItem('bunetto_gh_owner', document.getElementById('gh-owner').value);
    localStorage.setItem('bunetto_gh_repo', document.getElementById('gh-repo').value);
    localStorage.setItem('bunetto_gh_path', document.getElementById('gh-path').value);
    localStorage.setItem('bunetto_gh_token', document.getElementById('gh-token').value);
    alert('Settings saved locally.');
}

function clearSettings() {
    if(!confirm("Are you sure you want to clear your credentials?")) return;
    localStorage.removeItem('bunetto_gh_owner');
    localStorage.removeItem('bunetto_gh_repo');
    localStorage.removeItem('bunetto_gh_path');
    localStorage.removeItem('bunetto_gh_token');
    document.getElementById('gh-owner').value = '';
    document.getElementById('gh-repo').value = '';
    document.getElementById('gh-path').value = 'data.json';
    document.getElementById('gh-token').value = '';
}

async function loadData() {
    try {
        // We load the data directly from the relative data.json to initialize.
        // It provides the current state of the main branch.
        const res = await fetch('data.json?' + new Date().getTime());
        if(res.ok) {
            liveData = await res.json();
            document.getElementById('data-status').textContent = 'Data loaded successfully!';
            document.getElementById('data-status').style.color = 'green';
            renderEditor();
        } else {
            throw new Error('Fetch failed');
        }
    } catch(e) {
        document.getElementById('data-status').textContent = 'Failed to load data.json. Ensure you are running this on a server.';
        document.getElementById('data-status').style.color = 'red';
    }
}

function renderEditor() {
    const area = document.getElementById('content-area');
    area.innerHTML = '';
    
    liveData.categoryConfig.forEach((cat, cIdx) => {
        const catBlock = document.createElement('div');
        catBlock.className = 'category-block card';
        
        let itemsHtml = '';
        if(liveData.menuData[cat.id]) {
            liveData.menuData[cat.id].forEach((item, iIdx) => {
                itemsHtml += `
                    <div class="item-row">
                        <div>
                            <img src="${item.img}" alt="${item.name}">
                        </div>
                        <div>
                            <label>Name</label>
                            <input type="text" value="${item.name.replace(/"/g, '&quot;')}" onchange="updateItem('${cat.id}', ${iIdx}, 'name', this.value)">
                            <label>Description</label>
                            <input type="text" value="${(item.desc || '').replace(/"/g, '&quot;')}" onchange="updateItem('${cat.id}', ${iIdx}, 'desc', this.value)">
                            <label>Image URL</label>
                            <input type="text" value="${item.img.replace(/"/g, '&quot;')}" onchange="updateItem('${cat.id}', ${iIdx}, 'img', this.value)">
                        </div>
                        <div>
                            <label>Original Price</label>
                            <input type="number" value="${item.price}" onchange="updateItem('${cat.id}', ${iIdx}, 'price', this.value)">
                        </div>
                        <div>
                            <label>Discount Price (0 or empty = none)</label>
                            <input type="number" value="${item.discountPrice || ''}" placeholder="Discounted Price" onchange="updateItem('${cat.id}', ${iIdx}, 'discountPrice', this.value)">
                        </div>
                        <div>
                            <br>
                            <button class="danger" style="width:100%" onclick="removeItem('${cat.id}', ${iIdx})">Delete</button>
                        </div>
                    </div>
                `;
            });
        }

        catBlock.innerHTML = `
            <div class="row" style="margin-bottom: 20px;">
                <div class="col">
                    <label>Category Layout Group ID</label>
                    <input type="text" value="${cat.id}" disabled style="background:#eee" title="Category ID cannot be changed.">
                </div>
                <div class="col">
                    <label>Category Title</label>
                    <input type="text" value="${cat.title.replace(/"/g, '&quot;')}" onchange="updateCategory(${cIdx}, 'title', this.value)">
                </div>
                <div class="col">
                    <label>Category Subtitle</label>
                    <input type="text" value="${cat.subtitle.replace(/"/g, '&quot;')}" onchange="updateCategory(${cIdx}, 'subtitle', this.value)">
                </div>
            </div>
            <h3>Menu Items in ${cat.title}</h3>
            ${itemsHtml}
            <button onclick="addItem('${cat.id}')" style="margin-top: 10px;">+ Add New Item</button>
        `;
        area.appendChild(catBlock);
    });
}

function updateCategory(cIdx, key, val) {
    liveData.categoryConfig[cIdx][key] = val;
}

function updateItem(catId, iIdx, key, val) {
    if(key === 'price' || key === 'discountPrice') {
        val = parseInt(val);
        if(isNaN(val)) val = 0;
        if(key === 'discountPrice' && val === 0) {
            delete liveData.menuData[catId][iIdx][key];
            return;
        }
    }
    liveData.menuData[catId][iIdx][key] = val;
}

function removeItem(catId, iIdx) {
    if(confirm("Are you sure you want to completely delete this item? This action is not reversible once saved to GitHub.")) {
        liveData.menuData[catId].splice(iIdx, 1);
        renderEditor();
    }
}

function addItem(catId) {
    if(!liveData.menuData[catId]) liveData.menuData[catId] = [];
    liveData.menuData[catId].push({
        id: "new_" + Date.now(),
        name: "New Item",
        desc: "",
        price: 0,
        img: "images/placeholder.png"
    });
    renderEditor();
}

function resetForm() {
    if(confirm("Discard all unsaved changes and fetch fresh data again?")) {
        loadData();
    }
}

async function saveAllChangesToGithub() {
    if(!confirm("WARNING: Are you sure you want to push these changes to the live website? Vercel will begin rebuilding formatting for all users.")) return;
    
    const owner = document.getElementById('gh-owner').value.trim();
    const repo = document.getElementById('gh-repo').value.trim();
    const path = document.getElementById('gh-path').value.trim();
    const token = document.getElementById('gh-token').value.trim();

    if(!owner || !repo || !path || !token) {
        alert("Please fill in all GitHub connection settings before saving natively.");
        return;
    }

    document.getElementById('data-status').textContent = 'Pushing to GitHub... Please wait.';
    document.getElementById('data-status').style.color = 'orange';

    try {
        const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;

        // 1. Get the current file's SHA
        let sha = null;
        const getRes = await fetch(apiUrl, {
            method: 'GET',
            headers: { 'Authorization': `token ${token}`, 'Accept': 'application/vnd.github.v3+json' }
        });

        if(getRes.ok) {
            const fileData = await getRes.json();
            sha = fileData.sha;
        } else if(getRes.status !== 404) {
            throw new Error("Failed to fetch file metadata. Check credentials & repo. Status: " + getRes.status);
        }

        // 2. Base64 Encode content
        const jsonContent = JSON.stringify(liveData, null, 2);
        // Using unescape encodeURIComponent to safely b64 encode utf-8 strings in JS
        const base64Content = btoa(unescape(encodeURIComponent(jsonContent)));

        // 3. Make the PUT response
        const putRes = await fetch(apiUrl, {
            method: 'PUT',
            headers: { 'Authorization': `token ${token}`, 'Accept': 'application/vnd.github.v3+json', 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: "Update Menu Data from Bunetto Admin Panel",
                content: base64Content,
                sha: sha
            })
        });

        if(putRes.ok) {
            document.getElementById('data-status').textContent = 'Successfully Pushed! Vercel is now updating your live site.';
            document.getElementById('data-status').style.color = 'green';
            alert("Success! Your changes were committed to GitHub.");
        } else {
            const err = await putRes.json();
            throw new Error(err.message || 'Unknown error during PUT');
        }

    } catch (e) {
        console.error(e);
        document.getElementById('data-status').textContent = 'Error: ' + e.message;
        document.getElementById('data-status').style.color = 'red';
        alert('Failed to save to GitHub. Check the console and error message.');
    }
}

// Kick off
window.addEventListener('DOMContentLoaded', loadData);
