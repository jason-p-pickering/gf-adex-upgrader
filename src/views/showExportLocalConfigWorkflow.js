import { ExportLocalConfig } from "../components/ExportLocalConfig.js";
customElements.define("export-local-config", ExportLocalConfig);

/* global translator */
export function showExportLocalConfigWorkflow() {
    document.querySelector("#appContent").innerHTML = `
    <export-local-config></export-local-config>
    <upgrade-status></upgrade-status>`;
    translator.translatePageTo();
}