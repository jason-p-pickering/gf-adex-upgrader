
import { ImportDataExchange } from "../components/ImportDataExchange";
customElements.define("import-data-exchange", ImportDataExchange);

/* global translator */
export function showImportDataExchange() {
    document.querySelector("#appContent").innerHTML = "<import-data-exchange></import-data-exchange>";
    translator.translatePageTo();
}