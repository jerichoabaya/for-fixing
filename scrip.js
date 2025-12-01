// --- CONFIGURATION ---

// Final ESP32 IP (from your selections: 2a)
const ESP32_IP = "http://192.168.68.250";

// Correct endpoint (your old file had a broken string)
const READINGS_URL = ESP32_IP + "/readings";

const FETCH_INTERVAL_MS = 5000; // Fetch every 5 seconds



// ------------------------------------------------------------------
// --- GAUGE UTILITIES ---
// ------------------------------------------------------------------

/**
 * Convert sensor range to rotation.
 */
function mapValueToRotation(value, inMin, inMax, outMin, outMax) {
    const clampedValue = Math.max(inMin, Math.min(inMax, value));
    return (clampedValue - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
}



/**
 * Update one gauge with value, status, and needle rotation.
 */
function updateGauge(idPrefix, value, status) {
    const valueEl = document.getElementById(idPrefix + "ValueDisplay");
    const statusEl = document.getElementById(idPrefix + "StatusDisplay");
    const indicatorEl = document.getElementById(idPrefix + "Indicator");

    // --------------------
    // Display numeric / text value
    // --------------------
    if (valueEl) {
        if (!isNaN(parseFloat(value)) && idPrefix !== "color") {
            valueEl.textContent = parseFloat(value).toFixed(2);
        } else {
            valueEl.textContent = value;
        }
    }

    // --------------------
    // Apply status color
    // --------------------
    if (statusEl) {
        statusEl.textContent = status;
        statusEl.className = "gauge-status " + status.toLowerCase().replace(" ", "");
    }

    // --------------------
    // Needle Rotation
    // --------------------
    let rotationDegrees = -120; // default
    const numericValue = parseFloat(value);
    const ROT_MIN = -120;
    const ROT_MAX = 120;

    if (indicatorEl && !isNaN(numericValue) && idPrefix !== "color") {
        switch (idPrefix) {
            case "ph":
                rotationDegrees = mapValueToRotation(numericValue, 0, 14, ROT_MIN, ROT_MAX);
                break;
            case "tds":
                rotationDegrees = mapValueToRotation(numericValue, 0, 1000, ROT_MIN, ROT_MAX);
                break;
            case "turbidity":
                rotationDegrees = mapValueToRotation(numericValue, 0, 50, ROT_MIN, ROT_MAX);
                break;
            case "lead":
                rotationDegrees = mapValueToRotation(numericValue, 0, 0.02, ROT_MIN, ROT_MAX);
                break;
        }
    }

    else if (idPrefix === "color") {
        switch (status.toLowerCase()) {
            case "safe": rotationDegrees = 0; break;
            case "warning": rotationDegrees = 60; break;
            case "failed": rotationDegrees = 100; break;
            default: rotationDegrees = -60;
        }
    }

    // Correct transform syntax
    if (indicatorEl) {
        indicatorEl.style.transform = `rotate(${rotationDegrees}deg)`;
    }
}



function updateGlobalStatus(text) {
    const el = document.getElementById("last-update-display");
    if (el) el.textContent = text;
}



// ------------------------------------------------------------------
// --- FETCH READINGS FROM ESP32 ---
// ------------------------------------------------------------------

function fetchReadings() {

    const overallStatusEl = document.getElementById("overall-connection-status");
    overallStatusEl.textContent = "CONNECTING...";
    overallStatusEl.className = "status-indicator connecting";

    fetch(READINGS_URL)
        .then(response => {

            if (response.status === 503) {
                updateGlobalStatus("ESP32 BUSY – waiting for test cycle to finish");
                updateGauge("tds", "---", "Connecting");
                updateGauge("ph", "---", "Connecting");
                updateGauge("turbidity", "---", "Connecting");
                updateGauge("lead", "---", "Connecting");
                updateGauge("color", "---", "Connecting");
                return Promise.reject("ESP32 is busy");
            }

            if (!response.ok) {
                updateGlobalStatus(`Network Error: ${response.status} ${response.statusText}`);
                return Promise.reject(`Network error: ${response.status}`);
            }

            return response.json();
        })

        .then(data => {

            updateGauge("tds", data.TDS_Value, data.TDS_Status);
            updateGauge("ph", data.PH_Value, data.PH_Status);
            updateGauge("turbidity", data.Turbidity_Value, data.Turbidity_Status);
            updateGauge("lead", data.Lead_Value, data.Lead_Status);
            updateGauge("color", data.Color_Result, data.Color_Status);

            updateGlobalStatus(`Live Data – Last Update: ${new Date().toLocaleTimeString()}`);

            overallStatusEl.textContent = "ONLINE";
            overallStatusEl.className = "status-indicator online";
        })

        .catch(error => {
            console.error("Fetch Error:", error);

            overallStatusEl.textContent = "OFFLINE";
            overallStatusEl.className = "status-indicator offline";

            updateGauge("tds", "---", "Failed");
            updateGauge("ph", "---", "Failed");
            updateGauge("turbidity", "---", "Failed");
            updateGauge("lead", "---", "Failed");
            updateGauge("color", "---", "Failed");
        });
}



// ------------------------------------------------------------------
// --- PAGE LOAD INIT ---
// ------------------------------------------------------------------

document.addEventListener("DOMContentLoaded", () => {
    fetchReadings();
    setInterval(fetchReadings, FETCH_INTERVAL_MS);
});
