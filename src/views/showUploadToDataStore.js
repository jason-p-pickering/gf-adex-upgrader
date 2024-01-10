import { UploadToDataStore } from "../components/UploadToDataStore.js";
customElements.define("upload-to-datastore", UploadToDataStore);

/* global translator */
export function showUploadToDataStore() {
    document.querySelector("#appContent").innerHTML = "<upload-to-datastore></upload-to-datastore>";
    translator.translatePageTo();
}