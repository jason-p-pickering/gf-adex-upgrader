export class ExportLocalPackage extends HTMLElement {
    connectedCallback() {
        this.innerHTML = ` <h2 data-i18n="export-local-package.title"></h2>
        <p data-i18n="export-local-package.content"></p>
        <button data-i18n="export-local-package.export-btn" onclick="exportLocalPackage()" id="btn-export-local-package"></button>
        <div id="upgradeStatus"></div>`
        ;
    }
}