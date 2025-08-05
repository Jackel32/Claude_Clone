document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENT SELECTORS ---
    const tabBar = document.getElementById('tab-bar');
    const tabPanels = document.getElementById('tab-panels');
    const chatWindow = document.getElementById('chat-window');
    const chatForm = document.getElementById('chat-form');
    const messageInput = document.getElementById('message-input');
    const agentTaskBtn = document.getElementById('agent-task-btn');
    const addDocsBtn = document.getElementById('add-docs-btn');
    const refactorBtn = document.getElementById('refactor-btn');
    const testBtn = document.getElementById('test-btn');
    const gitDiffBtn = document.getElementById('git-diff-btn');

    // --- REPO SELECTOR LOGIC (NEW) ---
    const repoSelectorOverlay = document.getElementById('repo-selector-overlay');
    const appContainer = document.getElementById('app-container');
    const repoList = document.getElementById('repo-list');
    const cloneForm = document.getElementById('clone-form');
    const repoUrlInput = document.getElementById('repo-url');
    const repoPatInput = document.getElementById('repo-pat');

    async function initializeRepoSelector() {
        const response = await fetch('/api/repos');
        const repos = await response.json();
        repoList.innerHTML = '';
        if (repos.length > 0) {
            repos.forEach(repoName => {
                const li = document.createElement('li');
                li.textContent = repoName;
                li.onclick = () => selectRepo(repoName);
                repoList.appendChild(li);
            });
        } else {
            repoList.innerHTML = '<li>No repositories cloned yet.</li>';
        }
    }

    async function selectRepo(repoName) {
        await fetch('/api/repos/active', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ repoName }),
        });
        repoSelectorOverlay.classList.add('hidden');
        appContainer.classList.remove('hidden');
    }

    cloneForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const repoUrl = repoUrlInput.value;
        const pat = repoPatInput.value;
        
        const cloneButton = cloneForm.querySelector('button');
        cloneButton.textContent = 'Cloning...';
        cloneButton.disabled = true;

        const response = await fetch('/api/repos/clone', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ repoUrl, pat }),
        });
        const result = await response.json();
        
        if (response.ok) {
            await selectRepo(result.repoName);
        } else {
            alert(`Error cloning repository: ${result.error}`);
            cloneButton.textContent = 'Clone';
            cloneButton.disabled = false;
        }
    });

    initializeRepoSelector(); // Run on page load

    // --- TAB MANAGEMENT ---
    let tabCounter = 0;

    function createTab(title, makeActive = true) {
        tabCounter++;
        const tabId = `tab-${tabCounter}`;

        const tab = document.createElement('div');
        tab.className = 'tab';
        tab.dataset.tabId = tabId;
        
        const titleSpan = document.createElement('span');
        titleSpan.textContent = title;
        tab.appendChild(titleSpan);

        const closeBtn = document.createElement('span');
        closeBtn.className = 'close-tab';
        closeBtn.innerHTML = '&times;';
        closeBtn.onclick = (e) => {
            e.stopPropagation();
            closeTab(tabId);
        };
        tab.appendChild(closeBtn);
        tabBar.appendChild(tab);
        tab.onclick = () => switchToTab(tabId);

        const panel = document.createElement('div');
        panel.className = 'tab-panel';
        panel.dataset.tabId = tabId;
        tabPanels.appendChild(panel);

        if (makeActive) {
            switchToTab(tabId);
        }
        return panel;
    }

    function switchToTab(tabId) {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        const tabToActivate = document.querySelector(`.tab[data-tab-id="${tabId}"]`);
        if (tabToActivate) tabToActivate.classList.add('active');
        
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        const panelToActivate = document.querySelector(`.tab-panel[data-tab-id="${tabId}"]`);
        if (panelToActivate) panelToActivate.classList.add('active');
    }

    function closeTab(tabId) {
        if (tabId === 'home') return;
        document.querySelector(`.tab[data-tab-id="${tabId}"]`)?.remove();
        document.querySelector(`.tab-panel[data-tab-id="${tabId}"]`)?.remove();
        switchToTab('home');
    }
    
    function initHomeTab() {
        const homeTab = document.createElement('div');
        homeTab.className = 'tab active';
        homeTab.dataset.tabId = 'home';
        homeTab.textContent = 'Chat';
        homeTab.onclick = () => switchToTab('home');
        tabBar.appendChild(homeTab);
    }
    initHomeTab();

    // --- WEBSOCKET & MESSAGE HANDLING ---
    const socket = new WebSocket(`ws://${window.location.host}`);
    let assistantMessageElement = null;

    socket.onopen = () => console.log('WebSocket connection established.');
    
    socket.onmessage = (event) => {
        const message = JSON.parse(event.data);
        displayMessage(message);
    };

    function displayMessage(message) {
        let el;
        switch (message.type) {
            case 'thought':
                el = createMessageElement('assistant');
                el.firstChild.textContent = `Thought: ${message.content}`;
                break;
            case 'action':
                el = createMessageElement('assistant');
                el.firstChild.textContent = `Action: ${message.content}`;
                break;
            case 'observation':
                el = createMessageElement('assistant');
                el.firstChild.innerHTML = `<strong>Observation:</strong><pre>${message.content}</pre>`;
                break;
            case 'finish':
                el = createMessageElement('assistant');
                el.style.backgroundColor = '#1e8e3e';
                el.firstChild.textContent = `✅ Task Complete: ${message.content}`;
                break;
            case 'start':
                assistantMessageElement = createMessageElement('assistant');
                chatWindow.prepend(assistantMessageElement);
                return;
            case 'chunk':
                if (assistantMessageElement) assistantMessageElement.firstChild.textContent += message.content;
                return;
            case 'end':
                assistantMessageElement = null;
                return;
            case 'error':
                el = createMessageElement('assistant', 'error');
                el.firstChild.textContent = `Error: ${message.content}`;
                break;
            default: return;
        }
        if (el) chatWindow.prepend(el);
    }
    
    // --- CHAT FORM LOGIC ---
    chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const messageText = messageInput.value;
        if (messageText.trim() === '') return;

        switchToTab('home');
        const userMessage = createMessageElement('user');
        userMessage.firstChild.textContent = messageText;
        chatWindow.prepend(userMessage);
        
        socket.send(JSON.stringify({ type: 'chat', content: messageText }));
        messageInput.value = '';
    });

    function createMessageElement(role, type = 'normal') {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', role);
        if (type === 'error') messageDiv.style.color = '#ff8a8a';
        const p = document.createElement('p');
        messageDiv.appendChild(p);
        return messageDiv;
    }

    // --- EVENT LISTENERS FOR ACTION BUTTONS ---
    if(agentTaskBtn) agentTaskBtn.addEventListener('click', showAgentDialog);
    if(addDocsBtn) addDocsBtn.addEventListener('click', showAddDocsDialog);
    if(refactorBtn) refactorBtn.addEventListener('click', showRefactorDialog);
    if(testBtn) testBtn.addEventListener('click', showTestDialog);
    if(gitDiffBtn) gitDiffBtn.addEventListener('click', showGitDiffDialog);

    // --- GENERIC HELPERS ---
    async function applyChanges(filePath, newContent, panelToClose) {
        try {
            const response = await fetch('/api/apply-changes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filePath, newContent }),
            });
            if (!response.ok) throw new Error(`Server error: ${response.statusText}`);
            closeTab(panelToClose.dataset.tabId);
            alert(`Changes applied successfully to ${filePath}`);
        } catch (error) {
            panelToClose.innerHTML = `Error applying changes: ${error.message}`;
        }
    }

    function renderFileTree(node, onFileSelect) {
        const li = document.createElement('li');
        const itemSpan = document.createElement('span');
        itemSpan.className = 'tree-item';
        itemSpan.textContent = node.name;
        li.appendChild(itemSpan);

        if (node.type === 'folder') {
            li.className = 'tree-folder collapsed';
            itemSpan.onclick = () => li.classList.toggle('collapsed');
            
            const childrenUl = document.createElement('ul');
            childrenUl.className = 'file-tree';
            if (node.children) {
                // The recursive call correctly passes the onFileSelect callback down
                node.children.forEach(child => {
                    childrenUl.appendChild(renderFileTree(child, onFileSelect));
                });
            }
            li.appendChild(childrenUl);
        } else {
            li.className = 'tree-file';
            // The click handler is attached directly to the file item
            li.onclick = () => onFileSelect(node.path);
        }
        return li;
    }

    async function showGenericFileDialog(title, onFileSelect) {
        const panel = createTab(title);
        panel.innerHTML = 'Loading files...';
        try {
            const response = await fetch('/api/file-tree');
            if (!response.ok) throw new Error(`Server error: ${response.statusText}`);
            const treeData = await response.json();
            
            const treeRoot = document.createElement('ul');
            treeRoot.className = 'file-tree';
            if (treeData.children) {
                treeData.children.forEach(node => {
                    treeRoot.appendChild(renderFileTree(node, (filePath) => onFileSelect(filePath, panel)));
                });
            }
            
            panel.innerHTML = `<h3>${title}</h3>`;
            panel.appendChild(treeRoot);
        } catch (e) {
            panel.innerHTML = `Error: ${e.message}`;
        }
    }

    // --- ACTION WORKFLOWS ---
    function showAgentDialog() {
        const task = prompt("What task would you like the AI agent to perform?");
        if (task && task.trim()) {
            switchToTab('home');
            chatWindow.innerHTML = '';
            socket.send(JSON.stringify({ type: 'agent-task', task }));
            const userMessage = createMessageElement('user');
            userMessage.firstChild.textContent = `Task: ${task}`;
            chatWindow.prepend(userMessage);
        }
    }

    function showAddDocsDialog() {
        showGenericFileDialog('Add Docs: Select a File', onFileSelectForDocs);
    }
    async function onFileSelectForDocs(filePath, panel) {
        panel.innerHTML = '<h3>Generating Documentation...</h3>';
        try {
            const response = await fetch('/api/add-docs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filePath }),
            });
            if (!response.ok) throw new Error(`Server error: ${response.statusText}`);
            const { patch, newContent } = await response.json();
            displayDiff(panel, patch, `Docs: ${filePath.split('/').pop().split('\\').pop()}`);
            
            const actions = document.createElement('div');
            const applyBtn = document.createElement('button');
            applyBtn.textContent = 'Apply Changes';
            applyBtn.onclick = () => applyChanges(filePath, newContent, panel);
            actions.appendChild(applyBtn);
            panel.appendChild(actions);
        } catch (e) {
            panel.innerHTML = `Error: ${e.message}`;
        }
    }

    function showRefactorDialog() {
        showGenericFileDialog('Refactor: Select a File', onFileSelectForRefactor);
    }
    async function onFileSelectForRefactor(filePath, panel) {
        const promptText = prompt(`Enter refactoring instructions for ${filePath}:`);
        if (!promptText || !promptText.trim()) {
            closeTab(panel.dataset.tabId);
            return;
        }
        panel.innerHTML = '<h3>Refactoring file...</h3>';
        try {
            const response = await fetch('/api/refactor', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filePath, prompt: promptText }),
            });
            if (!response.ok) throw new Error(`Server error: ${response.statusText}`);
            const { patch, newContent } = await response.json();
            displayDiff(panel, patch, `Refactor: ${filePath.split('/').pop().split('\\').pop()}`);

            const actions = document.createElement('div');
            const applyBtn = document.createElement('button');
            applyBtn.textContent = 'Apply Changes';
            applyBtn.onclick = () => applyChanges(filePath, newContent, panel);
            actions.appendChild(applyBtn);
            panel.appendChild(actions);
        } catch (e) {
            panel.innerHTML = `Error: ${e.message}`;
        }
    }
    
    async function showTestDialog() {
        const panel = createTab('Generate Test');
        panel.innerHTML = 'Finding testable files...';
        try {
            const response = await fetch('/api/testable-file-tree');
            if (!response.ok) throw new Error(`Server error: ${response.statusText}`);
            const treeData = await response.json();
            
            if (!treeData || !treeData.children || treeData.children.length === 0) {
                panel.innerHTML = '<h3>No files with testable functions found.</h3>';
                return;
            }
            
            const treeRoot = document.createElement('ul');
            treeRoot.className = 'file-tree';
            treeData.children.forEach(node => {
                treeRoot.appendChild(renderFileTree(node, (filePath) => onFileSelectForTest(filePath, panel)));
            });
            
            panel.innerHTML = `<h3>Generate Test: Select a File</h3>`;
            panel.appendChild(treeRoot);
        } catch (e) {
            panel.innerHTML = `Error: ${e.message}`;
        }
    }

    // This function now fetches the list of symbols
    async function onFileSelectForTest(filePath, panel) {
        panel.innerHTML = '<h3>Loading functions from file...</h3>';
        try {
            const response = await fetch('/api/list-symbols', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filePath }),
            });
            if (!response.ok) throw new Error(`Server error: ${response.statusText}`);
            const symbols = await response.json();

            if (symbols.length === 0) {
                panel.innerHTML = `<h3>No exportable functions or classes found in ${filePath}.</h3>`;
                return;
            }

            const symbolList = document.createElement('ul');
            symbols.forEach(symbol => {
                const li = document.createElement('li');
                li.textContent = symbol;
                li.onclick = () => onSymbolSelectForTest(filePath, symbol, panel);
                symbolList.appendChild(li);
            });
            
            panel.innerHTML = `<h3>Select a function or class to test:</h3>`;
            panel.appendChild(symbolList);

        } catch (e) {
            panel.innerHTML = `Error: ${e.message}`;
        }
    }

    async function onSymbolSelectForTest(filePath, symbol, panel) {
        const framework = prompt(`Enter the testing framework for "${symbol}":`, 'jest');
        if (!framework || !framework.trim()) {
            closeTab(panel.dataset.tabId);
            return;
        }

        panel.innerHTML = `<h3>Generating ${framework} test for "${symbol}"...</h3>`;
        try {
            const response = await fetch('/api/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filePath, symbol, framework }),
            });
            if (!response.ok) throw new Error(`Server error: ${response.statusText}`);
            const { newContent } = await response.json();
            
            document.querySelector(`.tab[data-tab-id="${panel.dataset.tabId}"] span:first-child`).textContent = `Test: ${symbol}`;
            panel.innerHTML = `<h3>Generated Test for ${symbol}</h3><pre><code>${newContent.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</code></pre>`;

            const actions = document.createElement('div');
            const saveBtn = document.createElement('button');
            saveBtn.textContent = 'Save to File';
            saveBtn.onclick = () => {
                const defaultPath = filePath.replace('.ts', '.test.ts');
                const outputPath = prompt(`Enter path to save test file:`, defaultPath);
                if (outputPath) applyChanges(outputPath, newContent, panel);
            };
            actions.appendChild(saveBtn);
            panel.appendChild(actions);
        } catch (e) {
            panel.innerHTML = `Error: ${e.message}`;
        }
    }

    async function showGitDiffDialog() {
        const panel = createTab('Analyze Commits');
        panel.innerHTML = '<h3>Loading commit history...</h3>';
        try {
            const response = await fetch('/api/commits');
            if (!response.ok) throw new Error(`Server error: ${response.statusText}`);
            const commits = await response.json();
            
            if (commits.length === 0) {
                panel.innerHTML = '<h3>No commits found in this repository.</h3>';
                return;
            }

            const commitList = document.createElement('ul');
            commits.forEach(commitLine => {
                const [hash, author, date, msg] = commitLine.split('|');
                const li = document.createElement('li');
                li.textContent = `${hash} - ${msg.trim()} (${author}, ${date})`;
                // Store the hash in a data attribute instead of an inline onclick
                li.dataset.hash = hash;
                commitList.appendChild(li);
            });
            panel.innerHTML = '<h3>Select the START commit (older):</h3>';
            panel.appendChild(commitList);

            // After rendering, attach the click handlers
            panel.querySelectorAll('li').forEach(li => {
                li.onclick = () => onCommitSelect_Start(li.dataset.hash, commits, panel);
            });
        } catch (e) {
            panel.innerHTML = `Error: ${e.message}`;
        }
    }

    function onCommitSelect_Start(startCommit, commits, panel) {
        panel.innerHTML = '<h3>Select the END commit (newer):</h3>';
        const commitList = document.createElement('ul');
        commits.forEach(commitLine => {
            const [hash, author, date, msg] = commitLine.split('|');
            const li = document.createElement('li');
            li.textContent = `${hash} - ${msg.trim()} (${author}, ${date})`;
            // Store the hash in a data attribute
            li.dataset.hash = hash;
            commitList.appendChild(li);
        });
        panel.appendChild(commitList);

        // After rendering, attach the new click handlers
        panel.querySelectorAll('li').forEach(li => {
            li.onclick = () => onCommitSelect_End(startCommit, li.dataset.hash, panel);
        });
    }
    
    async function onCommitSelect_End(startCommit, endCommit, panel) {
        panel.innerHTML = '<h3>Generating Diff and AI Analysis...</h3>';
        try {
            const response = await fetch('/api/diff', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ startCommit, endCommit }),
            });

            // --- NEW DEBUGGING LOGS ---
            console.log('--- DEBUG: Raw response from server ---', response);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('--- DEBUG: Server returned an error ---', errorText);
                throw new Error(`Server error: ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log('--- DEBUG: Parsed JSON data from server ---', data);
            
            const { patch, analysis } = data;
            console.log('--- DEBUG: Value of analysis variable ---', analysis);
            console.log('--- DEBUG: Type of analysis variable ---', typeof analysis);

            const analysisElement = document.createElement('div');
            analysisElement.className = 'ai-analysis';
            
            const analysisHtml = (typeof analysis === 'string' && analysis) ? analysis.replace(/\n/g, '<br>') : 'No analysis provided.';
            analysisElement.innerHTML = `<h3>AI Summary</h3><p>${analysisHtml}</p>`;
            
            displayDiff(panel, patch, `Diff: ${startCommit.substring(0,7)}..${endCommit.substring(0,7)}`);
            
            panel.prepend(analysisElement);

        } catch (e) {
            console.error('--- DEBUG: Caught an error in onCommitSelect_End ---', e);
            panel.innerHTML = `Error: ${e.message}`;
        }
    }

    function displayDiff(panel, patch, title) {
        document.querySelector(`.tab[data-tab-id="${panel.dataset.tabId}"] span:first-child`).textContent = title;
        
        const diffJson = Diff2Html.parse(patch);
        const diffHtml = Diff2Html.html(diffJson, {
            drawFileList: false,
            outputFormat: 'side-by-side',
            matching: 'lines',
            colorScheme: 'dark'
        });

        // This prevents an empty diff box from showing if there are no changes
        if (!diffHtml) {
             panel.innerHTML = `<h3>${title}</h3><p>No changes detected.</p>`;
             return;
        }

        panel.innerHTML = `<h3>${title}</h3>` + diffHtml;
    }

    async function onCommitSelect_End(startCommit, endCommit, panel) {
        panel.innerHTML = '<h3>Generating Diff and AI Analysis...</h3>';
        try {
            const response = await fetch('/api/diff', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ startCommit, endCommit }),
            });
            if (!response.ok) throw new Error(`Server error: ${response.statusText}`);
            
            // Get both the patch and the analysis from the response
            const { patch, analysis } = await response.json();
            
            // --- NEW: Display the AI analysis ---
            const analysisElement = document.createElement('div');
            analysisElement.className = 'ai-analysis';
            analysisElement.innerHTML = `<h3>AI Summary</h3><p>${analysis.replace(/\n/g, '<br>')}</p>`;
            // ------------------------------------

            // Display the diff using the existing helper
            displayDiff(panel, patch, `Diff: ${startCommit.substring(0,7)}..${endCommit.substring(0,7)}`);
            
            // Prepend the analysis so it appears above the diff
            panel.prepend(analysisElement);

        } catch (e) {
            panel.innerHTML = `Error: ${e.message}`;
        }
    }
});