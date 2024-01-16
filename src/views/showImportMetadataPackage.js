
import { ImportMetadataPackage } from "../components/ImportMetadataPackage";
customElements.define("import-metadata-package", ImportMetadataPackage);

/* global translator */
export function showImportMetadataPackage() {
    document.querySelector("#appContent").innerHTML = "<download-reference-package></download-reference-package><upload-to-datastore></upload-to-datastore><import-metadata-package></import-metadata-package>";
    translator.translatePageTo();
}