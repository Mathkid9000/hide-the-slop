const btn = document.getElementById('scan-all-btn')
const moneyText = document.getElementById('sub-scan-btn')
const badge = document.getElementById('word-count-badge')
const statusEl = document.getElementById('status')

const moneyPer1000Words = 0.034
let remainingBalance;
let finalBalance;
const MONEY_FORMATTER = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  });

chrome.storage.sync.get(['remain_balance'], data => {
    console.log(data)
    if (!parseFloat(data['remain_balance'])) data = { 'remain_balance': 10 }
    remainingBalance = data['remain_balance']
    moneyText.textContent = MONEY_FORMATTER.format(remainingBalance)
})

async function getActiveTabId() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    return tab?.id
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
        const words = res.totalWords ?? 0
        const count = res.count ?? 0
        const scannedPct = res.scannedPct ?? '0.0'
        const aiPct = res.aiPct ?? '0.0'
        const realPct = res.realPct ?? '0.0'
        badge.textContent = `${words.toLocaleString()} words`
        if (count === 0) {
            statusEl.textContent = 'No scannable sections found.'
        } else {
            btn.disabled = false
            if (parseFloat(scannedPct) > 0) {
                statusEl.textContent = `${scannedPct}% scanned — ${aiPct}% AI, ${realPct}% real`
            } else {
                statusEl.textContent = `${count} section${count !== 1 ? 's' : ''} ready to scan`
            }
        }

        const totalCost = moneyPer1000Words * words / 1000
        finalBalance = remainingBalance - totalCost
        console.log('set balance to', finalBalance)
        moneyText.textContent = MONEY_FORMATTER.format(remainingBalance.toFixed(2)) + " - " + MONEY_FORMATTER.format(totalCost.toFixed(2)) + " = " + MONEY_FORMATTER.format(finalBalance.toFixed(2))
    } catch {
        badge.textContent = '0 words'
        statusEl.textContent = 'Could not read page. Try reloading.'
    }
}

chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.scan_progress) return
    const p = changes.scan_progress.newValue
    if (!p) return
    if (p.scanning) {
        statusEl.textContent = `${p.completed}/${p.total} scanned — ${p.ai_words.toLocaleString()} AI words, ${p.real_words.toLocaleString()} real words`
    } else {
        statusEl.textContent = `Done — ${p.ai_words.toLocaleString()} AI words, ${p.real_words.toLocaleString()} real words`
        btn.disabled = false
        init()
    }
})

btn.addEventListener('click', async () => {
    const tabId = await getActiveTabId()
    if (!tabId) return

    btn.disabled = true
    statusEl.textContent = 'Scanning...'
    badge.textContent = '...'

    chrome.storage.sync.set({ 'remain_balance': finalBalance })
    remainingBalance = finalBalance
    console.log('SET FINAL BALANCE:', finalBalance)

    try {
        await chrome.tabs.sendMessage(tabId, { type: 'scanAll' })
    } catch {
        statusEl.textContent = 'Error: could not trigger scan.'
        btn.disabled = false
    }
})

function makePlaceholderIcon() {
    const ph = document.createElement('div')
    ph.className = 'site-icon-placeholder'
    return ph
}

function renderSiteList(siteData) {
    const section = document.getElementById('site-list-section')
    const container = document.getElementById('site-list')
    const entries = Object.entries(siteData)
    if (entries.length === 0) return
    section.style.display = 'block'
    entries.sort((a, b) => b[1].times_visited - a[1].times_visited)
    container.innerHTML = ''
    for (const [site, data] of entries) {
        if (site === 'undefined') continue
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
        stats.textContent = `${data.times_visited} visit${data.times_visited !== 1 ? 's' : ''} · ${totalWords.toLocaleString()} words scanned`
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
        container.appendChild(item)
    }
}

chrome.storage.local.get(['site_data'], data => {
    renderSiteList(data.site_data ?? {})
})

init()
