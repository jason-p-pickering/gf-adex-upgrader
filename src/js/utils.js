"use strict";

export function getContextPath() {
    var ctx = window.location.pathname.substring(
        0,
        window.location.pathname.indexOf("/", 2)
    );
    console.log("Context path is : ", ctx);
    if (ctx === "/api") {
        return "";
    }
    return ctx;
}

export const baseUrl = getContextPath() + "/api/";

export async function d2Fetch(endpoint) {
    return new Promise(function (resolve, reject) {
        fetch(baseUrl + endpoint, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                credentials: "include",
            },
        })
            .then((response) => response.json())
            .then((data) => {
                resolve(data);
            })
            .catch((error) => {
                console.error("Error fetching data:", error, baseUrl + endpoint);
                reject(error);
            });
    });
}

//Fetch the GF indicators (based on [GFADEX] code in name)
export async function fetchIndicators() {
    var data = await d2Fetch(
        "indicators.json?filter=name:$like:[GFADEX]&fields=:owner&paging=false"
    );
    if (!data || data.indicators.length === 0) {
        console.log("No GF ADEx indicators found");
        return [];
    } else {
        return data.indicators;
    }
}

export function fetchIndicatorsFromDataStore() {
    return new Promise(function (resolve, reject) {
        fetch(baseUrl + "dataStore/gfadex/remote", {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                credentials: "include",
            },
        })
            .then((response) => response.json())
            .then((data) => {
                resolve(data);
            })
            .catch((error) => {
                console.error("Error fetching data:", error);
                reject(error);
            });
    });
}


export async function upgradeExistingIndicators(remote, local) {
    try {
        let remoteIndicators = remote.indicators;

        local.forEach((indicator) => {
            // Update the remote indicator with the local indicator
            const remoteIndicator = remote.indicators.find(
                (remoteIndicator) => remoteIndicator.id === indicator.id
            );
            if (remoteIndicator) {
                remoteIndicator.numerator = indicator.numerator;
            }
        });

        remote.indicators = remoteIndicators;

        // Upload the rest of the metadata package to the /metadata endpoint
        const response = await fetch(baseUrl + "metadata", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(remote),
        });

        if (!response.ok) {
            // Handle non-successful response
            console.error("Error upgrading existing GF metadata:", response.statusText);
            alert(__("upgrade-error"));
        } else {
            const data = await response.json();
            return data;
        }
    } catch (error) {
        console.error("Error upgrading existing GF metadata:", error);
        alert(__("upgrade-error"));
        throw error; // Re-throw the error so that the calling code can handle it if necessary
    }
}

/* global __ */
export function renderUpgradeStatusReport(statusReport) {
    //Just display the raw JSON as text
    // var html = "<h3>Upgrade Status Report</h3>";
    // html += "<pre>" + JSON.stringify(statusReport, null, 2) + "</pre>";
    // eslint-disable-next-line no-undef
    var html = generateSummaryTable(statusReport);
    document.querySelector("#upgradeStatus").innerHTML = html;
    document.querySelector("#update-gf-metadata-btn").disabled = false;
}

export async function upgradeIndicators() {
    showLoading();
    document.querySelector("#update-gf-metadata-btn").disabled = true;
    const remote = await fetchIndicatorsFromDataStore();
    const local = await fetchIndicators();
    console.log("Remote metadata is : ", remote);
    if (!remote.indicators) {
        resetUpgradeStatus();
        alert(__("no-remote-metadata"));
        return;
    }
    //If we don't have any local indicators, then alert the user
    if (local.length === 0) {
        resetUpgradeStatus();
        alert(__("no-local-gfadex-indicators"));
        return;
    }

    upgradeExistingIndicators(remote, local).then((statusReport) => {
        console.log("Upgrade status report:", statusReport);
        renderUpgradeStatusReport(statusReport);
    });

}

export function verifyRemoteMetadata(remote) {
    //The remote object should be an array containing the following keys:
    const expectedNames = [
        "attributes",
        "indicatorTypes",
        "userGroups",
        "indicators",
        "indicatorGroups",
    ];
    //Verify that the remote object contains the expected keys
    //Should only contain the expected keys
    const remoteNames = Object.keys(remote);
    const validKeys = expectedNames.every((name) => remoteNames.includes(name));

    if (!validKeys) {
        return false;
    }

    //Verify that all indicators contian GFADEX in the name
    const remoteIndicators = remote.indicators;
    //If we did not get any indicators, return false
    if (!remoteIndicators || remoteIndicators.length === 0) {
        return false;
    }

    const remoteIndicatorNames = remoteIndicators.map((indicator) => indicator.name);
    const validNumeratorNames = remoteIndicatorNames.every((name) => name.includes("GFADEX"));

    if (!validNumeratorNames) {
        return false;
    }

    return true;
}

