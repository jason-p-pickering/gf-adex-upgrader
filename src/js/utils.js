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
        "indicators.json?filter=name:$like:[GFADEX]&fields=id,name,shortName,code,indicatorType," +
        "numerator,numeratorDescription,denominator,denominatorDescription," +
        "decimals,aggregateExportAttributeOptionCombo,sharing&paging=false"
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

export async function importNewIndicators() {
    //Get the remote indicators from the datastore
    const remoteIndicators = await getIndicatorsFromDataStore();
    //Get the existing indicators from the DHIS2 instance
    const existingIndicators = await fetchIndicators();
    //Find all of the remoteIndicators which do not exist in the existingIndicators
    const newIndicators = remoteIndicators.indicators.filter(function (remoteIndicator) {
        return !existingIndicators.some(function (existingIndicator) {
            return existingIndicator.id === remoteIndicator.id;
        });
    });
    if (newIndicators.length > 0) {
        //Put each new indicator into the upload.indicators array
        var upload = {
            indicators: []
        };
        newIndicators.forEach(function (newIndicator) {
            upload.indicators.push(newIndicator);
        });
        //Upload the new indicators to the metadata
        //enpoint. Alert the user if an error occurs.
        fetch(baseUrl + "metadata", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(upload),
        })
            .then((response) => response.json())
            .then((data) => {
                console.log("Response from server:", data);
                alert(newIndicators.length + "new indicators uploaded successfully!");
            })
            .catch((error) => {
                console.error("Error uploading new indicators:", error);
                alert("Error uploading new indicators. Please try again.");
            });
    }
}

export async function upgradeExistingIndicators(remoteIndicators, existingIndicators) {
    //We need to update all properties on the indicators except for the id and numerator
    //Get the remote indicators from the datastore
    console.log("Existing indicators:", existingIndicators);
    existingIndicators.forEach(function (existingIndicator) {
        var remoteIndicator = remoteIndicators.indicators.find(function (remoteIndicator) {
            return remoteIndicator.id === existingIndicator.id;
        });

        if (remoteIndicator) {
            //Update the existing indicator
            existingIndicator.name = remoteIndicator.name;
            existingIndicator.shortName = remoteIndicator.shortName;
            existingIndicator.code = remoteIndicator.code;
            existingIndicator.denominator = remoteIndicator.denominator;
            existingIndicator.decimals = remoteIndicator.decimals;
            existingIndicator.aggregateExportAttributeOptionCombo = remoteIndicator.aggregateExportAttributeOptionCombo;
        }
    });
    //Put each updated indicator into the upload.indicators array
    var upload = {
        indicators: []
    };
    existingIndicators.forEach(function (existingIndicator) {
        upload.indicators.push(existingIndicator);
    });
    //Upload the updated indicators to the metadata
    //enpoint. Alert the user if an error occurs.
    fetch(baseUrl + "metadata", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(upload),
    })
        .then((response) => response.json())
        .then((data) => {
            console.log("Response from server:", JSON.stringify(data));
            alert("GFADEX indicators upgraded successfully!");
        })
        .catch((error) => {
            console.error("Error upgrading existing indicators:", error);
            alert("Error upgrading existing indicators. Please try again.");
        });
}

export async function upgradeIndicators() {
    const remoteIndicators = await getIndicatorsFromDataStore();
    await importNewIndicators();
    const existingIndicators = await fetchIndicators();
    await upgradeExistingIndicators(remoteIndicators, existingIndicators);

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

        // Manipulate the JSON data as needed
        const manipulatedData = JSON.parse(jsonData);

        // Now, you can send the manipulated data to the server
        const apiUrl =  baseUrl + "dataStore/gfadex/remote";

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
                    body: JSON.stringify(manipulatedData),
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
