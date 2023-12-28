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

export var baseUrl = getContextPath() + "/api/";

async function d2Fetch(endpoint) {
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
async function fetchIndicators() {
    var data = await d2Fetch(
        "indicators.json?filter=name:$like:[GFADEX]&fields=:owner&paging=false"
    );
    if (!data || data.indicators.length === 0) {
        console.log("No GF ADEx indicators found");
        return false;
    } else {
        return data.indicators;
    }
}

export function getIndicatorsFromDataStore() {
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

export async function upgradeExistingIndicators(remote, existingIndicators) {

    //If we have existing indicators, update them with the existing inidcators numerator
    if (existingIndicators) {
        remote.indicators.forEach((remoteIndicator) => {
            const existingIndicator = existingIndicators.find(
                (indicator) => indicator.id === remoteIndicator.id
            );

            if (existingIndicator) {
                remoteIndicator.numerator = existingIndicator.numerator;
            }
        });
    }

    //Upload the rest of the metadata package to the /metadata
    //endpoint. Alert the user if an error occurs.
    fetch(baseUrl + "metadata", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(remote),
    })
        .then((response) => response.json())
        .then((data) => {
            renderUpgradeStatusReport(data);
        })
        .catch((error) => {
            console.error("Error upgrading existing GF metadata:", error);
            alert("Error upgrading existing GF metadata. Please try again.");
        });
}


function renderUpgradeStatusReport(statusReport) {
    //Just display the raw JSON as text
    // var html = "<h3>Upgrade Status Report</h3>";
    // html += "<pre>" + JSON.stringify(statusReport, null, 2) + "</pre>";
    // eslint-disable-next-line no-undef
    console.log(statusReport);
    var html = generateSummaryTable(statusReport);
    document.querySelector("#upgradeStatus").innerHTML = html;
    document.querySelector("#update-gf-metadata-btn").disabled = false;
}

export async function upgradeIndicators() {
    //Disable the update button
    document.querySelector("#update-gf-metadata-btn").disabled = true;
    const remoteIndicators = await getIndicatorsFromDataStore();
    const existingIndicators = await fetchIndicators();
    upgradeExistingIndicators(remoteIndicators, existingIndicators);
}

export function verifyRemoteMetadata(remote) {

    //Should contain attributes, indicators, indicatorTypes, userGroups, indicators, indicatorGroups only
    //Get the names from the remote object
    const remoteNames = Object.keys(remote);
    const expectedNames = [
        "attributes",
        "indicatorTypes",
        "userGroups",
        "indicators",
        "indicatorGroups",
    ];
    //Return false if the remote object does not contain the expected names
    const validKeys = expectedNames.every((name) => remoteNames.includes(name));

    //Verify that all indicators contian GFADEX in the name
    const remoteIndicators = remote.indicators;
    const remoteIndicatorNames = remoteIndicators.map((indicator) => indicator.name);
    const validNumeratorNames = remoteIndicatorNames.every((name) => name.includes("GFADEX"));

    return validKeys && validNumeratorNames;
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

        // We need to verify that the JSON is valid before we send it to the server
        const remoteMetadata = JSON.parse(jsonData);
        const isValid = verifyRemoteMetadata(remoteMetadata);
        if (!isValid) {
            alert("The JSON file you uploaded is not valid. Please verify and try again.");
            return;
        }

        // Now, you can send the manipulated data to the server
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
                        document.querySelector("#update-gf-metadata-btn").disabled = false;
                        alert("JSON uploaded and processed successfully!");
                    })
                    .catch((error) => {
                        console.error("Error uploading and processing JSON:", error);
                        alert("Error uploading and processing JSON. Please try again.");
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

    const tableHeaders = ["Object Type", "Created", "Updated", "Deleted", "Ignored", "Total"];

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
        return `<tr>${rowValues.map((value) => `<td>${value}</td>`).join("")}</tr>`;
    });

    const tableHTML = `
          <table border="1">
            <thead>
              <tr>${tableHeaders.map((header) => `<th>${header}</th>`).join("")}</tr>
            </thead>
            <tbody>
              ${tableRows.join("")}
            </tbody>
          </table>
        `;
    var html = "<h3>Upgrade Status Report</h3>";
    html += "<h3>Status:" + data.httpStatus + "</h3>";
    html += "<h3>Status Code:" + data.httpStatusCode + "</h3>";
    html += tableHTML;

    return html;
}
