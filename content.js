window.addEventListener("load", () => setTimeout(load_window, 1000), false);

const TEXT_LENGTH_THRESHOLD = 100
const SENTENCE_LENGTH_THRSHOLD = 20
const TEXT_LENGTH_TARGET = 100
const GROUP_PROXIMITY_THRESHOLD = 30
const SLOP_URL =  chrome.runtime.getURL("image.jpg");
let SITE_DATA = {}
let AI_SENTENCES = []
let NON_AI_SENTENCES = []
let TRACKED_ELEMENTS = []

const currentSite = window.location.href.split('://')[1].split('/')[0]
console.log("CURRENT SITE:", currentSite, window.location.href)

function load_window() {
    // getTextBoxes()
    setupMutationObserver()
    updatePageText()
    autoHideSentences()
}

chrome.storage.local.get([ 'site_data' ], data => {
    SITE_DATA = data.site_data ?? {}
    console.log('Loaded site data:', SITE_DATA)
})

chrome.storage.local.get([ 'ai_sentences', 'non_ai_sentences' ], data => {
    AI_SENTENCES = (data.ai_sentences ?? []).filter(s => s.trim().length >= SENTENCE_LENGTH_THRSHOLD).map(s => s.replaceAll('\n', ' '))
    NON_AI_SENTENCES = (data.non_ai_sentences ?? []).filter(s => s.trim().length >= SENTENCE_LENGTH_THRSHOLD).map(s => s.replaceAll('\n', ' '))
    console.log('Loaded sentence data:', AI_SENTENCES.length, 'AI,', NON_AI_SENTENCES.length, 'non-AI')
})

chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return
    if (changes.ai_sentences) {
        AI_SENTENCES = (changes.ai_sentences.newValue ?? []).filter(s => s.trim().length >= SENTENCE_LENGTH_THRSHOLD).map(s => s.replaceAll('\n', ' '))
        autoHideSentences()
        updateAllButtonLabels()
    }
    if (changes.non_ai_sentences) {
        NON_AI_SENTENCES = (changes.non_ai_sentences.newValue ?? []).filter(s => s.trim().length >= SENTENCE_LENGTH_THRSHOLD).map(s => s.replaceAll('\n', ' '))
        updateAllButtonLabels()
    }
})

function getPageText() {
    const text = document.body.innerText
    const prescreened = preScreenText(text)
    let filtered = prescreened.filteredText

    filtered = filtered.split('.').filter(sentence => {
        let count = 0
        let index = 0
        while (filtered.indexOf(sentence.trim(), index) !== -1) {
            if (count >= 1) break
            else count++
            index = filtered.indexOf(sentence.trim(), index) + sentence.trim().length
        }

        return count == 1
    }).join('.')

    filtered = filtered.split('\n').filter(sentence => {
        let count = 0
        let index = 0
        while (filtered.indexOf(sentence.trim(), index) !== -1) {
            if (count >= 1) break
            else count++
            index = filtered.indexOf(sentence.trim(), index) + sentence.trim().length
        }

        return count == 1
    }).join('\n')

    prescreened.filteredText = filtered
    return prescreened
}

function updatePageText() {
    const data = getPageText()
    const totalWords = data.filteredText.replaceAll('  ', ' ').split(' ').length
    const totalAiChars = data.removedAiCharacters
    const totalNonAiChars = data.removedNonAiCharacters
    const totalChars = data.totalCharacters
    const scannedPct = totalChars > 0 ? ((totalAiChars + totalNonAiChars) / totalChars * 100).toFixed(1) : '0.0'
    const aiPct = totalChars > 0 ? (totalAiChars / totalChars * 100).toFixed(1) : '0.0'
    const realPct = totalChars > 0 ? (totalNonAiChars / totalChars * 100).toFixed(1) : '0.0'

    new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ type: "updateText", data: { totalWords, scannedPct, aiPct, realPct, text: data.filteredText } }, (response) => { });
    })
}