export function uploadReferenceJson() {
    const fileInput = document.getElementById("jsonFileInput");
    const file = fileInput.files[0];

    if (!file) {
        alert("Please choose a JSON file to upload.");
        return;
    }

    const reader = new FileReader();

    reader.onload = function (event) {
        const jsonData = event.target.result;
        let remoteMetadata = [];
        // We need to verify that the JSON is valid before we send it to the server
        try {
            remoteMetadata = JSON.parse(jsonData);
        } catch (error) {
            console.error("Error parsing JSON:", error);
            alert(__("json-invalid"));
            return;
        }

        const isValid = verifyRemoteMetadata(remoteMetadata);
        if (!isValid) {
            alert(__("json-invalid"));
            return;
        }
        const apiUrl = baseUrl + "dataStore/gfadex/remote";

        //If the datastore key already exists, delete it
        fetch(apiUrl, {
            method: "DELETE",
            credentials: "include",
            headers: {
                "Content-Type": "application/json",
            },
        })
            .then((response) => {
                console.log("Existing key found:", response);
            })
            .catch((error) => {
                console.error("Key not found:", error);
            }).then(() => {
                fetch(apiUrl, {
                    method: "POST",
                    credentials: "include",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(remoteMetadata),
                })
                    .then((response) => response.json())
                    .then(() => {
                        // document.querySelector("#update-gf-metadata-btn").disabled = false;
                        const msg = __("json-upload-success");
                        alert(msg);
                    })
                    .catch((error) => {
                        console.error("Error uploading and processing JSON:", error);
                        alert(__("json-upload-error"));
                    });
            });
    };

    reader.readAsText(file);
}


export async function fetchUserLocale() {
    return d2Fetch("me/settings/keyUiLocale.json")
        .then(data => {
            if (!data || data.length === 0) {
                console.log("No user locale found");
                return "en";
            } else {
                return data;
            }
        })
        .catch(error => {
            console.error("Error fetching user locale:", error);
            return "en";
        });
}

export function generateSummaryTable(data) {
    const tableHeaders = [
        __("object-type"),
        __("created"),
        __("updated"),
        __("deleted"),
        __("ignored"),
        __("total")
    ];

    const tableRows = data.response.typeReports.map((report) => {
        const klassWithoutPrefix = report.klass.replace(/^.*\./, "");
        const rowValues = [
            klassWithoutPrefix,
            report.stats.created,
            report.stats.updated,
            report.stats.deleted,
            report.stats.ignored,
            report.stats.total,
        ];

        const rowHTML = rowValues.map((value) => `<td>${value}</td>`).join("");
        return `<tr>${rowHTML}</tr>`;
    });

    const tableHTML = `
        <table border="1">
            <thead>
                <tr>${tableHeaders.map((header) => `<th>${header}</th>`).join("")}</tr>
            </thead>
            <tbody>
                ${tableRows.join("")}
            </tbody>
        </table>`;

    const html = `
        <h3>${__("upgrade-status-report")}</h3>
        <h3>${__("status")}:${data.httpStatus}</h3>
        <h3>${__("status-code")}:${data.httpStatusCode}</h3>
        ${tableHTML}`;

    return html;
}

