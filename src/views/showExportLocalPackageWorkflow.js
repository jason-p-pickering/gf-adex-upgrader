import { ExportLocalPackage } from "../components/ExportLocalPackage.js";
customElements.define("export-local-package", ExportLocalPackage);

/* global translator */
export function showExportLocalPackageWorkflow() {
    document.querySelector("#appContent").innerHTML = "<export-local-package></export-local-package><upgrade-status></upgrade-status>";
    translator.translatePageTo();
}