/*
function getTextBoxes() {
    console.log(document.body)
    const textTags = [ 'p', 'span' ]
    let textBoxes = []

    textTags.forEach(tag => {
        const elements = Array.from(document.body.getElementsByTagName(tag))
        textBoxes = textBoxes.concat(elements)
    })

    textBoxes = textBoxes.filter(tb => tb.innerText.length > TEXT_LENGTH_THRESHOLD);
    output = []
    for (var i = 0; i < textBoxes.length; i++) {
        if (textBoxes[i].style.display === 'none') continue
        if (textBoxes.filter(e => e.contains(textBoxes[i]) && Math.abs(TEXT_LENGTH_TARGET - e.innerText.length) <= Math.abs(TEXT_LENGTH_TARGET - textBoxes[i].innerText.length) && e !== textBoxes[i]
            || textBoxes[i].contains(e) && Math.abs(TEXT_LENGTH_TARGET - textBoxes[i].innerText.length) > Math.abs(TEXT_LENGTH_TARGET - e.innerText.length) && e !== textBoxes[i]).length > 0) continue
        // createScanButton(textBoxes[i])
        output.push(textBoxes[i])
    }
    TRACKED_ELEMENTS = output
    console.log(output)
    autoHideSentences()
}
    */

function setupMutationObserver() {
    const textTags = new Set(['P', 'SPAN'])

    const observer = new MutationObserver(mutations => {
        updatePageText()
        // const candidates = []
        // for (const mutation of mutations) {
        //     for (const node of mutation.addedNodes) {
        //         if (node.nodeType !== Node.ELEMENT_NODE) continue
        //         if (textTags.has(node.tagName)) candidates.push(node)
        //         candidates.push(...node.querySelectorAll('p, span'))
        //     }
        // }

        // const newElements = candidates.filter(el => {
        //     if (el.innerText.length <= TEXT_LENGTH_THRESHOLD) return false
        //     if (el.style.display === 'none') return false
        //     if (el.querySelector('.hts-scan-btn')) return false
        //     if (TRACKED_ELEMENTS.includes(el)) return false
        //     if (TRACKED_ELEMENTS.some(tracked =>
        //         tracked.contains(el) &&
        //         Math.abs(TEXT_LENGTH_TARGET - tracked.innerText.length) <= Math.abs(TEXT_LENGTH_TARGET - el.innerText.length)
        //     )) return false
        //     return true
        // })

        // const filtered = newElements.filter(el =>
        //     !newElements.some(other => other !== el && (
        //         other.contains(el) && Math.abs(TEXT_LENGTH_TARGET - other.innerText.length) <= Math.abs(TEXT_LENGTH_TARGET - el.innerText.length) ||
        //         el.contains(other) && Math.abs(TEXT_LENGTH_TARGET - el.innerText.length) > Math.abs(TEXT_LENGTH_TARGET - other.innerText.length)
        //     ))
        // )

        // for (const el of filtered) {
        //     createScanButton(el)
        //     TRACKED_ELEMENTS.push(el)
        //     if (AI_SENTENCES.length > 0) processElement(el, AI_SENTENCES)
        // }
    })

    observer.observe(document.body, { childList: true, subtree: true })
}

function autoHideSentences() {
    console.log("sdfsdf", AI_SENTENCES)
    if (AI_SENTENCES.length === 0) return
    processElement(document.body, AI_SENTENCES)
}

 //no purpose
function updateAllButtonLabels() {
    document.querySelectorAll('.hts-scan-btn').forEach(btn => {
        if (btn.dataset.innerText) updateScanButtonLabel(btn, btn.dataset.innerText)
    })
}

/*
function updateScanButtonLabel(button, innerText) {
    const { filteredText, removedAiCharacters, removedNonAiCharacters, totalCharacters } = preScreenText(innerText)
    const words = filteredText.trim().length > 0 ? filteredText.split(/\s+/).filter(Boolean).length : 0
    const scannedChars = removedAiCharacters + removedNonAiCharacters
    const scannedPct = totalCharacters > 0 ? (scannedChars / totalCharacters * 100) : 0
    const aiPct = totalCharacters > 0 ? (removedAiCharacters / totalCharacters * 100) : 0
    const realPct = totalCharacters > 0 ? (removedNonAiCharacters / totalCharacters * 100) : 0

    button.dataset.wordCount = words
    button.dataset.removedAiChars = removedAiCharacters
    button.dataset.removedNonAiChars = removedNonAiCharacters
    button.dataset.totalChars = totalCharacters
    button.dataset.remainingChars = filteredText.length

    if (filteredText.trim().length <= 10) {
        button.textContent = `Scanned: ${aiPct.toFixed(0)}% AI / ${realPct.toFixed(0)}% real`
        button.style.backgroundColor = aiPct >= 50 ? '#ffdddd' : '#ddffee'
    } else if (scannedPct > 0) {
        button.textContent = `Scan (${words} words) — ${scannedPct.toFixed(0)}% scanned`
    } else {
        button.textContent = `Scan for AI (${words} words)`
    }
}
    */

