const btn = document.getElementById('scan-all-btn')
const moneyText = document.getElementById('sub-scan-btn')
const badge = document.getElementById('word-count-badge')
const statusEl = document.getElementById('status')
const apiKeyInput = document.getElementById('api-key-input')
const balanceInput = document.getElementById('balance-input')

const moneyPer1000Words = 0.034
let remainingBalance;
let finalBalance;
let lastData = null;
const MONEY_FORMATTER = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
});

chrome.storage.sync.get(['remain_balance', 'zerogpt_api_key'], data => {
    // console.log(data)
    remainingBalance = parseFloat(data['remain_balance'])
    if (!remainingBalance) remainingBalance = 10
    balanceInput.value = remainingBalance.toFixed(2)
    moneyText.textContent = MONEY_FORMATTER.format(remainingBalance)

    apiKeyInput.value = data['zerogpt_api_key'] ?? ''
})

apiKeyInput.addEventListener('change', () => {
    const key = apiKeyInput.value.trim()
    chrome.storage.sync.set({ zerogpt_api_key: key }, () => { })
})

balanceInput.addEventListener('input', () => {
    const value = parseFloat(balanceInput.value)
    if (isNaN(value) || value < 0) return
    remainingBalance = value
    chrome.storage.sync.set({ remain_balance: value })
    if (lastData) updatePopupText(lastData)
})

async function getActiveTabId() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    return tab?.id
}

function updatePopupText(data) {
    lastData = data
    // console.log(data.text.substring(0, 130))
    const words = data.totalWords ?? 0
    const scannedPct = data.scannedPct ?? '0.0'
    const aiPct = data.aiPct ?? '0.0'
    const realPct = data.realPct ?? '0.0'
    badge.textContent = `${words.toLocaleString()} words`
    if (words === 0) {
        statusEl.textContent = 'No scannable sections found.'
    } else {
        btn.disabled = false
        if (parseFloat(scannedPct) > 0) {
            statusEl.textContent = `${scannedPct}% scanned — ${aiPct}% AI, ${realPct}% real`
        } else {
            statusEl.textContent = `Ready to scan`
        }
    }

    const totalCost = moneyPer1000Words * words / 1000
    finalBalance = remainingBalance - totalCost
    // console.log('set balance to', finalBalance)
    moneyText.textContent = MONEY_FORMATTER.format(remainingBalance.toFixed(2)) + " - " + MONEY_FORMATTER.format(totalCost.toFixed(2)) + " = " + MONEY_FORMATTER.format(finalBalance.toFixed(2))
}

async function init() {
    const tabId = await getActiveTabId()
    if (!tabId) {
        badge.textContent = '0 words'
        statusEl.textContent = 'No active tab found.'
        return
    }

    try {
        const res = await chrome.tabs.sendMessage(tabId, { type: 'getWordCounts' })
        updatePopupText(res)
    } catch {
        badge.textContent = '0 words'
        statusEl.textContent = 'Could not read page. Try reloading.'
    }
}

chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.scan_progress) return
    const p = changes.scan_progress.newValue
    if (!p) return
    // console.log('recieved scan', p)
    if (p.scanning) {
        statusEl.textContent = `Scanning...`
    } else {
        statusEl.textContent = `${p.ai_words.toLocaleString()} AI words, ${p.real_words.toLocaleString()} real words`
        btn.disabled = false
        init()
        refreshSiteList()
    }
})

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Only claim messages we actually handle. Returning a value (incl. an async
    // function's Promise) for other types makes Chrome treat the popup as the
    // responder and deliver our (empty) reply instead of the background's —
    // which is what was turning analyzeText's response into null.
    if (message.type !== "updateText") return

    getActiveTabId().then(activeId => {
        // console.log("recieved message", message, sender, activeId)
        try {
            if (activeId === sender.tab?.id)
                updatePopupText(message.data)
        } catch (err) {
            console.error('updateText handler failed', err)
        }
        sendResponse({})
    })
    return true // keep the channel open for the async sendResponse above
})

