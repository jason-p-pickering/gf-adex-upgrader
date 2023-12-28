"use strict";

//CSS
import "./css/style.css";

//JS
import {getContextPath} from "./js/utils.js";
import {uploadReferenceJson} from "./js/utils.js";
import {getIndicatorsFromDataStore} from "./js/utils.js";
import { upgradeIndicators } from "./js/utils.js";
import { fetchUserLocale } from "./js/utils.js";
import { emitIntroduction } from "./js/utils.js";

var baseUrl = getContextPath() + "/api/";
var userLocale = "en";
console.log("Baseurl is : ", baseUrl);

window.baseUrl = baseUrl;
window.uploadReferenceJson = uploadReferenceJson;
window.getIndicatorsFromDataStore = getIndicatorsFromDataStore;
window.upgradeIndicators = upgradeIndicators;
window.userLocale = userLocale;
window.fetchUserLocale = fetchUserLocale;
window.emitIntroduction = emitIntroduction;

document.addEventListener("DOMContentLoaded", function () {
    userLocale = fetchUserLocale();
    emitIntroduction();

});