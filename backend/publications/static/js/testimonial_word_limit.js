document.addEventListener("DOMContentLoaded", function () {
    const contentField = document.getElementById("id_content");
    if (!contentField) return;

    // Add a counter element below the textarea
    const counterDisplay = document.createElement("p");
    counterDisplay.style.color = "#666";
    counterDisplay.style.fontSize = "12px";
    counterDisplay.style.marginTop = "5px";
    contentField.parentNode.insertBefore(counterDisplay, contentField.nextSibling);

    function updateCounter() {
        const text = contentField.value.trim();
        const words = text ? text.split(/\s+/) : [];
        const wordCount = words.length;

        // Prevent more than 50 words by trimming the value
        if (wordCount > 50) {
            contentField.value = words.slice(0, 50).join(" ");
            counterDisplay.style.color = "red";
            counterDisplay.textContent = "Word limit reached (50/50 words limit).";
        } else {
            counterDisplay.style.color = "#666";
            counterDisplay.textContent = `Words: ${wordCount}/50`;
        }
    }

    contentField.addEventListener("input", updateCounter);
    contentField.addEventListener("keydown", function (e) {
        const text = contentField.value.trim();
        const words = text ? text.split(/\s+/) : [];

        // If we already have 50 words, prevent typing any more spaces or words
        if (words.length >= 50 && e.key === " " && contentField.selectionStart === contentField.selectionEnd) {
            e.preventDefault(); // Stop spacebar specifically at the limit
        }
    });

    // Initialize counter
    updateCounter();
});
