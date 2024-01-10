import {BackupWorkflow} from "../components/BackupWorkflow.js";
import {UpgradeStatus} from "../components/UpgradeStatus.js";

window.customElements.define("backup-workflow", BackupWorkflow);
window.customElements.define("upgrade-status", UpgradeStatus);

/* global translator */
export function showBackupWorkflow() {
    document.querySelector("#appContent").innerHTML = "<backup-workflow></backup-workflow><upgrade-status></upgrade-status>";
    translator.translatePageTo();
}

