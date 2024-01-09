import { UpdateLocalIndicators } from "../components/UpdateLocalIndicators";
customElements.define("update-local-indicators", UpdateLocalIndicators);

/* global translator */
export function showUpdateIndicatorsWorkflow() {
    document.querySelector("#appContent").innerHTML = `<backup-workflow></backup-workflow>
    <download-reference-package></download-reference-package>
    <upload-to-datastore></upload-to-datastore>
    <update-local-indicators></update-local-indicators>`;
    translator.translatePageTo();
}