function showLoading() {
    let html = "<h3>" + __("loading") + "</h3>";
    html += "<img alt=\"\"src=\"data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBzdGFuZGFsb25lPSJubyI/Pgo8IURPQ1RZUEUgc3ZnIFBVQkxJQyAiLS8vVzNDLy9EVEQgU1ZHIDEuMS8vRU4iICJodHRwOi8vd3d3LnczLm9yZy9HcmFwaGljcy9TVkcvMS4xL0RURC9zdmcxMS5kdGQiPgo8c3ZnIHdpZHRoPSI0MHB4IiBoZWlnaHQ9IjQwcHgiIHZpZXdCb3g9IjAgMCA0MCA0MCIgdmVyc2lvbj0iMS4xIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zOnhsaW5rPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5L3hsaW5rIiB4bWw6c3BhY2U9InByZXNlcnZlIiBzdHlsZT0iZmlsbC1ydWxlOmV2ZW5vZGQ7Y2xpcC1ydWxlOmV2ZW5vZGQ7c3Ryb2tlLWxpbmVqb2luOnJvdW5kO3N0cm9rZS1taXRlcmxpbWl0OjEuNDE0MjE7IiB4PSIwcHgiIHk9IjBweCI+CiAgICA8ZGVmcz4KICAgICAgICA8c3R5bGUgdHlwZT0idGV4dC9jc3MiPjwhW0NEQVRBWwogICAgICAgICAgICBALXdlYmtpdC1rZXlmcmFtZXMgc3BpbiB7CiAgICAgICAgICAgICAgZnJvbSB7CiAgICAgICAgICAgICAgICAtd2Via2l0LXRyYW5zZm9ybTogcm90YXRlKDBkZWcpCiAgICAgICAgICAgICAgfQogICAgICAgICAgICAgIHRvIHsKICAgICAgICAgICAgICAgIC13ZWJraXQtdHJhbnNmb3JtOiByb3RhdGUoLTM1OWRlZykKICAgICAgICAgICAgICB9CiAgICAgICAgICAgIH0KICAgICAgICAgICAgQGtleWZyYW1lcyBzcGluIHsKICAgICAgICAgICAgICBmcm9tIHsKICAgICAgICAgICAgICAgIHRyYW5zZm9ybTogcm90YXRlKDBkZWcpCiAgICAgICAgICAgICAgfQogICAgICAgICAgICAgIHRvIHsKICAgICAgICAgICAgICAgIHRyYW5zZm9ybTogcm90YXRlKC0zNTlkZWcpCiAgICAgICAgICAgICAgfQogICAgICAgICAgICB9CiAgICAgICAgICAgIHN2ZyB7CiAgICAgICAgICAgICAgICAtd2Via2l0LXRyYW5zZm9ybS1vcmlnaW46IDUwJSA1MCU7CiAgICAgICAgICAgICAgICAtd2Via2l0LWFuaW1hdGlvbjogc3BpbiAxLjVzIGxpbmVhciBpbmZpbml0ZTsKICAgICAgICAgICAgICAgIC13ZWJraXQtYmFja2ZhY2UtdmlzaWJpbGl0eTogaGlkZGVuOwogICAgICAgICAgICAgICAgYW5pbWF0aW9uOiBzcGluIDEuNXMgbGluZWFyIGluZmluaXRlOwogICAgICAgICAgICB9CiAgICAgICAgXV0+PC9zdHlsZT4KICAgIDwvZGVmcz4KICAgIDxnIGlkPSJvdXRlciI+CiAgICAgICAgPGc+CiAgICAgICAgICAgIDxwYXRoIGQ9Ik0yMCwwQzIyLjIwNTgsMCAyMy45OTM5LDEuNzg4MTMgMjMuOTkzOSwzLjk5MzlDMjMuOTkzOSw2LjE5OTY4IDIyLjIwNTgsNy45ODc4MSAyMCw3Ljk4NzgxQzE3Ljc5NDIsNy45ODc4MSAxNi4wMDYxLDYuMTk5NjggMTYuMDA2MSwzLjk5MzlDMTYuMDA2MSwxLjc4ODEzIDE3Ljc5NDIsMCAyMCwwWiIgc3R5bGU9ImZpbGw6YmxhY2s7Ii8+CiAgICAgICAgPC9nPgogICAgICAgIDxnPgogICAgICAgICAgICA8cGF0aCBkPSJNNS44NTc4Niw1Ljg1Nzg2QzcuNDE3NTgsNC4yOTgxNSA5Ljk0NjM4LDQuMjk4MTUgMTEuNTA2MSw1Ljg1Nzg2QzEzLjA2NTgsNy40MTc1OCAxMy4wNjU4LDkuOTQ2MzggMTEuNTA2MSwxMS41MDYxQzkuOTQ2MzgsMTMuMDY1OCA3LjQxNzU4LDEzLjA2NTggNS44NTc4NiwxMS41MDYxQzQuMjk4MTUsOS45NDYzOCA0LjI5ODE1LDcuNDE3NTggNS44NTc4Niw1Ljg1Nzg2WiIgc3R5bGU9ImZpbGw6cmdiKDIxMCwyMTAsMjEwKTsiLz4KICAgICAgICA8L2c+CiAgICAgICAgPGc+CiAgICAgICAgICAgIDxwYXRoIGQ9Ik0yMCwzMi4wMTIyQzIyLjIwNTgsMzIuMDEyMiAyMy45OTM5LDMzLjgwMDMgMjMuOTkzOSwzNi4wMDYxQzIzLjk5MzksMzguMjExOSAyMi4yMDU4LDQwIDIwLDQwQzE3Ljc5NDIsNDAgMTYuMDA2MSwzOC4yMTE5IDE2LjAwNjEsMzYuMDA2MUMxNi4wMDYxLDMzLjgwMDMgMTcuNzk0MiwzMi4wMTIyIDIwLDMyLjAxMjJaIiBzdHlsZT0iZmlsbDpyZ2IoMTMwLDEzMCwxMzApOyIvPgogICAgICAgIDwvZz4KICAgICAgICA8Zz4KICAgICAgICAgICAgPHBhdGggZD0iTTI4LjQ5MzksMjguNDkzOUMzMC4wNTM2LDI2LjkzNDIgMzIuNTgyNCwyNi45MzQyIDM0LjE0MjEsMjguNDkzOUMzNS43MDE5LDMwLjA1MzYgMzUuNzAxOSwzMi41ODI0IDM0LjE0MjEsMzQuMTQyMUMzMi41ODI0LDM1LjcwMTkgMzAuMDUzNiwzNS43MDE5IDI4LjQ5MzksMzQuMTQyMUMyNi45MzQyLDMyLjU4MjQgMjYuOTM0MiwzMC4wNTM2IDI4LjQ5MzksMjguNDkzOVoiIHN0eWxlPSJmaWxsOnJnYigxMDEsMTAxLDEwMSk7Ii8+CiAgICAgICAgPC9nPgogICAgICAgIDxnPgogICAgICAgICAgICA8cGF0aCBkPSJNMy45OTM5LDE2LjAwNjFDNi4xOTk2OCwxNi4wMDYxIDcuOTg3ODEsMTcuNzk0MiA3Ljk4NzgxLDIwQzcuOTg3ODEsMjIuMjA1OCA2LjE5OTY4LDIzLjk5MzkgMy45OTM5LDIzLjk5MzlDMS43ODgxMywyMy45OTM5IDAsMjIuMjA1OCAwLDIwQzAsMTcuNzk0MiAxLjc4ODEzLDE2LjAwNjEgMy45OTM5LDE2LjAwNjFaIiBzdHlsZT0iZmlsbDpyZ2IoMTg3LDE4NywxODcpOyIvPgogICAgICAgIDwvZz4KICAgICAgICA8Zz4KICAgICAgICAgICAgPHBhdGggZD0iTTUuODU3ODYsMjguNDkzOUM3LjQxNzU4LDI2LjkzNDIgOS45NDYzOCwyNi45MzQyIDExLjUwNjEsMjguNDkzOUMxMy4wNjU4LDMwLjA1MzYgMTMuMDY1OCwzMi41ODI0IDExLjUwNjEsMzQuMTQyMUM5Ljk0NjM4LDM1LjcwMTkgNy40MTc1OCwzNS43MDE5IDUuODU3ODYsMzQuMTQyMUM0LjI5ODE1LDMyLjU4MjQgNC4yOTgxNSwzMC4wNTM2IDUuODU3ODYsMjguNDkzOVoiIHN0eWxlPSJmaWxsOnJnYigxNjQsMTY0LDE2NCk7Ii8+CiAgICAgICAgPC9nPgogICAgICAgIDxnPgogICAgICAgICAgICA8cGF0aCBkPSJNMzYuMDA2MSwxNi4wMDYxQzM4LjIxMTksMTYuMDA2MSA0MCwxNy43OTQyIDQwLDIwQzQwLDIyLjIwNTggMzguMjExOSwyMy45OTM5IDM2LjAwNjEsMjMuOTkzOUMzMy44MDAzLDIzLjk5MzkgMzIuMDEyMiwyMi4yMDU4IDMyLjAxMjIsMjBDMzIuMDEyMiwxNy43OTQyIDMzLjgwMDMsMTYuMDA2MSAzNi4wMDYxLDE2LjAwNjFaIiBzdHlsZT0iZmlsbDpyZ2IoNzQsNzQsNzQpOyIvPgogICAgICAgIDwvZz4KICAgICAgICA8Zz4KICAgICAgICAgICAgPHBhdGggZD0iTTI4LjQ5MzksNS44NTc4NkMzMC4wNTM2LDQuMjk4MTUgMzIuNTgyNCw0LjI5ODE1IDM0LjE0MjEsNS44NTc4NkMzNS43MDE5LDcuNDE3NTggMzUuNzAxOSw5Ljk0NjM4IDM0LjE0MjEsMTEuNTA2MUMzMi41ODI0LDEzLjA2NTggMzAuMDUzNiwxMy4wNjU4IDI4LjQ5MzksMTEuNTA2MUMyNi45MzQyLDkuOTQ2MzggMjYuOTM0Miw3LjQxNzU4IDI4LjQ5MzksNS44NTc4NloiIHN0eWxlPSJmaWxsOnJnYig1MCw1MCw1MCk7Ii8+CiAgICAgICAgPC9nPgogICAgPC9nPgo8L3N2Zz4K\"/>";
    document.querySelector("#upgradeStatus").innerHTML = html;
}

