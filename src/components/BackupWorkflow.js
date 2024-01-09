export class BackupWorkflow extends HTMLElement {
    connectedCallback() {
        this.innerHTML = `<h2 class="backup-config" data-i18n="backup-config.title"></h2>
    <p class="backup-config" data-i18n="backup-config.content"></p>
    <button data-i18n="backup-config.backup-btn" onclick="exportLocalIndicators()" id="btn-backup-local-config"></button>
    <div id="upgradeStatus"></div>`;
    }
}