function createScanButton(element) {
    const parentOverlay = document.createElement('div')
    parentOverlay.style = "position: relative; display: block; left: 0; top: 0; width: 100%; height: 100%; background-color: none"

    // const button = document.createElement('button')
    // const innerText = element.innerText.replace("Scan for AI", "").replaceAll("  ", " ").trim()
    // button.className = 'hts-scan-btn'
    // button.dataset.innerText = innerText
    // button.style = "position: absolute;background-color: white;display: block;font-size: 10px;color: black;line-height: 10px;padding: 5px;top: 5px; right: 5px; border-radius: 4px; z-index: 9999"
    // button.onclick = () => runScan(innerText, element, button)

    // updateScanButtonLabel(button, innerText)

    // let originalBorder = element ? (element.style.outline ?? "") : ""
    // button.onmouseenter = (e) => {
    //     element.style.outline = "2px solid black"
    // }
    // button.onmouseleave = (e) => {
    //     element.style.outline = originalBorder
    // }

    // Replace child elements
    while (element.childNodes.length > 0) {
        parentOverlay.appendChild(element.firstChild)
    }

    // parentOverlay.appendChild(button)
    element.appendChild(parentOverlay)
}

function preScreenText(text) {
    const foundSentences = []
    let filteredText = text.replaceAll('\n', ' ')
    let removedAiCharacters = 0
    let removedNonAiCharacters = 0
    const totalCharacters = text.length

    for (const sentence of AI_SENTENCES) {
        if (!sentence || !filteredText.includes(sentence)) continue
        foundSentences.push(sentence.replaceAll('\n', ' '))
        const prelength = filteredText.length
        filteredText = filteredText.split(sentence.replaceAll('\n', ' ')).join(' ')
        removedAiCharacters += prelength - filteredText.length
    }

    for (const sentence of NON_AI_SENTENCES) {
        if (!sentence || !filteredText.includes(sentence.replaceAll('\n', ' '))) continue
        const prelength = filteredText.length
        filteredText = filteredText.split(sentence.replaceAll('\n', ' ')).join(' ')
        removedNonAiCharacters += prelength - filteredText.length
    }

    let splits = filteredText.split('.')
    splits = splits.filter(s => s.trim().length > SENTENCE_LENGTH_THRSHOLD)
    filteredText = splits.join('.')

    splits = filteredText.split('\n')
    splits = splits.filter(s => s.trim().length > SENTENCE_LENGTH_THRSHOLD)
    filteredText = splits.join('\n')

    return { filteredText, foundSentences, removedAiCharacters, removedNonAiCharacters, totalCharacters }
}

function getSiteIconUrl() {
    const link = document.querySelector('link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]')
    return link ? link.href : null
}

async function analyzeText(text) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ type: "analyzeText", text }, (response) => {
            console.log('analyzed: ', response)
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
            } else if (response.success) {
                console.log(text, response.success)
                resolve(response.data);
            } else {
                reject(new Error(response.error));
            }
        });
    });
}


