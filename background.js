chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "analyzeText") {
        chrome.storage.sync.get(["zerogpt_api_key"], ({ zerogpt_api_key }) => {
            const apiKey = (zerogpt_api_key || "").trim();
            if (!apiKey) {
                sendResponse({ success: false, error: "No ZeroGPT API key set. Add one in the extension popup." });
                return;
            }
            fetch("https://api.zerogpt.com/api/detect/detectText", {
                method: "POST",
                headers: {
                    "ApiKey": apiKey,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ input_text: message.text })
            })
            .then(r => r.json())
            .then(data => sendResponse({ success: true, data }))
            .catch(err => sendResponse({ success: false, error: err.message }));
        });

        return true; // keeps the message channel open for async response
    }
});
