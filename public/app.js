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
    const logHistory = [];
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
    if(agentTaskBtn) agentTaskBtn.addEventListener('click', showAgentDialog);
    if(addDocsBtn) addDocsBtn.addEventListener('click', showAddDocsDialog);
    if(refactorBtn) refactorBtn.addEventListener('click', showRefactorDialog);
    if(testBtn) testBtn.addEventListener('click', showTestDialog);
    if(gitDiffBtn) gitDiffBtn.addEventListener('click', showGitDiffDialog);
    if(reportBtn) reportBtn.addEventListener('click', showReport);
    
    indexNowBtn.addEventListener('click', () => {
        indexingModal.classList.add('hidden');
        const panel = createTab('Indexing Project');
        panel.innerHTML = '<h3>Indexing codebase...</h3>';
        setTabStatus(panel, 'running'); // Start the spinner
        socket.send(JSON.stringify({ type: 'start-indexing' }));
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
        if (messageType === 'index-required') {
            indexingModal.classList.remove('hidden');
            return;
        }
        if (['start', 'chunk', 'end'].includes(messageType)) {
            handleChatMessage(message);
        } else {
            handleLogMessage(message);
        }
    }
    function handleChatMessage(message) {
        switch (message.type) {
            case 'start': assistantMessageElement = createMessageElement('assistant'); chatWindow.prepend(assistantMessageElement); break;
            case 'chunk': if (assistantMessageElement) assistantMessageElement.firstChild.textContent += message.content; break;
            case 'end': assistantMessageElement = null; break;
        }
    }
    function handleLogMessage(message) {
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
            default: return;
        }

        const activePanel = document.querySelector('.tab-panel.active');
        if (message.type === 'finish' || message.type === 'error') {
            if(activePanel) setTabStatus(activePanel, 'finished');
        }

        logHistory.push(logText);
        const logsPanel = document.querySelector('.tab-panel[data-tab-id="logs"] pre');
        if (logsPanel) {
            logsPanel.textContent = logHistory.join(message.type === 'stream-chunk' ? '' : '\n\n');
            logsPanel.parentElement.scrollTop = logsPanel.parentElement.scrollHeight;
        }
        if (message.type !== 'finish' && message.type !== 'error') {
            switchToTab('logs');
        }
    }
    function handleChatSubmit(e) {
        e.preventDefault();
        const messageText = messageInput.value;
        if (messageText.trim() === '') return;
        switchToTab('home');
        const userMessage = createMessageElement('user');
        userMessage.firstChild.textContent = messageText;
        chatWindow.prepend(userMessage);
        socket.send(JSON.stringify({ type: 'chat', content: messageText }));
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
            switchToTab('logs');
            const logsPanel = document.querySelector('.tab-panel[data-tab-id="logs"] pre');
            if(logsPanel) logsPanel.textContent = '';
            logHistory.length = 0;
            socket.send(JSON.stringify({ type: 'agent-task', task }));
        }
    }
    function showReport() {
        const panel = createTab('Project Report');
        panel.innerHTML = '<h3>Generating project report...</h3>';
        setTabStatus(panel, 'running'); // Start the spinner
        socket.send(JSON.stringify({ type: 'get-report' }));
    }
    function showAddDocsDialog() { showGenericFileDialog('Add Docs', onFileSelectForDocs); }
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
        if (!promptText || !promptText.trim()) { closeTab(panel.dataset.tabId); return; }
        panel.innerHTML = '<h3>Refactoring file...</h3>';
        try {
            const response = await fetch('/api/refactor', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filePath, prompt: promptText }) });
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
        } catch (e) { panel.innerHTML = `Error: ${e.message}`; }
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
        panel.innerHTML = '<h3>Loading functions from file...</h3>';
        try {
            const response = await fetch('/api/list-symbols', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filePath }) });
            if (!response.ok) throw new Error(`Server error: ${response.statusText}`);
            const symbols = await response.json();
            if (symbols.length === 0) {
                panel.innerHTML = `<h3>No functions or classes found in ${filePath}.</h3>`; return;
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
        } catch (e) { panel.innerHTML = `Error: ${e.message}`; }
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