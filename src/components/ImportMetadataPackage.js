"use strict";

import { d2Fetch } from "../js/utils.js";
import { fetchIndicatorsFromDataStore } from "../js/utils.js";
import { renderUpgradeStatusReport } from "../js/utils.js";
import { baseUrl } from "../js/utils.js";

async function checkExistingPackage() {
    //Get ADEX indicators from the API
    var adexIndicators = await d2Fetch(
        "indicators.json?filter=name:$like:[GFADEX]&fields=:owner&paging=false"
    );

    //Alert the user if any ADEX indicators are already present
    if (adexIndicators.indicators.length > 0) {
        alert(translator.translateForKey("import-package.existing-package-warning"));
        return true;
    } else {
        return false;
    }
}

/* global translator, __ */
export function importMetadataPackage() {
    checkExistingPackage().then((packageExists) => {

        if (!packageExists) {
        //Get the indicators from the datastore
            fetchIndicatorsFromDataStore().then((payload) => {
                const indicatorsToDeleteList = [];
                //Post this to the API
                fetch(baseUrl + "metadata", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(payload),
                })
                    .then((response) => response.json())
                    .then((data) => {
                        renderUpgradeStatusReport(data, indicatorsToDeleteList);
                    })
                    .catch((error) => {
                        console.error("Error while importing GF ADEX indicators.", error);
                        alert(__("upgrade-error"));
                    });
            });
        }});

}



export class ImportMetadataPackage extends HTMLElement {
    connectedCallback() {
        this.innerHTML = `<h2 data-i18n="import-package.title"></h2>
    <p data-i18n="import-package.content"></p>
    <button id="import-gf-pacakge-btn" onclick="importMetadataPackage()" data-i18n="import-package.import-btn"></button>
    <upgrade-status></upgrade-status>
    `;
    }
}
