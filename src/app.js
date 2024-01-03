"use strict";

//CSS
import "./css/style.css";

//JS
import { getContextPath } from "./js/utils.js";
import { uploadReferenceJson } from "./js/utils.js";
import { getIndicatorsFromDataStore } from "./js/utils.js";
import { upgradeIndicators } from "./js/utils.js";
import { fetchUserLocale } from "./js/utils.js";
import { backupLocalConfig } from "./js/utils.js";
import Translator from "@andreasremdt/simple-translator";

var baseUrl = getContextPath() + "/api/";
var userLocale = false;
const appLocation = window.location.pathname;
const appFolder = appLocation.substring(0, appLocation.lastIndexOf("/"));
const i18nLocation = appFolder + "/i18n/";

var translator = new Translator({
    defaultLanguage : "en",
    persist : true,
    registerGlobally: "__",
    debug : true,
    filesLocation : i18nLocation}
);
console.log("Translator is : ", translator.defaultLanguage);

window.baseUrl = baseUrl;
window.uploadReferenceJson = uploadReferenceJson;
window.getIndicatorsFromDataStore = getIndicatorsFromDataStore;
window.upgradeIndicators = upgradeIndicators;
window.fetchUserLocale = fetchUserLocale;
window.translator = translator;
window.userLocale = userLocale;
window.backupLocalConfig = backupLocalConfig;

let input = document.querySelector("#jsonFileInput");
let uploadButton = document.querySelector("#upload-btn");

input.addEventListener("input", () => {
    if (input.files.length > 0) {
        uploadButton.disabled = false;
    } else {
        uploadButton.disabled = true;
    }
});

document.addEventListener("DOMContentLoaded", function () {
    fetchUserLocale().then((locale) => {
        console.log("Detected locale is : ", locale);
        const availableLanguages = ["en", "fr", "pt", "sv"];
        const defaultLanguage = "en";
        //If the user locale is not in the tranlsation list, use the default language
        if (!availableLanguages.includes(locale)) {
            locale = defaultLanguage;
        }
        //Set the global user locale
        userLocale = locale;
        console.log("User locale is : ", userLocale);
        translator.fetch(availableLanguages, true).then(() => {
        // -> Translations are ready...
            translator.translatePageTo(userLocale);
        });
    });
});

