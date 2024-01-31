export class ImportDataExchange extends HTMLElement {
    connectedCallback() {
        this.innerHTML = `<h2 data-i18n="import-exchange.title"></h2>
    <p data-i18n="import-exchange.content"></p>
    <div class="upload-btn-wrapper" style="margin-bottom: 20px;">
    <button class="btnr" data-i18n="upload-btn.choose">Choose file</button>
    <span data-i18n="upload-btn.no-file-chosen" id="dataExchangeJson">No file chosen</span>
    <input type="file" id="dataExchangeJson" accept=".json" />
    </div>
    <div style="margin-bottom: 20px;">
    <span data-i18n="import-exchange.pat" id="dataExchangePAT">PAT</span>
    <input type="password" id="dataExchangePAT"/>
    </div>
    <div>
    <span data-i18n="import-exchange.target-url" id="dataExchangePHT">URL</span>
    <input type="text" id="targetURL"/>
    </div>
    <div style="margin-top: 20px;">
    <button id="import-exchange-btn" onclick="importDataExchange()" data-i18n="import-exchange.import-btn"></button>
    </div>
    <div id="import-exchange-status"><upgrade-status></upgrade-status></div>`;
    }
}
