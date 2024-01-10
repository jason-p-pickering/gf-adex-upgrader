import { ValidationReport } from "../components/ValidationReport.js";
customElements.define("validation-report", ValidationReport);

/* global translator */
export function showValidationReport() {
    document.querySelector("#appContent").innerHTML = "<validation-report></validation-report>";
    translator.translatePageTo();
}