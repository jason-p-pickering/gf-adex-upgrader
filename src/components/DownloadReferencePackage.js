export class DownloadReferencePackage extends HTMLElement {
    connectedCallback() {
        this.innerHTML = `<h2 data-i18n="download-package.title"></h2>
        <p data-i18n="download-package.content"></p>`;
    }
}