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
    var html = "<h3>Upgrade Status Report</h3>";
    html += "<pre>" + JSON.stringify(statusReport, null, 2) + "</pre>";
    // eslint-disable-next-line no-undef
    document.querySelector("#upgradeStatus").innerHTML = html;
}

export async function upgradeIndicators() {
    //Disable the update button
    document.querySelector("#updateIndicatorsButton").disabled = true;
    const remoteIndicators = await getIndicatorsFromDataStore();
    const existingIndicators = await fetchIndicators();
    upgradeExistingIndicators(remoteIndicators, existingIndicators);
    document.querySelector("#updateIndicatorsButton").disabled = false;
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
                    .then((data) => {
                        console.log("Response from server:", data);
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


export function fetchUserLocale() {
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

export function emitEnglishVersion() {
    let html = "<h2>How to use the app</h1>";
    html += "<p>This app will help you to update to the latest version of the GF ADEx metadata package.</p>";
    html += "<p>Follow the steps below to upgrade the package.</p>";
    html += "All GF ADEX related metadata such as indicators, indicator groups will be updated.</p>";
    html += "<p><strong>ny changes which you have made to the numerator definitions will be preserved.</strong></p>";
    html += "<h2>Step 1: Download the GF metadata package from GitHub.</h2>";
    html += "<p>Save a copy of this file locally.</p>";
    html += "<h2>Step 2: Upload a copy of the GF ADEX metadata to the DHIS2 datastore.</h2>";
    html += "<p>Using the file which you downloaded from Step 1, choose the file to upload it and then click \"Upload GFADEx template\"</p>";
    html += "<p>This will save a copy of the GF ADEx metadata in the local datastore.</p>";
    html += "<div>";
    html += "<input type=\"file\" id=\"jsonFileInput\" accept=\".json\">";
    html += "</p>";
    html += "</div>";
    html += "<div>";
    html += "<button onclick=\"uploadReferenceJson()\">Upload GFADex template</button>";
    html += "</div>";
    html += "<h2>Step 3: Update GFADex metadata</h2>";
    html += "<p>Once you have completed Step 1 and 2, click the \"Update GF ADEx Metadata button below.</p>";
    html += "<p>The process should complete fairly quickly, but this will depend on the speed and load of your server.</p>";
    html += "<p>Once the process compeltes, you will see a summary of the import process below.</p>";
    html += "<button id=\"updateIndicatorsButton\" onclick=\"upgradeIndicators()\">Update GF ADEx Metadata</button>";
    html += "</div>";
    html += "<div id=\"upgradeStatus\">";
    html += "</div>";
    return html;
}

export function emitFrenchVersion() {
    let html = "<h2>Comment utiliser l'application</h1>";
    html += "<p>Cette application vous aidera à mettre à jour les indicateurs GF ADEx vers la dernière version du modèle GF ADEx.</p>";
    html += "<p>Suivez les étapes ci-dessous pour mettre à jour les indicateurs.</p>";
    html += "<p>Les propriétés telles que les noms, les noms courts et les codes seront mis à jour.</p>";
    html += "<p>Toute modification que vous avez apportée aux définitions du numérateur sera conservée.</p>";
    html += "<h2>Étape 1: Téléchargez les indicateurs de référence depuis Github.</h2>";
    html += "<p>Téléchargez une copie des indicateurs Global Fund ADEx depuis GitHub ici et enregistrez-les localement.</p>";
    html += "<h2>Étape 2: Téléchargez une copie des indicateurs dans le datastore DHIS2.</h2>";
    html += "<p>A l'aide du fichier que vous avez téléchargé à l'étape 1, choisissez le fichier à télécharger et cliquez sur \"Télécharger le modèle GFADEx\"</p>";
    html += "<p>Cela enregistrera une copie des indicateurs GF dans le datastore local.</p>";
    html += "<div>";
    html += "<input type=\"file\" id=\"jsonFileInput\" accept=\".json\">";
    html += "</p>";
    html += "</div>";
    html += "<div>";
    html += "<button onclick=\"uploadReferenceJson()\">Télécharger le modèle GFADex</button>";
    html += "</div>";
    html += "<h2>Étape 3: Mettre à jour les indicateurs GFADex</h2>";
    html += "<p>Une fois que vous avez terminé les étapes 1 et 2, cliquez sur le bouton \"Mettre à jour les indicateurs GF ADEx ci-dessous.</p>";
    html += "<p>Le processus devrait se terminer assez rapidement, mais cela dépendra de la vitesse et de la charge de votre serveur.</p>";
    html += "<p>Une fois le processus terminé, vous verrez un résumé du processus d'importation ci-dessous.</p>";
    html += "<button id=\"updateIndicatorsButton\" onclick=\"upgradeIndicators()\">Mettre à jour les indicateurs GF ADEx</button>";
    html += "</div>";
    html += "<div id=\"upgradeStatus\">";
    html += "</div>";
    return html;
}


export async function emitIntroduction() {
    let locale = await fetchUserLocale();
    if (locale === "fr") {
        document.querySelector("#appContent").innerHTML = emitFrenchVersion();
    } else {
        document.querySelector("#appContent").innerHTML = emitEnglishVersion();
    }
}