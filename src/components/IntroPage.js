import { d2Fetch } from "../js/utils.js";
export async function checkForAppUpdates() {
    //Fetch a copy of th package.json from GitHub
    const response = await fetch("https://raw.githubusercontent.com/dhis2/gf-adex-flow-app/main/package.json").then((response) => {
        if (!response.ok) {
            // Handle non-successful response
            console.error("Error fetching package.json:", response.statusText);
            return;
        } else {
            //convert the response to JSON
            return response.json();
        }
    }
    );

    const remoteVersion = response.version;
    console.log("Remote version is : ", remoteVersion);
    //Get the current version of this apps API
    const installedApps = await d2Fetch("apps/");
    console.log("Installed apps: ", installedApps.length);
    var updateAvailable = false;
    installedApps.forEach((app) => {
        if (app.key === "ADEx-Flow") {
            console.log("App version is: ", app.version);
            if (app.version !== remoteVersion) {
                updateAvailable = true;
            }
        }
    });

    return updateAvailable;
}

export class IntroPage extends HTMLElement {
    connectedCallback() {

        this.innerHTML = `<h2 class="introduction" data-i18n="introduction.title"></h2>
    <p class="introduction" data-i18n="introduction.content"></p>
    `;
        checkForAppUpdates().then((updateAvailable) => {
            console.log("Update available: ", updateAvailable);
            if (updateAvailable) {
                this.innerHTML += "<p>App update is available. Please update the app from the App Management App!</p>";
            }
        });
    }
}