function resetUpgradeStatus() {
    document.querySelector("#upgradeStatus").innerHTML = "";
}

async function fetchLocalDataExchanges() {

    const data = await d2Fetch("aggregateDataExchanges.json?filter=target.api.url:like:globalfund&fields=*&paging=false");
    if (!data || data.aggregateDataExchanges.length === 0) {
        console.log("No GF data exchanges found");
        return [];
    }
    else {
        return data.aggregateDataExchanges;
    }
}


async function createLocalPackage(includeConfiguredOnly = false) {
    //Fetch the remote metadata
    let remote = await fetchIndicatorsFromDataStore();
    //There might not be anything in the datastore, if so, then alert the user
    if (!remote || remote.length === 0) {
        alert(__("no-remote-metadata"));
        return;
    }

    //Fetch the local metadata
    let localIndicators = await fetchIndicators();
    //There might not be indicators in the local metadata, if so, then alert the user
    if (!localIndicators || localIndicators.length === 0) {
        alert(__("no-local-gfadex-indicators"));
        return;
    }

    if (includeConfiguredOnly) {
        localIndicators = localIndicators.filter((indicator) => indicator.numerator.trim() != "0");
    }
    //Replace the remote indicators with the local indicators
    remote.indicators = localIndicators;
    //Remove all of the createdBy and lastUpdatedBy properties
    remote.indicators.forEach((indicator) => {
        indicator.createdBy = {};
        indicator.lastUpdatedBy = {};
    });


    //Get a map of indicator ids for easy lookup
    const indicatorIds = localIndicators.map((indicator) => indicator.id);

    remote.indicatorGroups.forEach((indicatorGroup) => {
        let filteredIndicators = [];
        indicatorGroup.indicators.forEach((indicator) => {
            if (indicatorIds.includes(indicator.id)) {
                filteredIndicators.push({ id: indicator.id });
            }
        });
        indicatorGroup.indicators = filteredIndicators;
    });

    //Append the data exchange to the remote metadata
    const dataExchanges = await fetchLocalDataExchanges();
    remote.aggregateDataExchanges = dataExchanges;
    remote.aggregateDataExchanges.forEach((dataExchange) => {
        dataExchange.createdBy = {};
        dataExchange.lastUpdatedBy = {};
    });

    //Create the backup object
    return remote;
}

export async function exportLocalIndicators() {
    const localIndicators = await fetchIndicators();
    const localConfig = { indicators: localIndicators };
    exportJsonData(localConfig);
}

export async function exportLocalConfig() {
    //Get the value of the checkbox
    const onlyConfiguredIndicators = document.querySelector("#only-configured-indicators").checked;
    const localConfig = await createLocalPackage(onlyConfiguredIndicators);
    exportJsonData(localConfig);
}

async function exportJsonData(json_data) {

    //There might not be anything in the backup, if so skip the download
    if (json_data) {
        showLoading();
        let dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(json_data));
        let dlAnchorElem = document.createElement("a");
        dlAnchorElem.setAttribute("href", dataStr);
        dlAnchorElem.setAttribute("download", "data.json");
        dlAnchorElem.click();
        resetUpgradeStatus();
    }

}


