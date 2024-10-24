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

//Fetch the GF indicators (based on [GFADEx] code in name)
export async function fetchIndicators() {
    var data = await d2Fetch(
        "indicators.json?filter=name:$like:[GFADEX]&fields=:owner&paging=false"
    );
    if (!data || data.indicators.length === 0) {
        console.log("No GFADEx indicators found");
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


export async function fetchPackageReleaseInfo() {
    const url = "https://api.github.com/repos/dhis2/gf-adex-metadata/releases/latest";
    const response = await fetch(url);
    const data = await response.json();
    return data;
}


export async function fetchRemoteAppVersion() {
    const url = "https://api.github.com/repos/dhis2/gf-adex-flow-app/releases/latest";
    const response = await fetch(url);
    const data = await response.json();
    return data.tag_name;
}

export async function fetchLocalAppVersion() {

    const manifest = await d2Fetch("apps/ADEx-Flow/manifest.webapp");
    return manifest.version;
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
        }

        const data = await response.json();
        return data;

    } catch (error) {
        console.error("Error upgrading existing GF metadata:", error);
        alert(__("upgrade-error"));
        throw error; // Re-throw the error so that the calling code can handle it if necessary
    }
}

/* global __ */
export function renderUpgradeStatusReport(statusReport) {
    console.log("Status report is : ", statusReport);
    //Just display the raw JSON as text
    // var html = "<h3>Upgrade Status Report</h3>";
    // html += "<pre>" + JSON.stringify(statusReport, null, 2) + "</pre>";
    // eslint-disable-next-line no-undef
    var html = generateSummaryTable(statusReport);
    document.querySelector("#upgradeStatus").innerHTML = html;
    document.querySelector("#update-gf-metadata-btn").disabled = false;
    if (statusReport.httpStatusCode != 200) {
        // eslint-disable-next-line no-undef
        document.querySelector("#json-report").innerHTML = JSON.stringify(statusReport, null, 2); 
    }
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
        alert(__("no-local-GFADEx-indicators"));
        return;
    }

    const statusReport = await upgradeExistingIndicators(remote, local);
    if (statusReport) {
        renderUpgradeStatusReport(statusReport);
    }

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

    //Verify that all indicators contian GFADEx in the name
    const remoteIndicators = remote.indicators;
    //If we did not get any indicators, return false
    if (!remoteIndicators || remoteIndicators.length === 0) {
        return false;
    }

    const remoteIndicatorNames = remoteIndicators.map((indicator) => indicator.name);
    const validNumeratorNames = remoteIndicatorNames.every((name) => name.includes("GFADEx"));

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

export async function fetchLocalDataExchanges() {

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
    console.log("Initial remote is : ", remote);
    //There might not be anything in the datastore, if so, then alert the user
    if (!remote || remote.length === 0) {
        alert(__("no-remote-metadata"));
        return;
    }

    //Fetch the local metadata
    let localIndicators = await fetchIndicators();
    //There might not be indicators in the local metadata, if so, then alert the user
    if (!localIndicators || localIndicators.length === 0) {
        alert(__("no-local-GFADEx-indicators"));
        return;
    }

    if (includeConfiguredOnly) {
        localIndicators = localIndicators.filter((indicator) => indicator.numerator.trim() != "0");
    }
    //Replace the remote indicators with the local indicators
    remote.indicators = localIndicators;
    console.log("Remote metadata is : ", remote);
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

    //Create the backup object
    return remote;
}


export async function exportLocalExchange() {

    const dataExchanges = await fetchLocalDataExchanges();
    const exchangeUID = document.getElementById("data-exchanges").value;
    const token = document.getElementById("token").value;
    const destinationServer = document.getElementById("destination-server").value;

    const exchange = dataExchanges.find((exchange) => exchange.id === exchangeUID);
    /* Setting these to null otherwise, the importer will complain about the createdBy and lastUpdatedBy fields */
    exchange.createdBy = null;
    exchange.lastUpdatedBy = null;
    exchange.user = null;
    /*Set the token to a placeholder if it is blank or undefined*/
    exchange.target.api.accessToken = token ? token : "d2_placeholdertoken";
    exchange.target.api.url = destinationServer;

    const localExchange =  { aggregateDataExchanges: [exchange] };
    
    exportJsonData(localExchange);
}

export async function exportLocalIndicators() {
    const localIndicators = await fetchIndicators();
    const localConfig = { indicators: localIndicators };
    exportJsonData(localConfig);
}

export async function exportLocalConfig() {
    //Get the value of the checkbox
    const onlyConfiguredIndicators = document.querySelector("#only-configured-indicators").checked;
    //Get the token and destination server
    const token = document.querySelector("#token").value;
    const destinationServer = document.querySelector("#destination-server").value;
    const localConfig = await createLocalPackage(onlyConfiguredIndicators, token, destinationServer);
    exportJsonData(localConfig);
}

