"use strict";

//CSS
import "./css/style.css";

//JS
import {getContextPath} from "./js/utils.js";
import {uploadReferenceJson} from "./js/utils.js";
import {getIndicatorsFromDataStore} from "./js/utils.js";
import { upgradeIndicators } from "./js/utils.js";
import { fetchUserLocale } from "./js/utils.js";
import Translator from '@andreasremdt/simple-translator';

var translator = new Translator();

var baseUrl = getContextPath() + "/api/";

console.log("Baseurl is : ", baseUrl);

window.baseUrl = baseUrl;
window.uploadReferenceJson = uploadReferenceJson;
window.getIndicatorsFromDataStore = getIndicatorsFromDataStore;
window.upgradeIndicators = upgradeIndicators;
window.fetchUserLocale = fetchUserLocale;

let input = document.querySelector("#jsonFileInput");
let uploadButton = document.querySelector("#upload-btn");

input.addEventListener("input", function(e) {
  if (input.files.length > 0) {
    uploadButton.disabled = false;
  } else {
    uploadButton.disabled = true;
  }
})

document.addEventListener("DOMContentLoaded", function () {
  fetchUserLocale().then((userLocale) => {
    const availableLanguages = ['en', 'fr', 'pt', 'sv'];
    const defaultLanguage = 'en';
    //If the user locale is not in the tranlsation list, use the default language
    if (!availableLanguages.includes(userLocale)) {
      userLocale = defaultLanguage;
    }

    translator.fetch(userLocale).then(() => {
      // -> Translations are ready...
      translator.translatePageTo(userLocale);
    });
  });
});