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
    const gitBranchesBtn = document.getElementById('git-branches-btn');
    const reportBtn = document.getElementById('report-btn');
    const repoSelectorOverlay = document.getElementById('repo-selector-overlay');
    const appContainer = document.getElementById('app-container');
    const repoList = document.getElementById('repo-list');
    const localList = document.getElementById('local-list');
    const cloneForm = document.getElementById('clone-form');
    const repoUrlInput = document.getElementById('repo-url');
    const repoPatInput = document.getElementById('repo-pat');
    const indexingModal = document.getElementById('indexing-modal');
    const indexNowBtn = document.getElementById('index-now-btn');
    const indexCancelBtn = document.getElementById('index-cancel-btn');

    // --- STATE MANAGEMENT ---
    let tabCounter = 0;
    let assistantMessageElement = null;

    // --- INITIALIZATION ---
    initializeRepoSelector();
    initFixedTabs();

    // --- WEBSOCKET SETUP ---
    const socket = new WebSocket(`ws://${window.location.host}`);
    socket.onopen = () => console.log('WebSocket connection established.');
    socket.onmessage = handleSocketMessage;

    // --- EVENT LISTENERS ---
    chatForm.addEventListener('submit', handleChatSubmit);
    if (agentTaskBtn) agentTaskBtn.addEventListener('click', showAgentDialog);
    if (addDocsBtn) addDocsBtn.addEventListener('click', showAddDocsDialog);
    if (refactorBtn) refactorBtn.addEventListener('click', showRefactorDialog);
    if (testBtn) testBtn.addEventListener('click', showTestDialog);
    if (gitDiffBtn) gitDiffBtn.addEventListener('click', showGitDiffDialog);
    if (gitBranchesBtn) gitBranchesBtn.addEventListener('click', showGitBranchesDialog);
    if (reportBtn) reportBtn.addEventListener('click', showReport);

    indexNowBtn.addEventListener('click', () => {
        indexingModal.classList.add('hidden');
        const taskId = `task-${Date.now()}`;
        const panel = createTab('Indexing Project', true, taskId);
        panel.innerHTML = '<h3>Indexing codebase...</h3>';
        setTabStatus(panel, 'running'); // Start the spinner
        socket.send(JSON.stringify({ type: 'start-indexing', taskId }));
    });

    indexCancelBtn.addEventListener('click', () => {
        indexingModal.classList.add('hidden');
    });

    // --- REPO SELECTOR LOGIC ---
    async function initializeRepoSelector() {
        try {
            const response = await fetch('/api/projects');
            if (!response.ok) throw new Error(`Server error: ${response.statusText}`);
            const projects = await response.json();
            if (projects.error) throw new Error(projects.error);

            repoList.innerHTML = '';
            if (projects.cloned && projects.cloned.length > 0) {
                projects.cloned.forEach(repo => {
                    const li = document.createElement('li');
                    li.textContent = repo.name;
                    li.onclick = () => selectProject(repo.path);
                    repoList.appendChild(li);
                });
            } else {
                repoList.innerHTML = '<li>No repositories cloned yet.</li>';
            }

            localList.innerHTML = '';
            if (projects.local && projects.local.length > 0) {
                projects.local.forEach(project => {
                    const li = document.createElement('li');
                    li.textContent = project.name;
                    li.onclick = () => selectProject(project.path);
                    localList.appendChild(li);
                });
            } else {
                localList.innerHTML = '<li>No local projects found in the mounted directory.</li>';
            }
        } catch (error) {
            console.error("Failed to initialize repo selector:", error);
            repoList.innerHTML = `<li>Error: ${error.message}</li>`;
            localList.innerHTML = `<li>Check server logs for details.</li>`;
        }
    }

    async function selectProject(projectPath) {
        await fetch('/api/set-active-project', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectPath }),
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
        try {
            const response = await fetch('/api/repos/clone', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ repoUrl, pat }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Unknown cloning error');

            await initializeRepoSelector();
            const newRepoResponse = await fetch('/api/projects');
            const projects = await newRepoResponse.json();
            const newRepo = projects.cloned.find(r => r.name === result.repoName);
            if (newRepo) {
                await selectProject(newRepo.path);
            } else {
                throw new Error('Could not find newly cloned repository.');
            }
        } catch (error) {
            alert(`Error cloning repository: ${error.message}`);
            cloneButton.textContent = 'Clone';
            cloneButton.disabled = false;
        }
    });

    // --- TAB MANAGEMENT ---
    function createTab(title, makeActive = true, taskId = null) {
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
        closeBtn.onclick = (e) => { e.stopPropagation(); closeTab(tabId); };
        tab.appendChild(closeBtn);
        const spinner = document.createElement('div');
        spinner.className = 'tab-spinner';
        spinner.style.display = 'none';
        tab.appendChild(spinner);
        tabBar.appendChild(tab);
        tab.onclick = () => switchToTab(tabId);
        const panel = document.createElement('div');
        panel.className = 'tab-panel';
        panel.dataset.tabId = tabId;
        if (taskId) {
            panel.dataset.taskId = taskId;
        }
        tabPanels.appendChild(panel);
        if (makeActive) {
            switchToTab(tabId);
        }
        return panel;
    }

    function switchToTab(tabId) {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelector(`.tab[data-tab-id="${tabId}"]`)?.classList.add('active');
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        document.querySelector(`.tab-panel[data-tab-id="${tabId}"]`)?.classList.add('active');
    }

    function closeTab(tabId) {
        if (['home', 'logs'].includes(tabId)) return;
        document.querySelector(`.tab[data-tab-id="${tabId}"]`)?.remove();
        document.querySelector(`.tab-panel[data-tab-id="${tabId}"]`)?.remove();
        switchToTab('home');
    }

    function setTabStatus(panel, status) {
        const tabId = panel.dataset.tabId;
        const tab = document.querySelector(`.tab[data-tab-id="${tabId}"]`);
        if (!tab) return;

        const spinner = tab.querySelector('.tab-spinner');
        const closeBtn = tab.querySelector('.close-tab');

        if (status === 'running') {
            if (spinner) spinner.style.display = 'block';
            if (closeBtn) closeBtn.style.display = 'none';
        } else { // 'finished' or 'error'
            if (spinner) spinner.style.display = 'none';
            if (closeBtn) closeBtn.style.display = 'flex';
        }
    }

    function initFixedTabs() {
        tabBar.innerHTML = '';

        const homeTab = document.createElement('div');
        homeTab.className = 'tab active';
        homeTab.dataset.tabId = 'home';
        homeTab.textContent = 'Chat';
        homeTab.onclick = () => switchToTab('home');
        tabBar.appendChild(homeTab);

        // The 'Logs' tab is kept for general server messages but is no longer used for tasks.
        const logsTab = document.createElement('div');
        logsTab.className = 'tab';
        logsTab.dataset.tabId = 'logs';
        logsTab.textContent = 'Logs';
        logsTab.onclick = () => switchToTab('logs');
        tabBar.appendChild(logsTab);

        const logsPanel = document.createElement('div');
        logsPanel.className = 'tab-panel';
        logsPanel.dataset.tabId = 'logs';
        const pre = document.createElement('pre');
        pre.style.whiteSpace = 'pre-wrap';
        logsPanel.appendChild(pre);
        tabPanels.appendChild(logsPanel);
    }
    initFixedTabs();

    // --- MESSAGE HANDLING ---
    function handleSocketMessage(event) {
        const message = JSON.parse(event.data);
        const messageType = message.type;

        if (message.taskId) {
            const panel = document.querySelector(`.tab-panel[data-task-id="${message.taskId}"]`);
            if (panel) {
                handleTaskUpdate(message, panel);
            } else {
                console.warn('Received message for non-existent task ID:', message.taskId);
            }
            return;
        }

        if (messageType === 'index-required') {
            indexingModal.classList.remove('hidden');
        } else if (messageType === 'finish') {
            // This handles the 'finish' message from the index-core.ts
            indexingModal.classList.add('hidden'); // Hide the modal

            if (pendingUserMessage) {
                console.log("Indexing complete. Re-sending pending message:", pendingUserMessage);
                socket.send(JSON.stringify(pendingUserMessage));
                pendingUserMessage = null; // Clear the pending message after re-sending
            }

            // Add back logging for consistency
            const logsPanel = document.querySelector('.tab-panel[data-tab-id="logs"] pre');
            if(logsPanel) {
                logsPanel.textContent += JSON.stringify(message, null, 2) + '\n';
                logsPanel.parentElement.scrollTop = logsPanel.parentElement.scrollHeight;
            }

        } else if (['start', 'chunk', 'end'].includes(messageType)) {
            handleChatMessage(message);
        } else {
            // Fallback for any non-task, non-chat messages
            console.log("Generic log message:", message);
            const logsPanel = document.querySelector('.tab-panel[data-tab-id="logs"] pre');
            if(logsPanel) {
                logsPanel.textContent += JSON.stringify(message, null, 2) + '\n';
                logsPanel.parentElement.scrollTop = logsPanel.parentElement.scrollHeight;
            }
        }
    }

    function handleChatMessage(message) {
        switch (message.type) {
            case 'start':
                assistantMessageElement = createMessageElement('assistant');
                chatWindow.prepend(assistantMessageElement);
                break;
            case 'chunk':
                if (assistantMessageElement) assistantMessageElement.firstChild.textContent += message.content;
                break;
            case 'end':
                assistantMessageElement = null;
                break;
        }
    }

    function handleTaskUpdate(message, panel) {
        let pre = panel.querySelector('pre');
        if (!pre) {
            panel.innerHTML = ''; // Clear initial message like "Generating..."
            pre = document.createElement('pre');
            panel.appendChild(pre);
        }

        let logText = '';
        switch (message.type) {
            case 'thought': logText = `[THOUGHT] ${message.content}`; break;
            case 'action': logText = `[ACTION] ${message.content}`; break;
            case 'observation': logText = `[OBSERVATION]\n${message.content}`; break;
            case 'finish': logText = `✅ [FINISH] ${message.content}`; break;
            case 'error': logText = `❌ [ERROR] ${message.content}`; break;
            case 'stream-start': logText = '\n--- AI RESPONSE ---\n'; break;
            case 'stream-chunk': logText = message.content; break;
            case 'stream-end': logText = ''; break;
            default: logText = `[INFO] ${JSON.stringify(message.content)}`; break;
        }

        if (logText) {
             pre.textContent += logText + (message.type === 'stream-chunk' ? '' : '\n\n');
             panel.scrollTop = panel.scrollHeight;
        }

        if (message.type === 'finish' || message.type === 'error') {
            setTabStatus(panel, 'finished');
        }
    }

    let pendingUserMessage = null;

    function handleChatSubmit(e) {
        e.preventDefault();
        const messageText = messageInput.value;
        if (messageText.trim() === '') return;
        switchToTab('home');
        const userMessage = createMessageElement('user');
        userMessage.firstChild.textContent = messageText;
        chatWindow.prepend(userMessage);
        socket.send(JSON.stringify({ type: 'chat', content: messageText }));
        pendingUserMessage = messageText;
        messageInput.value = '';
    }

    function createMessageElement(role, type = 'normal') {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', role);
        if (type === 'error') messageDiv.style.color = '#ff8a8a';
        const p = document.createElement('p');
        messageDiv.appendChild(p);
        return messageDiv;
    }

    // --- ACTION WORKFLOWS ---
    function showAgentDialog() {
        const task = prompt("What task would you like the AI agent to perform?");
        if (task && task.trim()) {
            const taskId = `task-${Date.now()}`;
            const panel = createTab('Agent Task', true, taskId);
            panel.innerHTML = `<h3>Running agent with task: "${task}"</h3>`;
            setTabStatus(panel, 'running');
            socket.send(JSON.stringify({ type: 'agent-task', task, taskId }));
        }
    }

    function showReport() {
        const taskId = `task-${Date.now()}`;
        const panel = createTab('Project Report', true, taskId);
        panel.innerHTML = '<h3>Generating project report...</h3>';
        setTabStatus(panel, 'running'); // Start the spinner
        socket.send(JSON.stringify({ type: 'get-report', taskId }));
    }
    
    // Unmodified functions from here down...
    function showAddDocsDialog() { showGenericFileDialog('Add Docs', onFileSelectForDocs); }

    function showGenericFileDialog(title, onFileSelectCallback) {
        const panel = createTab(title); // Assuming createTab exists
        panel.innerHTML = `<h3>${title}: Select a file...</h3>`;

        // This part is crucial: you need to provide a way for the user
        // to select a file, and then call onFileSelectCallback(selectedFilePath, panel)
        // once a file is chosen.

        // For demonstration, let's simulate a file selection with a prompt for now:
        const filePath = prompt(`Enter the path to the file for ${title}:`);
        if (filePath && filePath.trim()) {
            onFileSelectCallback(filePath.trim(), panel);
        } else {
            panel.innerHTML = `${title} cancelled.`;
        }

        // In a real application, this would involve rendering a file tree,
        // input fields, or a file picker UI.
    }

    async function onFileSelectForDocs(filePath, panel) {
        panel.innerHTML = '<h3>Generating Documentation...</h3>';
        try {
            const response = await fetch('/api/add-docs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filePath }) });
            if (!response.ok) throw new Error(`Server error: ${response.statusText}`);
            const { patch, newContent } = await response.json();
            displayDiff(panel, patch, `Docs: ${filePath.split('/').pop().split('\\').pop()}`);
            const actions = document.createElement('div');
            actions.className = 'actions';
            const applyBtn = document.createElement('button');
            applyBtn.textContent = 'Apply Changes';
            applyBtn.onclick = () => applyChanges(filePath, newContent, panel);
            actions.appendChild(applyBtn);
            panel.appendChild(actions);
        } catch (e) { panel.innerHTML = `Error: ${e.message}`; }
    }
    function showRefactorDialog() { showGenericFileDialog('Refactor File', onFileSelectForRefactor); }

    async function onFileSelectForRefactor(filePath, panel) {
        const promptText = prompt(`Enter refactoring instructions for ${filePath}:`);
        if (!promptText || !promptText.trim()) {
            panel.innerHTML = 'Refactoring cancelled.';
            return;
        }
        panel.innerHTML = '<h3>Applying Refactoring...</h3>';
        try {
            const response = await fetch('/api/refactor', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filePath, prompt: promptText })
            });
            if (!response.ok) throw new Error(`Server error: ${response.statusText}`);
            const { patch, newContent } = await response.json();
            displayDiff(panel, patch, `Refactor: ${filePath.split('/').pop().split('\\').pop()}`);
            const actions = document.createElement('div');
            actions.className = 'actions';
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
                panel.innerHTML = '<h3>No files with testable functions found.</h3>'; return;
            }
            const treeRoot = document.createElement('ul');
            treeRoot.className = 'file-tree';
            treeData.children.forEach(node => {
                treeRoot.appendChild(renderFileTree(node, (filePath) => onFileSelectForTest(filePath, panel)));
            });
            panel.innerHTML = `<h3>Generate Test: Select a File</h3>`;
            panel.appendChild(treeRoot);
        } catch (e) { panel.innerHTML = `Error: ${e.message}`; }
    }
    async function onFileSelectForTest(filePath, panel) {
        const symbol = prompt(`Enter the symbol (function/class name) for which to generate tests in ${filePath}:`);
        if (!symbol || !symbol.trim()) {
            panel.innerHTML = 'Test generation cancelled: Symbol not provided.';
            return;
        }
        const framework = prompt(`Enter the testing framework (e.g., 'jest', 'mocha', 'pytest') for ${filePath}:`);
        // You might want to add validation or default for framework
        
        panel.innerHTML = '<h3>Generating Test...</h3>';
        try {
            const response = await fetch('/api/test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filePath, symbol, framework })
            });
            if (!response.ok) throw new Error(`Server error: ${response.statusText}`);
            const { newContent } = await response.json();
            
            // For tests, you might just display the new content or offer to save it
            // If the server returns a patch, you'd use displayDiff similar to add-docs/refactor
            panel.innerHTML = `<h3>Generated Test Content for ${filePath.split('/').pop().split('\\').pop()}:</h3><pre>${newContent}</pre>`;
            
            const actions = document.createElement('div');
            actions.className = 'actions';
            const applyBtn = document.createElement('button');
            applyBtn.textContent = 'Apply Changes (Save Test File)';
            // You might want to suggest a new filename for the test file (e.g., originalFile.test.ts)
            // For simplicity, this example just applies to the original file, which might not be desired for tests.
            // A more robust solution would let the user specify the test file path.
            applyBtn.onclick = () => applyChanges(filePath.replace(/\.([a-zA-Z0-9]+)$/, '.test.$1'), newContent, panel); 
            actions.appendChild(applyBtn);
            panel.appendChild(actions);

        } catch (e) {
            panel.innerHTML = `Error: ${e.message}`;
        }
    }

    async function onSymbolSelectForTest(filePath, symbol, panel) {
        const framework = prompt(`Enter the testing framework for "${symbol}":`, 'jest');
        if (!framework || !framework.trim()) { closeTab(panel.dataset.tabId); return; }
        panel.innerHTML = `<h3>Generating ${framework} test for "${symbol}"...</h3>`;
        try {
            const response = await fetch('/api/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filePath, symbol, framework }) });
            if (!response.ok) throw new Error(`Server error: ${response.statusText}`);
            const { newContent } = await response.json();
            document.querySelector(`.tab[data-tab-id="${panel.dataset.tabId}"] span:first-child`).textContent = `Test: ${symbol}`;
            panel.innerHTML = `<h3>Generated Test for ${symbol}</h3><pre><code>${newContent.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</code></pre>`;
            const actions = document.createElement('div');
            actions.className = 'actions';
            const saveBtn = document.createElement('button');
            saveBtn.textContent = 'Save to File';
            saveBtn.onclick = () => {
                const defaultPath = filePath.replace('.ts', '.test.ts').replace('.py', '_test.py');
                const outputPath = prompt(`Enter path to save test file:`, defaultPath);
                if (outputPath) applyChanges(outputPath, newContent, panel);
            };
            actions.appendChild(saveBtn);
            panel.appendChild(actions);
        } catch (e) { panel.innerHTML = `Error: ${e.message}`; }
    }

    async function showGitBranchesDialog() {
        const panel = createTab('Analyze Branches');
        panel.innerHTML = '<h3>Loading branch history...</h3>';
        try {
            const response = await fetch('/api/branches');
            if (!response.ok) throw new Error(`Server error: ${response.statusText}`);
            const branches = await response.json();
            
            if (branches.length < 2) {
                panel.innerHTML = '<h3>Not enough branches to compare.</h3>';
                return;
            }

            const branchList = document.createElement('ul');
            branches.forEach(branchName => {
                const li = document.createElement('li');
                li.textContent = branchName;
                li.onclick = () => onBranchSelect_Start(branchName, branches, panel);
                branchList.appendChild(li);
            });
            panel.innerHTML = '<h3>Select the BASE branch (e.g., main):</h3>';
            panel.appendChild(branchList);

        } catch (e) {
            panel.innerHTML = `Error: ${e.message}`;
        }
    }

    function onBranchSelect_Start(baseBranch, branches, panel) {
        panel.innerHTML = '<h3>Select the COMPARE branch (e.g., your feature branch):</h3>';
        const remainingBranches = branches.filter(b => b !== baseBranch);
        const branchList = document.createElement('ul');
        remainingBranches.forEach(branchName => {
            const li = document.createElement('li');
            li.textContent = branchName;
            li.onclick = () => onBranchSelect_End(baseBranch, branchName, panel);
            branchList.appendChild(li);
        });
        panel.appendChild(branchList);
    }

    async function onBranchSelect_End(baseBranch, compareBranch, panel) {
        panel.innerHTML = '<h3>Generating Diff and AI Analysis...</h3>';
        try {
            const response = await fetch('/api/diff', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ baseBranch, compareBranch }), // Send branches instead of commits
            });
            if (!response.ok) throw new Error(`Server error: ${response.statusText}`);
            const { patch, analysis } = await response.json();
            
            const analysisElement = document.createElement('div');
            analysisElement.className = 'ai-analysis';
            const analysisHtml = (typeof analysis === 'string' && analysis) ? analysis.replace(/\n/g, '<br>') : 'No analysis provided.';
            analysisElement.innerHTML = `<h3>AI Summary</h3><p>${analysisHtml}</p>`;
            
            displayDiff(panel, patch, `Diff: ${baseBranch}...${compareBranch}`);
            panel.prepend(analysisElement);
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
                panel.innerHTML = '<h3>No commits found in this repository.</h3>'; return;
            }
            const commitList = document.createElement('ul');
            commits.forEach(commitLine => {
                const [hash, author, date, msg] = commitLine.split('|');
                const li = document.createElement('li');
                li.textContent = `${hash} - ${msg.trim()} (${author}, ${date})`;
                li.dataset.hash = hash;
                commitList.appendChild(li);
            });
            panel.innerHTML = '<h3>Select the START commit (older):</h3>';
            panel.appendChild(commitList);
            panel.querySelectorAll('li').forEach(li => {
                li.onclick = () => onCommitSelect_Start(li.dataset.hash, commits, panel);
            });
        } catch (e) { panel.innerHTML = `Error: ${e.message}`; }
    }
    
    function onCommitSelect_Start(startCommit, commits, panel) {
        panel.innerHTML = '<h3>Select the END commit (newer):</h3>';
        const commitList = document.createElement('ul');
        commits.forEach(commitLine => {
            const [hash, author, date, msg] = commitLine.split('|');
            const li = document.createElement('li');
            li.textContent = `${hash} - ${msg.trim()} (${author}, ${date})`;
            li.dataset.hash = hash;
            commitList.appendChild(li);
        });
        panel.appendChild(commitList);
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
            if (!response.ok) throw new Error(`Server error: ${response.statusText}`);
            const { patch, analysis } = await response.json();
            const analysisElement = document.createElement('div');
            analysisElement.className = 'ai-analysis';
            const analysisHtml = (typeof analysis === 'string' && analysis) ? analysis.replace(/\n/g, '<br>') : 'No analysis provided.';
            analysisElement.innerHTML = `<h3>AI Summary</h3><p>${analysisHtml}</p>`;
            displayDiff(panel, patch, `Diff: ${startCommit.substring(0,7)}..${endCommit.substring(0,7)}`);
            panel.prepend(analysisElement);
        } catch (e) { panel.innerHTML = `Error: ${e.message}`; }
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
        if (!diffHtml) {
            panel.innerHTML = `<h3>${title}</h3><p>No changes detected.</p>`;
            return;
        }
        panel.innerHTML = `<h3>${title}</h3>` + diffHtml;
    }
});