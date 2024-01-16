export class ExportLocalConfig extends HTMLElement {
    connectedCallback() {
        this.innerHTML = ` <h2 data-i18n="export-local-config.title"></h2>
        <p data-i18n="export-local-config.content"></p>
        <input type="checkbox" id="only-configured-indicators" checked>
        <label for="only-configured-indicators" data-i18n="export-local-config.configured-only">Configured only</label>
        <p/>
        <button data-i18n="export-local-config.export-btn" onclick="exportLocalConfig()" id="btn-export-local-package"></button>`
        ;
    }
}