// TODO: Update this function \/
async function runScan() {
    try {
        const { filteredText, foundSentences } = getPageText()

        let result
        if (filteredText.trim().length > 10) {
            result = await analyzeText(filteredText)
        } else {
            result = { data: { h: [], fakePercentage: 100, textWords: 0, aiWords: 0 } }
        }

        result.data = result.data ?? {}
        result.data.h = [...(result.data.h ?? []), ...foundSentences]

        // Extract non-AI sentences from the scanned text
        const apiAiSentences = result.data.h ?? []
        const scannedSentences = filteredText.split('.').map(s => s.trim()).filter(s => s.trim().length >= SENTENCE_LENGTH_THRSHOLD)
        const newNonAiSentences = scannedSentences.filter(sentence =>
            !apiAiSentences.some(ai => ai.includes(sentence) || sentence.includes(ai))
        )

        // Batch save AI + non-AI sentences
        const updates = {}
        if (apiAiSentences.length > 0) {
            AI_SENTENCES = [...new Set([...AI_SENTENCES, ...apiAiSentences])]
            updates.ai_sentences = AI_SENTENCES
        }
        if (newNonAiSentences.length > 0) {
            NON_AI_SENTENCES = [...new Set([...NON_AI_SENTENCES, ...newNonAiSentences])]
            updates.non_ai_sentences = NON_AI_SENTENCES
        }
        if (Object.keys(updates).length > 0) {
            chrome.storage.local.set(updates)
            console.log('Saved:', Object.keys(updates).join(', '), '— AI:', AI_SENTENCES.length, 'non-AI:', NON_AI_SENTENCES.length)
        }

        // Update site_data keyed by hostname
        const iconUrl = getSiteIconUrl()
        const existing = SITE_DATA[currentSite] ?? { words_seen: 0, ai_words_seen: 0, times_visited: 0, icon_url: iconUrl }
        const preScreenWordCount = foundSentences.reduce((acc, s) => acc + s.split(/\s+/).length, 0)
        SITE_DATA[currentSite] = {
            words_seen: existing.words_seen + (result.data.textWords ?? 0) + preScreenWordCount,
            ai_words_seen: existing.ai_words_seen + (result.data.aiWords ?? 0) + preScreenWordCount,
            times_visited: existing.times_visited,
            icon_url: iconUrl ?? existing.icon_url
        }
        chrome.storage.local.set({ site_data: SITE_DATA })
        console.log('Saved site data:', SITE_DATA)

        const scanProgress = { scanning: false, ai_words: 0, real_words: 0 }
        const aiW = (result.data.aiWords ?? 0) + preScreenWordCount
        const totalW = (result.data.textWords ?? 0) + preScreenWordCount
        scanProgress.completed++
        scanProgress.ai_words += aiW
        scanProgress.real_words += Math.max(0, totalW - aiW)
        chrome.storage.local.set({ scan_progress: { ...scanProgress } })

        hideSentences(result)
        // updateScanButtonLabel(button, innerText)
        console.log(result)
    } catch (err) {
        console.error(err)
    }
}

function hideSentences(result) {
    const sentences = result.data?.h ?? []
    if (sentences.length === 0) return
    processElement(document.body, sentences)
}

function createCoverSpan(text) {
    const cover = document.createElement('span')
    cover.className = 'slop-cover'
    cover.textContent = text

    cover.style.setProperty('--slop-image-url', `url("${SLOP_URL}")`)

    // Paint the textured overlays once the span has been laid out so we can
    // read its per-line geometry.
    requestAnimationFrame(() => paintCover(cover))

    cover.addEventListener('mouseover', () => { cover.querySelectorAll('.slop-overlay').forEach(i => i.style.opacity = 0.1) })
    cover.addEventListener('mouseout', () => { cover.querySelectorAll('.slop-overlay').forEach(i => i.style.opacity = 0.8) })

    return cover
}

// Build one overlay per line box so the texture follows the exact shape of the
// covered text (the union of every line, including indented wrapped lines)
// rather than a single bounding rectangle.
function paintCover(cover) {
    if (!cover.isConnected) return

    cover.querySelectorAll('.slop-overlay').forEach(o => o.remove())

    // The containing block origin for an absolutely-positioned child of a
    // multi-line inline element isn't its bounding-box corner, so measure the
    // real origin with a zero-size probe instead of assuming it.
    const probe = document.createElement('span')
    probe.style.cssText = 'position:absolute;left:0;top:0;width:0;height:0'
    cover.appendChild(probe)
    const origin = probe.getBoundingClientRect()
    probe.remove()

    for (const rect of cover.getClientRects()) {
        if (rect.width === 0 || rect.height === 0) continue
        const overlay = document.createElement('span')
        overlay.className = 'slop-overlay'
        overlay.style.left = `${rect.left - origin.left}px`
        overlay.style.top = `${rect.top - origin.top}px`
        overlay.style.width = `${rect.width}px`
        overlay.style.height = `${rect.height}px`
        cover.appendChild(overlay)
    }
}

let repaintTimer = null
function repaintAllCovers() {
    clearTimeout(repaintTimer)
    repaintTimer = setTimeout(() => {
        document.querySelectorAll('.slop-cover').forEach(paintCover)
    }, 150)
}
window.addEventListener('resize', repaintAllCovers)

