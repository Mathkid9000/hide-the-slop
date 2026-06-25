chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "analyzeText") {
        const apiKey = "3ce65b4e-41a5-40d1-b1a6-5a8b38d26c21";
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

        return true; // keeps the message channel open for async response
    }
});
