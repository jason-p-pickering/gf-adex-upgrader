
import {UpdateImplementerType} from "../components/UpdateImplementerType.js";
window.customElements.define("update-impl-type", UpdateImplementerType);

/* global translator */
export function showUpdateImplType() {
    document.querySelector("#appContent").innerHTML = "<update-impl-type></update-impl-type>";
    translator.translatePageTo();
}