export async function exportJsonData(json_data) {

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


export const allowed_implementer_types = [
    {
        "name": "Governmental Organization",
        "id": "HXEkCx9uasx"
    },
    {
        "name": "United Nations Development Programme",
        "id": "ddY6CWfWwoX"
    },
    {
        "name": "Local Private Sector",
        "id": "WqYrHai9gYJ"
    },
    {
        "name": "Other Multilateral Organization",
        "id": "KuPZumnAA3k"
    },
    {
        "name": "Faith Based Organization",
        "id": "izUdgJ2ixiI"
    },
    {
        "name": "Ministry of Finance",
        "id": "ldI7bQZyhIM"
    },
    {
        "name": "Other Entity",
        "id": "buBCzm4Q9py"
    },
    {
        "name": "Other Governmental Organization",
        "id": "iCCfsjluy7r"
    },
    {
        "name": "International Private Sector",
        "id": "S2So8oWX78q"
    },
    {
        "name": "International Faith Based Organization",
        "id": "jK7wYMb7ZcV"
    },
    {
        "name": "Other Community Sector Entity",
        "id": "BBHddcb1ZVr"
    },
    {
        "name": "United Nations Organization",
        "id": "Kg346mmQUxe"
    },
    {
        "name": "International Non-Governmental Organization",
        "id": "nLQuKoZXttR"
    },
    {
        "name": "Ministry of Health",
        "id": "DxDJklvqL7Q"
    },
    {
        "name": "NGO/CBO/Academic",
        "id": "MXeOmeI8Y36"
    },
    {
        "name": "Civil Society Organization",
        "id": "FKpadYSM48G"
    },
    {
        "name": "Local Faith Based Organization",
        "id": "yl4h3HuXlfE"
    },
    {
        "name": "Multilateral Organization",
        "id": "FBS4envxo55"
    },
    {
        "name": "Community led organizations",
        "id": "pZZmYvr4qBh"
    },
    {
        "name": "Private Sector",
        "id": "c9sd0PVzL1G"
    },
    {
        "name": "Local Non-Governmental Organization",
        "id": "VPLzNdhNfmj"
    },
    {
        "name": "Other Organization",
        "id": "bvKLmM9thFG"
    }
];

export const disaggMap = [
    {
        "tQ1EdZrsWV9": "mFV92JDHWuy",
        "bQewWLkBU43": "mFV92JDHWuy",
        "yhZs0dnK3NA": "ky9Be8C6wgK",
        "fCQqfzmaNG1": "ky9Be8C6wgK",
        "v1MU5tVfseC": "ky9Be8C6wgK",
        "tdTp5hnYmCg": "ky9Be8C6wgK",
        "mJBYXji1GL0": "uTRIOcjS3Hn",
        "dh94afv61LD": "uTRIOcjS3Hn",
        "u8joZu7is3B": "sn71HVfDLWl",
        "vCVfDwJonI0": "sn71HVfDLWl",
        "ygEOA5U0eSz": "sn71HVfDLWl",
        "bLgicDW67Et": "sn71HVfDLWl",
        "mx9YLB5bVrk": "ofMxOmQrj9u",
        "tU1KECWOspu": "ofMxOmQrj9u",
        "st5hy1C6awB": "w7yprnSJh0v",
        "gwOmPkq308L": "w7yprnSJh0v",
        "ykEWafJy07o": "w7yprnSJh0v",
        "u58MmZc9PHL": "w7yprnSJh0v",
        "eQuKfoLdCOA": "m9fURW8AKmh",
        "yAQD30SLzvU": "m9fURW8AKmh",
        "bW8ZNuIsovA": "phlKDCAL1Ei",
        "fobfd5H3wiv": "phlKDCAL1Ei",
        "djdK85qZUhM": "nSIPDiJOC7y",
        "fyMiTbHkFal": "nSIPDiJOC7y",
        "o1oZKOct2fq": "mpHCOJEdQPF",
        "gUzS5f4sDOu": "mpHCOJEdQPF",
        "bTsH6RUwYSg": "foXrqBWOQ75",
        "qgQYwKVN01J": "foXrqBWOQ75",
        "gQEIDSwtOLW": "cq6QYNiCzuL",
        "slsG64Ufw2B": "cq6QYNiCzuL",
        "hdcCWaDy5iG": "pJiDghpE4Yv",
        "ltmIEP1nGYV": "pJiDghpE4Yv",
        "fk7rGzZCy2i": "neMuLhvAHt4",
        "l1woI4c78Xv": "neMuLhvAHt4",
        "fK853FQHV2E": "neMuLhvAHt4",
        "t0UtoPgibFq": "a2SAJM3jlps",
        "h7Mhd3e1aUy": "a2SAJM3jlps",
        "bW1KNUfp0nO": "a2SAJM3jlps",
        "fNVnMu2Qa0y": "ybBzLTFV93N",
        "isA4oXWnxr3": "ybBzLTFV93N",
        "hHUNlwV7dae": "ybBzLTFV93N",
        "mderWXTBtql": "aGSqFN1kd8U",
        "hn42y1NAOHf": "aGSqFN1kd8U",
        "bLg6ua24GfA": "aGSqFN1kd8U",
        "iJvhY1DKt2Z": "aGSqFN1kd8U",
        "np9kP3NDHJu": "aGSqFN1kd8U",
        "m5TEdkfUhWj": "kA0bi9lSarh",
        "nlIC26THs4L": "kA0bi9lSarh",
        "rL1olyzHmjv": "kA0bi9lSarh",
        "rXh23FAou4M": "kA0bi9lSarh",
        "nFnWO7cdV3j": "kA0bi9lSarh",
        "ywbBAgJfU3W": "oEqwHYmdyCV",
        "eQm3GnuqYCX": "oEqwHYmdyCV",
        "fWbytrhENpc": "oEqwHYmdyCV",
        "iHTjMtgAQ7F": "oEqwHYmdyCV",
        "zZLoQIGBmw1": "oEqwHYmdyCV",
        "hMkP2ypt9Gq": "ldIDXRJxcK8",
        "hSrwNf39yKz": "ldIDXRJxcK8",
        "gbWwHzmrIJs": "ldIDXRJxcK8",
        "byFu2bEOlf4": "ldIDXRJxcK8",
        "cSqChEj8cQV": "ldIDXRJxcK8",
        "kkS9nECbscI": "ldIDXRJxcK8",
        "mqsmxjpvw47": "ldIDXRJxcK8",
        "jD0J1rcMUh5": "ldIDXRJxcK8",
        "c0uK3C47r1A": "ldIDXRJxcK8",
        "d9mDa7RLOpl": "ldIDXRJxcK8",
        "pD5zIvWt93f": "ldIDXRJxcK8",
        "hlLgMy0jFKO": "e4mLarXxZlV",
        "q7dsQZA4RcN": "e4mLarXxZlV",
        "kc6w8zkEVsY": "e4mLarXxZlV",
        "gS82IkgE9jd": "e4mLarXxZlV",
        "dAPqhUWSuNg": "e4mLarXxZlV",
        "pnzSITEQiHh": "e4mLarXxZlV",
        "eshU8mL4YfO": "e4mLarXxZlV",
        "j8kOLXe3wzY": "e4mLarXxZlV",
        "gkb7pfhYVLx": "e4mLarXxZlV",
        "pxaSeHQmPOC": "e4mLarXxZlV",
        "iS1o4Qi8J6v": "e4mLarXxZlV",
        "g5uHCyoGbWX": "umfaIXlyHUq",
        "em53GKfNszb": "umfaIXlyHUq",
        "xaRPeU6yMQk": "umfaIXlyHUq",
        "n3vDAfTldqR": "umfaIXlyHUq",
        "hbXjdJYnAxi": "umfaIXlyHUq",
        "dxpifM8JtPH": "umfaIXlyHUq",
        "q3jlQt9gJok": "umfaIXlyHUq",
        "ztKOIBFJEdL": "umfaIXlyHUq",
        "nrn6iINsqC3": "umfaIXlyHUq",
        "gy3UQRCAu0T": "umfaIXlyHUq",
        "oG2RBx39KJF": "umfaIXlyHUq",
        "bLbDUkY4VMJ": "pBIGeDk8Sza",
        "z7gPr1asFKq": "pBIGeDk8Sza",
        "s8yh4K2Ljf5": "pBIGeDk8Sza",
        "pxfYXBWmpGv": "pBIGeDk8Sza",
        "mrMY9uhnw4V": "pBIGeDk8Sza",
        "y0TQEnk6Lby": "pBIGeDk8Sza",
        "vsy0uxDefGL": "pBIGeDk8Sza",
        "rehW80K7vMY": "pBIGeDk8Sza",
        "n3W6M5qIYC7": "pBIGeDk8Sza",
        "vG0Jt4C5STv": "pBIGeDk8Sza",
        "upXtDoil1qs": "tSbK5Lq3MH4",
        "sXHhLwqxIEu": "tSbK5Lq3MH4",
        "rCt4ERiblOx": "tSbK5Lq3MH4",
        "hGJyTZ260t1": "tSbK5Lq3MH4",
        "myx8PuUGBFi": "tSbK5Lq3MH4",
        "gyhb2o3lzHK": "tSbK5Lq3MH4",
        "gLyWop6sFNd": "tSbK5Lq3MH4",
        "sJMyv4uR9wN": "tSbK5Lq3MH4",
        "ba3oyPT6OnW": "tSbK5Lq3MH4",
        "jyCuJd3eSKi": "tSbK5Lq3MH4",
        "nePF5ykRmV8": "tSbK5Lq3MH4",
        "oBIayvY1jxf": "tSbK5Lq3MH4",
        "piNgRunS9Iz": "tSbK5Lq3MH4",
        "km8SHDuaXRK": "tSbK5Lq3MH4",
        "mAnhjCBx2ra": "tSbK5Lq3MH4",
        "gd4QowFqjv1": "tSbK5Lq3MH4",
        "pRCFDtVOoWQ": "dXYz4rwFSf0",
        "avhROWPjq27": "dXYz4rwFSf0",
        "lks27SqCW4J": "dXYz4rwFSf0",
        "sHSJWZ2jrOU": "dXYz4rwFSf0",
        "ouKVZOkpMRi": "cZzO51tyEis",
        "pbnDGYLFVv1": "cZzO51tyEis",
        "xd4pt0hbSXj": "cZzO51tyEis",
        "tvpNrxshQI7": "cZzO51tyEis",
        "r9QGR3hcESA": "xCNJ5Su32Pw",
        "hZbHQzDgs02": "xCNJ5Su32Pw",
        "sMlgNnvmOZH": "xCNJ5Su32Pw",
        "omyjb8U3wZI": "xCNJ5Su32Pw",
        "oZ3YHeEwJr2": "goJHYDWvQ9t",
        "tHdWb3mkAxo": "goJHYDWvQ9t",
        "dO3BpUlW2tN": "goJHYDWvQ9t",
        "bxYiBMqR9hL": "goJHYDWvQ9t",
        "w4kvB6aKPqd": "wh9MfJvO750",
        "wASa4C1REDg": "wh9MfJvO750",
        "s68V9uvXjOe": "wh9MfJvO750",
        "pN6YizxG2BS": "wh9MfJvO750",
        "mNG6ctvhHj5": "kywfzBp6EbK",
        "qojkYgeyUmP": "kywfzBp6EbK",
        "gZ0pfCe9AbT": "kywfzBp6EbK",
        "kJqG1ue3tjr": "kywfzBp6EbK",
        "vtcuZPdpMAT": "kywfzBp6EbK",
        "i1TaWgMsmRb": "kywfzBp6EbK",
        "mnRv2xqpaUD": "kywfzBp6EbK",
        "apRw1ANUIKS": "kywfzBp6EbK",
        "dKs1uHVYaPN": "kywfzBp6EbK",
        "tmJXEMlosOG": "kywfzBp6EbK",
        "xULOa9rPjVd": "kywfzBp6EbK",
        "fcMDdJs3ZwA": "kywfzBp6EbK",
        "eSwmbDKkTur": "sd2pvT7cLk6",
        "wLc5ix1ksjY": "sd2pvT7cLk6",
        "i1mbNdt0zDC": "sd2pvT7cLk6",
        "z9Ae3DHinza": "sd2pvT7cLk6",
        "mhAnfxQTSKH": "sd2pvT7cLk6",
        "h0fLvAh6dWw": "sd2pvT7cLk6",
        "hD7NCvt8MOp": "sd2pvT7cLk6",
        "wEOeW5MD0oz": "sd2pvT7cLk6",
        "eIqD5p7O1Nc": "sd2pvT7cLk6",
        "d6zEFMZP8b3": "sd2pvT7cLk6",
        "obpHfAyZLU8": "sd2pvT7cLk6",
        "mYl16gTx84m": "sd2pvT7cLk6",
        "yM7dsqVHvXY": "sbVG8okTi7H",
        "gsXJ6RcG7gS": "sbVG8okTi7H",
        "nsFyLJK2nk8": "sbVG8okTi7H",
        "chwTj0MqQYB": "sbVG8okTi7H",
        "fv3RuQm8b2C": "sbVG8okTi7H",
        "oOIaGohFYQe": "nyanq1J954h",
        "otyi8OWxRf5": "nyanq1J954h",
        "lzWH8nLCTeU": "nyanq1J954h",
        "eGmLyxa4f8B": "nyanq1J954h",
        "vuDykAsKZX4": "nyanq1J954h",
        "sbGDJnPTsAF": "kxtAPr0Xi6C",
        "oRcMgbsYO0S": "kxtAPr0Xi6C",
        "oa8MOJX5Fb7": "kxtAPr0Xi6C",
        "eR5SGiwWK81": "kxtAPr0Xi6C",
        "uD3Wzfse9mJ": "kxtAPr0Xi6C",
        "piah80IfVUg": "kxtAPr0Xi6C",
        "fmpcxXvdTk4": "kxtAPr0Xi6C",
        "oG4vKc5w2Zu": "kxtAPr0Xi6C",
        "wOTw3pjY1v0": "j2TLYBF9aAg",
        "z7SqZcafJVx": "j2TLYBF9aAg",
        "rcxY82zJ4nX": "aLZSXHjxCiK",
        "hlAuKI94TwR": "aLZSXHjxCiK",
        "dO5KezWdDkh": "hQGlpTJnV5o",
        "sTeHtLEnmBo": "hQGlpTJnV5o",
        "oQu7S8C2qVh": "hQGlpTJnV5o",
        "qgxEvF8BtfI": "q85nFr1lMZo",
        "b0figh1XZFK": "q85nFr1lMZo",
        "z24ywok8Gf1": "q85nFr1lMZo",
        "c19XCOj2Dof": "q85nFr1lMZo",
        "nV6frY5IypG": "q85nFr1lMZo",
        "zQSRek7mA2z": "q85nFr1lMZo",
        "bdTnyMWFLBH": "q85nFr1lMZo",
        "otDSW6FOeLT": "q85nFr1lMZo",
        "vgTYDXLUbIl": "q85nFr1lMZo",
        "bI5vzBDl9w4": "q85nFr1lMZo",
        "gY86zHj2GX5": "q85nFr1lMZo",
        "jzfRTEV6Uti": "hgAGDcisJdT",
        "yd7NqhJ2lvL": "hgAGDcisJdT",
        "pWb1QFNVgfM": "hgAGDcisJdT",
        "r7SMOkaJAZH": "hgAGDcisJdT",
        "wamEHvuZCDc": "hgAGDcisJdT",
        "fG0RM8VIvCO": "hgAGDcisJdT",
        "gXLpyAgHquD": "hgAGDcisJdT",
        "lO9KIRh03jE": "hgAGDcisJdT",
        "odJFtku6iP1": "hgAGDcisJdT",
        "xYGMjvbou6i": "hgAGDcisJdT",
        "gcMvi2jzQTx": "hgAGDcisJdT",
        "kFXQwtdkRWP": "hgAGDcisJdT",
        "ekf2ZLXn7bo": "hgAGDcisJdT",
        "h0jWVigLea7": "hgAGDcisJdT",
        "dTlIws2D1Kp": "hgAGDcisJdT",
        "f6jMotXKBHU": "f1EnTCFktiV",
        "aTmEVZNib5h": "f1EnTCFktiV",
        "k3r6VLuSwIA": "f1EnTCFktiV",
        "eN58OQ49lnV": "f1EnTCFktiV",
        "d2CiMa8DVlB": "f1EnTCFktiV",
        "cxcZgvUh2ie": "f1EnTCFktiV",
        "hSm8LCiZVwo": "f1EnTCFktiV",
        "of64UvaW0Z1": "f1EnTCFktiV",
        "cHxvrPOjDR5": "f1EnTCFktiV",
        "o9dO3nb7PN8": "f1EnTCFktiV",
        "aIF8JcRCfqU": "f1EnTCFktiV",
        "y4Jd9Vsla5j": "zNXhbG3i61D",
        "xy8DHEVu0iW": "zNXhbG3i61D",
        "lPnL0eo9IMr": "rXdVi8PFxjY",
        "zdWYzyEQkp7": "rXdVi8PFxjY",
        "b75G6yBmRaw": "rXdVi8PFxjY",
        "anJPiVSRxKO": "rXdVi8PFxjY",
        "earyj4nY0GZ": "rXdVi8PFxjY",
        "tl1vUBqNADI": "rXdVi8PFxjY",
        "kThvX8rFg5N": "rXdVi8PFxjY",
        "wdxLtgib4F3": "rXdVi8PFxjY",
        "djV7Qh3PxYn": "sEvqdDzIXO6",
        "qCnWeQhdP3E": "sEvqdDzIXO6",
        "kVQyqv9eC60": "sEvqdDzIXO6",
        "r6cHflbtUDJ": "sEvqdDzIXO6",
        "jfPbxuC8aBG": "sEvqdDzIXO6",
        "p1i4bmQ6pgC": "sEvqdDzIXO6",
        "lACPcHrnaRE": "sEvqdDzIXO6",
        "y8pCDBVwXFg": "sEvqdDzIXO6",
        "lSjF4ihH5sE": "m0Z3SkRsrUW",
        "xa187m9GBfP": "m0Z3SkRsrUW",
        "bFHUZqa2IAg": "m0Z3SkRsrUW",
        "tNnKZGdW51X": "rg4B63I0uAz",
        "nE9abjBeUyn": "rg4B63I0uAz",
        "aRyiI6Fbjvg": "rg4B63I0uAz",
        "fg8Hi1EKe9y": "rg4B63I0uAz",
        "lMEGudRDwBf": "rg4B63I0uAz",
        "q79LKmN6eC5": "rg4B63I0uAz",
        "jLrnoG3YQPy": "rg4B63I0uAz",
        "tOaymPeztgx": "rg4B63I0uAz",
        "yfcR8lOYS2g": "rg4B63I0uAz",
        "hIZn539ClgV": "rg4B63I0uAz",
        "teNTajn7oRp": "rg4B63I0uAz",
        "ibTYsunKDFh": "eIRKLcg43TV",
        "nV1IwGT5RLr": "eIRKLcg43TV",
        "d3bwCkNWqiF": "eIRKLcg43TV",
        "fuWtvq30zQ7": "eIRKLcg43TV",
        "y6MDncuCW5v": "eIRKLcg43TV",
        "v2De7JfpsrR": "eIRKLcg43TV",
        "istzhu60YAS": "eIRKLcg43TV",
        "l75CUXrevdu": "eIRKLcg43TV",
        "oShRweEVaHx": "eIRKLcg43TV",
        "dcehXEuf7Kk": "eIRKLcg43TV",
        "tVQ6RdmLYyq": "eIRKLcg43TV",
        "ka2isEOXnIS": "eIRKLcg43TV",
        "tp01evMEXAx": "eIRKLcg43TV",
        "rOXiMNoWAKy": "eIRKLcg43TV",
        "atq2kcr7zd9": "eIRKLcg43TV",
        "iIsAxr01cbT": "wnhcTpHYlUO",
        "hqiFwzGdNm5": "wnhcTpHYlUO",
        "dgC2kqs4Ddw": "wnhcTpHYlUO",
        "oPjrn3xp2NG": "wnhcTpHYlUO",
        "qAl0deUapVK": "wnhcTpHYlUO",
        "t2N5PtOiE8z": "wnhcTpHYlUO",
        "qpZ6BQ5eOPt": "wnhcTpHYlUO",
        "r048pbXHI3x": "wnhcTpHYlUO",
        "uTZhrFAVL2Q": "wnhcTpHYlUO",
        "s174KX9Rcyh": "wnhcTpHYlUO",
        "yPrHMBhjnsl": "wnhcTpHYlUO",
        "h5gbEYRLJ0K": "xPqdr8JFyTX",
        "urEFfktvxDu": "xPqdr8JFyTX",
        "u5u7hmO3Fpt": "xPqdr8JFyTX",
        "tsATKgvbuLW": "o3GqdS5NMYt",
        "dpsoYyL8jl2": "o3GqdS5NMYt",
        "coGbe40lKZR": "o3GqdS5NMYt",
        "mhJmECkVbHr": "o3GqdS5NMYt",
        "cZXf8T3EDv0": "o3GqdS5NMYt",
        "zQc6gSzdIyD": "o3GqdS5NMYt",
        "eOj8oaDYTAl": "o3GqdS5NMYt",
        "wbDdKevgntY": "o3GqdS5NMYt",
        "mUwFbaIMfQx": "o3GqdS5NMYt",
        "m5Zupjw3P4W": "o3GqdS5NMYt",
        "lBqVKxwlTkj": "o3GqdS5NMYt",
        "oDr0EJbI6no": "zYJgUzyoedp",
        "am1kVO7yfAI": "zYJgUzyoedp",
        "t74iYfeJmOA": "zYJgUzyoedp",
        "j38p6IB0Jv2": "zYJgUzyoedp",
        "lWpZFh16gt8": "zYJgUzyoedp",
        "toJ5cKXMhAZ": "zYJgUzyoedp",
        "inw9IKdRSoF": "zYJgUzyoedp",
        "dblGxsjOE7h": "zYJgUzyoedp",
        "yML6bYAc7I9": "zYJgUzyoedp",
        "gWbCap8mzlR": "zYJgUzyoedp",
        "zBVbWx3ugJF": "zYJgUzyoedp",
        "aEgtpjTFhW6": "kmYfUcV41HS",
        "nDsjxGeMrAi": "kmYfUcV41HS",
        "rBLKQAFrRnH": "kmYfUcV41HS",
        "tCZv2lVtomf": "kmYfUcV41HS",
        "cJOpRE2NlGm": "kmYfUcV41HS",
        "iWRZSTsBQ04": "kmYfUcV41HS",
        "qW8z6IMTk3X": "caDgZfdPuB3",
        "rb5IRvKXFU2": "caDgZfdPuB3",
        "ftRYT7DQfdc": "caDgZfdPuB3",
        "keGrVdhmWxn": "caDgZfdPuB3",
        "bC4YGOn2JrM": "caDgZfdPuB3",
        "pYI3ChyXfWK": "caDgZfdPuB3",
        "lOSa1R7iQxk": "caDgZfdPuB3",
        "jtheYN2ydJR": "caDgZfdPuB3",
        "vnXcA45vYV7": "caDgZfdPuB3",
        "bCptjEvD3u5": "caDgZfdPuB3",
        "aKbdMBkt83r": "caDgZfdPuB3",
        "bVEw6QW3ysr": "caDgZfdPuB3",
        "jbpr82WEksY": "caDgZfdPuB3",
        "j1SfRUyT3PV": "caDgZfdPuB3",
        "xrUpQPEnAa4": "a8iFcJwD2EM",
        "ux1BFGP0EUi": "a8iFcJwD2EM",
        "ggj3eGivN0a": "a8iFcJwD2EM",
        "xDQxtbhFJqT": "a8iFcJwD2EM",
        "t89C7jzdYQR": "a8iFcJwD2EM",
        "nEZBQXgm9fq": "a8iFcJwD2EM",
        "tkHVcaClbgO": "a8iFcJwD2EM",
        "i3JTDqIslp8": "a8iFcJwD2EM",
        "r6PHv3XKmBn": "a8iFcJwD2EM",
        "zZN16WmoShd": "a8iFcJwD2EM",
        "aAu1Dh5N34U": "a8iFcJwD2EM",
        "opMhmlQSfg5": "a8iFcJwD2EM",
        "olvsoKLueXE": "a8iFcJwD2EM",
        "mzD0evAMxFa": "a8iFcJwD2EM",
        "abzutMpjxF5": "a8iFcJwD2EM",
        "zynspDgrPYm": "a8iFcJwD2EM",
        "s32wVZtuY7Q": "a8iFcJwD2EM",
        "tBOkaQTx6cs": "a8iFcJwD2EM",
        "qz5Fxog3Lkc": "l8nXmH5DyC2",
        "dle3iXSDtYE": "l8nXmH5DyC2",
        "eXr3KlRsVeu": "l8nXmH5DyC2",
        "o83bHvAeSVG": "l8nXmH5DyC2",
        "rIkTlh0Za6K": "l8nXmH5DyC2",
        "vnTlP5CtXhH": "l8nXmH5DyC2",
        "wjHpw82fKdu": "l8nXmH5DyC2",
        "tkXvu48jEaK": "l8nXmH5DyC2",
        "iaWL41Oitw8": "l8nXmH5DyC2",
        "fY0lGvxBWVL": "l8nXmH5DyC2",
        "lGFva6teU5M": "l8nXmH5DyC2",
        "maLIEZox68O": "l8nXmH5DyC2",
        "ce5lDXfjF8h": "l8nXmH5DyC2",
        "rQaO2eIZLkC": "l8nXmH5DyC2",
        "ntnB97siKUC": "ejYPVLN57q8",
        "gryY7OcLvDi": "ejYPVLN57q8",
        "qPaybFNlcB8": "ejYPVLN57q8",
        "v1e8Vj4tUZJ": "ejYPVLN57q8",
        "ka8hP6Zq2yL": "ejYPVLN57q8",
        "akrHqUw4ua9": "yfk5cLpR3O4",
        "rFIpG1HLvzR": "yfk5cLpR3O4",
        "iCicNb7fZAD": "yfk5cLpR3O4",
        "v5xQ2TenGYE": "yfk5cLpR3O4",
        "jabqNCPLhOw": "yfk5cLpR3O4",
        "nVORmGd5clT": "yfk5cLpR3O4",
        "mJhzk4NAS9I": "yfk5cLpR3O4",
        "fPaIY45AOex": "yfk5cLpR3O4",
        "v0f5hir3LEu": "yfk5cLpR3O4",
        "vpMinkh2foE": "yfk5cLpR3O4",
        "uB96aoAEOTs": "yfk5cLpR3O4",
        "ek9vc4Qra5j": "yfk5cLpR3O4",
        "g7sRcZCyvNr": "yfk5cLpR3O4",
        "djuDKlFCvL7": "u7bP8q9IoWl",
        "o1MVl6WRnEN": "u7bP8q9IoWl",
        "jGDgieES412": "u7bP8q9IoWl",
        "mop1PuiDbZU": "u7bP8q9IoWl",
        "pEBUwHj9k5C": "u7bP8q9IoWl",
        "vT3mM8YygkN": "u7bP8q9IoWl",
        "a6bE4XevaiM": "u7bP8q9IoWl",
        "zt7sCkTRLlZ": "u7bP8q9IoWl",
        "pc6yS7RlXK3": "u7bP8q9IoWl",
        "sGNRq5D1w3x": "u7bP8q9IoWl",
        "vY3zwvd9cKg": "u7bP8q9IoWl",
        "h8wiQD7NkGE": "u7bP8q9IoWl",
        "rcvDZ9MBL0V": "u7bP8q9IoWl",
        "aBbqL5y3fsc": "u7bP8q9IoWl",
        "aGuINl45bjz": "u7bP8q9IoWl",
        "hskFaLBoiO2": "u7bP8q9IoWl",
        "qvy2afTW9CR": "u7bP8q9IoWl",
        "qF48HKWu1kp": "wafxOGXpr2v",
        "qRTG5r9tgv1": "wafxOGXpr2v",
        "zm0KEs53xkB": "wafxOGXpr2v",
        "eomHIyZWD8E": "wafxOGXpr2v",
        "pebJMFSKut6": "wafxOGXpr2v",
        "m2OAQayhGlV": "wafxOGXpr2v",
        "bvHZi9FxtA6": "wafxOGXpr2v",
        "h3AU7YI8lEF": "wafxOGXpr2v",
        "ltUzBh0PkQa": "wafxOGXpr2v",
        "miLuyalKrgZ": "wafxOGXpr2v",
        "xSWuVpvjfT5": "wafxOGXpr2v",
        "yFA6Ctvj3Xr": "o8o127ndjiI",
        "wxH1C2dvtuK": "o8o127ndjiI",
        "jDAgPI1wEFM": "o8o127ndjiI",
        "gTuVnpZg4Bz": "o8o127ndjiI",
        "dDbmVBtkGOg": "o8o127ndjiI",
        "fDC241bdU6p": "qfFAtPlDwX1",
        "ycdvSPoZiwF": "qfFAtPlDwX1",
        "fzRm1XxsrQG": "qfFAtPlDwX1",
        "mK8bj509Mep": "qfFAtPlDwX1",
        "sJL5im2O0KT": "qfFAtPlDwX1",
        "pbZ5Tk07SeH": "i9Hck7PmuFf",
        "c4Vtx6na7JZ": "i9Hck7PmuFf",
        "lCHd7XgJW9a": "i9Hck7PmuFf",
        "llcxqOJAEUH": "i9Hck7PmuFf",
        "umaR0WlGT6o": "i9Hck7PmuFf",
        "vsMP7de03t4": "oHkfEaqWBe8",
        "rsoZQxLiFEC": "oHkfEaqWBe8",
        "pE2CK0wbzIU": "oHkfEaqWBe8",
        "gV6hYvBCD5r": "oHkfEaqWBe8",
        "w4x9WjfsONQ": "oHkfEaqWBe8",
        "aFzxt0uEe5j": "mHf50m8nGFk",
        "xMOxIKeGQSV": "mHf50m8nGFk",
        "bj6t83UGVzO": "mHf50m8nGFk",
        "tFKhaXPgfVt": "mHf50m8nGFk",
        "smMZSqkgK2A": "mHf50m8nGFk",
        "a7sXEHWJtCx": "sxNc5fSXzrM",
        "jBcqvrgT729": "sxNc5fSXzrM",
        "gkQlanw2u1L": "sxNc5fSXzrM",
        "iBIcCp0q4Ky": "sxNc5fSXzrM",
        "b91IfeZrs0X": "sxNc5fSXzrM",
        "hpEn8mXKvkx": "haTZ3Xl1G8O",
        "dp8a6yOCjhR": "haTZ3Xl1G8O",
        "zk0EXHFshgY": "haTZ3Xl1G8O",
        "meDd8CmZsVQ": "haTZ3Xl1G8O",
        "p1u4WGSLsJg": "haTZ3Xl1G8O",
        "fFrPXx4EdHK": "uUOIR6YGhMi",
        "nlMyBUe57nw": "uUOIR6YGhMi",
        "dWv6t4RJL5H": "p2lMD8ZPO9y",
        "ePdaQUGXmtI": "p2lMD8ZPO9y",
        "v6hS4dGafH7": "p2lMD8ZPO9y",
        "zORz7hTM3no": "p2lMD8ZPO9y",
        "lERL2qu49jN": "p2lMD8ZPO9y",
        "bFp93jEuOtr": "igatI4K8sQf",
        "ol9GkEngL6W": "igatI4K8sQf",
        "oGDYSgzOt5r": "igatI4K8sQf",
        "sW1T9SNhgHv": "igatI4K8sQf",
        "kuB3Fd5e97o": "igatI4K8sQf",
        "xjTqSJZWtH8": "enkQTFZXyjW",
        "ytefsUGYrAB": "enkQTFZXyjW",
        "eOZhqKYGiN0": "enkQTFZXyjW",
        "omPBcewnHxi": "enkQTFZXyjW",
        "zPsVJn5eDtf": "enkQTFZXyjW",
        "b4CfRFj0GOu": "enkQTFZXyjW",
        "iVQwYegKh9d": "enkQTFZXyjW",
        "n5ig9ASkHzE": "enkQTFZXyjW",
        "qlUWcrN9HmX": "yuw4Qyd5N9C",
        "ciOYcXNMJ6v": "yuw4Qyd5N9C",
        "jX2MuBAVH1i": "yuw4Qyd5N9C",
        "qbLgYXJKEne": "yuw4Qyd5N9C",
        "y49I0RZnzFK": "yuw4Qyd5N9C",
        "asNUybf8qOM": "yuw4Qyd5N9C",
        "eWwUZISYb6H": "yuw4Qyd5N9C",
        "lsnAgexOXm2": "yuw4Qyd5N9C",
        "rZvBQl6OiFJ": "b3WQmSHZR4f",
        "o0vZkDrybxs": "b3WQmSHZR4f",
        "wjU148a2bLO": "b3WQmSHZR4f",
        "iZbO2B5sRiw": "b3WQmSHZR4f",
        "l35cAlqLv84": "b3WQmSHZR4f",
        "cf3cTF2JvC8": "b3WQmSHZR4f",
        "nzAVyjYceT1": "b3WQmSHZR4f",
        "rFD6mIhxsUZ": "b3WQmSHZR4f",
        "axnChFTYNtc": "hTQzwg7Mnru",
        "mIM7t6sZNTj": "hTQzwg7Mnru",
        "yC8Ee1fg5Dn": "hTQzwg7Mnru",
        "y8G5CP3HSrY": "hTQzwg7Mnru",
        "upA7fjB9owX": "hTQzwg7Mnru",
        "cgHzfZ7Jthi": "hTQzwg7Mnru",
        "mPmTVcrONa4": "hTQzwg7Mnru",
        "mEi8uvwAc96": "hTQzwg7Mnru",
        "bfbsPJjAGoB": "mKYWc74Q0I1",
        "iSKXRtE3wUi": "mKYWc74Q0I1",
        "sJeY0vsNkTz": "mKYWc74Q0I1",
        "iXPfOaclnZS": "mKYWc74Q0I1",
        "xFsbUEVyTDQ": "mKYWc74Q0I1",
        "nltqzDydOiM": "mKYWc74Q0I1",
        "kOFuZmGIkgA": "mKYWc74Q0I1",
        "xOs6iREacg1": "mKYWc74Q0I1",
        "gvimP2ILAk1": "gD1oNY7TeaW",
        "o98BDiLmXWg": "gD1oNY7TeaW",
        "lQLg3UBSGOI": "gD1oNY7TeaW",
        "mnQ7IAg8ifa": "gD1oNY7TeaW",
        "cM4fd0KxgZD": "gD1oNY7TeaW",
        "w0aLuOFwcpU": "yOhS5vjxbCm",
        "lnN4YgmKua6": "yOhS5vjxbCm",
        "fxWGz2STaQu": "yOhS5vjxbCm",
        "kCFZibP5Hgn": "yOhS5vjxbCm",
        "udfgneGQtpq": "yOhS5vjxbCm",
        "pvZwjCYmTO1": "uhvq3Q0FpPk",
        "zV4m7a1YwSL": "uhvq3Q0FpPk",
        "fDhVM4uXp0P": "f0tok9GIBZX",
        "srC5E1Ja9Md": "f0tok9GIBZX",
        "n6BiAa38uEH": "f0tok9GIBZX",
        "dkBi86zIw1s": "f0tok9GIBZX",
        "zsNRplAUPk2": "f0tok9GIBZX",
        "b41RqAmMalF": "f0tok9GIBZX",
        "tKIClZ1nbAj": "f0tok9GIBZX",
        "veRwyn2q0TB": "f0tok9GIBZX",
        "s1B0n5RF6WG": "f0tok9GIBZX",
        "mnyvofeZkB3": "f0tok9GIBZX",
        "zs6N5K8Lr3z": "f0tok9GIBZX",
        "edFB1Gwio5D": "dlCMWuZeBvI",
        "f1LV7f6EMBI": "dlCMWuZeBvI",
        "mYtMdurGVIj": "dlCMWuZeBvI",
        "ax4RGoQqFAk": "dlCMWuZeBvI",
        "yI2XWNa9i3t": "dlCMWuZeBvI",
        "aF10vSr42p5": "dlCMWuZeBvI",
        "zMUGDtBO3Ju": "dlCMWuZeBvI",
        "q7DG8zOvIl6": "dlCMWuZeBvI",
        "xwAIh39OjQu": "dlCMWuZeBvI",
        "qDp0L15J3zV": "dlCMWuZeBvI",
        "uVLDnbAEIaT": "dlCMWuZeBvI",
        "l8wupG0vs4T": "lh0cVKYdG6A",
        "oRHwNCbjfqU": "lh0cVKYdG6A",
        "gZgLhu8lrDQ": "lh0cVKYdG6A",
        "wLzaV1EvusS": "lh0cVKYdG6A",
        "zpSCfFxEb5y": "lh0cVKYdG6A",
        "gOMfunLzxZU": "lh0cVKYdG6A",
        "tRTMF5ihczm": "lh0cVKYdG6A",
        "zAJ8TghNc0H": "lh0cVKYdG6A",
        "sQ7Lwc5tbvS": "lh0cVKYdG6A",
        "fkUvdAbKWT5": "lh0cVKYdG6A",
        "iY3vLaRZMun": "lh0cVKYdG6A",
        "wu0Mx8qtsAb": "lh0cVKYdG6A",
        "vwQL5Pyi8Y6": "lh0cVKYdG6A",
        "mEzfHNRBmX0": "lh0cVKYdG6A",
        "rwrPl94YZjq": "lh0cVKYdG6A",
        "b0PhD6TqtNu": "lh0cVKYdG6A",
        "o6Xov3AIYFs": "lh0cVKYdG6A",
        "g6lyhqz4viP": "lh0cVKYdG6A",
        "gK5B93bfnze": "lh0cVKYdG6A",
        "ksjQnez4HBZ": "lh0cVKYdG6A",
        "lk2EsSN4hD9": "lh0cVKYdG6A",
        "qDqT9pJ31UR": "lh0cVKYdG6A",
        "hGrse5bchYC": "lh0cVKYdG6A",
        "kKs2EwMRXgO": "lh0cVKYdG6A",
        "xZzORm9rbfn": "lh0cVKYdG6A",
        "xKeu4RFWaTl": "lh0cVKYdG6A",
        "qXgkVSdBTbU": "lh0cVKYdG6A",
        "i8c1PGNLyKk": "lh0cVKYdG6A",
        "iUpEoSMXztk": "lh0cVKYdG6A",
        "hyLYszfjGvW": "lh0cVKYdG6A",
        "bYDRqPiL4Mx": "lh0cVKYdG6A",
        "h4vh07IO5me": "lh0cVKYdG6A",
        "cr1BtcMWFiC": "lh0cVKYdG6A",
        "s5GDVQMq1vp": "lh0cVKYdG6A",
        "eyvEs1afot6": "lh0cVKYdG6A",
        "yK4cwh3t0Ls": "p1HSRpMDNGy",
        "yqOI627RJ9Y": "p1HSRpMDNGy",
        "yKHkhABjUiP": "p1HSRpMDNGy",
        "e0yilsJ2BDV": "p1HSRpMDNGy",
        "e2JcLidRYvp": "p1HSRpMDNGy",
        "ii6yEWGPz7q": "p1HSRpMDNGy",
        "ae1q9sHUtYB": "p1HSRpMDNGy",
        "bqWKB5tyg4R": "p1HSRpMDNGy",
        "xwjZfFXWnLg": "p1HSRpMDNGy",
        "aWMfnpSkPC4": "p1HSRpMDNGy",
        "lOMLpwznocs": "p1HSRpMDNGy",
        "n21u0S6rTcl": "xskeaW1CoFE",
        "weHfF7pGaUX": "xskeaW1CoFE",
        "jB2FMg9eOoK": "xskeaW1CoFE",
        "jRt7WqF1LmT": "xskeaW1CoFE",
        "yx5bh1DcfkA": "xskeaW1CoFE",
        "c0dbMl1oV3N": "xskeaW1CoFE",
        "alN1Vvnzm8F": "xskeaW1CoFE",
        "hGLZHCSVxdv": "xskeaW1CoFE",
        "sGrt0uJXh4K": "xskeaW1CoFE",
        "wmT1PVwrnLy": "xskeaW1CoFE",
        "fvETbcoQxhZ": "xskeaW1CoFE",
        "eC6NSPxRnl0": "s16CMdxEyjf",
        "jE3tLK0Qyor": "s16CMdxEyjf",
        "v8t47P6XrU1": "s16CMdxEyjf",
        "ruXPDtLFvWJ": "s16CMdxEyjf",
        "e1ZwusoNgUH": "s16CMdxEyjf",
        "u3CsdeWRmEb": "s16CMdxEyjf",
        "veq2J0DUzyF": "s16CMdxEyjf",
        "gzRpGn9boEk": "s16CMdxEyjf",
        "oCLEaSWyk17": "s16CMdxEyjf",
        "eo6JCAqhf7Y": "s16CMdxEyjf",
        "kG9VqSdMReB": "s16CMdxEyjf",
        "sz86PILi4bU": "s16CMdxEyjf",
        "tVfHNGy0n3w": "s16CMdxEyjf",
        "qr7DFV02Pph": "s16CMdxEyjf",
        "pFHY4sL1ixb": "s16CMdxEyjf",
        "e4mdx5DatIo": "s16CMdxEyjf",
        "nAU6z21Ii9v": "wnCBX4ju32g",
        "ahXaiS7R4LI": "wnCBX4ju32g",
        "eOBhpnd2UmZ": "wnCBX4ju32g",
        "ogpVMvsXN4r": "wnCBX4ju32g",
        "zYsJZ20SOPl": "wnCBX4ju32g",
        "z1g05CoBh2a": "wnCBX4ju32g",
        "lYLTiB1hJkH": "wnCBX4ju32g",
        "hqc89nEDixL": "wnCBX4ju32g",
        "vdSgMoXQe7E": "wnCBX4ju32g",
        "h6gsHOoQBRD": "wnCBX4ju32g",
        "p9lKUfAL80v": "wnCBX4ju32g",
        "mHcyCjRVK7E": "wnCBX4ju32g",
        "tzWKYnd7D0I": "wnCBX4ju32g",
        "d2sI3KOYc9j": "wnCBX4ju32g",
        "zqkVBpCrmoc": "wnCBX4ju32g",
        "mPyGIfdvTs5": "wnCBX4ju32g",
        "yuRNko4Pbwx": "wnCBX4ju32g",
        "ops74RVjxfM": "wnCBX4ju32g",
        "yEY41fnMJq0": "rPU1Nx0QOZj",
        "mWMcwl0pygn": "rPU1Nx0QOZj",
        "mZ7VxBkfJlR": "rPU1Nx0QOZj",
        "l3dX8J0Sk2V": "rPU1Nx0QOZj",
        "mkEpNshoTPl": "rPU1Nx0QOZj",
        "qftATHvb0Zn": "rPU1Nx0QOZj",
        "qfUpi3vKQjt": "rPU1Nx0QOZj",
        "vwBEVUYsZgb": "rPU1Nx0QOZj",
        "boLVwQ5GZCq": "rPU1Nx0QOZj",
        "cINYv54zaZ2": "rPU1Nx0QOZj",
        "nM2NIzm1ABJ": "rPU1Nx0QOZj",
        "nEZ6oe2ybnr": "rLu2Ez4pwVS",
        "oHxTpfkF9dD": "rLu2Ez4pwVS",
        "lGOZerqvbjR": "rLu2Ez4pwVS",
        "himC8has75Z": "j4JoVxBAkMO",
        "lWgh1Qqt6AS": "j4JoVxBAkMO",
        "ofg1Y7y0kbm": "j4JoVxBAkMO",
        "hi4dyMUk6Os": "r0sC2Ag3qfc",
        "ym32SAdD1EH": "r0sC2Ag3qfc",
        "z5Cz8LWNtOE": "r0sC2Ag3qfc",
        "oyW0QNlc8eG": "r0sC2Ag3qfc",
        "pKH7OfcZtkN": "r0sC2Ag3qfc",
        "gAj9YoLyJld": "r0sC2Ag3qfc",
        "fe4kRs2u3rB": "r0sC2Ag3qfc",
        "sxLiTnPDYt0": "r0sC2Ag3qfc",
        "uRaPCuT3ly7": "r0sC2Ag3qfc",
        "iBnjy2Rmbh9": "r0sC2Ag3qfc",
        "rSCXYz6mwV0": "r0sC2Ag3qfc",
        "n6dV3mjeIgf": "r0sC2Ag3qfc",
        "sEIMycuqXB6": "r0sC2Ag3qfc",
        "yd1UuCv7j4c": "r0sC2Ag3qfc",
        "il9Hs71MTyC": "k3VuAMSljdY",
        "pKup9ZjqEOU": "k3VuAMSljdY",
        "lNSKPDEyqWg": "k3VuAMSljdY",
        "nXRwE5k4LGd": "k3VuAMSljdY",
        "iqj0unZmbCQ": "k3VuAMSljdY",
        "n15drpNPEgR": "k3VuAMSljdY",
        "gEsfI5mWvMA": "k3VuAMSljdY",
        "dWuGS4YPvUD": "k3VuAMSljdY",
        "qKQOi3F78c6": "uUBxDfXLehI",
        "kAvy8qbSdVt": "uUBxDfXLehI",
        "ut984iEZkg7": "uUBxDfXLehI",
        "vSwmBs305gY": "uUBxDfXLehI",
        "siqHBTklb5A": "uUBxDfXLehI",
        "s2ID89PeZKR": "uUBxDfXLehI",
        "oDgRSZM6Khz": "uUBxDfXLehI",
        "e9MJZ3LAsNu": "uUBxDfXLehI",
        "urJhM3A4Scv": "uUBxDfXLehI",
        "hjx1cLM3muR": "uUBxDfXLehI",
        "czYLmJnWxHy": "uUBxDfXLehI",
        "r9aKjrkIQ62": "uUBxDfXLehI",
        "o4cFlW2MyIv": "uUBxDfXLehI",
        "n13yc0J67sv": "uUBxDfXLehI",
        "sWEBez6vXmd": "zIUvaF4nw72",
        "gqlpTFOStyQ": "zIUvaF4nw72",
        "sDt8mq5csh2": "zIUvaF4nw72",
        "c7xmrePIinJ": "zIUvaF4nw72",
        "j6FRBVo5SmY": "zIUvaF4nw72",
        "goTxL0y7ZJ8": "zIUvaF4nw72",
        "eNOCSpFMZDb": "zIUvaF4nw72",
        "vTBnUgIO4Y3": "zIUvaF4nw72",
        "r65axWcUMT2": "nAF21pMtuS0",
        "dr5BdtyZ4kx": "nAF21pMtuS0",
        "xN1j2rm507J": "nAF21pMtuS0",
        "dsNZacBVHrW": "nAF21pMtuS0",
        "yprNa230MxT": "nAF21pMtuS0",
        "g0hE32MCrKH": "nAF21pMtuS0",
        "tUWl5AsM82o": "nAF21pMtuS0",
        "f86HJhAndKN": "nAF21pMtuS0",
        "lwWpLD1yXMq": "edLHmln1QV5",
        "vURvceaJLF6": "edLHmln1QV5",
        "yHIQhJPTOKc": "edLHmln1QV5",
        "i4Vy3m6ZrYG": "edLHmln1QV5",
        "ipYgqwZaos2": "edLHmln1QV5",
        "jHF6CoZAg2r": "edLHmln1QV5",
        "uKR8rtJfuyo": "edLHmln1QV5",
        "rq3yf12XZVe": "edLHmln1QV5",
        "wanjB13WDNH": "iRSBcFOqGTJ",
        "jTOCEeLD6RK": "iRSBcFOqGTJ",
        "l1OymN3BAhX": "iRSBcFOqGTJ",
        "uQ1DaudB2xl": "iRSBcFOqGTJ",
        "jlfnXWch0TE": "cAQ3Px8CFkf",
        "xyTRaGxmIqP": "cAQ3Px8CFkf",
        "gR0pT6tO9e3": "cAQ3Px8CFkf",
        "l8bE0PSoXN7": "oLHWgO38pyM",
        "ssmYnXUp1Ze": "oLHWgO38pyM",
        "qNnilbXsS84": "oLHWgO38pyM",
        "wavpRgnA2GW": "eNafK1E2oMs",
        "iMzo0kpjlCR": "eNafK1E2oMs",
        "zO9KnGN4S6o": "tzrk72CReQF",
        "wtFV1sEKYDv": "tzrk72CReQF",
        "wWrTaquGpcf": "tzrk72CReQF",
        "w2JUDusKNtm": "tzrk72CReQF",
        "yCE3h0pQDkb": "tzrk72CReQF",
        "z8Vq3mn9dNH": "aMmiLUga596",
        "fcKBaXVSDJ9": "aMmiLUga596",
        "jlr3YkE8f52": "y6Bu3xGAOjf",
        "hTIJlUfgxB1": "y6Bu3xGAOjf",
        "sY3vzluKIRG": "y6Bu3xGAOjf",
        "fKjxsDk6rGO": "y6Bu3xGAOjf",
        "w3vBtmYNz8h": "nftDZQ6qL3Y",
        "tFS6n7ADvdP": "nftDZQ6qL3Y",
        "jAS1Z3iEp5t": "nftDZQ6qL3Y"
    }
] ;
