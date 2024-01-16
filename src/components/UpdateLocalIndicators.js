export class UpdateLocalIndicators extends HTMLElement {
    connectedCallback() {
        this.innerHTML = `<h2 data-i18n="update-local.title"></h2>
        <p data-i18n="update-local.content"></p>
        <button id="update-gf-metadata-btn" onclick="upgradeIndicators()" data-i18n="update-metadata-btn"></button>
        `;
    }
}