btn.addEventListener('click', async () => {
    const tabId = await getActiveTabId()
    if (!tabId) return

    btn.disabled = true
    statusEl.textContent = 'Scanning...'
    badge.textContent = '...'

    chrome.storage.sync.set({ 'remain_balance': finalBalance })
    remainingBalance = finalBalance
    balanceInput.value = finalBalance.toFixed(2)
    // console.log('SET FINAL BALANCE:', finalBalance)

    try {
        await chrome.tabs.sendMessage(tabId, { type: 'scanAll' })
    } catch (e) {
        statusEl.textContent = 'Error: could not trigger scan.'
        console.log(e)
        btn.disabled = false
    }
})

function makePlaceholderIcon() {
    const ph = document.createElement('div')
    ph.className = 'site-icon-placeholder'
    return ph
}

function deleteSite(site, item) {
    chrome.storage.local.get(['site_data'], data => {
        const siteData = data.site_data ?? {}
        delete siteData[site]
        chrome.storage.local.set({ site_data: siteData }, () => {
            item.remove()
            const container = document.getElementById('site-list')
            if (container.children.length === 0) {
                document.getElementById('site-list-section').style.display = 'none'
            }
        })
    })
}

function makeDeleteActions(site, item) {
    const actions = document.createElement('div')
    actions.className = 'site-actions'

    const deleteBtn = document.createElement('button')
    deleteBtn.className = 'site-delete-btn'
    deleteBtn.textContent = '✕'
    deleteBtn.title = 'Delete site data'
    deleteBtn.addEventListener('click', () => deleteSite(site, item))

    actions.appendChild(deleteBtn)
    return actions
}

function renderSiteList(siteData) {
    const section = document.getElementById('site-list-section')
    const container = document.getElementById('site-list')
    const entries = Object.entries(siteData)
    if (entries.length === 0) return
    section.style.display = 'block'
    entries.sort((a, b) => b[1].ai_words_seen_cumulative - a[1].ai_words_seen_cumulative)
    container.innerHTML = ''
    for (const [site, data] of entries) {
        if (site === 'undefined' || data.words_seen === 0) continue
        const aiWords = data.ai_words_seen ?? 0
        const totalWords = data.words_seen ?? 0
        const realWords = Math.max(0, totalWords - aiWords)
        const aiPct = totalWords > 0 ? (aiWords / totalWords * 100) : 0
        const realPct = totalWords > 0 ? (realWords / totalWords * 100) : 0

        const item = document.createElement('div')
        item.className = 'site-item'

        if (data.icon_url) {
            const img = document.createElement('img')
            img.className = 'site-icon'
            img.src = data.icon_url
            img.onerror = () => img.replaceWith(makePlaceholderIcon())
            item.appendChild(img)
        } else {
            item.appendChild(makePlaceholderIcon())
        }

        const content = document.createElement('div')
        content.className = 'site-content'

        const name = document.createElement('div')
        name.className = 'site-name'
        name.textContent = site
        content.appendChild(name)

        const stats = document.createElement('div')
        stats.className = 'site-stats'
        stats.textContent = `${data.times_visited} visit${data.times_visited !== 1 ? 's' : ''} · ${(data.ai_words_seen_cumulative ?? 0).toLocaleString()} AI words seen`
        content.appendChild(stats)

        const barWrap = document.createElement('div')
        barWrap.className = 'site-bar-wrap'
        const barAi = document.createElement('div')
        barAi.className = 'site-bar-ai'
        barAi.style.width = aiPct + '%'
        const barReal = document.createElement('div')
        barReal.className = 'site-bar-real'
        barReal.style.width = realPct + '%'
        barWrap.appendChild(barAi)
        barWrap.appendChild(barReal)
        content.appendChild(barWrap)

        const barLabel = document.createElement('div')
        barLabel.className = 'site-bar-label'
        barLabel.textContent = totalWords > 0
            ? `${aiPct.toFixed(0)}% AI · ${realPct.toFixed(0)}% real`
            : 'No scan data yet'
        content.appendChild(barLabel)

        item.appendChild(content)
        item.appendChild(makeDeleteActions(site, item))
        container.appendChild(item)
    }
}

function refreshSiteList() {
    chrome.storage.local.get(['site_data'], data => {
        renderSiteList(data.site_data ?? {})
    })
}

refreshSiteList()

init()
