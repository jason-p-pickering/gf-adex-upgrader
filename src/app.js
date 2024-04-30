"use strict";

//CSS
import "./css/style.css";
import "datatables.net-dt/css/jquery.dataTables.css";

//External libs
import Translator from "@andreasremdt/simple-translator";
import $ from "jquery";
window.$ = $;
window.jQuery = $;
import DataTable from "datatables.net";
window.DataTable = DataTable;
import * as jspdf from "jspdf";
window.jspdf = jspdf;
import "jspdf-autotable";
import * as semver from "semver";
window.semver = semver;
//JS

import { getContextPath } from "./js/utils.js";
import { uploadReferenceJson } from "./js/utils.js";
import { fetchIndicatorsFromDataStore } from "./js/utils.js";
import { upgradeIndicators } from "./js/utils.js";
import { fetchUserLocale } from "./js/utils.js";
import { exportLocalIndicators } from "./js/utils.js";
import { exportLocalConfig } from "./js/utils.js";
import { exportLocalExchange } from "./js/utils.js";
import { CurrentDate } from "./components/CurrentDate.js";
import { HeaderBar } from "./components/HeaderBar.js";
import { NavigationStrip } from "./components/NavigationStrip.js";
import { showIntroduction } from "./views/showIntroduction.js";
import { showBackupWorkflow } from "./views/showBackupWorkflow.js";
import { showDownloadReferencePackage } from "./views/showDownloadReferencePackage.js";
import { showUploadToDataStore } from "./views/showUploadToDataStore.js";
import { showUpdateIndicatorsWorkflow } from "./views/showUpdateIndicatorsWorkflow.js";
import { showExportLocalConfigWorkflow } from "./views/showExportLocalConfigWorkflow.js";
import { showImportMetadataPackage } from "./views/showImportMetadataPackage.js";
import { importMetadataPackage } from "./components/ImportMetadataPackage.js";
import { showValidationReport } from "./views/showValidationReport.js";
import { runValidation, reportToPDF, configToCSV } from "./components/ValidationReport.js";
import { updateImplType,patchIndicatorAggregateDataExportCombo  } from "./components/UpdateImplementerType.js";
import { showUpdateImplType } from "./views/showUpdateImplemeterType.js";



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

//Register the custom elements
window.customElements.define("current-date", CurrentDate);
window.customElements.define("header-bar", HeaderBar);
window.customElements.define("navigation-strip", NavigationStrip);

window.baseUrl = baseUrl;
window.uploadReferenceJson = uploadReferenceJson;
window.getIndicatorsFromDataStore = fetchIndicatorsFromDataStore;
window.upgradeIndicators = upgradeIndicators;
window.fetchUserLocale = fetchUserLocale;
window.translator = translator;
window.userLocale = userLocale;
window.exportLocalIndicators = exportLocalIndicators;
window.exportLocalConfig = exportLocalConfig;
window.showIntroduction = showIntroduction;
window.showBackupWorkflow = showBackupWorkflow;
window.showDownloadReferencePackage = showDownloadReferencePackage;
window.showUploadToDataStore = showUploadToDataStore;
window.showUpdateIndicatorsWorkflow = showUpdateIndicatorsWorkflow;
window.showExportConfigWorkflow = showExportLocalConfigWorkflow;
window.showImportMetadataPackage = showImportMetadataPackage;
window.importMetadataPackage = importMetadataPackage;
window.showValidationReport = showValidationReport;
window.runValidation = runValidation;
window.reportToPDF = reportToPDF;
window.configToCSV = configToCSV;
window.exportLocalExchange = exportLocalExchange;
window.showUpdateImplType = showUpdateImplType;
window.updateImplType = updateImplType;
window.patchIndicatorAggregateDataExportCombo = patchIndicatorAggregateDataExportCombo;

document.addEventListener("DOMContentLoaded", function () {

    fetchUserLocale().then((locale) => {
        const availableLanguages = ["en", "fr", "pt", "sv"];
        const defaultLanguage = "en";
        if (!availableLanguages.includes(locale)) {
            console.log("User locale", locale," not found in translation list. Using default language: " + defaultLanguage);
            userLocale = defaultLanguage;
        } else {
            userLocale = locale;
        }

        translator.fetch(availableLanguages, true).then(() => {
            translator.translatePageTo(userLocale);
        });
    });
});

