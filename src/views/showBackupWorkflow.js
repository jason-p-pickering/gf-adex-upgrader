import { BackupWorkflow } from "../components/BackupWorkflow.js";
customElements.define("backup-workflow", BackupWorkflow);

/* global translator */
export function showBackupWorkflow() {
    document.querySelector("#appContent").innerHTML = "<backup-workflow></backup-workflow>";
    translator.translatePageTo();
}