function processElement(element, sentences) {
    // Collect all leaf text nodes with their cumulative offsets in the concatenated textContent
    const textNodes = []
    let offset = 0

    function walk(node) {
        if (node.nodeType === Node.TEXT_NODE) {
            const len = node.textContent.length
            if (len > 0) {
                textNodes.push({ node, start: offset, end: offset + len })
                offset += len
            }
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.classList?.contains('slop-cover')) return
            Array.from(node.childNodes).forEach(walk)
        }
    }
    walk(element)

    if (textNodes.length === 0) return

    const fullText = textNodes.map(t => t.node.textContent).join('')

    // Find all sentence matches in the full element text
    const allRanges = []
    for (const sentence of sentences) {
        if (!sentence) continue
        let idx = fullText.indexOf(sentence)
        while (idx !== -1) {
            allRanges.push({ start: idx, end: idx + sentence.length, sentence })
            idx = fullText.indexOf(sentence, idx + sentence.length)
        }
    }
    if (allRanges.length === 0) return

    // Only hide sentences that appear in groups of 2+ within GROUP_PROXIMITY_THRESHOLD chars
    allRanges.sort((a, b) => a.start - b.start)
    const proximityGroups = []
    let currentGroup = [allRanges[0]]
    for (let i = 1; i < allRanges.length; i++) {
        if (allRanges[i].start - currentGroup[currentGroup.length - 1].end < GROUP_PROXIMITY_THRESHOLD) {
            currentGroup.push(allRanges[i])
        } else {
            proximityGroups.push(currentGroup)
            currentGroup = [allRanges[i]]
        }
    }
    proximityGroups.push(currentGroup)

    const approved = new Set()
    proximityGroups.filter(g => g.length >= 2).forEach(g => g.forEach(r => approved.add(r.sentence)))

    const approvedRanges = allRanges.filter(r => approved.has(r.sentence))
    if (approvedRanges.length === 0) return

    // Merge overlapping approved ranges
    approvedRanges.sort((a, b) => a.start - b.start)
    const merged = [{ start: approvedRanges[0].start, end: approvedRanges[0].end }]
    for (let i = 1; i < approvedRanges.length; i++) {
        const last = merged[merged.length - 1]
        if (approvedRanges[i].start <= last.end) {
            last.end = Math.max(last.end, approvedRanges[i].end)
        } else {
            merged.push({ start: approvedRanges[i].start, end: approvedRanges[i].end })
        }
    }

    // Map ranges back to individual text nodes and apply coverage
    for (const { node, start: nodeStart, end: nodeEnd } of textNodes) {
        const nodeRanges = merged
            .filter(r => r.start < nodeEnd && r.end > nodeStart)
            .map(r => ({
                start: Math.max(r.start, nodeStart) - nodeStart,
                end: Math.min(r.end, nodeEnd) - nodeStart
            }))

        if (nodeRanges.length === 0) continue

        const text = node.textContent
        const fragment = document.createDocumentFragment()
        let pos = 0
        for (const { start, end } of nodeRanges) {
            if (pos < start) fragment.appendChild(document.createTextNode(text.slice(pos, start)))
            fragment.appendChild(createCoverSpan(text.slice(start, end)))
            pos = end
        }
        if (pos < text.length) fragment.appendChild(document.createTextNode(text.slice(pos)))

        node.parentNode.replaceChild(fragment, node)
    }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'getWordCounts') {
        const data = getPageText()
        const totalWords = data.filteredText.replaceAll('  ', ' ').split(' ').length
        const totalAiChars = data.removedAiCharacters
        const totalNonAiChars = data.removedNonAiCharacters
        const totalChars = data.totalCharacters
        const scannedPct = totalChars > 0 ? ((totalAiChars + totalNonAiChars) / totalChars * 100).toFixed(1) : '0.0'
        const aiPct = totalChars > 0 ? (totalAiChars / totalChars * 100).toFixed(1) : '0.0'
        const realPct = totalChars > 0 ? (totalNonAiChars / totalChars * 100).toFixed(1) : '0.0'

        sendResponse({ totalWords, scannedPct, aiPct, realPct, text: data.filteredText })
        return true
    }
    if (message.type === 'scanAll') {
        chrome.storage.local.set({ scan_progress: { scanning: true, ai_words: 0, real_words: 0 } })
        runScan()
        // const buttons = document.querySelectorAll('.hts-scan-btn')
        // const toScan = []
        // buttons.forEach(btn => {
        //     const remainingChars = parseInt(btn.dataset.remainingChars, 10)
        //     if (isNaN(remainingChars) || remainingChars > 10) toScan.push(btn)
        // })
        // toScan.forEach(btn => btn.click())
        sendResponse({ })
        return true
    }
})
