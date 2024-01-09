import { DownloadReferencePackage } from "../components/DownloadReferencePackage";
customElements.define("download-reference-package", DownloadReferencePackage);

/* global translator */
export function showDownloadReferencePackage() {
    document.querySelector("#appContent").innerHTML = "<download-reference-package></download-reference-package>";
    translator.translatePageTo();
}